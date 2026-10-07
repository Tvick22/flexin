import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { Colors, Radius, Type } from '@/constants/flexin-theme';
import { formatWeight } from '@/utils/format';

/**
 * − value + control for logging between sets. The value is also a text field
 * so you can type a number; while focused we keep the raw text so "62." survives.
 */
export function Stepper({
  label,
  value,
  step,
  decimals,
  emptyText,
  onChange,
  accessibilityName,
}: {
  label: string;
  value: number;
  step: number;
  decimals?: boolean;
  emptyText: string;
  onChange: (v: number) => void;
  accessibilityName: string;
}) {
  const [editing, setEditing] = useState<string | null>(null);
  const display = editing ?? (value === 0 ? '' : formatWeight(value));

  function onChangeText(t: string) {
    let cleaned = t.replace(decimals ? /[^0-9.]/g : /[^0-9]/g, '');
    if (decimals) {
      const [whole, ...rest] = cleaned.split('.');
      cleaned = rest.length ? `${whole}.${rest.join('').slice(0, 2)}` : whole;
    }
    cleaned = cleaned.slice(0, decimals ? 7 : 3);
    setEditing(cleaned);
    const n = decimals ? parseFloat(cleaned) : parseInt(cleaned, 10);
    onChange(Number.isFinite(n) ? n : 0);
  }

  function nudge(delta: number) {
    setEditing(null);
    onChange(Math.max(0, value + delta));
  }

  return (
    <View style={styles.stepper}>
      <View style={styles.row}>
        <Pressable
          onPress={() => nudge(-step)}
          accessibilityRole="button"
          accessibilityLabel={`Decrease ${accessibilityName.toLowerCase()}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>−</Text>
        </Pressable>
        <TextInput
          value={display}
          onChangeText={onChangeText}
          onFocus={() => setEditing(value === 0 ? '' : formatWeight(value))}
          onBlur={() => setEditing(null)}
          placeholder={emptyText}
          placeholderTextColor={Colors.textFaint}
          keyboardType={decimals ? 'decimal-pad' : 'number-pad'}
          selectTextOnFocus
          accessibilityLabel={accessibilityName}
          style={styles.value}
        />
        <Pressable
          onPress={() => nudge(step)}
          accessibilityRole="button"
          accessibilityLabel={`Increase ${accessibilityName.toLowerCase()}`}
          style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}>
          <Text style={styles.buttonText}>+</Text>
        </Pressable>
      </View>
      <Text style={[Type.label, { color: Colors.textMuted, textAlign: 'center' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stepper: {
    flex: 1,
    gap: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.wash,
    overflow: 'hidden',
  },
  button: {
    width: 44,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonPressed: {
    backgroundColor: Colors.line,
  },
  buttonText: {
    color: Colors.text,
    fontSize: 24,
    fontWeight: '700',
  },
  value: {
    flex: 1,
    flexBasis: 0,
    // Web TextInputs have an intrinsic width; without this they won't shrink to fit.
    minWidth: 0,
    height: '100%',
    color: Colors.text,
    fontSize: 26,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    textAlign: 'center',
    outlineWidth: 0,
  },
});
