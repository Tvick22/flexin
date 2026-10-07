import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Card, EmptyState, Icon, IconButton, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { mockProfile, type ConsistencyDay, type Profile } from '@/data/mock-data';
import { formatNumber, shortDate, timeAgo } from '@/utils/format';

export function ProfileScreen() {
  const profile = mockProfile;
  const { user, stats, unit } = profile;

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.topBar}>
          <IconButton
            icon="back"
            label="Back"
            onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          />
          <IconButton icon="settings" label="Settings" onPress={() => router.push('/settings')} />
        </View>

        <View style={styles.identity}>
          <Avatar name={user.name} size={88} />
          <Text style={[Type.title, { color: Colors.text, marginTop: Space.md }]}>{user.name}</Text>
          <Text style={[Type.body, { color: Colors.textMuted }]}>@{user.handle}</Text>
        </View>

        <Card style={styles.statsRow}>
          <StatCell value={formatNumber(stats.workouts)} label="Workouts" />
          <View style={styles.statDivider} />
          <StatCell value={`${stats.streakDays}`} label="Day streak" />
          <View style={styles.statDivider} />
          <StatCell value={`${stats.friends}`} label="Friends" />
        </Card>

        <Pressable
          onPress={() => router.push('/edit-profile')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.editButton, pressed && { opacity: 0.7 }]}>
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>Edit profile</Text>
        </Pressable>

        <SectionHeader title="Big three" />
        <Card dark>
          <View style={styles.bigThreeTotal}>
            <Text style={[Type.display, { color: Colors.onInkCard }]}>{formatNumber(profile.bigThree.total)}</Text>
            <Text style={[Type.heading, { color: Colors.onInkCardMuted }]}>{unit} total</Text>
          </View>
          <View style={styles.bigThreeLifts}>
            {profile.bigThree.lifts.map((l) => (
              <View key={l.lift} style={styles.bigThreeLift}>
                <Text style={[Type.label, { color: Colors.onInkCardMuted }]}>{l.lift}</Text>
                <Text style={[Type.stat, { color: l.weight === null ? Colors.onInkCardMuted : Colors.onInkCard }]}>
                  {l.weight === null ? '—' : formatNumber(l.weight)}
                </Text>
              </View>
            ))}
          </View>
          {profile.bigThree.total === 0 ? (
            <Text style={[Type.caption, { color: Colors.onInkCardMuted, marginTop: Space.md }]}>
              Log a squat, bench and deadlift to build your total.
            </Text>
          ) : null}
        </Card>

        <SectionHeader title="Personal records" />
        <Card style={profile.prs.length > 0 && styles.listCard}>
          {profile.prs.length === 0 ? (
            <EmptyState title="No PRs yet" body="Your heaviest lifts will show up here as you log workouts." />
          ) : null}
          {profile.prs.map((pr, i) => (
            <View key={pr.id} style={[styles.listRow, i < profile.prs.length - 1 && styles.divider]}>
              <View style={styles.prMarker} />
              <View style={{ flex: 1 }}>
                <Text style={[Type.bodyStrong, { color: Colors.text }]}>{pr.exercise}</Text>
                <Text style={[Type.caption, { color: Colors.textMuted }]}>{timeAgo(pr.achievedAt)}</Text>
              </View>
              <Text style={[Type.bodyStrong, Type.number, { color: Colors.text }]}>
                {pr.weight} {unit}
                <Text style={{ color: Colors.textMuted }}> × {pr.reps}</Text>
              </Text>
            </View>
          ))}
        </Card>

        <SectionHeader title="Last 12 weeks" />
        <Card>
          <ConsistencyGrid days={profile.consistency} />
          <View style={styles.legend}>
            <LegendItem color={Colors.line} label="Rest" />
            <LegendItem color={Colors.text} label="Trained" />
            <LegendItem color={Colors.pr} label="PR" />
          </View>
        </Card>

        <SectionHeader title="Recent workouts" />
        <Card style={profile.recentWorkouts.length > 0 && styles.listCard}>
          {profile.recentWorkouts.length > 0 ? (
            <RecentWorkouts workouts={profile.recentWorkouts} unit={unit} />
          ) : (
            <EmptyState title="No workouts yet" body="Workouts you finish will be listed here." />
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

const DAY_COLOR: Record<ConsistencyDay['status'], string> = {
  rest: Colors.line,
  trained: Colors.text,
  pr: Colors.pr,
};

function ConsistencyGrid({ days }: { days: ConsistencyDay[] }) {
  // Columns are weeks (oldest → newest), rows are Mon → Sun.
  const weeks: ConsistencyDay[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));

  return (
    <View style={styles.grid}>
      {weeks.map((week, w) => (
        <View key={w} style={styles.gridColumn}>
          {week.map((d) => (
            <View key={d.date} style={[styles.gridCell, { backgroundColor: DAY_COLOR[d.status] }]} />
          ))}
        </View>
      ))}
    </View>
  );
}

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: color }]} />
      <Text style={[Type.caption, { color: Colors.textMuted }]}>{label}</Text>
    </View>
  );
}

function RecentWorkouts({ workouts, unit }: { workouts: Profile['recentWorkouts']; unit: string }) {
  return workouts.map((w, i) => (
    <Pressable
      key={w.id}
      onPress={() => router.push({ pathname: '/workout/[id]', params: { id: w.id } })}
      style={({ pressed }) => [styles.listRow, i < workouts.length - 1 && styles.divider, pressed && { opacity: 0.6 }]}>
      <View style={{ flex: 1 }}>
        <View style={styles.workoutTitleRow}>
          <Text style={[Type.bodyStrong, { color: Colors.text }]}>{w.title}</Text>
          {w.prCount > 0 ? <View style={styles.prMarker} /> : null}
        </View>
        <Text style={[Type.caption, { color: Colors.textMuted }]}>
          {shortDate(w.completedAt)} · {w.durationMin} min
        </Text>
      </View>
      <Text style={[Type.caption, Type.number, { color: Colors.text }]}>
        {formatNumber(w.totalVolume)} {unit}
      </Text>
      <Icon name="chevron" size={14} color={Colors.textFaint} />
    </Pressable>
  ));
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
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  identity: {
    alignItems: 'center',
    marginTop: Space.sm,
    marginBottom: Space.xl,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Space.md,
  },
  statCell: {
    flex: 1,
    alignItems: 'center',
  },
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
  bigThreeTotal: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Space.sm,
  },
  bigThreeLifts: {
    flexDirection: 'row',
    marginTop: Space.md,
    paddingTop: Space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.onInkCardLine,
  },
  bigThreeLift: {
    flex: 1,
    gap: 2,
  },
  listCard: {
    paddingVertical: Space.xs,
  },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    paddingVertical: Space.md,
  },
  divider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.line,
  },
  prMarker: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.pr,
  },
  workoutTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
  },
  grid: {
    flexDirection: 'row',
    gap: 4,
  },
  gridColumn: {
    flex: 1,
    gap: 4,
  },
  gridCell: {
    aspectRatio: 1,
    borderRadius: 4,
  },
  legend: {
    flexDirection: 'row',
    gap: Space.lg,
    marginTop: Space.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  legendSwatch: {
    width: 10,
    height: 10,
    borderRadius: 3,
  },
});
