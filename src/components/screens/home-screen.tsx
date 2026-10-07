import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Card, EmptyState, Icon, IconButton, SectionHeader } from '@/components/flexin/ui';
import { Colors, Plate, Radius, Space, Type, onRankColor, rankColor } from '@/constants/flexin-theme';
import {
  mockFeed,
  mockLastWorkout,
  mockMe,
  mockWeeklyChallenge,
  type FeedItem,
  type LastWorkout,
  type WeeklyChallenge,
} from '@/data/mock-data';
import { formatNumber, ordinal, timeAgo, timeUntil } from '@/utils/format';

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View>
            <Text style={[Type.title, { color: Colors.text }]}>Flexin&apos;</Text>
            <Text style={[Type.caption, { color: Colors.textMuted }]}>
              Hey {mockMe.name.split(' ')[0]}, let&apos;s move some weight.
            </Text>
          </View>
          <View style={styles.headerActions}>
            <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
            <Pressable
              onPress={() => router.push('/profile')}
              accessibilityRole="button"
              accessibilityLabel="Profile">
              <Avatar name={mockMe.name} size={40} />
            </Pressable>
          </View>
        </View>

        {mockWeeklyChallenge ? (
          <ChallengeCard challenge={mockWeeklyChallenge} meId={mockMe.id} />
        ) : (
          <CreateChallengeCard />
        )}

        <Pressable
          onPress={() => router.push('/workout')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.cta, pressed && { opacity: 0.85 }]}>
          <Icon name="play" size={16} color={Colors.onPrimary} />
          <Text style={[Type.heading, { color: Colors.onPrimary }]}>Start workout</Text>
        </Pressable>

        <SectionHeader title="Last workout" />
        {mockLastWorkout ? (
          <LastWorkoutCard workout={mockLastWorkout} unit={mockMe.unit} />
        ) : (
          <Card>
            <EmptyState title="No workouts yet" body="Tap Start workout to log your first session." />
          </Card>
        )}

        <SectionHeader title="Friend activity" />
        {mockFeed.length > 0 ? (
          <Card style={styles.feedCard}>
            {mockFeed.map((item, i) => (
              <FeedRow key={item.id} item={item} last={i === mockFeed.length - 1} />
            ))}
          </Card>
        ) : (
          <Card>
            <EmptyState
              title="No activity yet"
              body="Add friends and their workouts, PRs and flexes will show up here."
            />
          </Card>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function CreateChallengeCard() {
  return (
    <Pressable
      onPress={() => router.push('/challenge/new')}
      accessibilityRole="button"
      accessibilityLabel="Create a weekly challenge"
      style={({ pressed }) => [styles.createChallenge, pressed && { opacity: 0.6 }]}>
      <View style={styles.createChallengeIcon}>
        <Icon name="plus" size={20} color={Colors.text} />
      </View>
      <Text style={[Type.heading, { color: Colors.text }]}>Create a challenge</Text>
      <Text style={[Type.caption, { color: Colors.textMuted, textAlign: 'center' }]}>
        Pick a few friends and compete to move the most volume this week.
      </Text>
    </Pressable>
  );
}

function ChallengeCard({ challenge, meId }: { challenge: WeeklyChallenge; meId: string }) {
  const meIndex = challenge.standings.findIndex((s) => s.user.id === meId);
  const me = challenge.standings[meIndex];
  const ahead = meIndex > 0 ? challenge.standings[meIndex - 1] : null;
  const behind = challenge.standings[meIndex + 1];
  const maxVolume = Math.max(...challenge.standings.map((s) => s.volume), 1);

  // No rank or plate color until someone else has joined.
  if (challenge.standings.length < 2) {
    return (
      <Card dark>
        <View style={styles.challengeTop}>
          <Text style={[Type.label, { color: Colors.onInkCardMuted }]}>Weekly challenge · volume</Text>
          <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>{timeUntil(challenge.endsAt)}</Text>
        </View>
        <View style={styles.challengeEmpty}>
          <EmptyState
            dark
            title="Waiting for friends to join"
            body={`Invite friends to compete on weekly volume. You're at ${formatNumber(me?.volume ?? 0)} ${challenge.unit} this week.`}
          />
        </View>
      </Card>
    );
  }

  let gapText = '';
  if (ahead) {
    gapText = `${formatNumber(ahead.volume - me.volume)} ${challenge.unit} behind ${ahead.user.name.split(' ')[0]}`;
  } else if (behind) {
    gapText = `Leading by ${formatNumber(me.volume - behind.volume)} ${challenge.unit}`;
  }

  return (
    <Card dark>
      <View style={styles.challengeTop}>
        <Text style={[Type.label, { color: Colors.onInkCardMuted }]}>Weekly challenge · volume</Text>
        <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>{timeUntil(challenge.endsAt)}</Text>
      </View>

      {me ? (
        <View style={styles.challengeHero}>
          <Text style={[Type.display, { color: rankColor(me.rank) }]}>{ordinal(me.rank)}</Text>
          <View style={{ flex: 1 }}>
            <Text style={[Type.bodyStrong, { color: Colors.onInkCard }]}>
              {formatNumber(me.volume)} {challenge.unit}
            </Text>
            <Text style={[Type.caption, { color: Colors.onInkCardMuted }]}>{gapText}</Text>
          </View>
        </View>
      ) : null}

      <View style={styles.challengeRows}>
        {challenge.standings.map((s) => {
          const isMe = s.user.id === meId;
          const color = rankColor(s.rank);
          return (
            <View key={s.user.id} style={styles.challengeRow}>
              <View style={[styles.rankBadge, { backgroundColor: color }]}>
                <Text style={[styles.rankBadgeText, { color: onRankColor(s.rank) }]}>{s.rank}</Text>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={styles.challengeRowLabels}>
                  <Text
                    numberOfLines={1}
                    style={[Type.caption, { color: isMe ? Colors.onInkCard : Colors.onInkCardMuted }, isMe && { fontWeight: '800' }]}>
                    {isMe ? 'You' : s.user.name}
                  </Text>
                  <Text style={[Type.caption, Type.number, { color: Colors.onInkCard }]}>{formatNumber(s.volume)}</Text>
                </View>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(s.volume / maxVolume) * 100}%`, backgroundColor: color }]} />
                </View>
              </View>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

function LastWorkoutCard({ workout, unit }: { workout: LastWorkout; unit: string }) {
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: workout.id } })}
      style={({ pressed }) => pressed && { opacity: 0.8 }}>
      <Card>
        <View style={styles.lastTop}>
          <View style={{ flex: 1 }}>
            <Text style={[Type.heading, { color: Colors.text }]}>{workout.title}</Text>
            <Text style={[Type.caption, { color: Colors.textMuted }]}>{timeAgo(workout.completedAt)}</Text>
          </View>
          {workout.prCount > 0 ? (
            <View style={styles.prPill}>
              <Text style={styles.prPillText}>
                {workout.prCount} PR{workout.prCount > 1 ? 's' : ''}
              </Text>
            </View>
          ) : null}
          <Icon name="chevron" size={14} color={Colors.textFaint} />
        </View>

        <View style={styles.lastStats}>
          <Stat icon="clock" value={`${workout.durationMin}`} unit="min" />
          <Stat icon="weight" value={formatNumber(workout.totalVolume)} unit={unit} />
          <Stat value={`${workout.setCount}`} unit="sets" />
        </View>

        <View style={styles.exerciseList}>
          {workout.exercises.map((e) => (
            <View key={e.name} style={styles.exerciseRow}>
              <Text style={[Type.caption, { color: Colors.text, flex: 1 }]} numberOfLines={1}>
                {e.isPr ? <Text style={{ color: Colors.pr }}>● </Text> : null}
                {e.name}
              </Text>
              <Text style={[Type.caption, Type.number, { color: Colors.textMuted }]}>
                {e.sets} × {e.topSet.weight} {unit} × {e.topSet.reps}
              </Text>
            </View>
          ))}
        </View>
      </Card>
    </Pressable>
  );
}

function Stat({ icon, value, unit }: { icon?: 'clock' | 'weight'; value: string; unit: string }) {
  return (
    <View style={styles.stat}>
      {icon ? <Icon name={icon} size={13} color={Colors.textMuted} /> : null}
      <Text style={[Type.bodyStrong, Type.number, { color: Colors.text }]}>{value}</Text>
      <Text style={[Type.caption, { color: Colors.textMuted }]}>{unit}</Text>
    </View>
  );
}

function FeedRow({ item, last }: { item: FeedItem; last: boolean }) {
  // Optimistic local state; will be reconciled with WebSocket `flex.updated` events.
  const [flexed, setFlexed] = useState(item.flexedByMe);
  const count = item.flexCount + (flexed === item.flexedByMe ? 0 : flexed ? 1 : -1);

  return (
    <View style={[styles.feedRow, !last && styles.feedRowDivider]}>
      <Avatar name={item.user.name} size={36} />
      <View style={{ flex: 1 }}>
        <Text style={[Type.caption, { color: Colors.text }]}>
          <Text style={{ fontWeight: '800' }}>{item.user.name.split(' ')[0]}</Text> {item.headline}
        </Text>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {item.detail ? `${item.detail} · ` : ''}
          {timeAgo(item.createdAt)}
        </Text>
      </View>
      <Pressable
        onPress={() => setFlexed((f) => !f)}
        accessibilityRole="button"
        accessibilityState={{ selected: flexed }}
        accessibilityLabel={`Flex ${item.user.name}`}
        hitSlop={6}
        style={[styles.flexButton, flexed && styles.flexButtonActive]}>
        <Text style={styles.flexEmoji}>💪</Text>
        <Text style={[Type.caption, Type.number, { color: flexed ? Colors.onPrimary : Colors.text }]}>{count}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    padding: Space.lg,
    paddingBottom: Space.xxl * 2,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Space.lg,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  challengeTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  challengeHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    marginTop: Space.xs,
    marginBottom: Space.md,
  },
  challengeEmpty: {
    marginTop: Space.md,
  },
  createChallenge: {
    alignItems: 'center',
    gap: Space.xs,
    paddingVertical: Space.xl,
    paddingHorizontal: Space.xl,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: Colors.textFaint,
    backgroundColor: Colors.wash,
  },
  createChallengeIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Space.xs,
  },
  challengeRows: {
    gap: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.onInkCardLine,
    paddingTop: Space.md,
  },
  challengeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
  },
  challengeRowLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: Space.sm,
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rankBadgeText: {
    fontSize: 12,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
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
  cta: {
    marginTop: Space.lg,
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  lastTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  prPill: {
    backgroundColor: Plate.red,
    borderRadius: Radius.pill,
    paddingHorizontal: Space.sm,
    paddingVertical: 2,
  },
  prPillText: {
    color: Colors.onPrimary,
    fontSize: 11,
    fontWeight: '900',
  },
  lastStats: {
    flexDirection: 'row',
    gap: Space.lg,
    marginTop: Space.md,
    paddingBottom: Space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  exerciseList: {
    marginTop: Space.md,
    gap: Space.sm,
  },
  exerciseRow: {
    flexDirection: 'row',
    gap: Space.sm,
  },
  feedCard: {
    paddingVertical: Space.xs,
  },
  feedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  feedRowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  flexButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Space.md,
    height: 32,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: Colors.line,
  },
  flexButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  flexEmoji: {
    fontSize: 14,
  },
});
