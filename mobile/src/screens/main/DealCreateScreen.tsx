import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet,
  ActivityIndicator, Alert,
} from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { createDeal, type DealTemplate } from '../../services/deal';
import { colors } from '../../theme/colors';

const TEMPLATES: { value: DealTemplate; label: string; icon: string; desc: string }[] = [
  { value: 'rent', label: 'Наем', icon: '🏠', desc: 'Наемен договор — винаги КЕП' },
  { value: 'service', label: 'Услуга', icon: '🔧', desc: 'Договор за услуга' },
  { value: 'nda', label: 'NDA', icon: '🤝', desc: 'Споразумение за неразкриване — КЕП' },
  { value: 'sale', label: 'Продажба', icon: '💰', desc: 'Покупко-продажба — КЕП' },
  { value: 'protocol', label: 'Протокол', icon: '📋', desc: 'Приемо-предавателен протокол' },
  { value: 'offer', label: 'Оферта', icon: '📨', desc: 'Оферта за услуга или продукт' },
  { value: 'custom', label: 'Друг', icon: '📄', desc: 'Свободен договор' },
];

export function DealCreateScreen({ navigation }: any) {
  const [template, setTemplate] = useState<DealTemplate>('service');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [creating, setCreating] = useState(false);

  const selectedTemplate = TEMPLATES.find((t) => t.value === template)!;
  const amountNum = parseFloat(amount);
  const isKep = ['rent', 'sale', 'nda'].includes(template) || (amountNum > 1955);

  const handleCreate = async () => {
    if (!title.trim()) {
      Alert.alert('Грешка', 'Въведи заглавие');
      return;
    }

    // AML check on client side
    if (amountNum > 5000 * 1.955) {
      Alert.alert('AML лимит', `Максимална сума: €5,000 (${(5000 * 1.955).toFixed(0)} лв)`);
      return;
    }

    setCreating(true);
    try {
      const deal = await createDeal({
        template,
        title: title.trim(),
        description: description.trim() || undefined,
        amount: amountNum > 0 ? amountNum : undefined,
      });
      Alert.alert('Готово', 'Сделката е създадена', [
        { text: 'OK', onPress: () => navigation.goBack() },
      ]);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Създаването не успя';
      Alert.alert('Грешка', msg);
    } finally {
      setCreating(false);
    }
  };

  return (
    <ScreenWrapper>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Text style={styles.heading}>Нова сделка</Text>

        {/* Template */}
        <Text style={styles.label}>Бланка</Text>
        <View style={styles.templateGrid}>
          {TEMPLATES.map((t) => (
            <Pressable
              key={t.value}
              style={[styles.templateBtn, template === t.value && styles.templateBtnActive]}
              onPress={() => setTemplate(t.value)}
            >
              <Text style={styles.templateIcon}>{t.icon}</Text>
              <Text style={[styles.templateLabel, template === t.value && styles.templateLabelActive]}>
                {t.label}
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.hint}>{selectedTemplate.desc}</Text>

        {/* Title */}
        <Text style={styles.label}>Заглавие</Text>
        <TextInput
          style={styles.input}
          value={title}
          onChangeText={setTitle}
          placeholder="Напр: Ремонт на баня — Георги Иванов"
          placeholderTextColor={colors.textMuted}
          maxLength={200}
        />

        {/* Description */}
        <Text style={styles.label}>Описание (по желание)</Text>
        <TextInput
          style={[styles.input, styles.multiline]}
          value={description}
          onChangeText={setDescription}
          placeholder="Условия, срокове, детайли..."
          placeholderTextColor={colors.textMuted}
          multiline
          maxLength={2000}
          textAlignVertical="top"
        />

        {/* Amount */}
        <Text style={styles.label}>Сума (BGN)</Text>
        <TextInput
          style={styles.input}
          value={amount}
          onChangeText={setAmount}
          placeholder="0.00"
          placeholderTextColor={colors.textMuted}
          keyboardType="decimal-pad"
        />

        {/* Signature info */}
        <View style={styles.sigInfo}>
          <Text style={styles.sigTitle}>
            {isKep ? '🔏 Квалифициран електронен подпис (КЕП)' : '✍️ Обикновен подпис'}
          </Text>
          <Text style={styles.sigDesc}>
            {isKep
              ? 'Равен на нотариален подпис по eIDAS. Цена: ~€0.50-1.00 чрез Evrotrust.'
              : 'Договорна сила — валиден в ЕС. Цена: ~€0.10-0.30.'}
          </Text>
        </View>

        {amountNum > 0 && (
          <View style={styles.escrowInfo}>
            <Text style={styles.escrowText}>
              💳 Парите ще бъдат задържани в Stripe Escrow до потвърждение от двете страни.
              {'\n'}Цена: 1.4% + €0.25 на транзакция.
            </Text>
          </View>
        )}

        <Pressable
          style={[styles.createBtn, creating && styles.createBtnDisabled]}
          onPress={handleCreate}
          disabled={creating}
        >
          {creating ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.createBtnText}>Създай сделка</Text>
          )}
        </Pressable>

        <View style={{ height: 40 }} />
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 20 },
  label: {
    fontSize: 13, fontWeight: '600', color: colors.textSecondary,
    textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 18, marginBottom: 8,
  },
  templateGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  templateBtn: {
    alignItems: 'center', paddingHorizontal: 14, paddingVertical: 10,
    borderRadius: 10, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface,
  },
  templateBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  templateIcon: { fontSize: 20 },
  templateLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 4 },
  templateLabelActive: { color: colors.primary, fontWeight: '700' },
  hint: { fontSize: 12, color: colors.textMuted, marginTop: 8, fontStyle: 'italic' },
  input: {
    backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border,
    borderRadius: 12, paddingHorizontal: 16, paddingVertical: 14, fontSize: 15, color: colors.text,
  },
  multiline: { minHeight: 80 },
  sigInfo: {
    backgroundColor: colors.primaryLight, borderRadius: 12, padding: 14, marginTop: 20,
  },
  sigTitle: { fontSize: 14, fontWeight: '700', color: colors.primaryDark },
  sigDesc: { fontSize: 12, color: colors.primaryDark, marginTop: 4, lineHeight: 18 },
  escrowInfo: {
    backgroundColor: '#FEF3C7', borderRadius: 12, padding: 14, marginTop: 12,
  },
  escrowText: { fontSize: 12, color: '#92400E', lineHeight: 18 },
  createBtn: {
    backgroundColor: colors.primary, borderRadius: 14, paddingVertical: 16,
    alignItems: 'center', marginTop: 28,
  },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
