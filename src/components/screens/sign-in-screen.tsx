import * as AppleAuthentication from 'expo-apple-authentication';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { API_URL, ApiError, NetworkError } from '@/lib/api';
import {
  isAppleSignInAvailable,
  isGoogleSignInConfigured,
  signInWithApple,
  signInWithGoogle,
} from '@/lib/social-sign-in';
import { authActions, useAuthStore } from '@/stores/auth-store';

type Busy = 'apple' | 'google' | 'dev' | 'retry' | null;

function describe(e: unknown): string {
  if (e instanceof NetworkError) return `Can't reach the server (${API_URL}). Is it running?`;
  if (e instanceof ApiError) return e.message;
  return e instanceof Error ? e.message : 'Something went wrong. Try again.';
}

export function SignInScreen() {
  const restoreError = useAuthStore((s) => s.restoreError);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [busy, setBusy] = useState<Busy>(null);
  const [error, setError] = useState<string | null>(null);
  const [devEmail, setDevEmail] = useState('dev@flexin.local');

  useEffect(() => {
    isAppleSignInAvailable().then(setAppleAvailable, () => setAppleAvailable(false));
  }, []);

  async function run(kind: Exclude<Busy, null>, action: () => Promise<void>) {
    setBusy(kind);
    setError(null);
    try {
      await action();
      // On success the auth store flips to signed-in and the router leaves this screen.
    } catch (e) {
      setError(describe(e));
    } finally {
      setBusy(null);
    }
  }

  const apple = () =>
    run('apple', async () => {
      const credential = await signInWithApple();
      if (credential) await authActions.signInWithApple(credential);
    });

  const google = () =>
    run('google', async () => {
      const credential = await signInWithGoogle();
      if (credential) await authActions.signInWithGoogle(credential);
    });

  const dev = () => run('dev', () => authActions.devSignIn(devEmail.trim()));
  const retry = () => run('retry', () => authActions.restore());

  const message = error ?? (restoreError ? `Couldn't restore your session: ${restoreError}` : null);
  const noProviders = !appleAvailable && !isGoogleSignInConfigured;

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <View style={styles.hero}>
          <Text style={styles.wordmark}>Flexin&apos;</Text>
          <Text style={[Type.heading, styles.tagline]}>Live gym challenges with your friends.</Text>
          <Text style={[Type.body, { color: Colors.textMuted, textAlign: 'center' }]}>
            Start a challenge, log your sets between rounds, and see who moved the most.
          </Text>
        </View>

        <View style={styles.actions}>
          {message ? (
            <View style={styles.error} accessibilityRole="alert">
              <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>{message}</Text>
              {restoreError && !error ? (
                <Pressable onPress={retry} accessibilityRole="button" hitSlop={8}>
                  <Text style={[Type.caption, styles.link]}>{busy === 'retry' ? 'Retrying…' : 'Retry'}</Text>
                </Pressable>
              ) : null}
            </View>
          ) : null}

          {appleAvailable ? (
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
              cornerRadius={Radius.md}
              style={[styles.providerButton, busy !== null && styles.disabled]}
              onPress={busy === null ? apple : () => {}}
            />
          ) : null}

          {isGoogleSignInConfigured ? (
            <Pressable
              onPress={google}
              disabled={busy !== null}
              accessibilityRole="button"
              style={({ pressed }) => [styles.providerButton, styles.googleButton, pressed && styles.pressed]}>
              {busy === 'google' ? (
                <ActivityIndicator color={Colors.text} />
              ) : (
                <Text style={[Type.heading, { color: Colors.text }]}>Continue with Google</Text>
              )}
            </Pressable>
          ) : null}

          {noProviders && !__DEV__ ? (
            <Text style={[Type.caption, { color: Colors.textMuted, textAlign: 'center' }]}>
              Sign-in isn&apos;t available on this device.
            </Text>
          ) : null}

          {__DEV__ ? (
            <View style={styles.dev}>
              <Text style={[Type.label, { color: Colors.textMuted }]}>Development only</Text>
              <TextInput
                value={devEmail}
                onChangeText={setDevEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                accessibilityLabel="Test account email"
                style={styles.devInput}
              />
              <Pressable
                onPress={dev}
                disabled={busy !== null || !devEmail.includes('@')}
                accessibilityRole="button"
                style={({ pressed }) => [styles.devButton, pressed && styles.pressed]}>
                {busy === 'dev' ? (
                  <ActivityIndicator color={Colors.text} />
                ) : (
                  <Text style={[Type.bodyStrong, { color: Colors.text }]}>Sign in as test account</Text>
                )}
              </Pressable>
            </View>
          ) : null}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  inner: {
    flex: 1,
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    padding: Space.xl,
    justifyContent: 'space-between',
  },
  hero: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: Space.md },
  wordmark: { fontSize: 56, fontWeight: '900', letterSpacing: -1.5, color: Colors.text },
  tagline: { color: Colors.text, textAlign: 'center' },
  actions: { gap: Space.md, paddingBottom: Space.lg },
  providerButton: { height: 54, width: '100%' },
  googleButton: {
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    gap: Space.xs,
  },
  link: { color: Colors.text, fontWeight: '800', textDecorationLine: 'underline' },
  dev: {
    gap: Space.sm,
    padding: Space.md,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textFaint,
    backgroundColor: Colors.wash,
  },
  devInput: {
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.md,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  devButton: {
    height: 44,
    borderRadius: Radius.sm,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: { opacity: 0.5 },
  pressed: { opacity: 0.7 },
});
