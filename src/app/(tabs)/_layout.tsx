import { useEffect } from 'react';
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { SymbolView } from 'expo-symbols';

import { colors } from '@/constants/theme';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';

const icons: Record<string, string> = { index: '⌂', create: '+', profile: '◉' };
const labels: Record<string, string> = { index: 'Inicio', search: 'Buscar', create: 'Publicar', notifications: 'Notificaciones', profile: 'Perfil' };

export default function TabsLayout() {
  const { refreshPosts, scrollHomeToTop, refreshUnreadNotifications, unreadNotificationCount } = useAppState();
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  useEffect(() => {
    void refreshUnreadNotifications(userId);
    const timer = setInterval(() => { void refreshUnreadNotifications(userId); }, 60_000);
    return () => clearInterval(timer);
  }, [refreshUnreadNotifications, userId]);

  return (
    <Tabs screenOptions={({ route }) => ({
      headerShown: false,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.muted,
      tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border, height: 62, paddingTop: 7, paddingBottom: 7 },
      tabBarIconStyle: route.name === 'notifications' || route.name === 'search' ? undefined : { transform: [{ translateY: -7 }] },
      tabBarLabel: labels[route.name],
      tabBarIcon: ({ color, size }) => route.name === 'notifications'
        ? <SymbolView name={{ ios: 'bell', android: 'notifications', web: 'notifications' }} tintColor={color} size={size + 3} weight="regular" />
        : route.name === 'search'
          ? <SymbolView name={{ ios: 'magnifyingglass', android: 'search', web: 'search' }} tintColor={color} size={size + 3} weight="regular" />
        : <Text style={{ color, fontSize: size + 3 }}>{icons[route.name]}</Text>,
      ...(route.name === 'notifications' && unreadNotificationCount > 0 ? {
        tabBarBadge: unreadNotificationCount > 99 ? '99+' : unreadNotificationCount,
        tabBarBadgeStyle: { backgroundColor: colors.accent, color: colors.background },
      } : {}),
    })}>
      <Tabs.Screen name="index" listeners={({ navigation }) => ({
        tabPress: () => {
          void refreshUnreadNotifications(userId);
          if (navigation.isFocused()) {
            scrollHomeToTop();
            void refreshPosts(userId);
          }
        },
      })} />
      <Tabs.Screen name="search" options={{ tabBarAccessibilityLabel: 'Buscar' }} />
      <Tabs.Screen name="create" />
      <Tabs.Screen name="notifications" options={{ tabBarAccessibilityLabel: 'Notificaciones' }} />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
