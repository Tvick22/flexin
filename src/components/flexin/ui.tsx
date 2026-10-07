import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View, type ColorValue, type StyleProp, type ViewStyle } from 'react-native';

import { Colors, Palette, Radius, Space, Type, onRankColor, rankColor } from '@/constants/flexin-theme';

// SF Symbols on iOS, Material Symbols on Android/web.
const ICONS = {
  settings: { ios: 'gearshape.fill', android: 'settings', web: 'settings' },
  back: { ios: 'chevron.left', android: 'chevron_left', web: 'chevron_left' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  trophy: { ios: 'trophy.fill', android: 'emoji_events', web: 'emoji_events' },
  plus: { ios: 'plus', android: 'add', web: 'add' },
  friends: { ios: 'person.2.fill', android: 'group', web: 'group' },
  share: { ios: 'square.and.arrow.up', android: 'share', web: 'share' },
  check: { ios: 'checkmark', android: 'check', web: 'check' },
  search: { ios: 'magnifyingglass', android: 'search', web: 'search' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  profile: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  bolt: { ios: 'bolt.fill', android: 'bolt', web: 'bolt' },
} satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 18, color = Colors.text }: { name: IconName; size?: number; color?: ColorValue }) {
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

/** Plate-colored rank circle. `null` = hasn't scored yet (neutral, no plate color). */
export function RankBadge({ rank, size = 26, dark }: { rank: number | null; size?: number; dark?: boolean }) {
  const bg = rank === null ? (dark ? Colors.onInkCardLine : Colors.wash) : rankColor(rank);
  const fg = rank === null ? (dark ? Colors.onInkCardMuted : Colors.textMuted) : onRankColor(rank);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: bg, alignItems: 'center', justifyContent: 'center' }}
      accessibilityLabel={rank === null ? 'No score yet' : `Rank ${rank}`}>
      <Text style={{ color: fg, fontSize: size * 0.46, fontWeight: '900', fontVariant: ['tabular-nums'] }}>
        {rank ?? '–'}
      </Text>
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

export function EmptyState({ title, body, dark }: { title: string; body: string; dark?: boolean }) {
  return (
    <View style={styles.empty}>
      <Text style={[Type.bodyStrong, { color: dark ? Colors.onInkCard : Colors.text }]}>{title}</Text>
      <Text style={[Type.caption, { color: dark ? Colors.onInkCardMuted : Colors.textMuted }]}>{body}</Text>
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

/**
 * Bottom confirmation sheet. Used instead of Alert.alert, which is a no-op on web.
 * `destructive` styles the confirm button as outlined ink rather than the red CTA.
 */
export function ConfirmSheet({
  visible,
  title,
  body,
  confirmLabel,
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
  destructive,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  destructive?: boolean;
}) {
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={styles.sheetBackdrop} onPress={onCancel} accessibilityLabel="Close">
        <Pressable style={styles.sheet} onPress={() => {}}>
          <Text style={[Type.heading, { color: Colors.text }]}>{title}</Text>
          {body ? <Text style={[Type.body, { color: Colors.textMuted }]}>{body}</Text> : null}
          <Pressable
            onPress={onConfirm}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.sheetButton,
              destructive ? styles.sheetButtonOutline : styles.sheetButtonPrimary,
              pressed && styles.pressed,
            ]}>
            <Text style={[Type.bodyStrong, { color: destructive ? Colors.text : Colors.onPrimary }]}>{confirmLabel}</Text>
          </Pressable>
          <Pressable
            onPress={onCancel}
            accessibilityRole="button"
            style={({ pressed }) => [styles.sheetButton, pressed && styles.pressed]}>
            <Text style={[Type.bodyStrong, { color: Colors.textMuted }]}>{cancelLabel}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(22, 32, 58, 0.4)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: Radius.lg,
    borderTopRightRadius: Radius.lg,
    padding: Space.xl,
    paddingBottom: Space.xxl + Space.lg,
    gap: Space.sm,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  sheetButton: {
    height: 50,
    borderRadius: Radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sheetButtonPrimary: {
    marginTop: Space.md,
    backgroundColor: Colors.primary,
  },
  sheetButtonOutline: {
    marginTop: Space.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
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
  empty: {
    gap: 4,
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
