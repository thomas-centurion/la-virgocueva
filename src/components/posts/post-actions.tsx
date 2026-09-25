import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';

export function PostActions({ likes, reposts, comments, liked, reposted, onLike, onRepost, onComment }: { likes: number; reposts: number; comments: number; liked?: boolean; reposted?: boolean; onLike: () => void; onRepost: () => void; onComment: () => void }) {
  return <View style={styles.row}>
    <Pressable onPress={onComment} style={styles.action}><Text style={styles.icon}>◯</Text><Text style={styles.count}>{comments}</Text></Pressable>
    <Pressable onPress={onRepost} style={styles.action}><Text style={[styles.icon, reposted && { color: colors.accent }]}>⟳</Text><Text style={[styles.count, reposted && { color: colors.accent }]}>{reposts}</Text></Pressable>
    <Pressable onPress={onLike} style={styles.action}><Text style={[styles.icon, liked && { color: colors.danger }]}>{liked ? '♥' : '♡'}</Text><Text style={[styles.count, liked && { color: colors.danger }]}>{likes}</Text></Pressable>
  </View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', paddingRight: 18, marginTop: 5 }, action: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 58 }, icon: { fontSize: 20, color: colors.muted }, count: { color: colors.muted, fontSize: 13 } });
