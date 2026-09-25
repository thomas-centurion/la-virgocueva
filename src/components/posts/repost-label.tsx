import { StyleSheet, Text, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { RepostContext } from '@/features/mock-data';

export function RepostLabel({ repost }: { repost: RepostContext }) {
  const reposter = repost.user.name || `@${repost.user.username}`;
  return <View style={styles.container}>
    <Text style={styles.label}>🔁 {reposter} revirgueó · {repost.time}</Text>
  </View>;
}

const styles = StyleSheet.create({
  container: { marginBottom: 10 },
  label: { color: colors.muted, fontSize: 12, fontWeight: '600' },
});
