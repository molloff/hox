import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, Pressable, StyleSheet,
  ActivityIndicator, Alert, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { getDashboard, payBill, payObligation, syncObligations, type Bill, type Obligation, type PayDashboard } from '../../services/pay';
import { authenticateWithBiometric } from '../../utils/biometric';
import { colors } from '../../theme/colors';

const LIGHT_COLORS = {
  green: '#10B981',
  yellow: '#F59E0B',
  red: '#EF4444',
  grey: '#9CA3AF',
};

export function PayScreen() {
  const [dashboard, setDashboard] = useState<PayDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [tab, setTab] = useState<'bills' | 'obligations'>('bills');

  const fetch = useCallback(async () => {
    try {
      const data = await getDashboard();
      setDashboard(data);
    } catch {
      Alert.alert('Грешка', 'Неуспешно зареждане');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const count = await syncObligations();
      Alert.alert('Готово', `${count} нови задължения намерени`);
      fetch();
    } catch {
      Alert.alert('Грешка', 'Синхронизацията не успя');
    } finally {
      setSyncing(false);
    }
  };

  const handlePayBill = async (bill: Bill) => {
    const confirmed = await authenticateWithBiometric('Потвърди плащане');
    if (!confirmed) return;
    try {
      await payBill(bill.id, true);
      Alert.alert('Платено', `${bill.title} — ${bill.amount} ${bill.currency}`);
      fetch();
    } catch {
      Alert.alert('Грешка', 'Плащането не успя');
    }
  };

  const handlePayObligation = async (obl: Obligation) => {
    const confirmed = await authenticateWithBiometric('Потвърди плащане');
    if (!confirmed) return;
    try {
      await payObligation(obl.id, true);
      Alert.alert('Платено', `${obl.title} — ${obl.amount} ${obl.currency}`);
      fetch();
    } catch {
      Alert.alert('Грешка', 'Плащането не успя');
    }
  };

  const renderBill = ({ item }: { item: Bill }) => (
    <View style={styles.card}>
      <View style={[styles.light, { backgroundColor: LIGHT_COLORS[item.traffic_light.color] }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardMeta}>
          {item.provider} · {item.source}
          {item.traffic_light.daysLeft !== null && item.status !== 'paid'
            ? ` · ${item.traffic_light.daysLeft > 0 ? `${item.traffic_light.daysLeft}д` : 'Просрочено!'}`
            : ''}
        </Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.amount}>{item.amount.toFixed(2)} {item.currency}</Text>
        {item.status !== 'paid' ? (
          <Pressable style={styles.payBtn} onPress={() => handlePayBill(item)}>
            <Text style={styles.payBtnText}>Плати</Text>
          </Pressable>
        ) : (
          <Text style={styles.paidLabel}>Платено</Text>
        )}
      </View>
    </View>
  );

  const renderObligation = ({ item }: { item: Obligation }) => (
    <View style={styles.card}>
      <View style={[styles.light, { backgroundColor: item.status === 'paid' ? LIGHT_COLORS.grey : LIGHT_COLORS.red }]} />
      <View style={styles.cardBody}>
        <Text style={styles.cardTitle} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.cardMeta}>{item.type} · {item.source}</Text>
      </View>
      <View style={styles.cardRight}>
        <Text style={styles.amount}>{item.amount.toFixed(2)} {item.currency}</Text>
        {item.status !== 'paid' ? (
          <Pressable style={styles.payBtn} onPress={() => handlePayObligation(item)}>
            <Text style={styles.payBtnText}>Плати</Text>
          </Pressable>
        ) : (
          <Text style={styles.paidLabel}>Платено</Text>
        )}
      </View>
    </View>
  );

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <Text style={styles.title}>Pay</Text>

      {/* Summary */}
      {dashboard && (
        <View style={styles.summary}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{dashboard.totalDue.toFixed(2)} лв</Text>
            <Text style={styles.summaryLabel}>Общо дължимо</Text>
          </View>
          <View style={styles.summaryItem}>
            <Text style={[styles.summaryValue, dashboard.overdueCount > 0 && { color: colors.error }]}>
              {dashboard.overdueCount}
            </Text>
            <Text style={styles.summaryLabel}>Просрочени</Text>
          </View>
        </View>
      )}

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable style={[styles.tab, tab === 'bills' && styles.tabActive]} onPress={() => setTab('bills')}>
          <Text style={[styles.tabText, tab === 'bills' && styles.tabTextActive]}>
            Сметки ({dashboard?.bills.length || 0})
          </Text>
        </Pressable>
        <Pressable style={[styles.tab, tab === 'obligations' && styles.tabActive]} onPress={() => setTab('obligations')}>
          <Text style={[styles.tabText, tab === 'obligations' && styles.tabTextActive]}>
            Задължения ({dashboard?.obligations.length || 0})
          </Text>
        </Pressable>
      </View>

      {tab === 'obligations' && (
        <Pressable style={styles.syncBtn} onPress={handleSync} disabled={syncing}>
          <Text style={styles.syncBtnText}>{syncing ? 'Проверяване...' : 'Провери НАП / КАТ / Община'}</Text>
        </Pressable>
      )}

      <FlatList
        data={tab === 'bills' ? dashboard?.bills || [] : dashboard?.obligations || []}
        keyExtractor={(item: any) => item.id}
        renderItem={tab === 'bills' ? renderBill : renderObligation}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>{tab === 'bills' ? 'Няма сметки' : 'Няма задължения'}</Text>
          </View>
        }
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8, paddingBottom: 12 },
  summary: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  summaryItem: {
    flex: 1, backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, alignItems: 'center',
  },
  summaryValue: { fontSize: 22, fontWeight: '800', color: colors.text },
  summaryLabel: { fontSize: 12, color: colors.textMuted, marginTop: 4 },
  tabs: { flexDirection: 'row', marginBottom: 12, gap: 8 },
  tab: {
    flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center',
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
  },
  tabActive: { backgroundColor: colors.primaryLight, borderColor: colors.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  tabTextActive: { color: colors.primary },
  syncBtn: {
    backgroundColor: colors.primaryLight, borderRadius: 10, paddingVertical: 10,
    alignItems: 'center', marginBottom: 12,
  },
  syncBtnText: { color: colors.primary, fontSize: 13, fontWeight: '700' },
  list: { paddingBottom: 20 },
  card: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 14, padding: 14,
    marginBottom: 8, borderWidth: 1, borderColor: colors.border,
  },
  light: { width: 8, height: 40, borderRadius: 4, marginRight: 12 },
  cardBody: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
  cardMeta: { fontSize: 11, color: colors.textMuted, marginTop: 3 },
  cardRight: { alignItems: 'flex-end', marginLeft: 8 },
  amount: { fontSize: 15, fontWeight: '700', color: colors.text },
  payBtn: {
    backgroundColor: colors.primary, borderRadius: 8, paddingHorizontal: 14, paddingVertical: 6, marginTop: 6,
  },
  payBtnText: { color: colors.white, fontSize: 12, fontWeight: '700' },
  paidLabel: { color: colors.success, fontSize: 12, fontWeight: '600', marginTop: 6 },
  empty: { alignItems: 'center', paddingTop: 40 },
  emptyText: { fontSize: 15, color: colors.textMuted },
});
