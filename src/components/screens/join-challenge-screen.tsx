import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { challengeActions } from '@/stores/challenge-store';
import { JOIN_CODE_LENGTH, formatJoinCode, normalizeJoinCode } from '@/utils/join-code';

const NOT_FOUND = "No open challenge has that code. Check it with the host — codes stop working once a challenge ends.";

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

export function JoinChallengeScreen() {
  // A shared link that didn't resolve lands here with the code prefilled.
  const params = useLocalSearchParams<{ code?: string; notFound?: string }>();
  const [code, setCode] = useState(() => normalizeJoinCode(params.code ?? ''));
  const [error, setError] = useState<string | null>(params.notFound ? NOT_FOUND : null);
  const [focused, setFocused] = useState(false);
  const canJoin = code.length === JOIN_CODE_LENGTH;

  function join() {
    if (!canJoin) return;
    const challenge = challengeActions.join(code);
    if (!challenge) {
      setError(NOT_FOUND);
      return;
    }
    router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[Type.title, { color: Colors.text }]}>Join a challenge</Text>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>

        <Text style={[Type.body, { color: Colors.textMuted, marginTop: Space.sm }]}>
          Enter the 6-character code from the host, or just open the invite link they shared.
        </Text>

        <TextInput
          value={formatJoinCode(code)}
          onChangeText={(t) => {
            setCode(normalizeJoinCode(t));
            setError(null);
          }}
          onSubmitEditing={join}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder="XXX XXX"
          placeholderTextColor={Colors.textFaint}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="off"
          autoFocus
          maxLength={JOIN_CODE_LENGTH + 1}
          returnKeyType="go"
          accessibilityLabel="Join code"
          style={[styles.input, focused && styles.inputFocused]}
        />
        {error ? <Text style={[Type.caption, styles.error]}>{error}</Text> : null}

        <Pressable
          onPress={join}
          disabled={!canJoin}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canJoin }}
          style={({ pressed }) => [styles.joinButton, !canJoin && styles.disabled, pressed && styles.pressed]}>
          <Text style={[Type.heading, { color: Colors.onPrimary }]}>Join</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center', paddingHorizontal: Space.lg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Space.sm,
  },
  input: {
    marginTop: Space.xl,
    height: 72,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
    color: Colors.text,
    fontSize: 32,
    fontWeight: '900',
    letterSpacing: 6,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    // Web: drop the browser focus ring (it reads as a plate color); focus shows as an ink border.
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  inputFocused: { borderColor: Colors.text },
  error: { color: Colors.text, fontWeight: '800', textAlign: 'center', marginTop: Space.md },
  joinButton: {
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
