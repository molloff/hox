import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  listNotifications, markAsRead, markAllAsRead,
  type Notification,
} from '../../services/notifications';
import { colors } from '../../theme/colors';

const CATEGORY_ICONS: Record<string, string> = {
  bill_reminder: '🟡',
  bill_overdue: '🔴',
  obligation_detected: '🚨',
  obligation_reminder: '🏛',
  document_expiry: '📄',
  deal_update: '🤝',
  deal_signature: '✍️',
  deal_completed: '✅',
  kyc_update: '🪪',
  index_update: '📊',
  connect_message: '💬',
  system: '⚙️',
  morning_briefing: '☀️',
  medication_reminder: '💊',
  vaccination_reminder: '💉',
};

const PRIORITY_COLORS: Record<string, string> = {
  critical: colors.error,
  high: '#F59E0B',
  normal: colors.primary,
  low: colors.textMuted,
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'сега';
  if (mins < 60) return `${mins} мин`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч`;
  const days = Math.floor(hours / 24);
  return `${days} д`;
}

export function NotificationsScreen({ navigation }: any) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await listNotifications(100);
      setNotifications(data);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handlePress = async (notif: Notification) => {
    if (!notif.read) {
      await markAsRead(notif.id);
      setNotifications((n) => n.map((x) => x.id === notif.id ? { ...x, read: true } : x));
    }
    // Deep link
    const screen = notif.data?.screen as string;
    if (screen) {
      navigation.navigate(screen, notif.data);
    }
  };

  const handleMarkAllRead = async () => {
    await markAllAsRead();
    setNotifications((n) => n.map((x) => ({ ...x, read: true })));
  };

  const unreadCount = notifications.filter((n) => !n.read).length;

  const renderNotification = ({ item }: { item: Notification }) => (
    <Pressable
      style={[styles.card, !item.read && styles.cardUnread]}
      onPress={() => handlePress(item)}
    >
      <Text style={styles.icon}>{CATEGORY_ICONS[item.category] || '🔔'}</Text>
      <View style={styles.cardBody}>
        <Text style={[styles.cardTitle, !item.read && styles.cardTitleUnread]} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.cardText} numberOfLines={2}>{item.body}</Text>
        <Text style={styles.cardTime}>{timeAgo(item.created_at)}</Text>
      </View>
      {!item.read && (
        <View style={[styles.dot, { backgroundColor: PRIORITY_COLORS[item.priority] || colors.primary }]} />
      )}
    </Pressable>
  );

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <Text style={styles.title}>Известия</Text>
        <View style={styles.headerRight}>
          {unreadCount > 0 && (
            <Pressable onPress={handleMarkAllRead}>
              <Text style={styles.markAll}>Прочети всички</Text>
            </Pressable>
          )}
          <Pressable onPress={() => navigation.navigate('NotificationSettings')}>
            <Text style={styles.settingsBtn}>⚙️</Text>
          </Pressable>
        </View>
      </View>

      {unreadCount > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{unreadCount} непрочетени</Text>
        </View>
      )}

      <FlatList
        data={notifications}
        keyExtractor={(n) => n.id}
        renderItem={renderNotification}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🔔</Text>
            <Text style={styles.emptyText}>Няма известия</Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: 8, paddingBottom: 12 },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  markAll: { fontSize: 13, fontWeight: '600', color: colors.primary },
  settingsBtn: { fontSize: 22 },
  badge: {
    backgroundColor: colors.primaryLight, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 6,
    alignSelf: 'flex-start', marginBottom: 12,
  },
  badgeText: { fontSize: 13, fontWeight: '700', color: colors.primary },
  list: { paddingBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: colors.border,
  },
  cardUnread: { backgroundColor: colors.primaryLight, borderColor: colors.primary + '40' },
  icon: { fontSize: 24, marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '500', color: colors.text },
  cardTitleUnread: { fontWeight: '700' },
  cardText: { fontSize: 13, color: colors.textSecondary, marginTop: 3, lineHeight: 18 },
  cardTime: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  dot: { width: 10, height: 10, borderRadius: 5, marginLeft: 8 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 15, color: colors.textMuted, marginTop: 12 },
});
