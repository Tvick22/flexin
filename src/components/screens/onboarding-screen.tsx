import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { ApiError, NetworkError } from '@/lib/api';
import { authActions, useMe } from '@/stores/auth-store';

const HANDLE_RE = /^[a-z0-9_]{3,30}$/;

type HandleStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'available' }
  | { kind: 'unavailable'; message: string };

function normalizeHandle(input: string) {
  return input.replace(/^@/, '').toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 30);
}

/** First run after sign-in: pick a name and @handle (and units). */
export function OnboardingScreen() {
  const me = useMe();
  const [name, setName] = useState(me.name ?? '');
  const [handle, setHandle] = useState('');
  const [unit, setUnit] = useState(me.unit);
  const [status, setStatus] = useState<HandleStatus>({ kind: 'idle' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Debounced availability check while typing.
  useEffect(() => {
    if (!HANDLE_RE.test(handle)) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      authActions.checkHandle(handle).then(
        (res) => {
          if (cancelled) return;
          setStatus(
            res.available
              ? { kind: 'available' }
              : { kind: 'unavailable', message: res.reason === 'taken' ? '@' + handle + ' is taken' : 'Not a valid handle' },
          );
        },
        () => !cancelled && setStatus({ kind: 'idle' }), // can't check right now; saving will tell
      );
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [handle]);

  function onChangeHandle(text: string) {
    const next = normalizeHandle(text);
    setHandle(next);
    setError(null);
    if (next.length === 0) setStatus({ kind: 'idle' });
    else if (next.length < 3) setStatus({ kind: 'unavailable', message: 'At least 3 characters' });
    else setStatus({ kind: 'checking' });
  }

  const canSave = name.trim().length > 0 && HANDLE_RE.test(handle) && status.kind !== 'unavailable' && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError(null);
    try {
      await authActions.updateProfile({ name: name.trim(), handle, unit });
      // `onboarded` is now true; the router swaps this screen for the app.
    } catch (e) {
      if (e instanceof ApiError && e.status === 409) setStatus({ kind: 'unavailable', message: `@${handle} is taken` });
      else setError(e instanceof NetworkError ? "Can't reach the server. Try again." : (e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Text style={[Type.title, { color: Colors.text }]}>Set up your profile</Text>
        <Text style={[Type.body, { color: Colors.textMuted, marginTop: Space.xs }]}>
          This is how friends find you and how you show up on the scoreboard.
        </Text>

        <Text style={[Type.label, styles.label]}>Name</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="Your name"
          placeholderTextColor={Colors.textFaint}
          maxLength={50}
          autoComplete="name"
          textContentType="name"
          accessibilityLabel="Name"
          style={styles.input}
        />

        <Text style={[Type.label, styles.label]}>Handle</Text>
        <View style={styles.handleRow}>
          <Text style={styles.at}>@</Text>
          <TextInput
            value={handle}
            onChangeText={onChangeHandle}
            placeholder="yourhandle"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            autoComplete="username"
            textContentType="username"
            maxLength={30}
            accessibilityLabel="Handle"
            style={[styles.input, styles.handleInput]}
          />
          <View style={styles.handleStatus}>
            {status.kind === 'checking' ? <ActivityIndicator size="small" color={Colors.textMuted} /> : null}
          </View>
        </View>
        <Text
          style={[
            Type.caption,
            styles.hint,
            status.kind === 'unavailable' && { color: Colors.text, fontWeight: '800' },
          ]}
          accessibilityLiveRegion="polite">
          {status.kind === 'available'
            ? `@${handle} is available`
            : status.kind === 'unavailable'
              ? status.message
              : 'Letters, numbers and underscores. 3–30 characters.'}
        </Text>

        <Text style={[Type.label, styles.label]}>Weights in</Text>
        <View style={styles.units}>
          {(['lb', 'kg'] as const).map((u) => (
            <Pressable
              key={u}
              onPress={() => setUnit(u)}
              accessibilityRole="radio"
              accessibilityState={{ checked: unit === u }}
              style={[styles.unit, unit === u && styles.unitOn]}>
              <Text style={[Type.bodyStrong, { color: unit === u ? Colors.onInkCard : Colors.text }]}>
                {u === 'lb' ? 'Pounds (lb)' : 'Kilograms (kg)'}
              </Text>
            </Pressable>
          ))}
        </View>

        {error ? (
          <Text style={[Type.caption, styles.error]} accessibilityRole="alert">
            {error}
          </Text>
        ) : null}

        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave }}
          style={({ pressed }) => [styles.save, !canSave && styles.disabled, pressed && styles.pressed]}>
          {saving ? (
            <ActivityIndicator color={Colors.onPrimary} />
          ) : (
            <Text style={[Type.heading, { color: Colors.onPrimary }]}>Let&apos;s go</Text>
          )}
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: { padding: Space.xl, width: '100%', maxWidth: 480, alignSelf: 'center' },
  label: { color: Colors.textMuted, marginTop: Space.xl, marginBottom: Space.sm },
  input: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.lg,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  handleRow: { flexDirection: 'row', alignItems: 'center' },
  at: { position: 'absolute', left: Space.lg, zIndex: 1, fontSize: 17, fontWeight: '800', color: Colors.textMuted },
  handleInput: { flex: 1, paddingLeft: Space.lg + 16, paddingRight: 44 },
  handleStatus: { position: 'absolute', right: Space.md, width: 24, alignItems: 'center' },
  hint: { color: Colors.textMuted, marginTop: Space.sm },
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
  error: { color: Colors.text, fontWeight: '800', marginTop: Space.lg },
  save: {
    marginTop: Space.xl,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
