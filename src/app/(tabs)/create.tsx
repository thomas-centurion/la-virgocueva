import { useCallback, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { router, useFocusEffect } from 'expo-router';
import { Avatar } from '@/components/profiles/avatar';
import { Button, Field, Header, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import type { User } from '@/features/mock-data';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import { deleteUserImage, getAppUser, getProfileById, uploadUserImage } from '@/features/supabase-social';

export default function CreateScreen() {
  const [text, setText] = useState('');
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [error, setError] = useState('');
  const [selectedImage, setSelectedImage] = useState<{ uri: string; base64: string } | null>(null);
  const publishing = useRef(false);
  const picking = useRef(false);
  const { addPost } = useAppState();
  const { session } = useAuth();
  const metadata = session?.user.user_metadata;

  useFocusEffect(useCallback(() => {
    if (!session?.user.id) return;
    let current = true;
    void getProfileById(session.user.id).then(async (profile) => {
      if (current && profile) setUser(await getAppUser(profile));
    }).catch((profileError: unknown) => {
      console.error('No se pudo cargar el perfil para publicar:', profileError);
    });
    return () => { current = false; };
  }, [session?.user.id]));

  const currentUser: User = user ?? {
    username: typeof metadata?.username === 'string' ? metadata.username : '',
    name: typeof metadata?.display_name === 'string' ? metadata.display_name : typeof metadata?.name === 'string' ? metadata.name : '',
    bio: '', avatar: null, cover: null,
  };

  const publish = async () => {
    if (publishing.current) return;
    if (!text.trim() && !selectedImage) { setError('Escribí algo o agregá una imagen antes de publicar.'); return; }
    if (!session?.user.id) { setError('Tu sesión venció. Inicia sesión nuevamente.'); return; }
    publishing.current = true;
    setLoading(true);
    setError('');
    let uploadedPath: string | null = null;
    try {
      if (selectedImage) uploadedPath = await uploadUserImage('post-images', session.user.id, selectedImage.base64);
      await addPost(text.trim(), session.user.id, uploadedPath, selectedImage?.uri);
      setText('');
      setSelectedImage(null);
      router.replace('/(tabs)');
    } catch (publishError) {
      console.error('No se pudo crear la publicación en Supabase:', publishError);
      setError('No se pudo publicar. Revisa tu conexión e inténtalo de vuelta.');
      if (uploadedPath) {
        try { await deleteUserImage('post-images', session.user.id, uploadedPath); }
        catch (cleanupError) { console.warn('No se pudo limpiar la imagen del post que no llegó a guardarse:', cleanupError); }
      }
    } finally {
      publishing.current = false;
      setLoading(false);
    }
  };

  const pickPostImage = async () => {
    if (picking.current || publishing.current) return;
    picking.current = true;
    setPickerBusy(true);
    let result: ImagePicker.ImagePickerResult;
    try {
      result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8, base64: true });
    } catch (pickerError) {
      console.error('No se pudo abrir la biblioteca de imágenes:', pickerError);
      Alert.alert('No se pudieron abrir las imágenes', 'Intentá de vuelta.');
      picking.current = false;
      setPickerBusy(false);
      return;
    }
    picking.current = false;
    setPickerBusy(false);
    if (result.canceled) return;
    const asset = result.assets[0];
    if (!asset?.base64) { Alert.alert('No se pudo leer la imagen', 'Elegí otra imagen y probá de vuelta.'); return; }
    setSelectedImage({ uri: asset.uri, base64: asset.base64 });
    setError('');
  };

  return <Screen><Header title="Nueva publicación" subtitle="Escribí la primer pelotudez que se te ocurra."/><View style={styles.composer}><View style={styles.user}><Avatar uri={currentUser.avatar}/><View><Text style={styles.name}>{currentUser.name}</Text><Text style={styles.handle}>@{currentUser.username}</Text></View></View><Field multiline value={text} onChangeText={(value) => { setText(value); if (error) setError(''); }} placeholder="¿Qué anda pasando?" maxLength={500} style={styles.input}/>{selectedImage && <View style={styles.previewWrap}><Image source={{ uri: selectedImage.uri }} style={styles.preview}/><Pressable accessibilityRole="button" accessibilityLabel="Quitar imagen" onPress={() => setSelectedImage(null)} style={styles.removeImage}><Text style={styles.removeImageText}>×</Text></Pressable></View>}<View style={styles.tools}><Pressable style={styles.attach} onPress={() => void pickPostImage()} disabled={pickerBusy || loading}><Text style={styles.attachIcon}>＋</Text><Text style={styles.attachText}>{pickerBusy ? 'Abriendo…' : selectedImage ? 'Cambiar imagen' : 'Agregar imagen'}</Text></Pressable><Text style={styles.counter}>{text.length}/500</Text></View>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Button title={loading ? 'Publicando…' : 'Publicar'} onPress={publish} disabled={loading || pickerBusy || (!text.trim() && !selectedImage)}/></View></Screen>;
}
const styles = StyleSheet.create({ composer: { margin: 16, padding: 17, borderRadius: 22, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface }, user: { flexDirection: 'row', alignItems: 'center', gap: 11 }, name: { color: colors.text, fontWeight: '700', fontSize: 14 }, handle: { color: colors.muted, marginTop: 3, fontSize: 12 }, input: { minHeight: 170, textAlignVertical: 'top', marginTop: 18, lineHeight: 23, borderWidth: 0, backgroundColor: 'transparent', paddingHorizontal: 0 }, previewWrap: { position: 'relative', marginTop: 4 }, preview: { width: '100%', height: 190, borderRadius: 15 }, removeImage: { position: 'absolute', top: 8, right: 8, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(11,13,16,0.8)' }, removeImageText: { color: colors.text, fontSize: 22, lineHeight: 25 }, tools: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginVertical: 16 }, attach: { flexDirection: 'row', alignItems: 'center', gap: 8 }, attachIcon: { color: colors.accent, fontSize: 22 }, attachText: { color: colors.accent, fontWeight: '600' }, counter: { color: colors.muted, fontSize: 12 }, error: { color: '#FF8585', fontSize: 13, lineHeight: 19, marginBottom: 12 } });
