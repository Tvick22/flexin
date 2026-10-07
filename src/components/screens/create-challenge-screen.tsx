import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Icon, IconButton, SectionHeader } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import type { ChallengeMetric } from '@/data/mock-data';
import { METRICS, challengeActions } from '@/stores/challenge-store';
import { useFriendsStore } from '@/stores/friends-store';

const METRIC_ORDER: ChallengeMetric[] = ['volume', 'reps', 'heaviest'];

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function defaultName(names: string[]): string {
  if (names.length === 0) return 'Gym challenge';
  if (names.length === 1) return `You vs ${names[0]}`;
  return `You vs ${names[0]} +${names.length - 1}`;
}

export function CreateChallengeScreen() {
  const friends = useFriendsStore((s) => s.friends);
  // Opened from a friend's "Challenge" button → that friend starts invited.
  const { friend } = useLocalSearchParams<{ friend?: string }>();
  const [invited, setInvited] = useState<string[]>(() => (friend ? [friend] : []));
  const [metric, setMetric] = useState<ChallengeMetric>('volume');
  const [name, setName] = useState('');

  const invite = friends.filter((f) => invited.includes(f.user.id)).map((f) => f.user);
  const placeholder = defaultName(invite.map((u) => u.name.split(' ')[0]));

  function toggleFriend(id: string) {
    setInvited((s) => (s.includes(id) ? s.filter((x) => x !== id) : [...s, id]));
  }

  function create() {
    const challenge = challengeActions.create({ name: name.trim() || placeholder, metric, invite });
    router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id } });
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[Type.title, { color: Colors.text }]}>New challenge</Text>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          <SectionHeader title="How you score" />
          <View style={styles.options}>
            {METRIC_ORDER.map((m) => {
              const on = metric === m;
              return (
                <Pressable
                  key={m}
                  onPress={() => setMetric(m)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={({ pressed }) => [styles.option, on && styles.selected, pressed && styles.pressed]}>
                  <View style={[styles.radio, on && styles.radioOn]}>{on ? <View style={styles.radioDot} /> : null}</View>
                  <View style={{ flex: 1 }}>
                    <Text style={[Type.bodyStrong, { color: Colors.text }]}>{METRICS[m].label}</Text>
                    <Text style={[Type.caption, { color: Colors.textMuted }]}>{METRICS[m].description}</Text>
                  </View>
                </Pressable>
              );
            })}
          </View>

          <SectionHeader title={`Invite friends${invited.length ? ` · ${invited.length}` : ''}`} />
          {friends.length === 0 ? (
            <Text style={[Type.caption, { color: Colors.textMuted }]}>
              No friends added yet. You&apos;ll get a join code to share once the challenge is created.
            </Text>
          ) : (
            <>
              <View style={styles.friendList}>
                {friends.map((f) => {
                  const on = invited.includes(f.user.id);
                  return (
                    <Pressable
                      key={f.user.id}
                      onPress={() => toggleFriend(f.user.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={`Invite ${f.user.name}`}
                      style={({ pressed }) => [styles.friend, on && styles.selected, pressed && styles.pressed]}>
                      <Avatar name={f.user.name} size={36} />
                      <View style={{ flex: 1 }}>
                        <Text style={[Type.bodyStrong, { color: Colors.text }]} numberOfLines={1}>
                          {f.user.name}
                        </Text>
                        <Text style={[Type.caption, { color: Colors.textMuted }]} numberOfLines={1}>
                          @{f.user.handle}
                        </Text>
                      </View>
                      <View style={[styles.check, on && styles.checkOn]}>
                        {on ? <Icon name="check" size={14} color={Colors.onInkCard} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
              <Text style={[Type.caption, { color: Colors.textMuted, marginTop: Space.sm }]}>
                Optional. Anyone with the join code can get in too.
              </Text>
            </>
          )}

          <SectionHeader title="Name" />
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder={placeholder}
            placeholderTextColor={Colors.textFaint}
            maxLength={40}
            accessibilityLabel="Challenge name"
            style={styles.nameInput}
          />
        </ScrollView>

        <View style={styles.footer}>
          <Text style={[Type.caption, { color: Colors.textMuted, textAlign: 'center' }]} numberOfLines={1}>
            You&apos;re the host. You start it when everyone&apos;s in.
          </Text>
          <Pressable
            onPress={create}
            accessibilityRole="button"
            style={({ pressed }) => [styles.createButton, pressed && styles.pressed]}>
            <Icon name="bolt" size={18} color={Colors.onPrimary} />
            <Text style={[Type.heading, { color: Colors.onPrimary }]}>Create challenge</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  inner: { flex: 1, width: '100%', maxWidth: 640, alignSelf: 'center' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Space.lg,
    paddingTop: Space.sm,
  },
  content: { paddingHorizontal: Space.lg, paddingBottom: 160 },
  options: { gap: Space.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  selected: { borderColor: Colors.text },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioOn: { borderColor: Colors.text },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: Colors.text },
  friendList: { gap: Space.sm },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  check: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkOn: { backgroundColor: Colors.inkCard, borderColor: Colors.inkCard },
  nameInput: {
    height: 50,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    paddingHorizontal: Space.lg,
    color: Colors.text,
    fontSize: 16,
    fontWeight: '700',
    outlineWidth: 0,
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    padding: Space.lg,
    paddingBottom: Space.xl,
    gap: Space.sm,
    backgroundColor: Colors.background,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: Colors.line,
  },
  createButton: {
    height: 56,
    borderRadius: Radius.md,
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
  pressed: { opacity: 0.7 },
});
