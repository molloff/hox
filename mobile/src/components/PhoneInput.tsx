import React from 'react';
import { View, TextInput, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  value: string;
  onChangeText: (text: string) => void;
  error?: string;
}

export function PhoneInput({ value, onChangeText, error }: Props) {
  const handleChange = (text: string) => {
    // Only allow digits, max 9
    const digits = text.replace(/\D/g, '').slice(0, 9);
    onChangeText(digits);
  };

  return (
    <View>
      <View style={[styles.container, error ? styles.containerError : null]}>
        <View style={styles.prefix}>
          <Text style={styles.flag}>🇧🇬</Text>
          <Text style={styles.prefixText}>+359</Text>
        </View>
        <TextInput
          style={styles.input}
          value={value}
          onChangeText={handleChange}
          keyboardType="phone-pad"
          placeholder="88 123 4567"
          placeholderTextColor={colors.textMuted}
          maxLength={9}
          autoFocus
        />
      </View>
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.surface,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 16,
    paddingHorizontal: 16,
    height: 60,
  },
  containerError: {
    borderColor: colors.error,
  },
  prefix: {
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: 12,
    paddingRight: 12,
    borderRightWidth: 1,
    borderRightColor: colors.border,
  },
  flag: { fontSize: 20, marginRight: 6 },
  prefixText: { fontSize: 18, fontWeight: '600', color: colors.text },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: '500',
    color: colors.text,
    letterSpacing: 1,
  },
  error: {
    color: colors.error,
    fontSize: 13,
    marginTop: 6,
    marginLeft: 4,
  },
});
