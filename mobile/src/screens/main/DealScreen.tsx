import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { listDeals, type Deal } from '../../services/deal';
import { colors } from '../../theme/colors';

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  draft: { label: 'Чернова', color: colors.textMuted },
  pending_signature: { label: 'Чака подпис', color: '#F59E0B' },
  signed: { label: 'Подписан', color: colors.primary },
  escrow_held: { label: 'Escrow', color: '#8B5CF6' },
  completed: { label: 'Завършен', color: colors.success },
  disputed: { label: 'Спор', color: colors.error },
  refunded: { label: 'Възстановен', color: colors.error },
  cancelled: { label: 'Отменен', color: colors.textMuted },
};

const TEMPLATE_ICONS: Record<string, string> = {
  rent: '🏠', service: '🔧', nda: '🤝', sale: '💰',
  protocol: '📋', offer: '📨', custom: '📄',
};

export function DealScreen({ navigation }: any) {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const data = await listDeals();
      setDeals(data);
    } catch {
      Alert.alert('Грешка', 'Неуспешно зареждане');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const renderDeal = ({ item }: { item: Deal }) => {
    const status = STATUS_LABELS[item.status] || STATUS_LABELS.draft;
    return (
      <Pressable style={styles.card} onPress={() => navigation.navigate('DealDetail', { dealId: item.id })}>
        <Text style={styles.icon}>{TEMPLATE_ICONS[item.template] || '📄'}</Text>
        <View style={styles.cardBody}>
          <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
          <View style={styles.cardRow}>
            <View style={[styles.statusBadge, { backgroundColor: status.color + '20' }]}>
              <Text style={[styles.statusText, { color: status.color }]}>{status.label}</Text>
            </View>
            {item.amount && (
              <Text style={styles.cardAmount}>{item.amount.toFixed(2)} {item.currency}</Text>
            )}
          </View>
          <Text style={styles.cardMeta}>
            {item.signature_type === 'kep' ? 'КЕП' : 'Обикновен'} · {new Date(item.created_at).toLocaleDateString('bg-BG')}
          </Text>
        </View>
      </Pressable>
    );
  };

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Deal</Text>

      <FlatList
        data={deals}
        keyExtractor={(d) => d.id}
        renderItem={renderDeal}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyIcon}>🤝</Text>
            <Text style={styles.emptyText}>Няма сделки</Text>
            <Text style={styles.emptyHint}>Създай сделка с бланка или от Connect</Text>
          </View>
        }
      />

      <Pressable style={styles.fab} onPress={() => navigation.navigate('DealCreate')}>
        <Text style={styles.fabText}>+</Text>
      </Pressable>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8, paddingBottom: 12 },
  list: { paddingBottom: 80 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  icon: { fontSize: 28, marginRight: 14 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 15, fontWeight: '600', color: colors.text },
  cardRow: { flexDirection: 'row', alignItems: 'center', marginTop: 6, gap: 8 },
  statusBadge: { borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 },
  statusText: { fontSize: 11, fontWeight: '700' },
  cardAmount: { fontSize: 14, fontWeight: '700', color: colors.text },
  cardMeta: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  empty: { alignItems: 'center', paddingTop: 60 },
  emptyIcon: { fontSize: 48 },
  emptyText: { fontSize: 18, fontWeight: '600', color: colors.text, marginTop: 12 },
  emptyHint: { fontSize: 14, color: colors.textMuted, marginTop: 4 },
  fab: {
    position: 'absolute', bottom: 24, right: 24, width: 56, height: 56, borderRadius: 28,
    backgroundColor: colors.primary, justifyContent: 'center', alignItems: 'center',
    elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.25, shadowRadius: 8,
  },
  fabText: { fontSize: 28, color: colors.white, fontWeight: '300', marginTop: -2 },
});
