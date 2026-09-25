import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { getAuthErrorMessage, isValidEmail } from '@/features/auth/errors';

export default function RegisterScreen() {
  const [values, setValues] = useState({ name: '', username: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const set = (key: keyof typeof values) => (value: string) => setValues((current) => ({ ...current, [key]: value }));
  const register = async () => {
    if (loading) return;
    setError('');
    setNotice('');
    const name = values.name.trim();
    const username = values.username.trim().replace(/^@/, '').toLowerCase();
    const email = values.email.trim();
    if (!name || !username || !email || !values.password || !values.confirm) { setError('Completa todos los campos.'); return; }
    if (!/^[a-z0-9_]{3,32}$/.test(username)) { setError('El username debe tener entre 3 y 32 caracteres: letras, números o guion bajo.'); return; }
    if (!isValidEmail(email)) { setError('Escribe un email válido.'); return; }
    if (values.password.length < 6) { setError('La contraseña debe tener al menos 6 caracteres.'); return; }
    if (values.password !== values.confirm) { setError('Las contraseñas no coinciden.'); return; }
    setLoading(true);
    try {
      const { data, error: authError } = await supabase.auth.signUp({
        email,
        password: values.password,
        options: {
          data: { display_name: name, name, username },
          emailRedirectTo: Linking.createURL('auth/callback', { scheme: 'virgocueva' }),
        },
      });
      if (authError) {
        console.error('Error de registro de Supabase:', authError);
        setError(getAuthErrorMessage(authError));
      } else if (!data.session) {
        setNotice('Te enviamos un email para confirmar tu cuenta. Cuando la confirmes, inicia sesión.');
      }
    } catch (authError) {
      console.error('Error de registro de Supabase:', authError);
      setError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return <Screen><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.content}><Text style={styles.eyebrow}>UN CÍRCULO MÁS CERCANO</Text><Text style={styles.title}>Crea tu cuenta.</Text><Text style={styles.subtitle}>Solo para ti y tus amigos.</Text><Field value={values.name} onChangeText={set('name')} placeholder="Nombre" autoCapitalize="words" style={styles.field}/><Field value={values.username} onChangeText={set('username')} placeholder="Username" autoCapitalize="none" autoCorrect={false} style={styles.field}/><Field value={values.email} onChangeText={set('email')} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={styles.field}/><Field value={values.password} onChangeText={set('password')} placeholder="Contraseña" secureTextEntry textContentType="newPassword" style={styles.field}/><Field value={values.confirm} onChangeText={set('confirm')} placeholder="Confirmar contraseña" secureTextEntry textContentType="newPassword" style={styles.field}/>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}{notice ? <Text accessibilityRole="alert" style={styles.notice}>{notice}</Text> : null}<Button title={loading ? 'Creando cuenta…' : 'Crear cuenta'} disabled={loading} onPress={register}/><View style={styles.footer}><Text style={styles.footerText}>¿Ya tienes cuenta? </Text><Link href="/(auth)/login" style={styles.link}>Inicia sesión</Link></View></View></KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1, justifyContent: 'center' }, content: { padding: 24 }, eyebrow: { color: colors.accent, letterSpacing: 1.8, fontSize: 10, fontWeight: '800' }, title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 9 }, subtitle: { color: colors.muted, fontSize: 14, marginTop: 7, marginBottom: 24 }, field: { marginBottom: 11 }, error: { color: '#FF8585', fontSize: 13, marginBottom: 12, lineHeight: 19 }, notice: { color: colors.accent, fontSize: 13, marginBottom: 12, lineHeight: 19 }, footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 20 }, footerText: { color: colors.muted }, link: { color: colors.accent, fontWeight: '700' } });
