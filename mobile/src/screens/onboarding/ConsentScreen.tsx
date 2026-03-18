import React, { useState } from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet } from 'react-native';
import { type NativeStackScreenProps } from '@react-navigation/native-stack';
import { ScreenWrapper } from '../../components/ScreenWrapper';
import { ConsentCheckbox } from '../../components/ConsentCheckbox';
import { colors } from '../../theme/colors';
import { type OnboardingStackParamList } from '../../navigation/OnboardingStack';

type Props = NativeStackScreenProps<OnboardingStackParamList, 'Consent'>;

export function ConsentScreen({ navigation }: Props) {
  const [kycConsent, setKycConsent] = useState(false);
  const [privacyConsent, setPrivacyConsent] = useState(false);

  const canContinue = kycConsent && privacyConsent;

  return (
    <ScreenWrapper>
      <View style={styles.container}>
        <Text style={styles.title}>Съгласие за верификация</Text>
        <Text style={styles.subtitle}>
          Преди да продължим, трябва да знаеш как пазим данните ти.
        </Text>

        <ScrollView style={styles.scroll} showsVerticalScrollIndicator={false}>
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Какво събираме</Text>
            <Text style={styles.cardText}>
              • Телефонен номер — за SMS верификация{'\n'}
              • Резултат от проверка на лична карта (верифициран/отхвърлен){'\n'}
              • Хеш на ЕГН — криптиран, необратим
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Какво НЕ събираме</Text>
            <Text style={styles.cardText}>
              • Снимка на лична карта — остава САМО при Onfido{'\n'}
              • Selfie за liveness проверка — само да/не{'\n'}
              • ЕГН в четим вид — НИКОГА не се запазва
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Твоите права (GDPR)</Text>
            <Text style={styles.cardText}>
              • Достъп до всички твои данни{'\n'}
              • Изтриване на акаунт и всички данни{'\n'}
              • Преносимост — експорт на данните ти{'\n'}
              • Оттегляне на съгласие по всяко време
            </Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Трети страни</Text>
            <Text style={styles.cardText}>
              • Onfido — верификация на самоличност (EU сървъри){'\n'}
              • Supabase — съхранение на данни (EU Frankfurt){'\n'}
              • Всички имат DPA (Data Processing Agreement)
            </Text>
          </View>
        </ScrollView>

        <View style={styles.checkboxes}>
          <ConsentCheckbox
            checked={kycConsent}
            onToggle={() => setKycConsent(!kycConsent)}
            label="Съгласен/а съм на верификация на самоличност чрез Onfido"
          />
          <ConsentCheckbox
            checked={privacyConsent}
            onToggle={() => setPrivacyConsent(!privacyConsent)}
            label="Прочетох и приемам Политиката за поверителност"
          />
        </View>

        <Pressable
          style={[styles.button, !canContinue && styles.buttonDisabled]}
          onPress={() => navigation.navigate('IdCard')}
          disabled={!canContinue}
        >
          <Text style={styles.buttonText}>Продължи</Text>
        </Pressable>
      </View>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, paddingTop: 16 },
  title: { fontSize: 24, fontWeight: '700', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: 8, marginBottom: 16 },
  scroll: { flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cardTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginBottom: 8 },
  cardText: { fontSize: 13, lineHeight: 20, color: colors.textSecondary },
  checkboxes: { paddingTop: 12, paddingBottom: 8 },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginBottom: 8,
  },
  buttonDisabled: { opacity: 0.4 },
  buttonText: { color: colors.white, fontSize: 16, fontWeight: '700' },
});
