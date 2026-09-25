import { useCallback, useEffect, useState } from 'react';
import { router, useFocusEffect } from 'expo-router';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { ProfileView } from '@/components/profiles/profile-view';
import { Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { useAuth } from '@/features/auth/auth-provider';
import type { User } from '@/features/mock-data';
import { useAppState } from '@/features/app-state';
import { getAppUser, getProfileById } from '@/features/supabase-social';

export default function MyProfileScreen() {
  const { session, signOut } = useAuth();
  const { posts, isLoadingPosts, postsError, refreshPosts, followSummaries, loadFollowSummary, updateProfileInState } = useAppState();
  const [loading, setLoading] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profile, setProfile] = useState<User | null>(null);
  const [profileError, setProfileError] = useState<string | null>(null);
  const metadata = session?.user.user_metadata;
  const userId = session?.user.id;

  const readProfile = useCallback(() => userId ? getProfileById(userId) : Promise.resolve(null), [userId]);

  useFocusEffect(useCallback(() => {
    let active = true;
    void readProfile().then(async (data) => {
      if (!active) return;
      const appUser = data ? await getAppUser(data) : null;
      if (!active) return;
      setProfile(appUser);
      if (appUser) updateProfileInState(appUser);
      setProfileError(data || !userId ? null : 'No encontramos tu perfil en Supabase.');
    }).catch((error: unknown) => {
      console.error('No se pudo cargar el perfil de Supabase:', error);
      if (active) setProfileError('No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => { if (active) setProfileLoading(false); });
    return () => { active = false; };
  }, [readProfile, updateProfileInState, userId]));

  useEffect(() => {
    if (!userId) return;
    void loadFollowSummary(userId, userId).catch((error: unknown) => {
      console.error('No se pudieron cargar tus estadísticas de seguimiento:', error);
    });
  }, [loadFollowSummary, userId]);

  const retryProfile = () => {
    setProfileLoading(true);
    setProfileError(null);
    void readProfile().then(async (data) => {
      setProfile(data ? await getAppUser(data) : null);
      setProfileError(data || !userId ? null : 'No encontramos tu perfil en Supabase.');
    }).catch((error: unknown) => {
      console.error('No se pudo cargar el perfil de Supabase:', error);
      setProfileError('No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => setProfileLoading(false));
  };

  const user: User = profile ?? {
    id: userId,
    name: typeof metadata?.display_name === 'string' ? metadata.display_name : typeof metadata?.name === 'string' ? metadata.name : '',
    username: typeof metadata?.username === 'string' ? metadata.username : '',
    bio: '', avatar: null, cover: null,
  };

  const handleSignOut = async () => {
    if (loading) return;
    setLoading(true);
    try {
      const { error } = await signOut();
      if (error) {
        console.error('Error al cerrar sesión de Supabase:', error);
        Alert.alert('No se pudo cerrar sesión', 'Inténtalo de nuevo en unos momentos.');
      }
    } catch (error) {
      console.error('Error al cerrar sesión de Supabase:', error);
      Alert.alert('No se pudo cerrar sesión', 'Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  if (profileLoading || (isLoadingPosts && posts.length === 0)) return <Screen><View style={styles.loading}><ActivityIndicator color={colors.accent} /></View></Screen>;

  return <Screen><ProfileView user={user} posts={posts.filter((post) => post.userId === userId || post.repost?.user.id === userId)} isCurrent followSummary={userId ? followSummaries[userId] : undefined} notice={profileError ?? postsError} onRetry={() => { if (profileError) retryProfile(); else void refreshPosts(userId ?? null); }} headerAction={<View style={styles.profileActions}><Pressable accessibilityRole="button" onPress={() => router.push('/edit-profile')} style={styles.edit}><Text style={styles.logoutText}>Editar perfil</Text></Pressable><Pressable accessibilityRole="button" accessibilityLabel="Cerrar sesión" disabled={loading} onPress={handleSignOut} style={[styles.logout, loading && styles.disabled]}><Text style={styles.logoutText}>{loading ? 'Saliendo…' : 'Cerrar sesión'}</Text></Pressable></View>} /></Screen>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' }, profileActions: { flexDirection: 'row', alignItems: 'center', gap: 7 }, edit: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.accent, backgroundColor: colors.accentDark }, logout: { paddingHorizontal: 10, paddingVertical: 9, borderRadius: 18, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, disabled: { opacity: 0.5 }, logoutText: { color: colors.text, fontSize: 11, fontWeight: '700' } });
