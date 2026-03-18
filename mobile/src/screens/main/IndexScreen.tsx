import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet,
  ActivityIndicator, RefreshControl,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { getScore, getEvents, type HoxScore, type IndexEvent } from '../../services/index';
import { colors } from '../../theme/colors';

const PILLAR_LABELS: Record<string, { label: string; icon: string }> = {
  financial: { label: 'Финансов', icon: '💰' },
  behavioral: { label: 'Поведенчески', icon: '🤝' },
  physical: { label: 'Физически', icon: '🏃' },
  civic: { label: 'Граждански', icon: '🏛' },
};

const SOURCE_LABELS: Record<string, string> = {
  official: 'Официален',
  system: 'Системен',
  verified: 'Верифициран',
  self: 'Ръчен',
};

export function IndexScreen() {
  const [score, setScore] = useState<HoxScore | null>(null);
  const [events, setEvents] = useState<IndexEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetch = useCallback(async () => {
    try {
      const [s, e] = await Promise.all([getScore(), getEvents(30)]);
      setScore(s);
      setEvents(e);
    } catch {} finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  if (loading) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <FlatList
        data={events}
        keyExtractor={(e) => e.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetch(); }} />}
        ListHeaderComponent={
          <>
            <Text style={styles.title}>HOX Index</Text>

            {/* Score circle */}
            {score && (
              <View style={styles.scoreContainer}>
                <View style={styles.scoreCircle}>
                  <Text style={styles.scoreValue}>{score.percentage}%</Text>
                  <Text style={styles.scoreLabel}>HOX Score</Text>
                </View>
                <Text style={styles.scoreTotal}>{score.total.toFixed(1)} точки от {score.eventCount} събития</Text>
              </View>
            )}

            {/* Pillars */}
            {score && (
              <View style={styles.pillars}>
                {score.pillars.map((p) => {
                  const info = PILLAR_LABELS[p.pillar] || { label: p.pillar, icon: '📊' };
                  const barWidth = Math.min(100, Math.max(5, (p.weightedScore / (score.total || 1)) * 100));
                  return (
                    <View key={p.pillar} style={styles.pillarRow}>
                      <Text style={styles.pillarIcon}>{info.icon}</Text>
                      <View style={styles.pillarInfo}>
                        <View style={styles.pillarHeader}>
                          <Text style={styles.pillarName}>{info.label}</Text>
                          <Text style={styles.pillarWeight}>{(p.weight * 100).toFixed(0)}%</Text>
                        </View>
                        <View style={styles.barBg}>
                          <View style={[styles.barFill, { width: `${barWidth}%` }]} />
                        </View>
                        <Text style={styles.pillarScore}>{p.weightedScore.toFixed(1)} точки</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            )}

            {/* Formula explanation */}
            <View style={styles.formula}>
              <Text style={styles.formulaTitle}>Как работи</Text>
              <Text style={styles.formulaText}>
                Score = Σ(действие × тежест на източника) с дневен таван{'\n\n'}
                Тежест: Официален 3.0× · Системен 1.5× · Верифициран 1.0× · Ръчен 0.3×{'\n\n'}
                Таван: макс. +1/ден от сметки — 10 сметки за 1 ден = само +1 точка{'\n\n'}
                Наказания НЯМАТ таван — само наградите имат.
              </Text>
            </View>

            <Text style={styles.sectionTitle}>Последни събития</Text>
          </>
        }
        renderItem={({ item }) => (
          <View style={styles.eventCard}>
            <View style={[styles.eventDot, { backgroundColor: item.delta >= 0 ? colors.success : colors.error }]} />
            <View style={styles.eventBody}>
              <Text style={styles.eventName}>{item.event_name}</Text>
              <Text style={styles.eventMeta}>
                {SOURCE_LABELS[item.source] || item.source} · {PILLAR_LABELS[item.pillar]?.label || item.pillar}
              </Text>
            </View>
            <Text style={[styles.eventDelta, { color: item.delta >= 0 ? colors.success : colors.error }]}>
              {item.delta >= 0 ? '+' : ''}{(item.delta * item.weight).toFixed(1)}
            </Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={<Text style={styles.emptyText}>Няма събития — започни да използваш HOX</Text>}
      />
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 28, fontWeight: '800', color: colors.text, paddingTop: 8 },
  scoreContainer: { alignItems: 'center', marginVertical: 24 },
  scoreCircle: {
    width: 140, height: 140, borderRadius: 70,
    borderWidth: 6, borderColor: colors.primary,
    justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.primaryLight,
  },
  scoreValue: { fontSize: 36, fontWeight: '900', color: colors.primary },
  scoreLabel: { fontSize: 12, color: colors.primaryDark, fontWeight: '600' },
  scoreTotal: { fontSize: 13, color: colors.textMuted, marginTop: 8 },
  pillars: {
    backgroundColor: colors.surface, borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: colors.border, marginBottom: 16,
  },
  pillarRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  pillarIcon: { fontSize: 22, marginRight: 12 },
  pillarInfo: { flex: 1 },
  pillarHeader: { flexDirection: 'row', justifyContent: 'space-between' },
  pillarName: { fontSize: 14, fontWeight: '600', color: colors.text },
  pillarWeight: { fontSize: 12, color: colors.textMuted },
  barBg: { height: 6, backgroundColor: colors.border, borderRadius: 3, marginTop: 6 },
  barFill: { height: 6, backgroundColor: colors.primary, borderRadius: 3 },
  pillarScore: { fontSize: 11, color: colors.textMuted, marginTop: 4 },
  formula: {
    backgroundColor: colors.primaryLight, borderRadius: 14, padding: 16, marginBottom: 20,
  },
  formulaTitle: { fontSize: 14, fontWeight: '700', color: colors.primaryDark, marginBottom: 8 },
  formulaText: { fontSize: 12, color: colors.primaryDark, lineHeight: 18 },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
  list: { paddingBottom: 20 },
  eventCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.surface, borderRadius: 10, padding: 12,
    marginBottom: 6, borderWidth: 1, borderColor: colors.border,
  },
  eventDot: { width: 8, height: 8, borderRadius: 4, marginRight: 12 },
  eventBody: { flex: 1 },
  eventName: { fontSize: 13, fontWeight: '600', color: colors.text },
  eventMeta: { fontSize: 11, color: colors.textMuted, marginTop: 2 },
  eventDelta: { fontSize: 15, fontWeight: '800' },
  emptyText: { textAlign: 'center', color: colors.textMuted, fontSize: 14, paddingTop: 20 },
});
