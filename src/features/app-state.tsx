import { createContext, useCallback, useContext, useMemo, useRef, useState, type PropsWithChildren } from 'react';
import type { Comment, Post, User } from './mock-data';
import { createSupabaseComment, createSupabasePost, deleteSupabaseComment, getFeedPosts, getFollowSummary, getNotifications, getProfileById, getRelativeTime, getUnreadNotificationCount, markAllSupabaseNotificationsRead, markSupabaseNotificationRead, refreshRelativePostTimes, setFollowState, setPostEngagement, sortFeedPosts, toAppUser, type FollowSummary, type SocialNotification } from './supabase-social';

type EngagementKind = 'like' | 'repost';

type AppState = {
  posts: Post[];
  isLoadingPosts: boolean;
  postsError: string | null;
  notifications: SocialNotification[];
  unreadNotificationCount: number;
  isLoadingNotifications: boolean;
  notificationsError: string | null;
  followSummaries: Record<string, FollowSummary>;
  updateProfileInState: (user: User) => void;
  refreshPosts: (userId: string | null) => Promise<void>;
  registerHomeScrollToTop: (handler: () => void) => () => void;
  scrollHomeToTop: () => void;
  refreshNotifications: (userId: string | null) => Promise<void>;
  refreshUnreadNotifications: (userId: string | null) => Promise<void>;
  markNotificationRead: (notificationId: string, userId: string) => Promise<void>;
  markAllNotificationsRead: (userId: string) => Promise<void>;
  refreshPostTimes: () => void;
  loadFollowSummary: (viewerId: string, profileId: string) => Promise<FollowSummary>;
  toggleFollow: (viewerId: string, profileId: string) => Promise<void>;
  addPost: (text: string, userId: string, imagePath: string | null, imagePreviewUri?: string) => Promise<void>;
  toggleLike: (id: string, userId: string | null) => Promise<void>;
  toggleRepost: (id: string, userId: string | null) => Promise<void>;
  addComment: (id: string, text: string, userId: string, parentCommentId?: string | null, imageBase64?: string | null) => Promise<Comment>;
  deleteComment: (commentId: string, postId: string, userId: string, removedCount?: number) => Promise<void>;
};
const Context = createContext<AppState | null>(null);
export function AppStateProvider({ children }: PropsWithChildren) {
  const [posts, setPosts] = useState<Post[]>([]);
  const postsRef = useRef<Post[]>([]);
  const pendingEngagement = useRef(new Set<string>());
  const pendingFollows = useRef(new Set<string>());
  const pendingComments = useRef(new Set<string>());
  const postsRefreshInFlight = useRef<{ userId: string; generation: number; request: Promise<void> } | null>(null);
  const postsOwner = useRef<string | null>(null);
  const postsGeneration = useRef(0);
  const homeScrollToTop = useRef<(() => void) | null>(null);
  const [followSummaries, setFollowSummaries] = useState<Record<string, FollowSummary>>({});
  const followOwner = useRef<string | null>(null);
  const followGeneration = useRef(0);
  const [isLoadingPosts, setIsLoadingPosts] = useState(false);
  const [postsError, setPostsError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [unreadNotificationCount, setUnreadNotificationCount] = useState(0);
  const [isLoadingNotifications, setIsLoadingNotifications] = useState(false);
  const [notificationsError, setNotificationsError] = useState<string | null>(null);
  const unreadRefreshInFlight = useRef<{ userId: string; request: Promise<void> } | null>(null);
  const notificationsRefreshInFlight = useRef<{ userId: string; request: Promise<void> } | null>(null);
  const notificationsOwner = useRef<string | null>(null);

  const updatePosts = useCallback((update: (current: Post[]) => Post[]) => {
    const next = update(postsRef.current);
    postsRef.current = next;
    setPosts(next);
  }, []);

  const updateProfileInState = useCallback((user: User) => {
    updatePosts((items) => items.map((post) => {
      const author = post.author?.id === user.id || post.userId === user.id ? user : post.author;
      const repost = post.repost && post.repost.user.id === user.id ? { ...post.repost, user } : post.repost;
      return { ...post, ...(post.userId === user.id ? { username: user.username } : {}), author, repost };
    }));
    setNotifications((items) => items.map((item) => item.actor.id === user.id ? { ...item, actor: user } : item));
  }, [updatePosts]);

  const refreshPosts = useCallback((userId: string | null): Promise<void> => {
    if (!userId) {
      postsOwner.current = null;
      postsGeneration.current += 1;
      updatePosts(() => []);
      setIsLoadingPosts(false);
      setPostsError('Inicia sesión para cargar las publicaciones.');
      return Promise.resolve();
    }
    if (postsOwner.current !== userId) {
      postsOwner.current = userId;
      postsGeneration.current += 1;
      updatePosts(() => []);
    }
    const generation = postsGeneration.current;
    const inFlight = postsRefreshInFlight.current;
    if (inFlight?.userId === userId && inFlight.generation === generation) return inFlight.request;
    setIsLoadingPosts(true);
    setPostsError(null);
    const request = Promise.resolve().then(async () => {
      try {
        const nextPosts = await getFeedPosts(userId);
        if (postsOwner.current === userId && postsGeneration.current === generation) updatePosts(() => nextPosts);
      } catch (error) {
        console.error('No se pudo cargar el feed de Supabase:', error);
        if (postsOwner.current === userId && postsGeneration.current === generation) {
          setPostsError('No pudimos cargar las publicaciones. Revisa tu conexión e inténtalo de nuevo.');
        }
      } finally {
        if (postsOwner.current === userId && postsGeneration.current === generation) setIsLoadingPosts(false);
        if (postsRefreshInFlight.current?.generation === generation) postsRefreshInFlight.current = null;
      }
    });
    postsRefreshInFlight.current = { userId, generation, request };
    return request;
  }, [updatePosts]);

  const registerHomeScrollToTop = useCallback((handler: () => void) => {
    homeScrollToTop.current = handler;
    return () => {
      if (homeScrollToTop.current === handler) homeScrollToTop.current = null;
    };
  }, []);

  const scrollHomeToTop = useCallback(() => {
    homeScrollToTop.current?.();
  }, []);

  const refreshPostTimes = useCallback(() => {
    updatePosts(refreshRelativePostTimes);
    setNotifications((items) => items.map((item) => ({ ...item, time: getRelativeTime(item.createdAt) })));
  }, [updatePosts]);

  const refreshUnreadNotifications = useCallback((userId: string | null): Promise<void> => {
    if (!userId) {
      notificationsOwner.current = null;
      setUnreadNotificationCount(0);
      return Promise.resolve();
    }
    const changedUser = notificationsOwner.current !== userId;
    notificationsOwner.current = userId;
    if (changedUser) {
      void Promise.resolve().then(() => {
        if (notificationsOwner.current === userId) {
          setNotifications([]);
          setNotificationsError(null);
        }
      });
    }
    if (unreadRefreshInFlight.current?.userId === userId) return unreadRefreshInFlight.current.request;
    const request = getUnreadNotificationCount(userId).then((count) => {
      if (notificationsOwner.current === userId) setUnreadNotificationCount(count);
    }).catch((error: unknown) => {
      console.warn('No se pudo actualizar el contador de notificaciones:', error);
    }).finally(() => {
      if (unreadRefreshInFlight.current?.userId === userId) unreadRefreshInFlight.current = null;
    });
    unreadRefreshInFlight.current = { userId, request };
    return request;
  }, []);

  const refreshNotifications = useCallback((userId: string | null): Promise<void> => {
    if (!userId) {
      notificationsOwner.current = null;
      setNotifications([]);
      setUnreadNotificationCount(0);
      setNotificationsError('Inicia sesión para ver tus notificaciones.');
      return Promise.resolve();
    }
    if (notificationsRefreshInFlight.current?.userId === userId) return notificationsRefreshInFlight.current.request;
    const request = (async () => {
      // Yield before changing loading state so focus effects do not trigger a
      // synchronous state update while React is running the effect.
      await Promise.resolve();
      if (notificationsOwner.current !== userId) {
        notificationsOwner.current = userId;
        setNotifications([]);
        setUnreadNotificationCount(0);
      }
      setIsLoadingNotifications(true);
      setNotificationsError(null);
      try {
        const [items, count] = await Promise.all([
          getNotifications(userId),
          getUnreadNotificationCount(userId),
        ]);
        if (notificationsOwner.current !== userId) return;
        setNotifications(items);
        setUnreadNotificationCount(count);
      } catch (error) {
        console.error('No se pudieron cargar las notificaciones:', error);
        if (notificationsOwner.current === userId) setNotificationsError('No pudimos cargar tus notificaciones. Revisa tu conexión e inténtalo de nuevo.');
      } finally {
        if (notificationsOwner.current === userId) setIsLoadingNotifications(false);
        if (notificationsRefreshInFlight.current?.userId === userId) notificationsRefreshInFlight.current = null;
      }
    })();
    notificationsRefreshInFlight.current = { userId, request };
    return request;
  }, []);

  const markNotificationRead = useCallback(async (notificationId: string, userId: string) => {
    const notification = notifications.find((item) => item.id === notificationId);
    if (!notification || notification.readAt) return;
    try {
      const readAt = new Date().toISOString();
      const changed = await markSupabaseNotificationRead(notificationId, userId, readAt);
      if (!changed || notificationsOwner.current !== userId) return;
      setNotifications((items) => items.map((item) => item.id === notificationId ? { ...item, readAt } : item));
      setUnreadNotificationCount((count) => Math.max(0, count - 1));
    } catch (error) {
      console.error('No se pudo marcar la notificación como leída:', error);
      throw new Error('No pudimos actualizar esta notificación. Inténtalo de nuevo.');
    }
  }, [notifications]);

  const markAllNotificationsRead = useCallback(async (userId: string) => {
    const readAt = new Date().toISOString();
    try {
      await markAllSupabaseNotificationsRead(userId, readAt);
      if (notificationsOwner.current !== userId) return;
      setNotifications((items) => items.map((item) => item.readAt ? item : { ...item, readAt }));
      setUnreadNotificationCount(0);
    } catch (error) {
      console.error('No se pudieron marcar todas las notificaciones como leídas:', error);
      throw new Error('No pudimos marcar todas como leídas. Revisa tu conexión e inténtalo de nuevo.');
    }
  }, []);

  const prepareFollowOwner = useCallback((viewerId: string) => {
    if (followOwner.current !== viewerId) {
      followOwner.current = viewerId;
      followGeneration.current += 1;
      setFollowSummaries({});
    }
    return followGeneration.current;
  }, []);

  const loadFollowSummary = useCallback(async (viewerId: string, profileId: string) => {
    const generation = prepareFollowOwner(viewerId);
    const summary = await getFollowSummary(profileId, viewerId);
    if (followOwner.current === viewerId && followGeneration.current === generation) {
      setFollowSummaries((current) => ({ ...current, [profileId]: summary }));
    }
    return summary;
  }, [prepareFollowOwner]);

  const toggleFollow = useCallback(async (viewerId: string, profileId: string) => {
    if (viewerId === profileId) throw new Error('No puedes seguir tu propio perfil.');
    const generation = prepareFollowOwner(viewerId);
    const key = `${viewerId}:${profileId}`;
    if (pendingFollows.current.has(key)) return;
    const currentSummary = followOwner.current === viewerId ? followSummaries[profileId] : undefined;
    const previous = currentSummary ?? await getFollowSummary(profileId, viewerId);
    if (followOwner.current !== viewerId || followGeneration.current !== generation) return;
    const isFollowing = !previous.isFollowing;
    const next: FollowSummary = {
      ...previous,
      isFollowing,
      followers: Math.max(0, previous.followers + (isFollowing ? 1 : -1)),
    };
    pendingFollows.current.add(key);
    setFollowSummaries((current) => followOwner.current === viewerId && followGeneration.current === generation
      ? { ...current, [profileId]: next }
      : current);
    try {
      await setFollowState(viewerId, profileId, isFollowing);
    } catch (error) {
      console.error('No se pudo actualizar el seguimiento:', error);
      if (followOwner.current === viewerId && followGeneration.current === generation) {
        setFollowSummaries((current) => ({ ...current, [profileId]: previous }));
      }
      throw new Error('No pudimos actualizar el seguimiento. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      pendingFollows.current.delete(key);
    }
  }, [followSummaries, prepareFollowOwner]);

  const addPost = useCallback(async (text: string, userId: string, imagePath: string | null, imagePreviewUri?: string) => {
    setPostsError(null);
    const post = await createSupabasePost(text, userId, imagePath);
    if (imagePreviewUri) post.image = imagePreviewUri;
    updatePosts((current) => [post, ...current.filter((item) => item.id !== post.id)]);
  }, [updatePosts]);

  const toggleEngagement = useCallback(async (kind: EngagementKind, postId: string, userId: string | null) => {
    if (!userId) throw new Error('Inicia sesión nuevamente para realizar esta acción.');
    const key = `${kind}:${postId}`;
    if (pendingEngagement.current.has(key)) return;

    const initialPost = postsRef.current.find((post) => post.id === postId);
    if (!initialPost) return;
    const wasActive = kind === 'like' ? Boolean(initialPost.liked) : Boolean(initialPost.reposted);
    const previousRepost = initialPost.repost;
    const willBeActive = !wasActive;
    const countChange = willBeActive ? 1 : -1;
    pendingEngagement.current.add(key);

    updatePosts((items) => sortFeedPosts(items.map((post) => post.id !== postId ? post : kind === 'like'
      ? { ...post, liked: willBeActive, likes: Math.max(0, post.likes + countChange) }
      : { ...post, reposted: willBeActive, reposts: Math.max(0, post.reposts + countChange), repost: willBeActive ? post.repost : undefined })));

    let repostCreatedAt: string | null = null;
    try {
      repostCreatedAt = await setPostEngagement(kind, postId, userId, willBeActive);
    } catch (error) {
      console.error(`No se pudo guardar ${kind === 'like' ? 'el Me gusta' : 'el Revirg'}:`, error);
      updatePosts((items) => sortFeedPosts(items.map((post) => {
        if (post.id !== postId) return post;
        const currentlyActive = kind === 'like' ? Boolean(post.liked) : Boolean(post.reposted);
        // A refresh may already have restored the server value while this write was pending.
        if (currentlyActive !== willBeActive) return post;
        return kind === 'like'
          ? { ...post, liked: wasActive, likes: Math.max(0, post.likes - countChange) }
          : { ...post, reposted: wasActive, reposts: Math.max(0, post.reposts - countChange), repost: previousRepost };
      })));
      throw new Error(kind === 'like'
        ? 'No pudimos actualizar Me gusta. Revisa tu conexión e inténtalo de nuevo.'
        : 'No pudimos actualizar el Revirg. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      pendingEngagement.current.delete(key);
    }

    if (kind === 'repost' && willBeActive) {
      try {
        const profile = await getProfileById(userId);
        if (profile) {
          const repostedAt = repostCreatedAt ?? new Date().toISOString();
          const repost = { user: toAppUser(profile), createdAt: repostedAt, time: getRelativeTime(repostedAt) };
          updatePosts((items) => sortFeedPosts(items.map((post) => post.id === postId ? { ...post, repost } : post)));
        }
      } catch (profileError) {
        console.warn('No se pudo cargar el perfil para mostrar el Revirg; se actualizará al refrescar el feed:', profileError);
      }
    }
  }, [updatePosts]);

  const addComment = useCallback(async (postId: string, text: string, userId: string, parentCommentId: string | null = null, imageBase64: string | null = null) => {
    if (!userId) throw new Error('Inicia sesión nuevamente para comentar.');
    const body = text.trim();
    if (!body && !imageBase64) throw new Error('Escribe un comentario o agrega una imagen antes de enviarlo.');
    const key = `create:${postId}`;
    if (pendingComments.current.has(key)) throw new Error('Estamos enviando tu comentario. Espera un momento.');
    pendingComments.current.add(key);
    try {
      const comment = await createSupabaseComment(postId, userId, body, parentCommentId, imageBase64);
      updatePosts((items) => items.map((post) => post.id === postId
        ? { ...post, commentsCount: (post.commentsCount ?? post.comments.length) + 1 }
        : post));
      return comment;
    } catch (error) {
      console.error('No se pudo crear el comentario en Supabase:', error);
      throw new Error(error instanceof Error && error.message === 'Escribe un comentario o agrega una imagen antes de enviarlo.'
        ? error.message
        : 'No pudimos enviar el comentario. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      pendingComments.current.delete(key);
    }
  }, [updatePosts]);

  const deleteComment = useCallback(async (commentId: string, postId: string, userId: string, removedCount = 1) => {
    const key = `delete:${commentId}`;
    if (pendingComments.current.has(key)) return;
    pendingComments.current.add(key);
    try {
      await deleteSupabaseComment(commentId, userId, postId);
      updatePosts((items) => items.map((post) => post.id === postId
        ? { ...post, commentsCount: Math.max(0, (post.commentsCount ?? post.comments.length) - removedCount) }
        : post));
    } catch (error) {
      console.error('No se pudo borrar el comentario en Supabase:', error);
      throw new Error(error instanceof Error && error.message.includes('Comprueba que sea tuyo')
        ? error.message
        : 'No pudimos borrar el comentario. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      pendingComments.current.delete(key);
    }
  }, [updatePosts]);

  const value = useMemo<AppState>(() => ({
    posts,
    isLoadingPosts,
    postsError,
    notifications,
    unreadNotificationCount,
    isLoadingNotifications,
    notificationsError,
    followSummaries,
    updateProfileInState,
    refreshPosts,
    registerHomeScrollToTop,
    scrollHomeToTop,
    refreshNotifications,
    refreshUnreadNotifications,
    markNotificationRead,
    markAllNotificationsRead,
    refreshPostTimes,
    loadFollowSummary,
    toggleFollow,
    addPost,
    toggleLike: (id, userId) => toggleEngagement('like', id, userId),
    toggleRepost: (id, userId) => toggleEngagement('repost', id, userId),
    addComment,
    deleteComment,
  }), [addComment, addPost, deleteComment, followSummaries, isLoadingNotifications, isLoadingPosts, loadFollowSummary, markAllNotificationsRead, markNotificationRead, notifications, notificationsError, posts, postsError, refreshNotifications, refreshPostTimes, refreshPosts, refreshUnreadNotifications, registerHomeScrollToTop, scrollHomeToTop, toggleEngagement, toggleFollow, unreadNotificationCount, updateProfileInState]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useAppState() { const state = useContext(Context); if (!state) throw new Error('useAppState debe usarse dentro de AppStateProvider'); return state; }
