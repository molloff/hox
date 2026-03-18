import React, { useState } from 'react';
import {
  View, Text, TextInput, Pressable, ScrollView, StyleSheet, Alert,
} from 'react-native';
import { colors } from '../theme/colors';
import { type UpdateProfileData } from '../services/profile';

const PROFILE_TYPES = [
  { value: 'family' as const, label: 'Семейство' },
  { value: 'freelancer' as const, label: 'Фрийлансър' },
  { value: 'small_business' as const, label: 'Малък бизнес' },
];

const COMMON_SKILLS = [
  'Електротехник', 'ВиК', 'Счетоводител', 'Програмист', 'Дизайнер',
  'Шофьор', 'Готвач', 'Фотограф', 'Юрист', 'Преводач', 'Строител',
  'Монтажник', 'Маникюрист', 'Фризьор', 'Личен треньор',
];

interface Props {
  initialData: {
    profile_type: string | null;
    display_name: string | null;
    skills: string[];
    description: string;
    company_name: string | null;
    eik: string | null;
  };
  onSave: (data: UpdateProfileData) => Promise<void>;
  saving: boolean;
}

export function ProfileForm({ initialData, onSave, saving }: Props) {
  const [profileType, setProfileType] = useState(initialData.profile_type);
  const [displayName, setDisplayName] = useState(initialData.display_name || '');
  const [skills, setSkills] = useState<string[]>(initialData.skills);
  const [description, setDescription] = useState(initialData.description);
  const [companyName, setCompanyName] = useState(initialData.company_name || '');
  const [eik, setEik] = useState(initialData.eik || '');
  const [skillInput, setSkillInput] = useState('');

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !skills.includes(trimmed) && skills.length < 20) {
      setSkills([...skills, trimmed]);
      setSkillInput('');
    }
  };

  const removeSkill = (index: number) => {
    setSkills(skills.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    try {
      await onSave({
        profile_type: profileType as UpdateProfileData['profile_type'],
        display_name: displayName || undefined,
        skills,
        description,
        company_name: profileType === 'small_business' ? companyName : null,
        eik: profileType === 'small_business' ? eik : null,
      });
    } catch {
      Alert.alert('Грешка', 'Неуспешно запазване на профила');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Profile Type */}
      <Text style={styles.label}>Тип профил</Text>
      <View style={styles.typeRow}>
        {PROFILE_TYPES.map((t) => (
          <Pressable
            key={t.value}
            style={[styles.typeBtn, profileType === t.value && styles.typeBtnActive]}
            onPress={() => setProfileType(t.value)}
          >
            <Text style={[styles.typeBtnText, profileType === t.value && styles.typeBtnTextActive]}>
              {t.label}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Display Name */}
      <Text style={styles.label}>Име</Text>
      <TextInput
        style={styles.input}
        value={displayName}
        onChangeText={setDisplayName}
        placeholder="Как да те показваме"
        placeholderTextColor={colors.textMuted}
        maxLength={100}
      />

      {/* Skills */}
      <Text style={styles.label}>Умения / Занаяти</Text>
      <View style={styles.tags}>
        {skills.map((s, i) => (
          <Pressable key={i} style={styles.tag} onPress={() => removeSkill(i)}>
            <Text style={styles.tagText}>{s} ×</Text>
          </Pressable>
        ))}
      </View>
      <TextInput
        style={styles.input}
        value={skillInput}
        onChangeText={setSkillInput}
        placeholder="Добави умение..."
        placeholderTextColor={colors.textMuted}
        onSubmitEditing={() => addSkill(skillInput)}
        returnKeyType="done"
      />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.suggestions}>
        {COMMON_SKILLS.filter((s) => !skills.includes(s)).map((s) => (
          <Pressable key={s} style={styles.suggestion} onPress={() => addSkill(s)}>
            <Text style={styles.suggestionText}>+ {s}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {/* Description */}
      <Text style={styles.label}>Описание</Text>
      <TextInput
        style={[styles.input, styles.multiline]}
        value={description}
        onChangeText={setDescription}
        placeholder="Какво предлагаш? Напр: Правя ВиК ремонти в София"
        placeholderTextColor={colors.textMuted}
        multiline
        maxLength={500}
        textAlignVertical="top"
      />
      <Text style={styles.charCount}>{description.length}/500</Text>

      {/* Company fields — only for small_business */}
      {profileType === 'small_business' && (
        <>
          <Text style={styles.label}>Фирма</Text>
          <TextInput
            style={styles.input}
            value={companyName}
            onChangeText={setCompanyName}
            placeholder="Име на фирмата"
            placeholderTextColor={colors.textMuted}
            maxLength={200}
          />
          <Text style={styles.label}>ЕИК</Text>
          <TextInput
            style={styles.input}
            value={eik}
            onChangeText={setEik}
            placeholder="ЕИК номер"
            placeholderTextColor={colors.textMuted}
            keyboardType="number-pad"
            maxLength={20}
          />
        </>
      )}

      {/* Save */}
      <Pressable
        style={[styles.saveBtn, saving && styles.saveBtnDisabled]}
        onPress={handleSave}
        disabled={saving}
      >
        <Text style={styles.saveBtnText}>{saving ? 'Запазване...' : 'Запази профила'}</Text>
      </Pressable>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  multiline: { minHeight: 100 },
  charCount: { fontSize: 12, color: colors.textMuted, textAlign: 'right', marginTop: 4 },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  typeBtnActive: { borderColor: colors.primary, backgroundColor: colors.primaryLight },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  typeBtnTextActive: { color: colors.primary },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 8 },
  tag: {
    backgroundColor: colors.primaryLight,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  tagText: { fontSize: 13, color: colors.primary, fontWeight: '600' },
  suggestions: { marginTop: 8 },
  suggestion: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginRight: 6,
  },
  suggestionText: { fontSize: 12, color: colors.textSecondary },
  saveBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  saveBtnDisabled: { opacity: 0.6 },
  saveBtnText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
