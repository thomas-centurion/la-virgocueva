import { useEffect, useRef, useState } from 'react';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { ActivityIndicator, Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/profiles/avatar';
import { ImageThumbnail } from '@/components/ui/image-viewer';
import { Button, Field, Screen, SectionLabel } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import { getAppUser, getProfileById, updateProfile } from '@/features/supabase-social';

type SelectedImage = { uri: string; base64: string };

export default function EditProfileScreen() {
  const { session } = useAuth();
  const { updateProfileInState } = useAppState();
  const userId = session?.user.id;
  const [loading, setLoading] = useState(Boolean(userId));
  const [saving, setSaving] = useState(false);
  const [pickerBusy, setPickerBusy] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatar, setAvatar] = useState<SelectedImage | null>(null);
  const [cover, setCover] = useState<SelectedImage | null>(null);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const savingRef = useRef(false);

  useEffect(() => {
    let active = true;
    if (!userId) return () => { active = false; };
    void getProfileById(userId).then(async (profile) => {
      if (!profile) throw new Error('No encontramos tu perfil en Supabase.');
      const user = await getAppUser(profile);
      if (!active) return;
      setDisplayName(profile.display_name);
      setUsername(profile.username);
      setBio(profile.bio);
      setAvatarUrl(user.avatar);
      setCoverUrl(user.cover);
    }).catch((error: unknown) => {
      console.error('No se pudo cargar el perfil para editarlo:', error);
      if (active) setErrorMessage(error instanceof Error && error.message === 'No encontramos tu perfil en Supabase.'
        ? error.message
        : 'No pudimos cargar tu perfil. Revisa tu conexión e inténtalo de nuevo.');
    }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [userId]);

  const visibleError = errorMessage ?? (!userId ? 'Inicia sesión para editar tu perfil.' : null);

  const selectImage = async (field: 'avatar' | 'cover') => {
    if (pickerBusy || saving) return;
    setPickerBusy(true);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: field === 'avatar' ? [1, 1] : [3, 1],
        quality: 0.8,
        base64: true,
      });
      if (result.canceled) return;
      const image = result.assets[0];
      if (!image?.uri || !image.base64) {
        Alert.alert('No se pudo leer la imagen', 'Elige otra imagen e inténtalo de nuevo.');
        return;
      }
      const selected = { uri: image.uri, base64: image.base64 };
      if (field === 'avatar') setAvatar(selected);
      else setCover(selected);
    } catch (pickerError) {
      console.error('No se pudo abrir la biblioteca de imágenes:', pickerError);
      Alert.alert('No se pudieron abrir las imágenes', 'Inténtalo de nuevo.');
    } finally {
      setPickerBusy(false);
    }
  };

  const save = async () => {
    if (!userId || savingRef.current) return;
    const cleanName = displayName.trim();
    const cleanUsername = username.trim().replace(/^@/, '').toLowerCase();
    if (!cleanName) {
      setErrorMessage('El nombre no puede quedar vacío.');
      return;
    }
    if (!/^[a-z0-9_]{3,32}$/.test(cleanUsername)) {
      setErrorMessage('El username debe tener entre 3 y 32 caracteres: letras, números o guion bajo.');
      return;
    }
    setErrorMessage(null);
    savingRef.current = true;
    setSaving(true);
    try {
      const user = await updateProfile(userId, {
        displayName: cleanName,
        username: cleanUsername,
        bio: bio.trim(),
        ...(avatar ? { avatarBase64: avatar.base64 } : {}),
        ...(cover ? { coverBase64: cover.base64 } : {}),
      });
      updateProfileInState(user);
      router.back();
    } catch (saveError) {
      console.error('No se pudo guardar el perfil:', saveError);
      setErrorMessage(saveError instanceof Error && [
        'Ese usuario ya está ocupado. Prueba con otro.',
        'El usuario debe tener entre 3 y 32 caracteres: letras, números o guion bajo.',
        'No encontramos tu perfil. Vuelve a iniciar sesión e inténtalo otra vez.',
        'No se pudo actualizar tu perfil. Comprueba tu sesión e inténtalo de nuevo.',
      ].includes(saveError.message)
        ? saveError.message
        : 'No pudimos guardar los cambios. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  };

  if (loading) return <Screen style={styles.loading}><ActivityIndicator color={colors.accent} /></Screen>;

  return <Screen>
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.topBar}>
        <Pressable accessibilityRole="button" onPress={() => router.back()} disabled={saving} hitSlop={10}>
          <Text style={styles.cancel}>Cancelar</Text>
        </Pressable>
        <Text style={styles.title}>Editar perfil</Text>
        <View style={styles.topSpacer} />
      </View>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.coverFrame}>
          {cover?.uri || coverUrl
            ? <ImageThumbnail uri={cover?.uri ?? coverUrl!} style={styles.coverImage} accessibilityLabel="Ver vista previa de la portada" />
            : <View style={styles.coverPlaceholder}><Text style={styles.placeholderText}>Tu portada</Text></View>}
          <Pressable accessibilityRole="button" onPress={() => void selectImage('cover')} disabled={pickerBusy || saving} style={styles.coverButton}>
            <Text style={styles.coverButtonText}>{pickerBusy ? 'Abriendo…' : 'Cambiar portada'}</Text>
          </Pressable>
        </View>
        <View style={styles.avatarRow}>
          <Avatar uri={avatar?.uri ?? avatarUrl} size={88} />
          <Pressable accessibilityRole="button" onPress={() => void selectImage('avatar')} disabled={pickerBusy || saving} style={styles.imageButton}>
            <Text style={styles.imageButtonText}>{pickerBusy ? 'Abriendo…' : 'Cambiar foto'}</Text>
          </Pressable>
        </View>

        <View style={styles.form}>
          <View>
            <SectionLabel>Nombre</SectionLabel>
            <Field value={displayName} onChangeText={setDisplayName} placeholder="Tu nombre" autoCapitalize="words" editable={!saving} returnKeyType="next" />
          </View>
          <View>
            <SectionLabel>Usuario</SectionLabel>
            <View style={styles.usernameField}><Text style={styles.at}>@</Text><Field value={username} onChangeText={setUsername} placeholder="usuario" autoCapitalize="none" autoCorrect={false} editable={!saving} /></View>
          </View>
          <View>
            <SectionLabel>Bio</SectionLabel>
            <Field value={bio} onChangeText={setBio} placeholder="Cuéntales algo sobre vos" multiline editable={!saving} textAlignVertical="top" style={styles.bioField} />
          </View>
          {visibleError ? <Text accessibilityRole="alert" style={styles.error}>{visibleError}</Text> : null}
          <Button title={saving ? 'Guardando…' : 'Guardar'} disabled={saving || pickerBusy || !userId} onPress={() => void save()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  </Screen>;
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { alignItems: 'center', justifyContent: 'center' },
  topBar: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, borderBottomWidth: 1, borderBottomColor: colors.border },
  cancel: { color: colors.muted, fontSize: 14, fontWeight: '600' },
  title: { color: colors.text, fontSize: 18, fontWeight: '800' },
  topSpacer: { width: 52 },
  content: { paddingBottom: 28 },
  coverFrame: { height: 150, backgroundColor: colors.surfaceRaised, position: 'relative' },
  coverImage: { width: '100%', height: '100%' },
  coverPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  placeholderText: { color: colors.muted, fontSize: 14 },
  coverButton: { position: 'absolute', right: 14, bottom: 12, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 18, backgroundColor: 'rgba(11,13,16,0.82)' },
  coverButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  avatarRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: -32, paddingHorizontal: 20, marginBottom: 20 },
  imageButton: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: 18, paddingHorizontal: 13, paddingVertical: 9 },
  imageButtonText: { color: colors.text, fontSize: 12, fontWeight: '700' },
  form: { paddingHorizontal: 20, gap: 20 },
  usernameField: { flexDirection: 'row', alignItems: 'center', borderColor: colors.border, borderWidth: 1, backgroundColor: colors.surface, borderRadius: 15, paddingLeft: 14 },
  at: { color: colors.muted, fontSize: 15 },
  bioField: { height: 118, paddingTop: 14 },
  error: { color: colors.danger, fontSize: 13, lineHeight: 19 },
});
