import React, { useEffect, useState } from 'react';
import {
  View, Text, ScrollView, Pressable, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import {
  getDeal, signDeal, completeDeal, disputeDeal, createEscrow, getContract,
  type Deal, type DealEvent,
} from '../../services/deal';
import { authenticateWithBiometric } from '../../utils/biometric';
import { colors } from '../../theme/colors';

export function DealDetailScreen({ route }: any) {
  const { dealId } = route.params;
  const [deal, setDeal] = useState<Deal | null>(null);
  const [events, setEvents] = useState<DealEvent[]>([]);
  const [contract, setContract] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetch = async () => {
    try {
      const data = await getDeal(dealId);
      setDeal(data.deal);
      setEvents(data.events);
    } catch {
      Alert.alert('Грешка', 'Неуспешно зареждане');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetch(); }, [dealId]);

  const handleSign = async () => {
    const confirmed = await authenticateWithBiometric('Подпиши договор');
    if (!confirmed) return;
    try {
      await signDeal(dealId);
      Alert.alert('Подписано', 'Договорът е подписан');
      fetch();
    } catch (err) {
      Alert.alert('Грешка', err instanceof Error ? err.message : 'Подписването не успя');
    }
  };

  const handleEscrow = async () => {
    try {
      await createEscrow(dealId);
      Alert.alert('Escrow', 'Парите са задържани в Stripe');
      fetch();
    } catch (err) {
      Alert.alert('Грешка', err instanceof Error ? err.message : 'Escrow не успя');
    }
  };

  const handleComplete = async () => {
    const confirmed = await authenticateWithBiometric('Потвърди завършване');
    if (!confirmed) return;
    try {
      await completeDeal(dealId);
      Alert.alert('Завършено', 'Сделката е завършена. Парите са освободени.');
      fetch();
    } catch (err) {
      Alert.alert('Грешка', err instanceof Error ? err.message : 'Не успя');
    }
  };

  const handleDispute = () => {
    Alert.prompt('Спор', 'Опиши причината:', async (reason) => {
      if (!reason) return;
      try {
        await disputeDeal(dealId, reason);
        Alert.alert('Спор', 'Парите ще бъдат възстановени в 48ч.');
        fetch();
      } catch {
        Alert.alert('Грешка', 'Не успя');
      }
    });
  };

  const handleViewContract = async () => {
    try {
      const text = await getContract(dealId);
      setContract(text);
    } catch {
      Alert.alert('Грешка', 'Не успя');
    }
  };

  if (loading || !deal) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{deal.title}</Text>
        <Text style={styles.meta}>
          {deal.template.toUpperCase()} · {deal.signature_type === 'kep' ? 'КЕП' : 'Обикновен'}
        </Text>
        {deal.amount && (
          <Text style={styles.amount}>{deal.amount.toFixed(2)} {deal.currency}</Text>
        )}
        {deal.description ? <Text style={styles.desc}>{deal.description}</Text> : null}

        {/* Status */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Статус</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Създател подписал:</Text>
            <Text style={deal.creator_signed_at ? styles.yes : styles.no}>
              {deal.creator_signed_at ? '✓ Да' : '✗ Не'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>Насрещна страна подписала:</Text>
            <Text style={deal.counter_signed_at ? styles.yes : styles.no}>
              {deal.counter_signed_at ? '✓ Да' : '✗ Не'}
            </Text>
          </View>
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Действия</Text>

          {['draft', 'pending_signature'].includes(deal.status) && (
            <Pressable style={styles.actionBtn} onPress={handleSign}>
              <Text style={styles.actionBtnText}>Подпиши</Text>
            </Pressable>
          )}

          {deal.status === 'signed' && deal.amount && (
            <Pressable style={styles.actionBtn} onPress={handleEscrow}>
              <Text style={styles.actionBtnText}>Създай Escrow</Text>
            </Pressable>
          )}

          {['signed', 'escrow_held'].includes(deal.status) && (
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.success }]} onPress={handleComplete}>
              <Text style={styles.actionBtnText}>Потвърди завършване</Text>
            </Pressable>
          )}

          {['escrow_held', 'signed'].includes(deal.status) && (
            <Pressable style={[styles.actionBtn, { backgroundColor: colors.error }]} onPress={handleDispute}>
              <Text style={styles.actionBtnText}>Оспорване</Text>
            </Pressable>
          )}

          <Pressable style={styles.contractBtn} onPress={handleViewContract}>
            <Text style={styles.contractBtnText}>Виж договора</Text>
          </Pressable>
        </View>

        {/* Contract preview */}
        {contract && (
          <View style={styles.contractBox}>
            <Text style={styles.contractText}>{contract}</Text>
          </View>
        )}

        {/* Event history */}
        {events.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>История</Text>
            {events.map((e) => (
              <View key={e.id} style={styles.eventRow}>
                <Text style={styles.eventAction}>{e.action}</Text>
                <Text style={styles.eventDate}>{new Date(e.created_at).toLocaleString('bg-BG')}</Text>
              </View>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 22, fontWeight: '700', color: colors.text, marginTop: 8 },
  meta: { fontSize: 13, color: colors.textMuted, marginTop: 4 },
  amount: { fontSize: 28, fontWeight: '800', color: colors.primary, marginTop: 8 },
  desc: { fontSize: 14, color: colors.textSecondary, marginTop: 10, lineHeight: 20 },
  section: {
    marginTop: 24, backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border,
  },
  sectionTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 12 },
  statusRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6 },
  statusLabel: { fontSize: 14, color: colors.textSecondary },
  yes: { fontSize: 14, fontWeight: '700', color: colors.success },
  no: { fontSize: 14, fontWeight: '700', color: colors.textMuted },
  actionBtn: {
    backgroundColor: colors.primary, borderRadius: 10, paddingVertical: 14,
    alignItems: 'center', marginBottom: 8,
  },
  actionBtnText: { color: colors.white, fontSize: 15, fontWeight: '700' },
  contractBtn: {
    borderWidth: 2, borderColor: colors.primary, borderRadius: 10,
    paddingVertical: 12, alignItems: 'center', marginTop: 4,
  },
  contractBtnText: { color: colors.primary, fontSize: 14, fontWeight: '700' },
  contractBox: {
    marginTop: 16, backgroundColor: '#FFFBEB', borderRadius: 12, padding: 16,
    borderWidth: 1, borderColor: '#FDE68A',
  },
  contractText: { fontSize: 12, color: '#78350F', fontFamily: 'monospace', lineHeight: 18 },
  eventRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6,
    borderTopWidth: 1, borderTopColor: colors.border,
  },
  eventAction: { fontSize: 13, color: colors.text, fontWeight: '500' },
  eventDate: { fontSize: 11, color: colors.textMuted },
});
