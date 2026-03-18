import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { useAuth } from '../../context/AuthContext';
import { getKycStatus } from '../../services/kyc';
import { colors } from '../../theme/colors';
import { type OnboardingStackParamList } from '../../navigation/OnboardingStack';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Waiting'>;

export function WaitingScreen({ navigation }: Props) {
  const { refreshUser } = useAuth();
  const [status, setStatus] = useState<'checking' | 'verified' | 'rejected'>('checking');
  const [dots, setDots] = useState('');
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  // Animate dots
  useEffect(() => {
    const timer = setInterval(() => {
      setDots((d) => (d.length >= 3 ? '' : d + '.'));
    }, 500);
    return () => clearInterval(timer);
  }, []);

  // Poll KYC status every 5 seconds
  useEffect(() => {
    const poll = async () => {
      try {
        const kycStatus = await getKycStatus();
        if (kycStatus === 'verified') {
          setStatus('verified');
          if (pollRef.current) clearInterval(pollRef.current);
          await refreshUser();
        } else if (kycStatus === 'rejected') {
          setStatus('rejected');
          if (pollRef.current) clearInterval(pollRef.current);
        }
      } catch {
        // Keep polling on error
      }
    };

    poll(); // Check immediately
    pollRef.current = setInterval(poll, 5000);

    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [refreshUser]);

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {status === 'checking' && (
          <>
            <Text style={styles.spinner}>🔍</Text>
            <Text style={styles.title}>Верифицираме те{dots}</Text>
            <Text style={styles.subtitle}>
              Обикновено отнема 1-2 минути.{'\n'}Не затваряй приложението.
            </Text>
          </>
        )}

        {status === 'verified' && (
          <>
            <Text style={styles.spinner}>✅</Text>
            <Text style={styles.title}>Добре дошъл в HOX!</Text>
            <Text style={styles.subtitle}>
              Верификацията е успешна.{'\n'}Вече имаш достъп до всички модули.
            </Text>
          </>
        )}

        {status === 'rejected' && (
          <>
            <Text style={styles.spinner}>❌</Text>
            <Text style={styles.title}>Верификацията не успя</Text>
            <Text style={styles.subtitle}>
              Моля, опитай отново или се свържи с поддръжката.
            </Text>
            <Pressable
              style={styles.retryBtn}
              onPress={() => navigation.navigate('IdCard')}
            >
              <Text style={styles.retryText}>Опитай отново</Text>
            </Pressable>
            <Pressable style={styles.supportBtn}>
              <Text style={styles.supportText}>Свържи се с поддръжка</Text>
            </Pressable>
          </>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  spinner: { fontSize: 64, marginBottom: 24 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  subtitle: {
    fontSize: 15, color: colors.textSecondary, textAlign: 'center',
    marginTop: 12, lineHeight: 22,
  },
  retryBtn: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 40,
    marginTop: 32,
  },
  retryText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  supportBtn: { marginTop: 16 },
  supportText: { color: colors.primary, fontSize: 14, fontWeight: '600' },
});
