import { useEffect, useRef, useState } from 'react';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { Button, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { supabase } from '@/lib/supabase';

type CallbackParams = {
  code?: string | string[];
  error?: string | string[];
  error_code?: string | string[];
  error_description?: string | string[];
};

const firstValue = (value: unknown): string | undefined => Array.isArray(value) ? firstValue(value[0]) : typeof value === 'string' ? value : undefined;

export default function AuthCallbackScreen() {
  const { code: codeParam, error: errorParam, error_code: errorCodeParam, error_description: errorDescriptionParam } = useLocalSearchParams<CallbackParams>();
  const linkingUrl = Linking.useLinkingURL();
  const parsedParams = linkingUrl ? Linking.parse(linkingUrl).queryParams : null;
  const fragment = linkingUrl?.split('#')[1];
  const fragmentParams = fragment ? Object.fromEntries(new URLSearchParams(fragment.startsWith('?') ? fragment.slice(1) : fragment)) : {};
  const code = firstValue(codeParam) || firstValue(parsedParams?.code) || firstValue(fragmentParams.code);
  const error = firstValue(errorParam) || firstValue(parsedParams?.error) || firstValue(fragmentParams.error);
  const errorCode = firstValue(errorCodeParam) || firstValue(parsedParams?.error_code) || firstValue(fragmentParams.error_code);
  const errorDescription = firstValue(errorDescriptionParam) || firstValue(parsedParams?.error_description) || firstValue(fragmentParams.error_description);
  const authError = errorDescription || error || errorCode;
  const attemptedCode = useRef<string | null>(null);
  const [exchangeErrorMessage, setExchangeErrorMessage] = useState('');
  const errorMessage = authError
    ? 'El enlace de confirmación no funcionó o ya venció. Vuelve a iniciar sesión o solicita otro email.'
    : exchangeErrorMessage;

  useEffect(() => {
    if (authError) {
      attemptedCode.current = 'error';
      console.error('Supabase devolvió un error al confirmar el email:', { error, code: errorCode, description: errorDescription });
      return;
    }

    if (!code || attemptedCode.current === code) return;
    attemptedCode.current = code;
    void supabase.auth.exchangeCodeForSession(code).then(({ error: exchangeError }) => {
      if (exchangeError) {
        console.error('No se pudo intercambiar el código de confirmación de Supabase:', exchangeError);
        setExchangeErrorMessage('No pudimos confirmar tu email. El enlace puede haber vencido; solicita uno nuevo e inténtalo otra vez.');
      }
    }).catch((exchangeError: unknown) => {
      console.error('Error al procesar la confirmación de email:', exchangeError);
      setExchangeErrorMessage('No pudimos confirmar tu email. Revisa tu conexión e inténtalo de nuevo.');
    });
  }, [authError, code, error, errorCode, errorDescription]);

  return <Screen><View style={styles.container}>{errorMessage ? <><Text style={styles.title}>No pudimos confirmar tu email</Text><Text style={styles.message}>{errorMessage}</Text><Button title="Ir a iniciar sesión" onPress={() => router.replace('/(auth)/login')} /></> : <><ActivityIndicator color={colors.accent} /><Text style={styles.title}>Confirmando tu correo</Text><Text style={styles.message}>Un momento, estamos preparando tu cuenta.</Text></>}</View></Screen>;
}

const styles = StyleSheet.create({ container: { flex: 1, justifyContent: 'center', padding: 28 }, title: { color: colors.text, fontSize: 23, fontWeight: '800', marginTop: 18 }, message: { color: colors.muted, fontSize: 14, lineHeight: 21, marginTop: 10, marginBottom: 22 } });
