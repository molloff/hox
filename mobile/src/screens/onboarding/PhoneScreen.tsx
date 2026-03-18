import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { PhoneInput } from '../../components/PhoneInput';
import { useAuth } from '../../context/AuthContext';
import { isValidBgPhone } from '../../utils/validation';
import { colors } from '../../theme/colors';
import { type OnboardingStackParamList } from '../../navigation/OnboardingStack';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Phone'>;

export function PhoneScreen({ navigation }: Props) {
  const { sendOtp } = useAuth();
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const fullPhone = `+359${phone}`;
  const isValid = isValidBgPhone(phone);

  const handleContinue = async () => {
    if (!isValid) {
      setError('Невалиден телефонен номер');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await sendOtp(fullPhone);
      navigation.navigate('SmsCode', { phone: fullPhone });
    } catch (err) {
      setError('Неуспешно изпращане на код. Опитай отново.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={styles.logo}>HOX</Text>
          <Text style={styles.subtitle}>Въведи телефонния си номер</Text>
          <Text style={styles.description}>
            Ще ти изпратим SMS код за потвърждение
          </Text>
        </View>

        <PhoneInput value={phone} onChangeText={setPhone} error={error} />

        <Pressable
          style={[styles.button, (!isValid || loading) && styles.buttonDisabled]}
          onPress={handleContinue}
          disabled={!isValid || loading}
        >
          {loading ? (
            <ActivityIndicator color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Продължи</Text>
          )}
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center' },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 48, fontWeight: '900', color: colors.primary, letterSpacing: 4 },
  subtitle: { fontSize: 20, fontWeight: '600', color: colors.text, marginTop: 24 },
  description: { fontSize: 14, color: colors.textSecondary, marginTop: 8, textAlign: 'center' },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 32,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
