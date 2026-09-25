import { useCallback, useState } from 'react';
import { useFocusEffect, router } from 'expo-router';
import { ActivityIndicator, Alert, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/profiles/avatar';
import { Header, Screen } from '@/components/ui/primitives';
import { colors } from '@/constants/theme';
import { useAppState } from '@/features/app-state';
import { useAuth } from '@/features/auth/auth-provider';
import type { SocialNotification } from '@/features/supabase-social';

function actionText(type: SocialNotification['type']): string {
  switch (type) {
    case 'follow': return 'empezó a seguirte';
    case 'like': return 'le dio Me gusta a tu publicación';
    case 'repost': return 'revirgueó tu publicación';
    case 'comment': return 'comentó tu publicación';
    case 'reply': return 'respondió a tu comentario';
  }
}

function NotificationRow({ item, onPress }: { item: SocialNotification; onPress: (item: SocialNotification) => void }) {
  const name = item.actor.name || `@${item.actor.username}`;
  const unread = item.readAt === null;
  return <Pressable
    accessibilityRole="button"
    accessibilityLabel={`${name} ${actionText(item.type)}, ${item.time}${unread ? ', no leída' : ''}`}
    onPress={() => onPress(item)}
    style={({ pressed }) => [styles.row, unread && styles.unreadRow, pressed && styles.pressed]}
  >
    <Avatar uri={item.actor.avatar} size={44}/>
    <View style={styles.copy}>
      <Text style={styles.name}>{name}<Text style={styles.username}>  @{item.actor.username}</Text></Text>
      <Text style={styles.action}>{actionText(item.type)}</Text>
      <Text style={styles.time}>{item.time}</Text>
    </View>
    {unread && <View accessibilityLabel="No leída" style={styles.unreadDot}/>}
  </Pressable>;
}

export default function NotificationsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;
  const {
    notifications,
    unreadNotificationCount,
    isLoadingNotifications,
    notificationsError,
    refreshNotifications,
    markNotificationRead,
    markAllNotificationsRead,
  } = useAppState();
  const [markingAll, setMarkingAll] = useState(false);

  useFocusEffect(useCallback(() => {
    void refreshNotifications(userId);
  }, [refreshNotifications, userId]));

  const openNotification = async (item: SocialNotification) => {
    if (userId && !item.readAt) {
      try {
        await markNotificationRead(item.id, userId);
      } catch (error) {
        Alert.alert('No se pudo actualizar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
      }
    }
    if (item.type !== 'follow' && item.postId) {
      router.push({ pathname: '/post/[id]', params: { id: item.postId } });
      return;
    }
    router.push({ pathname: '/user/[username]', params: { username: item.actor.username } });
  };

  const markAllAsRead = async () => {
    if (!userId || markingAll || unreadNotificationCount === 0) return;
    setMarkingAll(true);
    try {
      await markAllNotificationsRead(userId);
    } catch (error) {
      Alert.alert('No se pudieron actualizar', error instanceof Error ? error.message : 'Inténtalo de nuevo.');
    } finally {
      setMarkingAll(false);
    }
  };

  const emptyContent = isLoadingNotifications
    ? <ActivityIndicator color={colors.accent} style={styles.empty}/>
    : notificationsError
      ? <Pressable accessibilityRole="button" onPress={() => void refreshNotifications(userId)}><Text style={styles.emptyText}>{notificationsError} Toca para volver a intentar.</Text></Pressable>
      : <Text style={styles.emptyText}>Todavía no tienes notificaciones.</Text>;

  return <Screen>
    <View style={styles.headerRow}>
      <Header title="Notificaciones" subtitle="Interactuaron con vos, bien ahí" />
      {unreadNotificationCount > 0 && <Pressable
        accessibilityRole="button"
        onPress={() => void markAllAsRead()}
        disabled={markingAll}
        style={styles.markAllButton}
      >
        <Text style={styles.markAllText}>{markingAll ? 'Actualizando…' : 'Marcar todas como leídas'}</Text>
      </Pressable>}
    </View>
    {notificationsError && notifications.length > 0 && <Pressable onPress={() => void refreshNotifications(userId)}><Text style={styles.error}>{notificationsError} · Toca para reintentar</Text></Pressable>}
    <FlatList
      data={notifications}
      keyExtractor={(item) => item.id}
      renderItem={({ item }) => <NotificationRow item={item} onPress={(selected) => void openNotification(selected)}/>}
      ListEmptyComponent={emptyContent}
      refreshControl={<RefreshControl refreshing={isLoadingNotifications} onRefresh={() => void refreshNotifications(userId)} tintColor={colors.accent} colors={[colors.accent]}/>}
      contentContainerStyle={[styles.list, notifications.length === 0 && styles.emptyList]}
      showsVerticalScrollIndicator={false}
    />
  </Screen>;
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 18 },
  markAllButton: { paddingHorizontal: 11, paddingVertical: 8, borderRadius: 18, backgroundColor: colors.surfaceRaised },
  markAllText: { color: colors.accent, fontSize: 11, fontWeight: '700' },
  error: { color: colors.danger, paddingHorizontal: 20, paddingBottom: 10, fontSize: 12 },
  list: { paddingBottom: 20 },
  emptyList: { flexGrow: 1, justifyContent: 'center' },
  empty: { marginTop: 36 },
  emptyText: { color: colors.muted, textAlign: 'center', paddingHorizontal: 28, paddingVertical: 32, lineHeight: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 18, paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: colors.border },
  unreadRow: { backgroundColor: '#111812' },
  pressed: { opacity: 0.76 },
  copy: { flex: 1 },
  name: { color: colors.text, fontSize: 14, fontWeight: '700' },
  username: { color: colors.muted, fontSize: 12, fontWeight: '400' },
  action: { color: colors.text, fontSize: 13, marginTop: 4 },
  time: { color: colors.muted, fontSize: 11, marginTop: 5 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent },
});
