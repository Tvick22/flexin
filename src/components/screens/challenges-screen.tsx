import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ChallengeResultRow } from '@/components/flexin/challenge-result-row';
import { Avatar, Card, Icon, RankBadge, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import type { Challenge } from '@/data/mock-data';
import { useNow } from '@/hooks/use-now';
import { METRICS, formatScore, isHost, standingsFor, useChallengeStore } from '@/stores/challenge-store';
import { formatClock } from '@/utils/format';
import { formatJoinCode } from '@/utils/join-code';

function openChallenge(id: string) {
  router.push({ pathname: '/challenge/[id]', params: { id } });
}

export function ChallengesScreen() {
  const challenges = useChallengeStore((s) => s.challenges);
  const active = challenges.filter((c) => c.status !== 'finished');
  const finished = challenges.filter((c) => c.status === 'finished');

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[Type.title, { color: Colors.text }]}>Challenges</Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          Train together, score live, compare at the end.
        </Text>

        {active.map((c) =>
          c.status === 'lobby' ? <LobbyCard key={c.id} challenge={c} /> : <LiveCard key={c.id} challenge={c} />,
        )}

        {challenges.length === 0 ? (
          <Pressable
            onPress={() => router.push('/challenge/new')}
            accessibilityRole="button"
            accessibilityLabel="Create a challenge"
            style={({ pressed }) => [styles.createBox, pressed && { opacity: 0.6 }]}>
            <View style={styles.createIcon}>
              <Icon name="plus" size={20} />
            </View>
            <Text style={[Type.heading, { color: Colors.text }]}>Create a challenge</Text>
            <Text style={[Type.caption, { color: Colors.textMuted, textAlign: 'center' }]}>
              Heading to the gym with friends? Host a live challenge and share the code.
            </Text>
          </Pressable>
        ) : (
          <Pressable
            onPress={() => router.push('/challenge/new')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.newButton, pressed && { opacity: 0.85 }]}>
            <Icon name="plus" size={16} color={Colors.onPrimary} />
            <Text style={[Type.heading, { color: Colors.onPrimary }]}>New challenge</Text>
          </Pressable>
        )}

        <Pressable
          onPress={() => router.push('/join')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.joinButton, pressed && { opacity: 0.7 }]}>
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>Join with code</Text>
        </Pressable>

        {finished.length > 0 ? (
          <>
            <SectionHeader title="Results" />
            <Card style={styles.listCard}>
              {finished.map((c, i) => (
                <ChallengeResultRow key={c.id} challenge={c} last={i === finished.length - 1} />
              ))}
            </Card>
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

function LobbyCard({ challenge }: { challenge: Challenge }) {
  const host = isHost(challenge);
  const hostFirst = challenge.participants.find((p) => p.id === challenge.hostId)?.name.split(' ')[0];
  return (
    <Pressable
      onPress={() => openChallenge(challenge.id)}
      accessibilityRole="button"
      accessibilityLabel={`${challenge.name}, lobby. Open`}
      style={({ pressed }) => [styles.lobbyCard, pressed && { opacity: 0.8 }]}>
      <View style={styles.cardTop}>
        <Text style={[Type.label, { color: Colors.textMuted }]}>Lobby · {host ? 'You host' : `${hostFirst} hosts`}</Text>
        <Text style={[Type.caption, { color: Colors.textMuted, fontWeight: '800', letterSpacing: 1 }]}>
          {formatJoinCode(challenge.code)}
        </Text>
      </View>
      <Text style={[Type.heading, { color: Colors.text, marginTop: Space.sm }]} numberOfLines={1}>
        {challenge.name}
      </Text>
      <View style={styles.lobbyPeople}>
        <View style={styles.avatars}>
          {challenge.participants.slice(0, 5).map((p, i) => (
            <View key={p.id} style={[styles.avatarStack, i > 0 && { marginLeft: -10 }]}>
              <Avatar name={p.name} size={28} />
            </View>
          ))}
        </View>
        <Text style={[Type.caption, { color: Colors.textMuted, flex: 1 }]} numberOfLines={1}>
          {challenge.participants.length} in{challenge.invited.length ? ` · ${challenge.invited.length} invited` : ''}
        </Text>
        <Text style={[Type.caption, { color: Colors.text, fontWeight: '800' }]}>{host ? 'Start' : 'Waiting'}</Text>
        <Icon name="chevron" size={12} />
      </View>
    </Pressable>
  );
}

function LiveClock({ challenge }: { challenge: Challenge }) {
  const now = useNow();
  return (
    <Text style={[Type.caption, Type.number, { color: Colors.onInkCardMuted }]}>
      {formatClock((now - Date.parse(challenge.startedAt ?? challenge.createdAt)) / 1000)}
    </Text>
  );
}

function LiveCard({ challenge }: { challenge: Challenge }) {
  const standings = standingsFor(challenge);
  return (
    <Pressable
      onPress={() => openChallenge(challenge.id)}
      accessibilityRole="button"
      accessibilityLabel={`${challenge.name}, live. Open challenge`}
      style={({ pressed }) => [styles.liveCard, pressed && { opacity: 0.9 }]}>
      <View style={styles.cardTop}>
        <View style={styles.liveBadge}>
          <View style={styles.liveDot} />
          <Text style={[Type.label, { color: Colors.onInkCard }]}>Live</Text>
        </View>
        <LiveClock challenge={challenge} />
      </View>
      <Text style={[Type.heading, { color: Colors.onInkCard, marginTop: Space.sm }]} numberOfLines={1}>
        {challenge.name}
      </Text>
      <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>{METRICS[challenge.metric].label}</Text>

      <View style={styles.liveRows}>
        {standings.slice(0, 3).map((s) => (
          <View key={s.user.id} style={styles.liveRow}>
            <RankBadge rank={s.rank} size={22} dark />
            <Text
              style={[Type.caption, { flex: 1, color: s.isMe ? Colors.onInkCard : Colors.onInkCardMuted }, s.isMe && { fontWeight: '800' }]}
              numberOfLines={1}>
              {s.isMe ? 'You' : s.user.name}
            </Text>
            <Text style={[Type.caption, Type.number, { color: Colors.onInkCard, fontWeight: '800' }]}>
              {formatScore(s.score, challenge.metric)}
            </Text>
          </View>
        ))}
      </View>

      <View style={styles.rejoin}>
        <Text style={[Type.bodyStrong, { color: Colors.text }]}>Back to challenge</Text>
        <Icon name="chevron" size={14} />
      </View>
    </Pressable>
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
    gap: Space.md,
  },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lobbyCard: {
    marginTop: Space.sm,
    padding: Space.lg,
    borderRadius: Radius.lg,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  lobbyPeople: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginTop: Space.md,
  },
  avatars: { flexDirection: 'row' },
  avatarStack: { borderRadius: 16, borderWidth: 2, borderColor: Colors.surface },
  liveCard: {
    backgroundColor: Colors.inkCard,
    borderRadius: Radius.lg,
    padding: Space.lg,
    marginTop: Space.sm,
  },
  liveBadge: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: Colors.onInkCard },
  liveRows: {
    gap: Space.sm,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.onInkCardLine,
  },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: Space.sm },
  rejoin: {
    marginTop: Space.lg,
    height: 44,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  createBox: {
    alignItems: 'center',
    gap: Space.xs,
    marginTop: Space.sm,
    paddingVertical: Space.xl,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textFaint,
    backgroundColor: Colors.wash,
  },
  createIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  newButton: {
    marginTop: Space.sm,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  joinButton: {
    height: 48,
    borderRadius: Radius.md,
    borderWidth: 1.5,
    borderColor: Colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listCard: { paddingVertical: Space.xs },
});
