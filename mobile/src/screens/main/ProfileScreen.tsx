import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ProfileForm } from '../../components/ProfileForm';
import { useAuth } from '../../context/AuthContext';
import { getProfile, updateProfile, type Profile, type UpdateProfileData } from '../../services/profile';
import { maskPhone } from '../../utils/validation';
import { colors } from '../../theme/colors';

export function ProfileScreen() {
  const { user, logout, refreshUser } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchProfile = useCallback(async () => {
    try {
      const data = await getProfile();
      setProfile(data);
    } catch {
      Alert.alert('Грешка', 'Неуспешно зареждане на профила');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleSave = async (data: UpdateProfileData) => {
    setSaving(true);
    try {
      const updated = await updateProfile(data);
      setProfile((prev) => prev ? { ...prev, ...updated } : prev);
      await refreshUser();
      Alert.alert('Готово', 'Профилът е запазен');
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Изход', 'Сигурен ли си?', [
      { text: 'Отказ', style: 'cancel' },
      { text: 'Изход', style: 'destructive', onPress: logout },
    ]);
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Профил</Text>
          <Text style={styles.phone}>{maskPhone(user?.phone || '')}</Text>
        </View>
        <Pressable onPress={handleLogout}>
          <Text style={styles.logout}>Изход</Text>
        </Pressable>
      </View>

      {profile && (
        <View style={styles.verifiedBadge}>
          <Text style={styles.verifiedText}>
            {profile.is_verified ? '✓ Верифициран' : '⏳ Чака верификация'}
          </Text>
        </View>
      )}

      {profile && (
        <ProfileForm
          initialData={{
            profile_type: profile.profile_type,
            display_name: profile.display_name,
            skills: profile.skills,
            description: profile.description,
            company_name: profile.company_name,
            eik: profile.eik,
          }}
          onSave={handleSave}
          saving={saving}
        />
      )}
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text },
  phone: { fontSize: 14, color: colors.textSecondary, marginTop: 2 },
  logout: { color: colors.error, fontSize: 14, fontWeight: '600' },
  verifiedBadge: {
    backgroundColor: colors.primaryLight,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
    marginBottom: 4,
  },
  verifiedText: { fontSize: 13, fontWeight: '700', color: colors.primary },
});
