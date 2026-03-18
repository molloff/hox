import React, { useRef, useState } from 'react';
import { View, TextInput, StyleSheet, Pressable } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  length?: number;
  onComplete: (code: string) => void;
}

export function OtpInput({ length = 6, onComplete }: Props) {
  const [values, setValues] = useState<string[]>(Array(length).fill(''));
  const inputs = useRef<(TextInput | null)[]>([]);

  const handleChange = (text: string, index: number) => {
    // Handle paste of full code
    if (text.length === length) {
      const digits = text.replace(/\D/g, '').slice(0, length).split('');
      setValues(digits);
      inputs.current[length - 1]?.focus();
      if (digits.length === length) {
        onComplete(digits.join(''));
      }
      return;
    }

    const digit = text.replace(/\D/g, '').slice(-1);
    const next = [...values];
    next[index] = digit;
    setValues(next);

    if (digit && index < length - 1) {
      inputs.current[index + 1]?.focus();
    }

    if (next.every((v) => v !== '') && next.length === length) {
      onComplete(next.join(''));
    }
  };

  const handleKeyPress = (e: { nativeEvent: { key: string } }, index: number) => {
    if (e.nativeEvent.key === 'Backspace' && !values[index] && index > 0) {
      const next = [...values];
      next[index - 1] = '';
      setValues(next);
      inputs.current[index - 1]?.focus();
    }
  };

  return (
    <View style={styles.row}>
      {values.map((val, i) => (
        <Pressable key={i} onPress={() => inputs.current[i]?.focus()}>
          <TextInput
            ref={(ref) => { inputs.current[i] = ref; }}
            style={[styles.cell, val ? styles.cellFilled : null]}
            value={val}
            onChangeText={(t) => handleChange(t, i)}
            onKeyPress={(e) => handleKeyPress(e, i)}
            keyboardType="number-pad"
            maxLength={i === 0 ? length : 1}
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            selectTextOnFocus
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', gap: 10 },
  cell: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: colors.text,
    backgroundColor: colors.surface,
  },
  cellFilled: {
    borderColor: colors.primary,
    backgroundColor: colors.primaryLight,
  },
});
