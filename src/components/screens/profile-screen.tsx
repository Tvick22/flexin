import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChallengeResultRow } from '@/components/flexin/challenge-result-row';
import { Avatar, Card, EmptyState, IconButton, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { mockMe, type Challenge, type UserSummary } from '@/data/mock-data';
import { useMe } from '@/stores/auth-store';
import { scoreSets, standingsFor, useChallengeStore } from '@/stores/challenge-store';
import { useFriendsStore } from '@/stores/friends-store';
import { formatNumber, formatWeight } from '@/utils/format';

const unit = mockMe.unit;

type Rivalry = { user: UserSummary; wins: number; losses: number };

/** You beat someone in a challenge if you finished with a higher score. */
function headToHead(finished: Challenge[]): Rivalry[] {
  const byUser = new Map<string, Rivalry>();
  for (const c of finished) {
    const standings = standingsFor(c);
    const me = standings.find((s) => s.isMe);
    if (!me) continue;
    for (const s of standings) {
      if (s.isMe) continue;
      const r = byUser.get(s.user.id) ?? { user: s.user, wins: 0, losses: 0 };
      if (me.score > s.score) r.wins++;
      else if (s.score > me.score) r.losses++;
      byUser.set(s.user.id, r);
    }
  }
  return [...byUser.values()].sort((a, b) => b.wins + b.losses - (a.wins + a.losses));
}

export function ProfileScreen() {
  const me = useMe();
  const challenges = useChallengeStore((s) => s.challenges);
  const friendCount = useFriendsStore((s) => s.friends.length);

  const finished = challenges.filter((c) => c.status === 'finished');
  const wins = finished.filter((c) => standingsFor(c).some((s) => s.isMe && s.rank === 1)).length;
  const myChallengeSets = finished.map((c) => c.sets.filter((s) => s.userId === mockMe.id));
  const bests = {
    volume: Math.max(0, ...myChallengeSets.map((sets) => scoreSets(sets, 'volume'))),
    reps: Math.max(0, ...myChallengeSets.map((sets) => scoreSets(sets, 'reps'))),
    heaviest: Math.max(0, ...myChallengeSets.map((sets) => scoreSets(sets, 'heaviest'))),
  };
  const rivalries = headToHead(finished);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <Text style={[Type.title, { color: Colors.text }]}>Profile</Text>
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <View style={styles.identity}>
          <Avatar name={me.name ?? me.handle ?? '?'} size={88} />
          <Text style={[Type.title, { color: Colors.text, marginTop: Space.md }]}>{me.name}</Text>
          <Text style={[Type.body, { color: Colors.textMuted }]}>@{me.handle}</Text>
        </View>

        <Card style={styles.statsRow}>
          <StatCell value={`${finished.length}`} label="Challenges" />
          <View style={styles.statDivider} />
          <StatCell value={`${wins}`} label={wins === 1 ? 'Win' : 'Wins'} />
          <View style={styles.statDivider} />
          <StatCell value={`${friendCount}`} label={friendCount === 1 ? 'Friend' : 'Friends'} />
        </Card>

        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>Edit profile</Text>
        </Pressable>

        <SectionHeader title="Challenge bests" />
        <Card dark>
          <View style={styles.bests}>
            <Best label="Volume" value={bests.volume ? formatNumber(bests.volume) : '—'} unit={unit} />
            <Best label="Reps" value={bests.reps ? formatNumber(bests.reps) : '—'} unit="reps" />
            <Best label="Heaviest" value={bests.heaviest ? formatWeight(bests.heaviest) : '—'} unit={unit} />
          </View>
          {finished.length === 0 ? (
            <Text style={[Type.caption, { color: Colors.onInkCardMuted, marginTop: Space.md }]}>
              Your best single-challenge numbers show up after your first challenge.
            </Text>
          ) : null}
        </Card>

        <SectionHeader title="Head-to-head" />
        <Card style={rivalries.length ? styles.listCard : undefined}>
          {rivalries.length === 0 ? (
            <EmptyState title="No rivalries yet" body="Finish a challenge with a friend to start keeping score." />
          ) : (
            rivalries.map((r, i) => (
              <View key={r.user.id} style={[styles.rivalRow, i < rivalries.length - 1 && styles.divider]}>
                <Avatar name={r.user.name} size={36} />
                <Text style={[Type.bodyStrong, { color: Colors.text, flex: 1 }]} numberOfLines={1}>
                  {r.user.name}
                </Text>
                <Text style={[Type.heading, Type.number, { color: Colors.text }]}>
                  {r.wins}–{r.losses}
                </Text>
              </View>
            ))
          )}
        </Card>

        <SectionHeader title="Recent challenges" />
        <Card style={finished.length ? styles.listCard : undefined}>
          {finished.length === 0 ? (
            <EmptyState title="No challenges yet" body="Start one from the Challenges tab next time you hit the gym." />
          ) : (
            finished.slice(0, 5).map((c, i, arr) => <ChallengeResultRow key={c.id} challenge={c} last={i === arr.length - 1} />)
          )}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCell({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.statCell}>
      <Text style={[Type.stat, { color: Colors.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: Colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function Best({ label, value, unit: u }: { label: string; value: string; unit: string }) {
  return (
    <View style={styles.best}>
      <Text style={[Type.label, { color: Colors.onInkCardMuted }]}>{label}</Text>
      <Text style={[Type.stat, { color: value === '—' ? Colors.onInkCardMuted : Colors.onInkCard }]}>{value}</Text>
      {value !== '—' ? <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>{u}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  content: {
    padding: Space.lg,
    paddingBottom: Space.xxl * 2,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  identity: {
    alignItems: 'center',
    marginTop: Space.md,
    marginBottom: Space.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.md,
  },
  statCell: { flex: 1, alignItems: 'center' },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.line,
  },
  editButton: {
    marginTop: Space.md,
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bests: { flexDirection: 'row' },
  best: { flex: 1, gap: 2 },
  listCard: { paddingVertical: Space.xs },
  rivalRow: {
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
