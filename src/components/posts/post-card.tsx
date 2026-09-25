import { Link, router } from 'expo-router';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import { findUser, type Post } from '@/features/mock-data';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import { Avatar } from '@/components/profiles/avatar';
import { PostActions } from './post-actions';
import { ImageThumbnail } from '@/components/ui/image-viewer';
import { RepostLabel } from './repost-label';

export function PostCard({ post }: { post: Post }) {
  const user = post.author ?? findUser(post.username);
  const detailParams = post.repost?.user.id
    ? { id: post.id, reposterId: post.repost.user.id }
    : { id: post.id };
  const { toggleLike, toggleRepost } = useAppState();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const handleLike = () => { void toggleLike(post.id, userId).catch((error: unknown) => Alert.alert('No se pudo actualizar Me gusta', error instanceof Error ? error.message : 'Inténtalo de nuevo.')); };
  const handleRepost = () => { void toggleRepost(post.id, userId).catch((error: unknown) => Alert.alert('No se pudo actualizar el Revirg', error instanceof Error ? error.message : 'Inténtalo de nuevo.')); };
  return <View style={styles.card}>
    {post.repost && <RepostLabel repost={post.repost} />}
    <View style={styles.header}>
      <Link href={{ pathname: '/user/[username]', params: { username: user.username } }} asChild><Pressable><Avatar uri={user.avatar} /></Pressable></Link>
      <View style={styles.identity}>
        <Link href={{ pathname: '/user/[username]', params: { username: user.username } }} asChild><Pressable><Text style={styles.name}>{user.name}</Text></Pressable></Link>
        <View style={styles.metaRow}><Link href={{ pathname: '/user/[username]', params: { username: user.username } }} style={styles.meta}>@{user.username}</Link><Text style={styles.meta}> · </Text><Pressable accessibilityRole="button" accessibilityLabel="Abrir publicación" onPress={() => router.push({ pathname: '/post/[id]', params: detailParams })}><Text style={styles.meta}>{post.time}</Text></Pressable></View>
      </View>
      <Text style={styles.more}>···</Text>
    </View>
    {post.text ? <Pressable accessibilityRole="button" accessibilityLabel="Abrir publicación" onPress={() => router.push({ pathname: '/post/[id]', params: detailParams })} style={styles.bodyTarget}><Text style={styles.body}>{post.text}</Text></Pressable> : null}
    {post.image && <ImageThumbnail uri={post.image} style={[styles.image, !post.text && styles.imageWithoutText]} accessibilityLabel="Abrir imagen de la publicación" />}
    <PostActions likes={post.likes} reposts={post.reposts} comments={post.commentsCount ?? post.comments.length} liked={post.liked} reposted={post.reposted} onLike={handleLike} onRepost={handleRepost} onComment={() => router.push({ pathname: '/post/[id]', params: detailParams })} />
    <Link href={{ pathname: '/post/[id]', params: detailParams }} style={styles.commentsLink}>Ver conversación</Link>
  </View>;
}
const styles = StyleSheet.create({ card: { backgroundColor: colors.surface, marginHorizontal: 14, marginTop: 12, padding: 16, borderRadius: 22, borderWidth: 1, borderColor: colors.border }, header: { flexDirection: 'row', alignItems: 'center', gap: 11 }, identity: { flex: 1 }, metaRow: { flexDirection: 'row', alignItems: 'center' }, name: { color: colors.text, fontSize: 15, fontWeight: '700' }, meta: { color: colors.muted, fontSize: 12, marginTop: 3 }, more: { color: colors.muted, fontSize: 22, marginTop: -8 }, bodyTarget: { paddingVertical: 12, marginTop: 4 }, body: { color: colors.text, fontSize: 15, lineHeight: 23 }, image: { width: '100%', height: 200, borderRadius: 16, marginTop: 12 }, imageWithoutText: { marginTop: 16 }, commentsLink: { color: colors.muted, fontSize: 12, marginTop: 14 } });
