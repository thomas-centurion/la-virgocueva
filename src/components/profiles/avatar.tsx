import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

export function Avatar({ uri, size = 46 }: { uri: string | null; size?: number }) {
  return <View style={[styles.frame, { width: size, height: size, borderRadius: size / 2 }]}>{uri ? <Image source={{ uri }} style={{ width: size, height: size, borderRadius: size / 2 }} contentFit="cover" /> : <View style={styles.placeholder}><View style={[styles.head, { width: size * 0.27, height: size * 0.27, borderRadius: size / 2 }]} /><View style={[styles.shoulders, { width: size * 0.58, height: size * 0.29, borderTopLeftRadius: size / 2, borderTopRightRadius: size / 2 }]} /></View>}</View>;
}
const styles = StyleSheet.create({ frame: { overflow: 'hidden', backgroundColor: '#252C34', alignItems: 'center', justifyContent: 'center' }, placeholder: { flex: 1, width: '100%', alignItems: 'center', justifyContent: 'center', gap: 2 }, head: { backgroundColor: '#56616D' }, shoulders: { backgroundColor: '#56616D' } });
