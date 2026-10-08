import { useRef, useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { API_URL, ApiError, NetworkError } from '@/lib/api';
import { authActions, useAuthStore } from '@/stores/auth-store';

type Mode = 'signIn' | 'signUp';

const MIN_PASSWORD = 8;

function looksLikeEmail(email: string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim());
}

/** Email + password: sign in, or create an account (onboarding follows). */
export function SignInScreen() {
  const restoreError = useAuthStore((s) => s.restoreError);
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Sign-up hit an existing account: offer to switch to sign-in with the email kept.
  const [emailTaken, setEmailTaken] = useState(false);
  const passwordRef = useRef<TextInput>(null);

  const signingUp = mode === 'signUp';
  const valid = looksLikeEmail(email) && (signingUp ? password.length >= MIN_PASSWORD : password.length > 0);

  function switchMode(next: Mode) {
    setMode(next);
    setError(null);
    setEmailTaken(false);
  }

  async function submit() {
    if (!valid || busy) return;
    setBusy(true);
    setError(null);
    setEmailTaken(false);
    try {
      if (signingUp) await authActions.signUp(email, password);
      else await authActions.logIn(email, password);
      // Signed in: the router moves on to onboarding (new account) or the app.
    } catch (e) {
      if (e instanceof NetworkError) setError(`Can't reach the server (${API_URL}). Is it running?`);
      else if (e instanceof ApiError) {
        setError(e.message);
        setEmailTaken(signingUp && e.status === 409);
      } else setError(e instanceof Error ? e.message : 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function retryRestore() {
    setBusy(true);
    try {
      await authActions.restore();
    } finally {
      setBusy(false);
    }
  }

  const message = error ?? (restoreError ? `Couldn't restore your session: ${restoreError}` : null);
  const remaining = MIN_PASSWORD - password.length;

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.inner} keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.wordmark}>Flexin&apos;</Text>
            <Text style={[Type.heading, styles.tagline]}>Live gym challenges with your friends.</Text>
          </View>

          <View style={styles.segments} accessibilityRole="tablist">
            {(['signIn', 'signUp'] as const).map((m) => (
              <Pressable
                key={m}
                onPress={() => switchMode(m)}
                accessibilityRole="tab"
                accessibilityState={{ selected: mode === m }}
                style={[styles.segment, mode === m && styles.segmentOn]}>
                <Text style={[Type.bodyStrong, { color: mode === m ? Colors.text : Colors.textMuted }]}>
                  {m === 'signIn' ? 'Sign in' : 'Create account'}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={[Type.label, styles.label]}>Email</Text>
          <TextInput
            value={email}
            onChangeText={(t) => {
              setEmail(t);
              setError(null);
            }}
            placeholder="you@example.com"
            placeholderTextColor={Colors.textFaint}
            autoCapitalize="none"
            autoCorrect={false}
            keyboardType="email-address"
            autoComplete="email"
            textContentType="emailAddress"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            accessibilityLabel="Email"
            style={styles.input}
          />

          <Text style={[Type.label, styles.label]}>Password</Text>
          <View style={styles.passwordRow}>
            <TextInput
              ref={passwordRef}
              value={password}
              onChangeText={(t) => {
                setPassword(t);
                setError(null);
              }}
              placeholder={signingUp ? `At least ${MIN_PASSWORD} characters` : 'Your password'}
              placeholderTextColor={Colors.textFaint}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete={signingUp ? 'new-password' : 'current-password'}
              textContentType={signingUp ? 'newPassword' : 'password'}
              returnKeyType="go"
              onSubmitEditing={submit}
              maxLength={128}
              accessibilityLabel="Password"
              style={[styles.input, styles.passwordInput]}
            />
            <Pressable
              onPress={() => setShowPassword((v) => !v)}
              accessibilityRole="button"
              accessibilityLabel={showPassword ? 'Hide password' : 'Show password'}
              hitSlop={8}
              style={styles.showToggle}>
              <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>
                {showPassword ? 'Hide' : 'Show'}
              </Text>
            </Pressable>
          </View>
          {signingUp ? (
            <Text style={[Type.caption, styles.hint]}>
              {password.length > 0 && remaining > 0
                ? `${remaining} more character${remaining === 1 ? '' : 's'}`
                : `At least ${MIN_PASSWORD} characters. A short phrase works well.`}
            </Text>
          ) : null}

          {message ? (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>{message}</Text>
              {emailTaken ? (
                <Pressable onPress={() => switchMode('signIn')} accessibilityRole="button" hitSlop={8}>
                  <Text style={[Type.caption, styles.link]}>Sign in with this email</Text>
                </Pressable>
              ) : restoreError && !error ? (
                <Pressable onPress={retryRestore} accessibilityRole="button" hitSlop={8}>
                  <Text style={[Type.caption, styles.link]}>{busy ? 'Retrying…' : 'Retry'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          <Pressable
            onPress={submit}
            disabled={!valid || busy}
            accessibilityRole="button"
            accessibilityState={{ disabled: !valid || busy }}
            style={({ pressed }) => [styles.submit, (!valid || busy) && styles.disabled, pressed && styles.pressed]}>
            {busy ? (
              <ActivityIndicator color={Colors.onPrimary} />
            ) : (
              <Text style={[Type.heading, { color: Colors.onPrimary }]}>
                {signingUp ? 'Create account' : 'Sign in'}
              </Text>
            )}
          </Pressable>

          <Pressable
            onPress={() => switchMode(signingUp ? 'signIn' : 'signUp')}
            accessibilityRole="button"
            style={styles.switch}
            hitSlop={8}>
            <Text style={[Type.caption, { color: Colors.textMuted }]}>
              {signingUp ? 'Already have an account? ' : 'New to Flexin’? '}
              <Text style={{ color: Colors.text, fontWeight: '800' }}>
                {signingUp ? 'Sign in' : 'Create an account'}
              </Text>
            </Text>
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  flex: { flex: 1 },
  inner: {
    flexGrow: 1,
    justifyContent: 'center',
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: Space.xl,
  },
  hero: { alignItems: 'center', gap: Space.sm, marginBottom: Space.xxl },
  wordmark: { fontSize: 56, fontWeight: '900', letterSpacing: -1.5, color: Colors.text },
  tagline: { color: Colors.text, textAlign: 'center' },
  segments: {
    flexDirection: 'row',
    padding: 4,
    borderRadius: Radius.md,
    backgroundColor: Colors.wash,
    marginBottom: Space.sm,
  },
  segment: { flex: 1, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: Radius.sm },
  segmentOn: { backgroundColor: Colors.surface },
  label: { color: Colors.textMuted, marginTop: Space.lg, marginBottom: Space.sm },
  input: {
    height: 52,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.lg,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '600',
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  passwordRow: { flexDirection: 'row', alignItems: 'center' },
  passwordInput: { flex: 1, paddingRight: 64 },
  showToggle: { position: 'absolute', right: Space.lg },
  hint: { color: Colors.textMuted, marginTop: Space.sm },
  error: {
    marginTop: Space.lg,
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    gap: Space.xs,
  },
  link: { color: Colors.text, fontWeight: '800', textDecorationLine: 'underline' },
  submit: {
    marginTop: Space.xl,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  switch: { alignSelf: 'center', marginTop: Space.lg, padding: Space.sm },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.7 },
});
