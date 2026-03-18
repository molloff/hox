import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { OtpInput } from '../../components/OtpInput';
import { useAuth } from '../../context/AuthContext';
import { formatPhoneDisplay } from '../../utils/validation';
import { colors } from '../../theme/colors';
import { type OnboardingStackParamList } from '../../navigation/OnboardingStack';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'SmsCode'>;

const RESEND_COOLDOWN = 60;

export function SmsCodeScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const { verifyOtp, sendOtp } = useAuth();
  const [loading, setLoading] = useState(false);
  const [cooldown, setCooldown] = useState(RESEND_COOLDOWN);
  const [attempts, setAttempts] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  const handleComplete = useCallback(async (code: string) => {
    if (loading || attempts >= 3) return;
    setLoading(true);
    try {
      await verifyOtp(phone, code);
      navigation.navigate('Consent');
    } catch {
      setAttempts((a) => a + 1);
      if (attempts >= 2) {
        Alert.alert('Твърде много опити', 'Опитай отново с нов код.');
      } else {
        Alert.alert('Грешен код', 'Провери SMS-а и опитай отново.');
      }
    } finally {
      setLoading(false);
    }
  }, [loading, attempts, phone, verifyOtp, navigation]);

  const handleResend = async () => {
    if (cooldown > 0) return;
    try {
      await sendOtp(phone);
      setCooldown(RESEND_COOLDOWN);
      setAttempts(0);
    } catch {
      Alert.alert('Грешка', 'Неуспешно изпращане на нов код');
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.content}>
        <Text style={styles.title}>Въведи кода</Text>
        <Text style={styles.subtitle}>
          Изпратихме SMS код на{'\n'}
          <Text style={styles.phone}>{formatPhoneDisplay(phone)}</Text>
        </Text>

        <View style={styles.otpContainer}>
          <OtpInput onComplete={handleComplete} />
        </View>

        {loading && <ActivityIndicator color={colors.primary} style={styles.loader} />}

        {attempts >= 3 && (
          <Text style={styles.locked}>Твърде много грешни опити. Изпрати нов код.</Text>
        )}

        <Pressable onPress={handleResend} disabled={cooldown > 0}>
          <Text style={[styles.resend, cooldown > 0 && styles.resendDisabled]}>
            {cooldown > 0 ? `Изпрати отново (${cooldown}с)` : 'Изпрати нов код'}
          </Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 15, color: colors.textSecondary, textAlign: 'center', marginTop: 12, lineHeight: 22 },
  phone: { fontWeight: '700', color: colors.text },
  otpContainer: { marginTop: 40 },
  loader: { marginTop: 20 },
  locked: { color: colors.error, fontSize: 13, marginTop: 16, textAlign: 'center' },
  resend: { color: colors.primary, fontSize: 15, fontWeight: '600', marginTop: 32 },
  resendDisabled: { color: colors.textMuted },
});
