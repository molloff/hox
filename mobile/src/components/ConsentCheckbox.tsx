import React from 'react';
import { Pressable, View, Text, StyleSheet } from 'react-native';
import { colors } from '../theme/colors';

interface Props {
  checked: boolean;
  onToggle: () => void;
  label: string;
}

export function ConsentCheckbox({ checked, onToggle, label }: Props) {
  return (
    <Pressable style={styles.row} onPress={onToggle}>
      <View style={[styles.box, checked && styles.boxChecked]}>
        {checked && <Text style={styles.check}>✓</Text>}
      </View>
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 8,
  },
  box: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: colors.border,
    borderRadius: 6,
    marginRight: 12,
    marginTop: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  boxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  check: {
    color: colors.white,
    fontSize: 14,
    fontWeight: '700',
  },
  label: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: colors.text,
  },
});
