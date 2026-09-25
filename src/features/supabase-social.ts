import type { Database, NotificationType } from '@/types/database';
import { supabase } from '@/lib/supabase';
import { decode } from 'base64-arraybuffer';
import type { Comment, Post, RepostContext, User } from './mock-data';

type ProfileRow = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'username' | 'display_name' | 'bio' | 'avatar_path' | 'cover_path'>;
type PostRow = Pick<Database['public']['Tables']['posts']['Row'], 'id' | 'user_id' | 'body' | 'image_path' | 'created_at'>;
type EngagementRow = Pick<Database['public']['Tables']['reposts']['Row'], 'post_id' | 'user_id' | 'created_at'>;
type CommentRow = Pick<Database['public']['Tables']['comments']['Row'], 'id' | 'post_id' | 'user_id' | 'parent_comment_id' | 'body' | 'image_path' | 'created_at'>;
type CommentCleanupRow = Pick<Database['public']['Tables']['comments']['Row'], 'id' | 'user_id' | 'parent_comment_id' | 'image_path'>;
type NotificationRow = Pick<Database['public']['Tables']['notifications']['Row'], 'id' | 'recipient_id' | 'actor_id' | 'type' | 'post_id' | 'comment_id' | 'created_at' | 'read_at'>;
type PostEngagement = { likes: number; reposts: number; liked: boolean; reposted: boolean; repost?: RepostContext };

const profileColumns = 'id, username, display_name, bio, avatar_path, cover_path';
const postColumns = 'id, user_id, body, image_path, created_at';
export type ImageBucket = 'avatars' | 'covers' | 'post-images' | 'comment-images';
export type ProfileImageField = 'avatar_path' | 'cover_path';
export type FollowSummary = { followers: number; following: number; isFollowing: boolean };
export type ProfileSearchResult = { id: string; username: string; name: string; avatar: string | null };
export type UserRepostRow = Pick<Database['public']['Tables']['reposts']['Row'], 'post_id' | 'created_at'>;
export type SocialNotification = {
  id: string;
  recipientId: string;
  actorId: string;
  actor: User;
  type: NotificationType;
  postId: string | null;
  commentId: string | null;
  createdAt: string;
  time: string;
  readAt: string | null;
};

export async function getNotifications(recipientId: string): Promise<SocialNotification[]> {
  const { data: rows, error } = await supabase.from('notifications')
    .select('id, recipient_id, actor_id, type, post_id, comment_id, created_at, read_at')
    .eq('recipient_id', recipientId)
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  if (!rows.length) return [];

  const actorIds = [...new Set(rows.map((row) => row.actor_id))];
  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select(profileColumns)
    .in('id', actorIds);
  if (profilesError) throw profilesError;

  const profileRows = profiles ?? [];
  const avatarUrls = await resolveSignedUrls('avatars', profileRows.map((profile) => profile.avatar_path));
  const actors = new Map(profileRows.map((profile) => [profile.id, toAppUser(
    profile,
    profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null,
  )]));
  return rows.map((row) => toSocialNotification(row, actors.get(row.actor_id)));
}

export async function getUnreadNotificationCount(recipientId: string): Promise<number> {
  const { count, error } = await supabase.from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('recipient_id', recipientId)
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}

export async function markSupabaseNotificationRead(notificationId: string, recipientId: string, readAt: string): Promise<boolean> {
  const { data, error } = await supabase.from('notifications').update({ read_at: readAt })
    .eq('id', notificationId)
    .eq('recipient_id', recipientId)
    .is('read_at', null)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  return data !== null;
}

export async function markAllSupabaseNotificationsRead(recipientId: string, readAt: string): Promise<void> {
  const { error } = await supabase.from('notifications').update({ read_at: readAt })
    .eq('recipient_id', recipientId)
    .is('read_at', null);
  if (error) throw error;
}

export async function getCommentsForPost(postId: string): Promise<Comment[]> {
  const { data: rows, error } = await supabase.from('comments')
    .select('id, post_id, user_id, parent_comment_id, body, image_path, created_at')
    .eq('post_id', postId)
    .order('created_at', { ascending: true });
  if (error) throw error;
  if (!rows.length) return [];

  const userIds = [...new Set(rows.map((row) => row.user_id))];
  const { data: profiles, error: profilesError } = await supabase.from('profiles')
    .select(profileColumns)
    .in('id', userIds);
  if (profilesError) throw profilesError;

  const profileRows = profiles ?? [];
  const [avatarUrls, commentImageUrls] = await Promise.all([
    resolveSignedUrls('avatars', profileRows.map((profile) => profile.avatar_path)),
    resolveSignedUrls('comment-images', rows.map((row) => row.image_path)),
  ]);
  const authors = new Map(profileRows.map((profile) => [profile.id, toAppUser(
    profile,
    profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null,
  )]));
  return rows.map((row) => toAppComment(
    row,
    authors.get(row.user_id),
    row.image_path ? commentImageUrls.get(row.image_path) : undefined,
  ));
}

export async function createSupabaseComment(postId: string, userId: string, body: string, parentCommentId: string | null, imageBase64?: string | null): Promise<Comment> {
  const text = body.trim();
  if (!text && !imageBase64) throw new Error('Escribe un comentario o agrega una imagen antes de enviarlo.');
  let imagePath: string | null = null;
  let data: CommentRow;
  try {
    if (imageBase64) imagePath = await uploadUserImage('comment-images', userId, imageBase64);
    const result = await supabase.from('comments').insert({
      post_id: postId,
      user_id: userId,
      parent_comment_id: parentCommentId,
      body: text,
      image_path: imagePath,
    }).select('id, post_id, user_id, parent_comment_id, body, image_path, created_at').single();
    if (result.error) throw result.error;
    data = result.data;
  } catch (error) {
    if (imagePath) {
      try {
        await deleteUserImage('comment-images', userId, imagePath);
      } catch (cleanupError) {
        console.warn('No se pudo limpiar la imagen del comentario que no llegó a guardarse:', cleanupError);
      }
    }
    throw error;
  }

  const imageUrls = await resolveSignedUrls('comment-images', [data.image_path]);
  try {
    const profile = await getProfileById(userId);
    if (profile) {
      const urls = await resolveSignedUrls('avatars', [profile.avatar_path]);
      const author = toAppUser(profile, profile.avatar_path ? urls.get(profile.avatar_path) ?? null : null);
      return toAppComment(data, author, data.image_path ? imageUrls.get(data.image_path) : undefined);
    }
  } catch (profileError) {
    console.warn('No se pudo cargar el perfil del comentario recién creado:', profileError);
  }
  return toAppComment(data, undefined, data.image_path ? imageUrls.get(data.image_path) : undefined);
}

export async function deleteSupabaseComment(commentId: string, userId: string, postId: string): Promise<void> {
  const allRows: CommentCleanupRow[] = [];
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('comments')
      .select('id, user_id, parent_comment_id, image_path')
      .eq('post_id', postId)
      .order('created_at', { ascending: true })
      .range(from, from + pageSize - 1);
    if (error) throw error;
    allRows.push(...data);
    if (data.length < pageSize) break;
    from += pageSize;
  }
  const descendants = new Set([commentId]);
  const childIdsByParent = new Map<string, string[]>();
  for (const row of allRows) {
    if (!row.parent_comment_id) continue;
    childIdsByParent.set(row.parent_comment_id, [...(childIdsByParent.get(row.parent_comment_id) ?? []), row.id]);
  }
  const pendingIds = [commentId];
  while (pendingIds.length) {
    const parentId = pendingIds.pop();
    if (!parentId) continue;
    for (const childId of childIdsByParent.get(parentId) ?? []) {
      if (descendants.has(childId)) continue;
      descendants.add(childId);
      pendingIds.push(childId);
    }
  }
  const { data, error } = await supabase.from('comments').delete()
    .eq('id', commentId)
    .eq('user_id', userId)
    .eq('post_id', postId)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('No pudimos borrar el comentario. Comprueba que sea tuyo y vuelve a intentarlo.');

  const ownedImagePaths = allRows
    .filter((row) => descendants.has(row.id) && row.user_id === userId && row.image_path)
    .map((row) => row.image_path as string);
  try {
    await deleteUserImages('comment-images', userId, ownedImagePaths);
  } catch (cleanupError) {
    console.warn('No se pudieron limpiar todas las imágenes de los comentarios borrados:', cleanupError);
  }
}

async function getCommentCounts(postIds: string[]): Promise<Map<string, number>> {
  const counts = new Map<string, number>();
  if (!postIds.length) return counts;
  const pageSize = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from('comments').select('post_id')
      .in('post_id', postIds)
      .order('post_id')
      .range(from, from + pageSize - 1);
    if (error) throw error;
    for (const row of data) counts.set(row.post_id, (counts.get(row.post_id) ?? 0) + 1);
    if (data.length < pageSize) return counts;
    from += pageSize;
  }
}

export function toAppUser(profile: ProfileRow, avatarUrl: string | null = null, coverUrl: string | null = null): User {
  return {
    id: profile.id,
    username: profile.username,
    name: profile.display_name,
    bio: profile.bio,
    avatar: avatarUrl,
    cover: coverUrl,
  };
}

export async function getAppUser(profile: ProfileRow): Promise<User> {
  const [avatars, covers] = await Promise.all([
    resolveSignedUrls('avatars', [profile.avatar_path]),
    resolveSignedUrls('covers', [profile.cover_path]),
  ]);
  return toAppUser(profile, profile.avatar_path ? avatars.get(profile.avatar_path) ?? null : null, profile.cover_path ? covers.get(profile.cover_path) ?? null : null);
}

export async function getProfileById(id: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles')
    .select(profileColumns)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function getProfileByUsername(username: string): Promise<ProfileRow | null> {
  const { data, error } = await supabase.from('profiles')
    .select(profileColumns)
    .eq('username', username.toLowerCase())
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function searchProfiles(query: string, limit = 20): Promise<ProfileSearchResult[]> {
  const term = query.trim().replace(/^@/, '');
  if (!term) return [];
  const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`;
  const columns = 'id, username, display_name, avatar_path';
  const [usernameResult, displayNameResult] = await Promise.all([
    supabase.from('profiles').select(columns).ilike('username', pattern).order('username').limit(limit),
    supabase.from('profiles').select(columns).ilike('display_name', pattern).order('display_name').limit(limit),
  ]);
  if (usernameResult.error) throw usernameResult.error;
  if (displayNameResult.error) throw displayNameResult.error;

  const byId = new Map<string, (typeof usernameResult.data)[number]>();
  for (const profile of [...usernameResult.data, ...displayNameResult.data]) {
    if (!byId.has(profile.id)) byId.set(profile.id, profile);
    if (byId.size >= limit) break;
  }
  const profiles = [...byId.values()];
  const avatarUrls = await resolveSignedUrls('avatars', profiles.map((profile) => profile.avatar_path));
  return profiles.map((profile) => ({
    id: profile.id,
    username: profile.username,
    name: profile.display_name,
    avatar: profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null,
  }));
}

export async function getRepostsByUser(userId: string): Promise<UserRepostRow[]> {
  const { data, error } = await supabase.from('reposts')
    .select('post_id, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data;
}

export async function getRepostContext(postId: string, userId: string): Promise<RepostContext | null> {
  const { data, error } = await supabase.from('reposts').select('created_at')
    .eq('post_id', postId)
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const profile = await getProfileById(userId);
  if (!profile) return null;
  const avatarUrls = await resolveSignedUrls('avatars', [profile.avatar_path]);
  const avatar = profile.avatar_path ? avatarUrls.get(profile.avatar_path) ?? null : null;
  return { user: toAppUser(profile, avatar), createdAt: data.created_at, time: relativeTime(data.created_at) };
}

export async function getFollowSummary(profileId: string, viewerId: string): Promise<FollowSummary> {
  const [followersResult, followingResult, relationshipResult] = await Promise.all([
    supabase.from('follows').select('follower_id', { count: 'exact', head: true }).eq('following_id', profileId),
    supabase.from('follows').select('following_id', { count: 'exact', head: true }).eq('follower_id', profileId),
    supabase.from('follows').select('follower_id').eq('follower_id', viewerId).eq('following_id', profileId).maybeSingle(),
  ]);
  if (followersResult.error) throw followersResult.error;
  if (followingResult.error) throw followingResult.error;
  if (relationshipResult.error) throw relationshipResult.error;
  return {
    followers: followersResult.count ?? 0,
    following: followingResult.count ?? 0,
    isFollowing: Boolean(relationshipResult.data),
  };
}

export async function setFollowState(followerId: string, followingId: string, active: boolean): Promise<void> {
  if (followerId === followingId) throw new Error('No puedes seguir tu propio perfil.');
  if (active) {
    const { error } = await supabase.from('follows').upsert(
      { follower_id: followerId, following_id: followingId },
      { onConflict: 'follower_id,following_id', ignoreDuplicates: true },
    );
    if (error) throw error;
    return;
  }
  const { error } = await supabase.from('follows').delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw error;
}

export async function getFeedPosts(userId: string): Promise<Post[]> {
  const { data: rows, error } = await supabase.from('posts')
    .select(postColumns)
    .order('created_at', { ascending: false });
  if (error) throw error;
  if (!rows.length) return [];

  const userIds = [...new Set([...rows.map((row) => row.user_id), userId])];
  const postIds = rows.map((row) => row.id);
  const [profilesResult, likes, reposts, commentCounts] = await Promise.all([
    supabase.from('profiles').select(profileColumns).in('id', userIds),
    getEngagementRows('likes', postIds),
    getEngagementRows('reposts', postIds),
    getCommentCounts(postIds),
  ]);
  if (profilesResult.error) throw profilesResult.error;

  const profiles = profilesResult.data ?? [];
  const [avatars, covers, postImages] = await Promise.all([
    resolveSignedUrls('avatars', profiles.map((profile) => profile.avatar_path)),
    resolveSignedUrls('covers', profiles.map((profile) => profile.cover_path)),
    resolveSignedUrls('post-images', rows.map((row) => row.image_path)),
  ]);
  const profilesById = new Map(profiles.map((profile) => [profile.id, toAppUser(
    profile,
    profile.avatar_path ? avatars.get(profile.avatar_path) ?? null : null,
    profile.cover_path ? covers.get(profile.cover_path) ?? null : null,
  )]));
  const engagementByPost = new Map<string, PostEngagement>();
  for (const row of likes) {
    const engagement = engagementByPost.get(row.post_id) ?? { likes: 0, reposts: 0, liked: false, reposted: false };
    engagement.likes += 1;
    if (row.user_id === userId) engagement.liked = true;
    engagementByPost.set(row.post_id, engagement);
  }
  for (const row of reposts) {
    const engagement = engagementByPost.get(row.post_id) ?? { likes: 0, reposts: 0, liked: false, reposted: false };
    engagement.reposts += 1;
    if (row.user_id === userId) {
      engagement.reposted = true;
      const reposter = profilesById.get(userId);
      if (reposter) engagement.repost = { user: reposter, createdAt: row.created_at, time: relativeTime(row.created_at) };
    }
    engagementByPost.set(row.post_id, engagement);
  }
  return sortFeedPosts(rows.map((row) => ({
    ...toAppPost(row, profilesById.get(row.user_id), engagementByPost.get(row.id), row.image_path ? postImages.get(row.image_path) : undefined),
    commentsCount: commentCounts.get(row.id) ?? 0,
  })));
}

export async function createSupabasePost(text: string, userId: string, imagePath: string | null): Promise<Post> {
  const body = text.trim();
  if (!body && !imagePath) throw new Error('Escribe algo o agrega una imagen antes de publicar.');

  // Load the author's actual profile first, so a profile lookup failure cannot
  // make a successfully inserted post appear to have failed in the UI.
  const profile = await getProfileById(userId);
  if (!profile) throw new Error('No encontramos tu perfil. Vuelve a iniciar sesión e inténtalo otra vez.');
  const author = await getAppUser(profile);
  const image = imagePath ? (await resolveSignedUrls('post-images', [imagePath])).get(imagePath) : undefined;

  const { data, error } = await supabase.from('posts')
    .insert({ user_id: userId, body, image_path: imagePath })
    .select(postColumns)
    .single();
  if (error) throw error;

  return toAppPost(data, author, undefined, image);
}

export async function uploadUserImage(bucket: ImageBucket, userId: string, base64: string): Promise<string> {
  if (!base64) throw new Error('No pudimos leer la imagen seleccionada. Elige otra e inténtalo de nuevo.');
  const path = `${userId}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
  const { data, error } = await supabase.storage.from(bucket).upload(path, decode(base64), {
    contentType: 'image/jpeg', cacheControl: '3600', upsert: false,
  });
  if (error) throw error;
  return data.path;
}

export async function deleteUserImage(bucket: ImageBucket, userId: string, path: string): Promise<void> {
  await deleteUserImages(bucket, userId, [path]);
}

export async function deleteUserImages(bucket: ImageBucket, userId: string, paths: string[]): Promise<void> {
  const ownedPaths = [...new Set(paths.filter((path) => path.startsWith(`${userId}/`)))];
  if (!ownedPaths.length) return;
  const { error } = await supabase.storage.from(bucket).remove(ownedPaths);
  if (error) throw error;
}

export async function replaceProfileImage(field: ProfileImageField, userId: string, base64: string): Promise<User> {
  const profile = await getProfileById(userId);
  if (!profile) throw new Error('No encontramos tu perfil. Vuelve a iniciar sesión e inténtalo otra vez.');
  const bucket = field === 'avatar_path' ? 'avatars' : 'covers';
  const oldPath = profile[field];
  const newPath = await uploadUserImage(bucket, userId, base64);
  const update = field === 'avatar_path' ? { avatar_path: newPath } : { cover_path: newPath };
  const { data, error } = await supabase.from('profiles').update(update).eq('id', userId).select(profileColumns).maybeSingle();
  if (error || !data) {
    try { await deleteUserImage(bucket, userId, newPath); } catch (cleanupError) { console.warn('No se pudo limpiar la imagen de perfil sin usar:', cleanupError); }
    if (error) throw error;
    throw new Error('No se pudo guardar la imagen en tu perfil.');
  }
  if (oldPath && oldPath !== newPath) {
    try { await deleteUserImage(bucket, userId, oldPath); } catch (cleanupError) { console.warn('No se pudo borrar la imagen de perfil anterior:', cleanupError); }
  }
  return getAppUser(data);
}

export async function updateProfile(
  userId: string,
  values: { displayName: string; username: string; bio: string; avatarBase64?: string; coverBase64?: string },
): Promise<User> {
  const profile = await getProfileById(userId);
  if (!profile) throw new Error('No encontramos tu perfil. Vuelve a iniciar sesión e inténtalo otra vez.');

  const uploaded: { bucket: ImageBucket; path: string }[] = [];
  let committed = false;
  try {
    let avatarPath = profile.avatar_path;
    if (values.avatarBase64) {
      avatarPath = await uploadUserImage('avatars', userId, values.avatarBase64);
      uploaded.push({ bucket: 'avatars', path: avatarPath });
    }
    let coverPath = profile.cover_path;
    if (values.coverBase64) {
      coverPath = await uploadUserImage('covers', userId, values.coverBase64);
      uploaded.push({ bucket: 'covers', path: coverPath });
    }

    const { data, error } = await supabase.from('profiles').update({
      display_name: values.displayName,
      username: values.username,
      bio: values.bio,
      avatar_path: avatarPath,
      cover_path: coverPath,
    }).eq('id', userId).select(profileColumns).maybeSingle();

    if (error) {
      if (error.code === '23505') throw new Error('Ese usuario ya está ocupado. Prueba con otro.');
      if (error.code === '23514') throw new Error('El usuario debe tener entre 3 y 32 caracteres: letras, números o guion bajo.');
      throw error;
    }
    if (!data) throw new Error('No se pudo actualizar tu perfil. Comprueba tu sesión e inténtalo de nuevo.');
    committed = true;

    const oldImages: { bucket: ImageBucket; path: string | null }[] = [
      { bucket: 'avatars', path: profile.avatar_path },
      { bucket: 'covers', path: profile.cover_path },
    ];
    for (const oldImage of oldImages) {
      const newPath = oldImage.bucket === 'avatars' ? avatarPath : coverPath;
      if (oldImage.path && oldImage.path !== newPath) {
        try {
          await deleteUserImage(oldImage.bucket, userId, oldImage.path);
        } catch (cleanupError) {
          console.warn('No se pudo borrar una imagen de perfil anterior:', cleanupError);
        }
      }
    }
    return getAppUser(data);
  } catch (error) {
    if (!committed) {
      for (const image of uploaded) {
        try {
          await deleteUserImage(image.bucket, userId, image.path);
        } catch (cleanupError) {
          console.warn('No se pudo limpiar una imagen nueva sin usar:', cleanupError);
        }
      }
    }
    throw error;
  }
}

export async function setPostEngagement(kind: 'like' | 'repost', postId: string, userId: string, active: boolean): Promise<string | null> {
  const table = kind === 'like' ? 'likes' : 'reposts';
  if (active) {
    if (kind === 'like') {
      const { error } = await supabase.from('likes').upsert(
        { post_id: postId, user_id: userId },
        { onConflict: 'post_id,user_id', ignoreDuplicates: true },
      );
      if (error) throw error;
      return null;
    }
    const { data, error } = await supabase.from(table).upsert(
      { post_id: postId, user_id: userId },
      { onConflict: 'post_id,user_id', ignoreDuplicates: true },
    ).select('created_at').maybeSingle();
    if (error) throw error;
    return data?.created_at ?? new Date().toISOString();
  }

  const { error } = await supabase.from(table).delete()
    .eq('post_id', postId)
    .eq('user_id', userId);
  if (error) throw error;
  return null;
}

async function getEngagementRows(table: 'likes' | 'reposts', postIds: string[]): Promise<EngagementRow[]> {
  const pageSize = 1000;
  const allRows: EngagementRow[] = [];
  let from = 0;

  while (true) {
    const query = table === 'likes'
      ? supabase.from('likes').select('post_id, user_id, created_at').in('post_id', postIds).order('post_id').order('user_id').range(from, from + pageSize - 1)
      : supabase.from('reposts').select('post_id, user_id, created_at').in('post_id', postIds).order('post_id').order('user_id').range(from, from + pageSize - 1);
    const { data, error } = await query;
    if (error) throw error;
    allRows.push(...data);
    if (data.length < pageSize) return allRows;
    from += pageSize;
  }
}

function toAppPost(row: PostRow, author: User | undefined, engagement: PostEngagement = { likes: 0, reposts: 0, liked: false, reposted: false }, image?: string): Post {
  const displayAuthor = author ?? {
    username: 'usuario', name: 'Usuario', bio: '', avatar: null, cover: null,
  };
  return {
    id: row.id,
    userId: row.user_id,
    username: displayAuthor.username,
    author: displayAuthor,
    text: row.body,
    time: relativeTime(row.created_at),
    createdAt: row.created_at,
    likes: engagement.likes,
    reposts: engagement.reposts,
    comments: [],
    image,
    liked: engagement.liked,
    reposted: engagement.reposted,
    repost: engagement.repost,
  };
}

function toAppComment(row: CommentRow, author?: User, image?: string): Comment {
  return {
    id: row.id,
    postId: row.post_id,
    authorId: row.user_id,
    text: row.body,
    parentCommentId: row.parent_comment_id,
    createdAt: row.created_at,
    time: relativeTime(row.created_at),
    author,
    image,
  };
}

function toSocialNotification(row: NotificationRow, actor?: User): SocialNotification {
  return {
    id: row.id,
    recipientId: row.recipient_id,
    actorId: row.actor_id,
    actor: actor ?? { id: row.actor_id, username: 'usuario', name: 'Usuario', bio: '', avatar: null, cover: null },
    type: row.type,
    postId: row.post_id,
    commentId: row.comment_id,
    createdAt: row.created_at,
    time: relativeTime(row.created_at),
    readAt: row.read_at,
  };
}

async function resolveSignedUrls(bucket: ImageBucket, paths: (string | null)[]): Promise<Map<string, string>> {
  const uniquePaths = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  if (!uniquePaths.length) return new Map();
  try {
    const { data, error } = await supabase.storage.from(bucket).createSignedUrls(uniquePaths, 60 * 60 * 24);
    if (error) {
      console.warn(`No se pudieron resolver imágenes del bucket ${bucket}:`, error);
      return new Map();
    }
    const urls = new Map<string, string>();
    for (const item of data ?? []) {
      if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
    }
    return urls;
  } catch (error) {
    console.warn(`No se pudieron resolver imágenes del bucket ${bucket}:`, error);
    return new Map();
  }
}

function relativeTime(timestamp: string): string {
  const elapsedMinutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60_000));
  if (elapsedMinutes < 1) return 'ahora';
  if (elapsedMinutes < 60) return `hace ${elapsedMinutes} min`;
  const elapsedHours = Math.floor(elapsedMinutes / 60);
  if (elapsedHours < 24) return `hace ${elapsedHours} h`;
  const elapsedDays = Math.floor(elapsedHours / 24);
  return `hace ${elapsedDays} d`;
}

export function getRelativeTime(timestamp: string): string {
  return relativeTime(timestamp);
}

export function sortFeedPosts(posts: Post[]): Post[] {
  return [...posts].sort((first, second) => {
    const firstTime = first.repost?.createdAt ?? first.createdAt ?? '';
    const secondTime = second.repost?.createdAt ?? second.createdAt ?? '';
    return new Date(secondTime).getTime() - new Date(firstTime).getTime();
  });
}

export function refreshRelativePostTimes(posts: Post[]): Post[] {
  return posts.map((post) => ({
    ...post,
    ...(post.createdAt ? { time: relativeTime(post.createdAt) } : {}),
    ...(post.repost ? { repost: { ...post.repost, time: relativeTime(post.repost.createdAt) } } : {}),
  }));
}
