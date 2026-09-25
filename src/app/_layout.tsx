import { DarkTheme, ThemeProvider, Stack, useRouter, useSegments } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';

import { AppStateProvider } from '@/features/app-state';
import { colors } from '@/constants/theme';
import { ImageViewerProvider } from '@/components/ui/image-viewer';
import { AuthProvider, useAuth } from '@/features/auth/auth-provider';

function SessionRoutes() {
  const { session, isLoading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const inAuth = segments[0] === '(auth)';
  const inAuthCallback = segments[0] === 'auth' && segments[1] === 'callback';
  const routeAllowed = session ? !inAuth && !inAuthCallback : inAuth || inAuthCallback;

  useEffect(() => {
    if (isLoading) return;
    if (!session && !inAuth && !inAuthCallback) router.replace('/(auth)/login');
    else if (session && (inAuth || inAuthCallback)) router.replace('/(tabs)');
  }, [inAuth, inAuthCallback, isLoading, router, session]);

  return <View style={{ flex: 1, backgroundColor: colors.background }}><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
    <Stack.Screen name="index" />
    <Stack.Screen name="(tabs)" />
    <Stack.Screen name="(auth)" />
    <Stack.Screen name="auth/callback" />
    <Stack.Screen name="post/[id]" options={{ presentation: 'card' }} />
    <Stack.Screen name="user/[username]" options={{ presentation: 'card' }} />
    <Stack.Screen name="edit-profile" options={{ presentation: 'card' }} />
  </Stack>{(isLoading || !routeAllowed) && <View style={{ position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center' }}><ActivityIndicator color={colors.accent} /></View>}</View>;
}

export default function RootLayout() {
  return (
    <ThemeProvider value={{ ...DarkTheme, colors: { ...DarkTheme.colors, background: colors.background, card: colors.background, text: colors.text, border: colors.border } }}>
      <ImageViewerProvider>
        <AppStateProvider>
          <AuthProvider>
            <StatusBar style="light" />
            <SessionRoutes />
          </AuthProvider>
        </AppStateProvider>
      </ImageViewerProvider>
    </ThemeProvider>
  );
}
