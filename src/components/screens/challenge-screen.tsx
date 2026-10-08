import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, LinearTransition } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';

import { JoinCodeCard } from '@/components/flexin/join-code';
import { Stepper } from '@/components/flexin/stepper';
import { Avatar, Card, ConfirmSheet, EmptyState, Icon, IconButton, RankBadge, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type, rankColor } from '@/constants/flexin-theme';
import { mockMe, type Challenge, type ChallengeSet } from '@/data/mock-data';
import { useNow } from '@/hooks/use-now';
import {
  METRICS,
  challengeActions,
  formatScore,
  isHost,
  loggerFor,
  scoreSets,
  setScore,
  standingsFor,
  useChallengeStore,
  type Standing,
} from '@/stores/challenge-store';
import { formatClock, formatNumber, formatWeight, timeAgo } from '@/utils/format';

const unit = mockMe.unit;
const WEIGHT_STEP = unit === 'kg' ? 2.5 : 5;

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function firstName(s: Standing) {
  return s.isMe ? 'You' : s.user.name.split(' ')[0];
}

/** "185 lb × 8", or "BW × 12" for bodyweight (weight 0). */
function setText(set: Pick<ChallengeSet, 'weight' | 'reps'>) {
  const w = set.weight === 0 ? 'BW' : `${formatWeight(set.weight)} ${unit}`;
  return `${w} × ${set.reps}`;
}

export function ChallengeScreen({ id }: { id: string }) {
  const challenge = useChallengeStore((s) => s.challenges.find((c) => c.id === id));

  if (!challenge) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.padded}>
          <IconButton icon="back" label="Back" onPress={goBack} />
        </View>
        <View style={styles.missing}>
          <EmptyState
            title="Challenge not found"
            body="Challenges only last until the app reloads for now. They'll be saved once the backend is connected."
          />
        </View>
      </SafeAreaView>
    );
  }

  if (challenge.status === 'lobby') return <LobbyView challenge={challenge} />;
  return challenge.status === 'live' ? <LiveView challenge={challenge} /> : <ResultsView challenge={challenge} />;
}

function hostName(c: Challenge) {
  if (isHost(c)) return 'You';
  return c.participants.find((p) => p.id === c.hostId)?.name.split(' ')[0] ?? 'The host';
}

// --- Lobby -------------------------------------------------------------------

function LobbyView({ challenge }: { challenge: Challenge }) {
  const [confirmLeave, setConfirmLeave] = useState(false);
  const host = isHost(challenge);
  const canStart = challenge.participants.length >= 2;

  function leave() {
    setConfirmLeave(false);
    goBack();
    challengeActions.remove(challenge.id);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="back" label="Back (the lobby stays open)" onPress={goBack} />
        <View style={styles.liveClock}>
          <Text style={[Type.label, { color: Colors.textMuted }]}>Lobby</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[Type.title, { color: Colors.text }]} numberOfLines={2}>
          {challenge.name}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted, marginBottom: Space.lg }]}>
          {METRICS[challenge.metric].label} · Hosted by {hostName(challenge)}
        </Text>

        <JoinCodeCard challenge={challenge} />

        <SectionHeader title={`In the lobby · ${challenge.participants.length}`} />
        <Card style={styles.listCard}>
          {challenge.participants.map((p, i) => (
            <Animated.View
              key={p.id}
              entering={FadeIn.duration(400)}
              style={[styles.playerRow, (i < challenge.participants.length - 1 || challenge.invited.length > 0) && styles.divider]}>
              <Avatar name={p.name} size={36} />
              <Text style={[Type.bodyStrong, { color: Colors.text, flex: 1 }]} numberOfLines={1}>
                {p.id === mockMe.id ? 'You' : p.name}
              </Text>
              {p.id === challenge.hostId ? (
                <View style={styles.hostPill}>
                  <Text style={[Type.label, { color: Colors.onInkCard }]}>Host</Text>
                </View>
              ) : null}
            </Animated.View>
          ))}
          {challenge.invited.map((u, i) => (
            <View key={u.id} style={[styles.playerRow, styles.invited, i < challenge.invited.length - 1 && styles.divider]}>
              <Avatar name={u.name} size={36} />
              <Text style={[Type.bodyStrong, { color: Colors.text, flex: 1 }]} numberOfLines={1}>
                {u.name}
              </Text>
              <Text style={[Type.caption, { color: Colors.textMuted }]}>Invited…</Text>
            </View>
          ))}
        </Card>

        {host ? (
          <>
            <Pressable
              onPress={() => challengeActions.start(challenge.id)}
              disabled={!canStart}
              accessibilityRole="button"
              accessibilityState={{ disabled: !canStart }}
              style={({ pressed }) => [styles.startButton, !canStart && styles.disabled, pressed && styles.pressed]}>
              <Icon name="bolt" size={18} color={Colors.onPrimary} />
              <Text style={[Type.heading, { color: Colors.onPrimary }]}>Start challenge</Text>
            </Pressable>
            <Text style={[Type.caption, { color: Colors.textMuted, textAlign: 'center', marginTop: Space.sm }]}>
              {canStart
                ? 'Scores start counting for everyone when you tap Start.'
                : 'Waiting for at least one more person to join.'}
            </Text>
          </>
        ) : (
          <Card style={styles.waiting}>
            <Text style={[Type.bodyStrong, { color: Colors.text }]}>Waiting for {hostName(challenge)} to start…</Text>
            <Text style={[Type.caption, { color: Colors.textMuted }]}>
              This screen switches to the scoreboard the moment it begins.
            </Text>
          </Card>
        )}

        <Pressable onPress={() => setConfirmLeave(true)} accessibilityRole="button" style={styles.doneButton} hitSlop={8}>
          <Text style={[Type.bodyStrong, { color: Colors.textMuted }]}>{host ? 'Cancel challenge' : 'Leave lobby'}</Text>
        </Pressable>
      </ScrollView>

      <ConfirmSheet
        visible={confirmLeave}
        title={host ? 'Cancel challenge?' : 'Leave lobby?'}
        body={host ? 'The lobby closes for everyone and the join code stops working.' : 'You can rejoin with the code while it’s open.'}
        confirmLabel={host ? 'Cancel challenge' : 'Leave'}
        cancelLabel={host ? 'Keep it open' : 'Stay'}
        destructive
        onConfirm={leave}
        onCancel={() => setConfirmLeave(false)}
      />
    </SafeAreaView>
  );
}

// --- Live --------------------------------------------------------------------

function LiveView({ challenge }: { challenge: Challenge }) {
  const [confirmEnd, setConfirmEnd] = useState(false);
  const standings = standingsFor(challenge);

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <IconButton icon="back" label="Leave challenge screen (it keeps running)" onPress={goBack} />
        <LiveClock challenge={challenge} />
        {isHost(challenge) ? (
          <Pressable
            onPress={() => setConfirmEnd(true)}
            accessibilityRole="button"
            accessibilityLabel="End challenge for everyone"
            style={({ pressed }) => [styles.endButton, pressed && styles.pressed]}>
            <Text style={[Type.bodyStrong, { color: Colors.text }]}>End</Text>
          </Pressable>
        ) : (
          <View style={{ width: 40 }} />
        )}
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Text style={[Type.title, { color: Colors.text }]} numberOfLines={2}>
          {challenge.name}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {METRICS[challenge.metric].label} · Hosted by {hostName(challenge)}
        </Text>
        <JoinCodeCard challenge={challenge} compact />

        <Scoreboard challenge={challenge} standings={standings} />
        <SetLogger challenge={challenge} />
        <MySets challenge={challenge} />
        <Feed challenge={challenge} />
      </ScrollView>

      <ConfirmSheet
        visible={confirmEnd}
        title="End challenge?"
        body="Scores lock for everyone and you'll all see the final results."
        confirmLabel="End challenge"
        cancelLabel="Keep going"
        destructive
        onConfirm={() => {
          setConfirmEnd(false);
          challengeActions.end(challenge.id);
        }}
        onCancel={() => setConfirmEnd(false)}
      />
    </SafeAreaView>
  );
}

function LiveClock({ challenge }: { challenge: Challenge }) {
  const now = useNow();
  const text = formatClock((now - Date.parse(challenge.startedAt ?? challenge.createdAt)) / 1000);
  return (
    <View style={styles.liveClock} accessibilityLabel={`Live, ${text}`}>
      <View style={styles.liveDot} />
      <Text style={[Type.label, { color: Colors.text }]}>Live</Text>
      <Text style={[Type.heading, Type.number, { color: Colors.text }]}>{text}</Text>
    </View>
  );
}

function Scoreboard({ challenge, standings }: { challenge: Challenge; standings: Standing[] }) {
  const now = useNow(5000);
  const leader = standings[0];
  const meIndex = standings.findIndex((s) => s.isMe);
  const me = standings[meIndex];
  const max = Math.max(leader?.score ?? 0, 1);

  let status = 'Log a set to get on the board.';
  if (me && me.score > 0) {
    const ahead = standings.slice(0, meIndex).filter((s) => s.score > me.score).at(-1);
    const behind = standings.slice(meIndex + 1).find((s) => s.score < me.score);
    if (ahead) status = `${formatScore(ahead.score - me.score, challenge.metric)} behind ${firstName(ahead)}`;
    else if (standings.some((s) => !s.isMe && s.score === me.score)) status = 'Tied for 1st';
    else if (behind) status = `Leading by ${formatScore(me.score - behind.score, challenge.metric)}`;
    else status = 'In the lead';
  }

  return (
    <Card dark style={styles.scoreboard}>
      <Text style={[Type.bodyStrong, { color: Colors.onInkCard }]}>{status}</Text>
      <View style={styles.boardRows}>
        {standings.map((s) => (
          <Animated.View key={s.user.id} layout={LinearTransition.duration(300)} style={styles.boardRow}>
            <RankBadge rank={s.rank} dark />
            <View style={{ flex: 1, gap: 4 }}>
              <View style={styles.boardLabels}>
                <Text
                  numberOfLines={1}
                  style={[Type.bodyStrong, { color: s.isMe ? Colors.onInkCard : Colors.onInkCardMuted, flexShrink: 1 }]}>
                  {s.isMe ? 'You' : s.user.name}
                </Text>
                <Text style={[Type.bodyStrong, Type.number, { color: Colors.onInkCard }]}>
                  {formatScore(s.score, challenge.metric)}
                </Text>
              </View>
              <View style={styles.barTrack}>
                {s.rank !== null ? (
                  <View style={[styles.barFill, { width: `${(s.score / max) * 100}%`, backgroundColor: rankColor(s.rank) }]} />
                ) : null}
              </View>
              <Text style={[Type.caption, { color: Colors.onInkCardMuted }]} numberOfLines={1}>
                {s.lastSet
                  ? `Last set ${setText(s.lastSet)} · ${timeAgo(s.lastSet.loggedAt, now)}`
                  : 'No sets yet'}
              </Text>
            </View>
          </Animated.View>
        ))}
      </View>
    </Card>
  );
}

function SetLogger({ challenge }: { challenge: Challenge }) {
  const logger = useChallengeStore((s) => loggerFor(s, challenge.id));
  const { weight, reps } = logger.draft;
  const mySets = challenge.sets.filter((s) => s.userId === mockMe.id);
  const canLog = reps > 0;

  // What this set adds to your score, so every log feels like it moves the board.
  const myBest = scoreSets(mySets, 'heaviest');
  const gain =
    challenge.metric === 'heaviest'
      ? Math.max(0, weight - myBest)
      : setScore({ weight, reps }, challenge.metric);

  return (
    <View>
      <SectionHeader title="Your next set" />
      <Card style={styles.logger}>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          Any movement counts. Leave weight empty for bodyweight.
        </Text>
        <View style={styles.steppers}>
          <Stepper
            label={unit}
            value={weight}
            step={WEIGHT_STEP}
            decimals
            emptyText="BW"
            onChange={(v) => challengeActions.setDraft(challenge.id, { weight: v })}
            accessibilityName="Weight"
          />
          <Stepper
            label="reps"
            value={reps}
            step={1}
            emptyText="0"
            onChange={(v) => challengeActions.setDraft(challenge.id, { reps: v })}
            accessibilityName="Reps"
          />
        </View>

        <Pressable
          onPress={() => challengeActions.logSet(challenge.id)}
          disabled={!canLog}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canLog }}
          accessibilityLabel={`Log set, ${setText({ weight, reps })}, plus ${formatScore(gain, challenge.metric)}`}
          style={({ pressed }) => [styles.logButton, !canLog && styles.disabled, pressed && styles.pressed]}>
          <Icon name="check" size={18} color={Colors.onPrimary} />
          <Text style={[Type.heading, { color: Colors.onPrimary }]}>Log set</Text>
          <View style={styles.gainPill}>
            <Text style={[Type.caption, Type.number, { color: Colors.onPrimary, fontWeight: '900' }]}>
              +{formatScore(gain, challenge.metric)}
            </Text>
          </View>
        </Pressable>
      </Card>
    </View>
  );
}

function MySets({ challenge }: { challenge: Challenge }) {
  const mine = challenge.sets.filter((s) => s.userId === mockMe.id);
  if (mine.length === 0) return null;
  return (
    <View>
      <SectionHeader title={`Your sets · ${mine.length}`} />
      <Card style={styles.listCard}>
        {mine
          .map((s, i) => ({ s, i }))
          .reverse()
          .map(({ s, i }, idx) => (
            <View key={s.id} style={[styles.setRow, idx < mine.length - 1 && styles.divider]}>
              <Text style={[Type.caption, Type.number, styles.setIndex]}>{i + 1}</Text>
              <View style={{ flex: 1 }}>
                <Text style={[Type.bodyStrong, Type.number, { color: Colors.text }]}>{setText(s)}</Text>
                <Text style={[Type.caption, { color: Colors.textMuted }]}>{timeAgo(s.loggedAt)}</Text>
              </View>
              {challenge.metric !== 'heaviest' ? (
                <Text style={[Type.caption, Type.number, { color: Colors.textMuted }]}>
                  +{formatScore(setScore(s, challenge.metric), challenge.metric)}
                </Text>
              ) : null}
              <Pressable
                onPress={() => challengeActions.removeSet(challenge.id, s.id)}
                accessibilityRole="button"
                accessibilityLabel={`Remove set ${i + 1}`}
                hitSlop={10}
                style={({ pressed }) => pressed && styles.pressed}>
                <Icon name="close" size={14} color={Colors.textFaint} />
              </Pressable>
            </View>
          ))}
      </Card>
    </View>
  );
}

function Feed({ challenge }: { challenge: Challenge }) {
  const now = useNow(5000);
  const others = challenge.sets.filter((s) => s.userId !== mockMe.id).slice(-12).reverse();
  return (
    <View>
      <SectionHeader title="Live feed" />
      <Card style={styles.listCard}>
        {others.length === 0 ? (
          <View style={styles.feedEmpty}>
            <EmptyState title="Waiting on your friends" body="Their sets show up here the moment they log them." />
          </View>
        ) : (
          others.map((s, idx) => {
            const user = challenge.participants.find((p) => p.id === s.userId);
            return (
              <Animated.View
                key={s.id}
                entering={FadeIn.duration(400)}
                layout={LinearTransition.duration(300)}
                style={[styles.feedRow, idx < others.length - 1 && styles.divider]}>
                <Avatar name={user?.name ?? '?'} size={32} />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.caption, { color: Colors.text }]} numberOfLines={1}>
                    <Text style={{ fontWeight: '800' }}>{user?.name.split(' ')[0]}</Text> · {setText(s)}
                  </Text>
                  <Text style={[Type.caption, { color: Colors.textMuted }]}>{timeAgo(s.loggedAt, now)}</Text>
                </View>
                {challenge.metric !== 'heaviest' ? (
                  <Text style={[Type.caption, Type.number, { color: Colors.text, fontWeight: '800' }]}>
                    +{formatScore(setScore(s, challenge.metric), challenge.metric)}
                  </Text>
                ) : null}
              </Animated.View>
            );
          })
        )}
      </Card>
    </View>
  );
}

// --- Results -----------------------------------------------------------------

function ResultsView({ challenge }: { challenge: Challenge }) {
  const standings = standingsFor(challenge);
  const winners = standings.filter((s) => s.rank === 1);
  const iWon = winners.some((w) => w.isMe);
  const mine = challenge.sets.filter((s) => s.userId === mockMe.id);
  const durationMin = Math.max(
    1,
    Math.round((Date.parse(challenge.endedAt ?? challenge.createdAt) - Date.parse(challenge.startedAt ?? challenge.createdAt)) / 60000),
  );

  let headline = 'No one scored';
  if (winners.length > 1) headline = iWon ? 'You tied for 1st!' : `${winners.map(firstName).join(' & ')} tied`;
  else if (winners.length === 1) headline = iWon ? 'You won!' : `${firstName(winners[0])} won`;

  function rematch() {
    const next = challengeActions.rematch(challenge.id);
    if (next) router.replace({ pathname: '/challenge/[id]', params: { id: next.id } });
  }

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.resultsTop}>
          <IconButton icon="back" label="Back" onPress={goBack} />
        </View>

        <Text style={[Type.label, { color: Colors.textMuted, marginTop: Space.lg }]}>Final results</Text>
        <Text style={[Type.title, { color: Colors.text }]} numberOfLines={2}>
          {challenge.name}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {METRICS[challenge.metric].label} · {durationMin} min · {timeAgo(challenge.endedAt ?? challenge.createdAt)}
        </Text>

        <Card dark style={styles.scoreboard}>
          <Text style={[Type.title, { color: winners.length ? rankColor(1) : Colors.onInkCard }]}>{headline}</Text>
          <View style={styles.boardRows}>
            {standings.map((s) => (
              <View key={s.user.id} style={styles.finalRow}>
                <RankBadge rank={s.rank} size={32} dark />
                <View style={{ flex: 1 }}>
                  <Text style={[Type.bodyStrong, { color: s.isMe ? Colors.onInkCard : Colors.onInkCardMuted }]} numberOfLines={1}>
                    {s.isMe ? 'You' : s.user.name}
                  </Text>
                  <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>
                    {s.setCount} {s.setCount === 1 ? 'set' : 'sets'}
                  </Text>
                </View>
                <Text style={[Type.heading, Type.number, { color: Colors.onInkCard }]}>{formatScore(s.score, challenge.metric)}</Text>
              </View>
            ))}
          </View>
        </Card>

        <SectionHeader title="Your session" />
        <Card style={styles.sessionStats}>
          <SessionStat value={`${mine.length}`} label={mine.length === 1 ? 'set' : 'sets'} />
          <View style={styles.statDivider} />
          <SessionStat value={formatNumber(scoreSets(mine, 'reps'))} label="reps" />
          <View style={styles.statDivider} />
          <SessionStat value={formatNumber(scoreSets(mine, 'volume'))} label={`${unit} moved`} />
          <View style={styles.statDivider} />
          <SessionStat value={formatWeight(scoreSets(mine, 'heaviest'))} label={`${unit} top`} />
        </Card>

        <Pressable
          onPress={rematch}
          accessibilityRole="button"
          style={({ pressed }) => [styles.rematchButton, pressed && styles.pressed]}>
          <Icon name="bolt" size={18} color={Colors.onPrimary} />
          <Text style={[Type.heading, { color: Colors.onPrimary }]}>Rematch</Text>
        </Pressable>
        <Pressable onPress={() => router.navigate('/')} accessibilityRole="button" style={styles.doneButton} hitSlop={8}>
          <Text style={[Type.bodyStrong, { color: Colors.textMuted }]}>Done</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SessionStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.sessionStat}>
      <Text style={[Type.heading, Type.number, { color: Colors.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: Colors.textMuted }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  padded: {
    padding: Space.lg,
  },
  missing: {
    flex: 1,
    justifyContent: 'center',
    padding: Space.xl,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
    paddingBottom: Space.md,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  liveClock: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.text,
  },
  endButton: {
    height: 40,
    paddingHorizontal: Space.lg,
    borderRadius: Radius.pill,
    borderWidth: 1.5,
    borderColor: Colors.text,
    justifyContent: 'center',
  },
  content: {
    paddingHorizontal: Space.lg,
    paddingBottom: Space.xxl * 2,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  scoreboard: {
    marginTop: Space.lg,
  },
  boardRows: {
    gap: Space.md,
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.onInkCardLine,
  },
  boardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Space.md,
  },
  boardLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  barTrack: {
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.onInkCardLine,
    overflow: 'hidden',
  },
  barFill: {
    height: '100%',
    borderRadius: 3,
  },
  logger: {
    borderWidth: 1.5,
    borderColor: Colors.text,
  },
  steppers: {
    flexDirection: 'row',
    gap: Space.md,
    marginTop: Space.lg,
  },
  logButton: {
    marginTop: Space.lg,
    height: 60,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  gainPill: {
    marginLeft: Space.xs,
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.onInkCardLine,
  },
  listCard: {
    paddingVertical: Space.xs,
  },
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  setIndex: {
    width: 18,
    color: Colors.textFaint,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  feedEmpty: {
    paddingVertical: Space.md,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  resultsTop: {
    flexDirection: 'row',
    paddingTop: Space.sm,
  },
  finalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  sessionStats: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.md,
    paddingHorizontal: Space.sm,
  },
  sessionStat: {
    flex: 1,
    alignItems: 'center',
  },
  statDivider: {
    width: StyleSheet.hairlineWidth,
    alignSelf: 'stretch',
    backgroundColor: Colors.line,
  },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  invited: {
    opacity: 0.5,
  },
  hostPill: {
    paddingHorizontal: Space.sm,
    paddingVertical: 3,
    borderRadius: Radius.pill,
    backgroundColor: Colors.inkCard,
  },
  startButton: {
    marginTop: Space.xl,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  waiting: {
    marginTop: Space.xl,
    gap: 4,
  },
  rematchButton: {
    marginTop: Space.xl,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  doneButton: {
    alignSelf: 'center',
    marginTop: Space.lg,
    padding: Space.sm,
  },
  disabled: {
    opacity: 0.4,
  },
  pressed: {
    opacity: 0.7,
  },
});
