import React, { useEffect, useState } from 'react';
import {
  View, Text, Switch, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { getPreferences, updatePreferences, type NotificationPreferences } from '../../services/notifications';
import { colors } from '../../theme/colors';

interface ToggleRowProps {
  label: string;
  description: string;
  value: boolean;
  onToggle: (val: boolean) => void;
}

function ToggleRow({ label, description, value, onToggle }: ToggleRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel}>{label}</Text>
        <Text style={styles.rowDesc}>{description}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ true: colors.primary, false: colors.border }}
        thumbColor={colors.white}
      />
    </View>
  );
}

export function NotificationSettingsScreen() {
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const data = await getPreferences();
        setPrefs(data);
      } catch {
        Alert.alert('Грешка', 'Неуспешно зареждане');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const toggle = async (key: keyof NotificationPreferences, value: boolean) => {
    if (!prefs) return;
    const updated = { ...prefs, [key]: value };
    setPrefs(updated);
    try {
      await updatePreferences({ [key]: value });
    } catch {
      setPrefs(prefs); // revert
    }
  };

  if (loading || !prefs) {
    return <ScreenWrapper><ActivityIndicator size="large" color={colors.primary} style={{ flex: 1 }} /></ScreenWrapper>;
  }

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>Настройки на известията</Text>

        <Text style={styles.section}>Общи</Text>
        <ToggleRow
          label="Push известия"
          description="Получавай известия на телефона"
          value={prefs.push_enabled}
          onToggle={(v) => toggle('push_enabled', v)}
        />

        <Text style={styles.section}>Утринен брифинг</Text>
        <ToggleRow
          label="Утринен брифинг"
          description={`Ежедневен преглед в ${prefs.briefing_time}`}
          value={prefs.morning_briefing}
          onToggle={(v) => toggle('morning_briefing', v)}
        />

        <Text style={styles.section}>Сметки и задължения</Text>
        <ToggleRow
          label="Напомняне за сметки"
          description={`${prefs.bill_reminder_days} дни преди падеж`}
          value={prefs.bill_reminders}
          onToggle={(v) => toggle('bill_reminders', v)}
        />
        <ToggleRow
          label="Държавни задължения"
          description="НАП, КАТ, Община — веднага при засичане"
          value={prefs.obligation_alerts}
          onToggle={(v) => toggle('obligation_alerts', v)}
        />

        <Text style={styles.section}>Документи</Text>
        <ToggleRow
          label="Изтичащи документи"
          description="ЛК, паспорт, гаранции, застраховки"
          value={prefs.document_expiry}
          onToggle={(v) => toggle('document_expiry', v)}
        />

        <Text style={styles.section}>Сделки</Text>
        <ToggleRow
          label="Сделки"
          description="Подпис, escrow, завършване, спор"
          value={prefs.deal_updates}
          onToggle={(v) => toggle('deal_updates', v)}
        />

        <Text style={styles.section}>Connect</Text>
        <ToggleRow
          label="Съобщения"
          description="Нови съобщения в чатовете"
          value={prefs.connect_messages}
          onToggle={(v) => toggle('connect_messages', v)}
        />

        <Text style={styles.section}>Здраве</Text>
        <ToggleRow
          label="Лекарства и ваксини"
          description="Напомняне за прием и ваксинации"
          value={prefs.medication_reminders}
          onToggle={(v) => toggle('medication_reminders', v)}
        />

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 20 },
  section: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5,
    marginTop: 24, marginBottom: 8,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: colors.surface, borderRadius: 12, padding: 14,
    marginBottom: 6, borderWidth: 1, borderColor: colors.border,
  },
  rowText: { flex: 1, marginRight: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDesc: { fontSize: 12, color: colors.textMuted, marginTop: 2 },
});
