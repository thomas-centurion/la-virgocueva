import { Image } from 'expo-image';
import { createContext, useCallback, useContext, useMemo, useState, type PropsWithChildren } from 'react';
import { Modal, Pressable, StyleSheet, Text, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

type ViewerContextValue = { open: (uri: string) => void };
const ViewerContext = createContext<ViewerContextValue | null>(null);

export function ImageViewerProvider({ children }: PropsWithChildren) {
  const [uri, setUri] = useState<string | null>(null);
  const close = useCallback(() => setUri(null), []);
  const value = useMemo(() => ({ open: setUri }), []);

  return <ViewerContext.Provider value={value}>
    {children}
    <Modal visible={uri !== null} animationType="fade" presentationStyle="fullScreen" statusBarTranslucent onRequestClose={close}>
      <SafeAreaView style={styles.viewer}>
        <Pressable style={styles.close} onPress={close} accessibilityRole="button" accessibilityLabel="Cerrar imagen">
          <Text style={styles.closeIcon}>×</Text>
        </Pressable>
        {uri && <Image source={{ uri }} style={styles.fullImage} contentFit="contain" />}
      </SafeAreaView>
    </Modal>
  </ViewerContext.Provider>;
}

export function ImageThumbnail({ uri, style, imageStyle, accessibilityLabel, contentFit = 'cover' }: {
  uri: string;
  style?: StyleProp<ViewStyle>;
  imageStyle?: StyleProp<ImageStyle>;
  accessibilityLabel?: string;
  contentFit?: 'cover' | 'contain';
}) {
  const viewer = useContext(ViewerContext);
  if (!viewer) throw new Error('ImageThumbnail debe usarse dentro de ImageViewerProvider');
  return <Pressable onPress={() => viewer.open(uri)} style={[styles.thumbnail, style]} accessibilityRole="button" accessibilityLabel={accessibilityLabel ?? 'Abrir imagen a pantalla completa'}>
    <Image source={{ uri }} style={[styles.thumbnailImage, imageStyle]} contentFit={contentFit} />
  </Pressable>;
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: '#050607', justifyContent: 'center' },
  close: { position: 'absolute', zIndex: 2, top: 8, right: 18, width: 44, height: 44, borderRadius: 22, backgroundColor: '#24272CCC', alignItems: 'center', justifyContent: 'center' },
  closeIcon: { color: '#FFFFFF', fontSize: 31, lineHeight: 35, fontWeight: '300' },
  fullImage: { width: '100%', height: '82%' },
  thumbnail: { overflow: 'hidden' },
  thumbnailImage: { width: '100%', height: '100%' },
});
