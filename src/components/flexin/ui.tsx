import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Palette, Radius, Space, Type } from '@/constants/flexin-theme';

// SF Symbols on iOS, Material Symbols on Android/web.
const ICONS = {
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  play: { ios: 'play.fill', android: 'play_arrow', web: 'play_arrow' },
  clock: { ios: 'clock', android: 'schedule', web: 'schedule' },
  weight: { ios: 'scalemass', android: 'fitness_center', web: 'fitness_center' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
} satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, color = Colors.text }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}

export function Avatar({
  name,
  size = 36,
  ring,
}: {
  name: string;
  size?: number;
  /** Rank plate color; only pass one when the avatar is shown in a ranked context. */
  ring?: string;
}) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: size / 2 },
        ring ? { borderWidth: 2, borderColor: ring } : null,
      ]}>
      <Text style={[styles.avatarText, { fontSize: size * 0.38 }]}>{initials}</Text>
    </View>
  );
}

export function Card({ children, style, dark }: { children: ReactNode; style?: StyleProp<ViewStyle>; dark?: boolean }) {
  return <View style={[styles.card, dark && styles.cardDark, style]}>{children}</View>;
}

export function SectionHeader({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) {
  return (
    <View style={styles.sectionHeader}>
      <Text style={[Type.label, { color: Colors.textMuted }]}>{title}</Text>
      {action ? (
        <Pressable onPress={onAction} hitSlop={8}>
          <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>{action}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function IconButton({ icon, onPress, label }: { icon: IconName; onPress: () => void; label: string }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Icon name={icon} size={18} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  avatar: {
    backgroundColor: Palette.ink,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: Palette.onInk,
    fontWeight: '800',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Space.lg,
  },
  cardDark: {
    backgroundColor: Colors.inkCard,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: Space.xl,
    marginBottom: Space.sm,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.6,
  },
});
