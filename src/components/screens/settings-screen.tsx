import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Card, ConfirmSheet, IconButton, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { authActions, useMe } from '@/stores/auth-store';
import { formatFriendCode } from '@/utils/friend-code';

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function SettingsScreen() {
  const me = useMe();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [unitError, setUnitError] = useState<string | null>(null);

  async function setUnit(unit: 'lb' | 'kg') {
    if (unit === me.unit) return;
    setUnitError(null);
    try {
      await authActions.updateProfile({ unit });
    } catch (e) {
      setUnitError((e as Error).message);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <IconButton icon="back" label="Back" onPress={goBack} />
          <Text style={[Type.title, { color: Colors.text }]}>Settings</Text>
          <View style={{ width: 40 }} />
        </View>

        <SectionHeader title="Account" />
        <Card style={styles.rows}>
          <Row label="Name" value={me.name ?? '—'} />
          <Row label="Handle" value={me.handle ? `@${me.handle}` : '—'} />
          <Row label="Email" value={me.email ?? 'Hidden'} />
          <Row label="Friend code" value={formatFriendCode(me.friendCode)} last />
        </Card>

        <SectionHeader title="Weights in" />
        <View style={styles.units}>
          {(['lb', 'kg'] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              accessibilityRole="radio"
              accessibilityState={{ checked: me.unit === u }}
              style={[styles.unit, me.unit === u && styles.unitOn]}>
              <Text style={[Type.bodyStrong, { color: me.unit === u ? Colors.onInkCard : Colors.text }]}>
                {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
              </Text>
            </Pressable>
          ))}
        </View>
        {unitError ? <Text style={[Type.caption, styles.error]}>{unitError}</Text> : null}

        <Pressable
          onPress={() => setConfirmSignOut(true)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.signOut, pressed && { opacity: 0.7 }]}>
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <ConfirmSheet
        visible={confirmSignOut}
        title="Sign out?"
        body="You can sign back in any time with the same Apple or Google account."
        confirmLabel="Sign out"
        destructive
        onConfirm={() => {
          setConfirmSignOut(false);
          authActions.signOut();
        }}
        onCancel={() => setConfirmSignOut(false)}
      />
    </SafeAreaView>
  );
}

function Row({ label, value, last }: { label: string; value: string; last?: boolean }) {
  return (
    <View style={[styles.row, !last && styles.divider]}>
      <Text style={[Type.body, { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[Type.bodyStrong, { color: Colors.text, flexShrink: 1 }]} numberOfLines={1} selectable>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Space.lg, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rows: { paddingVertical: Space.xs },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  divider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: Colors.line },
  units: { flexDirection: 'row', gap: Space.sm },
  unit: {
    flex: 1,
    height: 48,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  unitOn: { backgroundColor: Colors.inkCard },
  error: { color: Colors.text, fontWeight: '800', marginTop: Space.sm },
  signOut: {
    marginTop: Space.xxl,
    height: 50,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
