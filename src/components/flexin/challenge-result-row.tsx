import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon, RankBadge } from '@/components/flexin/ui';
import { Colors, Space, Type } from '@/constants/flexin-theme';
import type { Challenge } from '@/data/mock-data';
import { METRICS, standingsFor } from '@/stores/challenge-store';
import { timeAgo } from '@/utils/format';

/** One finished challenge: your final rank plate, who won, tap for full results. */
export function ChallengeResultRow({ challenge, last }: { challenge: Challenge; last: boolean }) {
  const standings = standingsFor(challenge);
  const mine = standings.find((s) => s.isMe);
  const winners = standings.filter((s) => s.rank === 1);
  const others = challenge.participants.length - 1;
  const outcome =
    winners.length === 0
      ? 'No one scored'
      : winners.some((w) => w.isMe)
        ? winners.length > 1
          ? 'You tied for 1st'
          : 'You won'
        : `${winners[0].user.name.split(' ')[0]} won`;

  return (
    <Pressable
      onPress={() => router.push({ pathname: '/challenge/[id]', params: { id: challenge.id } })}
      accessibilityRole="button"
      style={({ pressed }) => [styles.row, !last && styles.divider, pressed && { opacity: 0.6 }]}>
      <RankBadge rank={mine?.rank ?? null} size={32} />
      <View style={{ flex: 1 }}>
        <Text style={[Type.bodyStrong, { color: Colors.text }]} numberOfLines={1}>
          {challenge.name}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]} numberOfLines={1}>
          {outcome} · {METRICS[challenge.metric].label} · vs {others} · {timeAgo(challenge.endedAt ?? challenge.createdAt)}
        </Text>
      </View>
      <Icon name="chevron" size={14} color={Colors.textFaint} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
});
