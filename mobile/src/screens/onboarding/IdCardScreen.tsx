import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet, ActivityIndicator, Alert } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { startKyc } from '../../services/kyc';
import { colors } from '../../theme/colors';
import { type OnboardingStackParamList } from '../../navigation/OnboardingStack';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'IdCard'>;

/**
 * This screen launches the Onfido SDK.
 *
 * IMPORTANT: The Onfido React Native SDK uploads ID card photos
 * DIRECTLY from the device to Onfido servers. Photos NEVER pass
 * through the HOX backend. HOX only receives webhook results.
 *
 * In production, replace the placeholder below with:
 * import { Onfido, OnfidoDocumentType, OnfidoCountryCode } from '@onfido/react-native-sdk';
 */
export function IdCardScreen({ navigation }: Props) {
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'intro' | 'processing'>('intro');

  const handleStart = async () => {
    setLoading(true);
    try {
      // Get SDK token from backend
      const { sdkToken } = await startKyc('', '');

      // In production, launch Onfido SDK:
      // const result = await Onfido.start({
      //   sdkToken,
      //   flowSteps: {
      //     welcome: false,
      //     document: {
      //       docType: OnfidoDocumentType.NATIONAL_IDENTITY_CARD,
      //       countryCode: OnfidoCountryCode.BGR,
      //     },
      //     face: { type: 'PHOTO' },
      //   },
      // });

      // For now, simulate SDK completion
      setStep('processing');

      // Navigate to waiting screen
      navigation.navigate('Waiting');
    } catch (err) {
      Alert.alert(
        'Грешка',
        'Неуспешно стартиране на верификацията. Опитай отново.',
        [{ text: 'OK' }]
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        {step === 'intro' ? (
          <>
            <View style={styles.iconContainer}>
              <Text style={styles.icon}>🪪</Text>
            </View>

            <Text style={styles.title}>Верификация на самоличност</Text>

            <View style={styles.steps}>
              <View style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>1</Text></View>
                <Text style={styles.stepText}>Снимай предната страна на личната си карта</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>2</Text></View>
                <Text style={styles.stepText}>Снимай задната страна</Text>
              </View>
              <View style={styles.stepRow}>
                <View style={styles.stepNum}><Text style={styles.stepNumText}>3</Text></View>
                <Text style={styles.stepText}>Направи selfie за потвърждение (30 сек.)</Text>
              </View>
            </View>

            <View style={styles.privacyNote}>
              <Text style={styles.privacyText}>
                Снимките отиват директно при Onfido — НЕ минават през HOX.
                Пазим само резултата: верифициран или не.
              </Text>
            </View>

            <Pressable
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleStart}
              disabled={loading}
            >
              {loading ? (
                <ActivityIndicator color={colors.white} />
              ) : (
                <Text style={styles.buttonText}>Започни верификация</Text>
              )}
            </Pressable>
          </>
        ) : (
          <View style={styles.processing}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.processingText}>Обработваме...</Text>
          </View>
        )}
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center' },
  iconContainer: { alignItems: 'center', marginBottom: 24 },
  icon: { fontSize: 64 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text, textAlign: 'center' },
  steps: { marginTop: 32, gap: 16 },
  stepRow: { flexDirection: 'row', alignItems: 'center' },
  stepNum: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: colors.primaryLight,
    justifyContent: 'center', alignItems: 'center', marginRight: 14,
  },
  stepNumText: { fontSize: 15, fontWeight: '700', color: colors.primary },
  stepText: { flex: 1, fontSize: 15, color: colors.text, lineHeight: 22 },
  privacyNote: {
    backgroundColor: colors.primaryLight,
    borderRadius: 12,
    padding: 14,
    marginTop: 28,
  },
  privacyText: { fontSize: 12, color: colors.primaryDark, lineHeight: 18 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 28,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
  processing: { alignItems: 'center' },
  processingText: { fontSize: 16, color: colors.textSecondary, marginTop: 16 },
});
