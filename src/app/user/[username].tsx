import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, Text, View } from 'react-native';
import { Stack, useLocalSearchParams } from 'expo-router';
import { ProfileView } from '@/components/profiles/profile-view';
import { Button, Screen } from '@/components/ui/primitives';
import { useAppState } from '@/features/app-state';
import type { Post, User } from '@/features/mock-data';
import { useAuth } from '@/features/auth/auth-provider';
import { getAppUser, getProfileByUsername, getRelativeTime, getRepostsByUser, sortFeedPosts, type UserRepostRow } from '@/features/supabase-social';
import { colors } from '@/constants/theme';

export default function UserProfileScreen() {
  const { username } = useLocalSearchParams<{ username: string }>();
  const { posts, isLoadingPosts, postsError, refreshPosts, followSummaries, loadFollowSummary, toggleFollow } = useAppState();
  const { session } = useAuth();
  const [user, setUser] = useState<User | null>(null);
  const [loadedUsername, setLoadedUsername] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [followError, setFollowError] = useState<string | null>(null);
  const [repostsError, setRepostsError] = useState<string | null>(null);
  const [profileReposts, setProfileReposts] = useState<UserRepostRow[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);

  const readProfile = useCallback(() => username ? getProfileByUsername(username) : Promise.resolve(null), [username]);

  useEffect(() => {
    let active = true;
    void readProfile().then(async (profile) => {
      if (!active) return;
      setUser(profile ? await getAppUser(profile) : null);
      setFollowError(null);
      setRepostsError(null);
      setProfileReposts([]);
      if (profile) {
        try { setProfileReposts(await getRepostsByUser(profile.id)); }
        catch (repostsLoadError) {
          console.error('No se pudieron cargar los Revirgs del perfil:', repostsLoadError);
          if (active) setRepostsError('No pudimos cargar todos los Revirgs de este perfil. Inténtalo de nuevo.');
        }
      }
      if (profile && session?.user.id) {
        try { await loadFollowSummary(session.user.id, profile.id); }
        catch (followLoadError) {
          console.error('No se pudo cargar el estado de seguimiento:', followLoadError);
          if (active) setFollowError('No pudimos cargar los datos de seguimiento. Inténtalo de nuevo.');
        }
      }
      if (!active) return;
      setNotFound(!profile);
      setError(null);
    }).catch((profileError: unknown) => {
      console.error('No se pudo cargar el perfil de Supabase:', profileError);
      if (active) setError('No pudimos cargar este perfil. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => { if (active && username) setLoadedUsername(username); });
    return () => { active = false; };
  }, [loadFollowSummary, readProfile, session?.user.id, username]);

  const retryProfile = () => {
    setLoadedUsername(null);
    setError(null);
    setFollowError(null);
    setRepostsError(null);
    setProfileReposts([]);
    setNotFound(false);
    void readProfile().then(async (profile) => {
      setUser(profile ? await getAppUser(profile) : null);
      if (profile) {
        try { setProfileReposts(await getRepostsByUser(profile.id)); }
        catch (repostsLoadError) {
          console.error('No se pudieron cargar los Revirgs del perfil:', repostsLoadError);
          setRepostsError('No pudimos cargar todos los Revirgs de este perfil. Inténtalo de nuevo.');
        }
      }
      if (profile && session?.user.id) {
        try { await loadFollowSummary(session.user.id, profile.id); }
        catch (followLoadError) {
          console.error('No se pudo cargar el estado de seguimiento:', followLoadError);
          setFollowError('No pudimos cargar los datos de seguimiento. Inténtalo de nuevo.');
        }
      }
      setNotFound(!profile);
    }).catch((profileError: unknown) => {
      console.error('No se pudo cargar el perfil de Supabase:', profileError);
      setError('No pudimos cargar este perfil. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => { if (username) setLoadedUsername(username); });
  };

  const handleToggleFollow = () => {
    if (!session?.user.id || !user || followLoading) return;
    setFollowLoading(true);
    void toggleFollow(session.user.id, user.id ?? '').catch((followError: unknown) => {
      console.error('No se pudo actualizar el seguimiento:', followError);
      Alert.alert('No se pudo actualizar', followError instanceof Error ? followError.message : 'Inténtalo de nuevo.');
    }).finally(() => setFollowLoading(false));
  };

  const profilePosts = useMemo(() => {
    if (!user?.id) return [];
    const itemsById = new Map<string, Post>();
    for (const post of posts) {
      if (post.userId === user.id) itemsById.set(post.id, { ...post, repost: undefined });
    }
    for (const repost of profileReposts) {
      const originalPost = posts.find((post) => post.id === repost.post_id);
      if (!originalPost) continue;
      itemsById.set(originalPost.id, {
        ...originalPost,
        repost: { user, createdAt: repost.created_at, time: getRelativeTime(repost.created_at) },
      });
    }
    return sortFeedPosts([...itemsById.values()]);
  }, [posts, profileReposts, user]);

  const header = <Stack.Screen options={{ headerShown: true, title: `@${user?.username ?? username ?? ''}`, headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text, headerShadowVisible: false }}/>;
  if (loadedUsername !== username || (!error && !notFound && isLoadingPosts && posts.length === 0)) {
    return <Screen>{header}<View style={styles.state}><ActivityIndicator color={colors.accent}/></View></Screen>;
  }
  if (notFound) {
    return <Screen>{header}<View style={styles.state}><Text style={styles.message}>No encontramos este perfil.</Text></View></Screen>;
  }
  if (error || !user) {
    return <Screen>{header}<View style={styles.state}><Text style={styles.message}>{error ?? 'No pudimos cargar este perfil.'}</Text><Button title="Intentar de nuevo" onPress={retryProfile}/></View></Screen>;
  }

  return <Screen>{header}<ProfileView user={user} isCurrent={user.id === session?.user.id} posts={profilePosts} followSummary={user.id ? followSummaries[user.id] : undefined} followLoading={followLoading} onToggleFollow={user.id !== session?.user.id ? handleToggleFollow : undefined} notice={repostsError ?? followError ?? postsError} onRetry={() => { if (repostsError || followError) retryProfile(); else void refreshPosts(session?.user.id ?? null); }}/></Screen>;
}

const styles = StyleSheet.create({ state: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, gap: 16 }, message: { color: colors.muted, textAlign: 'center', lineHeight: 20 } });
