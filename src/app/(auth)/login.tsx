import { useState } from 'react';
import { Link } from 'expo-router';
import { KeyboardAvoidingView, Platform, StyleSheet, Text, View } from 'react-native';
import { Button, Field, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { getAuthErrorMessage, isValidEmail } from '@/features/auth/errors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const signIn = async () => {
    if (loading) return;
    setSubmitted(true);
    setError('');
    if (!isValidEmail(email.trim())) { setError('Escribe un email válido.'); return; }
    if (!password) { setError('Escribe tu contraseña.'); return; }
    setLoading(true);
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (authError) {
        console.error('Error de inicio de sesión de Supabase:', authError);
        setError(getAuthErrorMessage(authError));
      }
    } catch (authError) {
      console.error('Error de inicio de sesión de Supabase:', authError);
      setError('No pudimos conectarnos. Revisa tu conexión e inténtalo de nuevo.');
    } finally {
      setLoading(false);
    }
  };

  return <Screen><KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}><View style={styles.content}><View style={styles.mark}><Text style={styles.markText}>v</Text></View><Text style={styles.eyebrow}>LA SOBREMESA</Text><Text style={styles.title}>Qué bueno verte.</Text><Text style={styles.subtitle}>Entra a tu rincón privado con amigos.</Text><Field value={email} onChangeText={(value) => { setEmail(value); if (submitted) setError(''); }} placeholder="Email" keyboardType="email-address" autoCapitalize="none" autoCorrect={false} textContentType="emailAddress" style={styles.field}/><Field value={password} onChangeText={(value) => { setPassword(value); if (submitted) setError(''); }} placeholder="Contraseña" secureTextEntry textContentType="password" style={styles.field}/>{error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}<Button title={loading ? 'Iniciando sesión…' : 'Iniciar sesión'} disabled={loading} onPress={signIn}/><View style={styles.footer}><Text style={styles.footerText}>¿Todavía no tienes cuenta? </Text><Link href="/(auth)/register" style={styles.link}>Regístrate</Link></View></View></KeyboardAvoidingView></Screen>;
}
const styles = StyleSheet.create({ flex: { flex: 1, justifyContent: 'center' }, content: { padding: 25 }, mark: { width: 54, height: 54, borderRadius: 19, backgroundColor: colors.accent, alignItems: 'center', justifyContent: 'center', marginBottom: 28 }, markText: { color: colors.background, fontSize: 34, fontWeight: '900' }, eyebrow: { color: colors.accent, letterSpacing: 2, fontSize: 11, fontWeight: '800' }, title: { color: colors.text, fontSize: 30, fontWeight: '800', marginTop: 10 }, subtitle: { color: colors.muted, fontSize: 15, marginTop: 8, marginBottom: 28 }, field: { marginBottom: 13 }, error: { color: '#FF8585', fontSize: 13, marginBottom: 12, lineHeight: 19 }, footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 23 }, footerText: { color: colors.muted }, link: { color: colors.accent, fontWeight: '700' } });
