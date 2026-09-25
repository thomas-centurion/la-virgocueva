import { useEffect, useRef } from 'react';
import { ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { PostCard } from '@/components/posts/post-card';
import { Screen } from '@/components/ui/primitives';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import type { Post } from '@/features/mock-data';

export default function FeedScreen() {
  const { posts, isLoadingPosts, postsError, refreshPosts, refreshPostTimes, registerHomeScrollToTop } = useAppState();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const feedRef = useRef<FlatList<Post>>(null);

  useEffect(() => { void refreshPosts(userId); }, [refreshPosts, userId]);
  useEffect(() => registerHomeScrollToTop(() => {
    feedRef.current?.scrollToOffset({ offset: 0, animated: false });
  }), [registerHomeScrollToTop]);
  useEffect(() => {
    const timer = setInterval(refreshPostTimes, 60_000);
    return () => clearInterval(timer);
  }, [refreshPostTimes]);

  const emptyState = isLoadingPosts
    ? <ActivityIndicator color={colors.accent} style={styles.state}/>
    : postsError
      ? <View style={styles.state}><Text style={styles.stateText}>{postsError}</Text><Pressable onPress={() => void refreshPosts(userId)}><Text style={styles.retry}>Intentar de nuevo</Text></Pressable></View>
      : <Text style={styles.stateText}>Todavía no hay publicaciones.</Text>;

  return <Screen>
    <View style={styles.top}><View><Text style={styles.eyebrow}>TU CÍRCULO</Text><Text style={styles.title}>La cueva</Text></View><View style={styles.online}><View style={styles.dot}/><Text style={styles.onlineText}>7 por aquí</Text></View></View>
    <FlatList ref={feedRef} data={posts} keyExtractor={(post) => post.id} renderItem={({ item }) => <PostCard post={item} />} showsVerticalScrollIndicator={false} contentContainerStyle={styles.list} ListHeaderComponent={<Text style={styles.caption}>Lo que se habla por acá</Text>} ListEmptyComponent={emptyState} />
  </Screen>;
}
const styles = StyleSheet.create({ top: { paddingHorizontal: 20, paddingTop: 12, paddingBottom: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, eyebrow: { color: colors.accent, fontSize: 10, letterSpacing: 2, fontWeight: '800' }, title: { color: colors.text, fontSize: 25, fontWeight: '800', marginTop: 3 }, online: { flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.surfaceRaised, borderRadius: 30, paddingHorizontal: 11, paddingVertical: 8 }, dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent }, onlineText: { color: colors.muted, fontSize: 11 }, list: { paddingBottom: 22, flexGrow: 1 }, caption: { color: colors.muted, fontSize: 13, paddingHorizontal: 20, paddingBottom: 3 }, state: { marginTop: 40, marginHorizontal: 28, alignItems: 'center', gap: 12 }, stateText: { color: colors.muted, textAlign: 'center', padding: 28 }, retry: { color: colors.accent, fontWeight: '700' } });
