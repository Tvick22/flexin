import { Pressable, Share, StyleSheet, Text, View } from 'react-native';

import { Icon } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import type { Challenge } from '@/data/mock-data';
import { formatJoinCode, joinLink } from '@/utils/join-code';

export async function shareChallenge(challenge: Pick<Challenge, 'name' | 'code'>) {
  const link = joinLink(challenge.code);
  try {
    await Share.share({
      message: `Join my Flexin' challenge "${challenge.name}"! Code ${formatJoinCode(challenge.code)} or tap ${link}`,
      url: link, // iOS shows this as a link preview
    });
  } catch {
    // Share sheet unavailable (e.g. some web browsers); the code is on screen.
  }
}

/** Big join code + link + Share button. `compact` is a one-line version for the live screen. */
export function JoinCodeCard({ challenge, compact }: { challenge: Pick<Challenge, 'name' | 'code'>; compact?: boolean }) {
  const code = formatJoinCode(challenge.code);

  if (compact) {
    return (
      <View style={styles.compact}>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          Join code <Text style={styles.compactCode}>{code}</Text>
        </Text>
        <Pressable
          onPress={() => shareChallenge(challenge)}
          accessibilityRole="button"
          accessibilityLabel="Share join link"
          hitSlop={8}
          style={({ pressed }) => [styles.compactShare, pressed && styles.pressed]}>
          <Icon name="share" size={13} />
          <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>Share</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.card}>
      <Text style={[Type.label, { color: Colors.onInkCardMuted }]}>Join code</Text>
      <Text selectable style={styles.code} accessibilityLabel={`Join code ${challenge.code.split('').join(' ')}`}>
        {code}
      </Text>
      <Text selectable style={[Type.caption, { color: Colors.onInkCardMuted }]} numberOfLines={1}>
        {joinLink(challenge.code)}
      </Text>
      <Pressable
        onPress={() => shareChallenge(challenge)}
        accessibilityRole="button"
        style={({ pressed }) => [styles.share, pressed && styles.pressed]}>
        <Icon name="share" size={15} />
        <Text style={[Type.bodyStrong, { color: Colors.text }]}>Share invite link</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    alignItems: 'center',
    gap: Space.xs,
    padding: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.inkCard,
  },
  code: {
    color: Colors.onInkCard,
    fontSize: 40,
    fontWeight: '900',
    letterSpacing: 4,
    fontVariant: ['tabular-nums'],
  },
  share: {
    alignSelf: 'stretch',
    marginTop: Space.md,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  compact: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Space.sm,
  },
  compactCode: {
    color: Colors.text,
    fontWeight: '900',
    letterSpacing: 1,
  },
  compactShare: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    height: 30,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
  },
  pressed: { opacity: 0.7 },
});
