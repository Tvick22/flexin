import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { EmptyState, Icon, IconButton } from '@/components/flexin/ui';
import { Colors, Radius, Space, Type } from '@/constants/flexin-theme';
import { EXERCISES, MUSCLES, type Exercise, type Muscle } from '@/data/exercises';
import { mockMe } from '@/data/mock-data';
import { challengeActions, loggerFor, useChallengeStore } from '@/stores/challenge-store';

function close() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/** Single-tap exercise picker for a live challenge's set logger. */
export function PickExerciseScreen({ challengeId }: { challengeId: string }) {
  const challenge = useChallengeStore((s) => s.challenges.find((c) => c.id === challengeId));
  const current = useChallengeStore((s) => loggerFor(s, challengeId).exerciseId);
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);

  // Exercises you've already logged in this challenge float to the top.
  const used = [...new Set((challenge?.sets ?? []).filter((s) => s.userId === mockMe.id).map((s) => s.exerciseId))].reverse();
  const q = query.trim().toLowerCase();
  const results = EXERCISES.filter(
    (e) => (!muscle || e.muscle === muscle) && (!q || e.name.toLowerCase().includes(q)),
  ).sort((a, b) => {
    const ai = used.indexOf(a.id);
    const bi = used.indexOf(b.id);
    return (ai === -1 ? Infinity : ai) - (bi === -1 ? Infinity : bi);
  });

  function choose(e: Exercise) {
    challengeActions.selectExercise(challengeId, e);
    close();
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.inner}>
        <View style={styles.header}>
          <Text style={[Type.title, { color: Colors.text }]}>Exercise</Text>
          <IconButton icon="close" label="Close" onPress={close} />
        </View>

        <View style={styles.search}>
          <Icon name="search" size={16} color={Colors.textMuted} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises"
            placeholderTextColor={Colors.textFaint}
            autoCorrect={false}
            returnKeyType="search"
            accessibilityLabel="Search exercises"
            style={styles.searchInput}
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipsScroll}>
          <Chip label="All" selected={muscle === null} onPress={() => setMuscle(null)} />
          {MUSCLES.map((m) => (
            <Chip key={m} label={m} selected={muscle === m} onPress={() => setMuscle(muscle === m ? null : m)} />
          ))}
        </ScrollView>

        <FlatList
          data={results}
          keyExtractor={(e) => e.id}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.list}
          ListEmptyComponent={<EmptyState title="No matches" body="Try a different name or muscle group." />}
          renderItem={({ item }) => {
            const isCurrent = item.id === current;
            const wasUsed = used.includes(item.id);
            return (
              <Pressable
                onPress={() => choose(item)}
                accessibilityRole="button"
                accessibilityLabel={`${item.name}, ${item.muscle}, ${item.equipment}`}
                style={({ pressed }) => [styles.row, isCurrent && styles.rowCurrent, pressed && styles.pressed]}>
                <View style={{ flex: 1 }}>
                  <Text style={[Type.bodyStrong, { color: Colors.text }]}>{item.name}</Text>
                  <Text style={[Type.caption, { color: Colors.textMuted }]}>
                    {item.muscle} · {item.equipment}
                    {wasUsed ? ' · used' : ''}
                  </Text>
                </View>
                {isCurrent ? <Icon name="check" size={16} /> : null}
              </Pressable>
            );
          }}
        />
      </View>
    </SafeAreaView>
  );
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.chipOn]}>
      <Text style={[Type.caption, { fontWeight: '800', color: selected ? Colors.onInkCard : Colors.text }]}>{label}</Text>
    </Pressable>
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
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.sm,
    marginHorizontal: Space.lg,
    marginTop: Space.lg,
    paddingHorizontal: Space.md,
    height: 46,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
  },
  searchInput: {
    flex: 1,
    height: '100%',
    color: Colors.text,
    fontSize: 16,
    fontWeight: '600',
    outlineWidth: 0,
    outlineStyle: 'solid',
  },
  chipsScroll: { flexGrow: 0 },
  chips: { gap: Space.sm, paddingHorizontal: Space.lg, paddingVertical: Space.md },
  chip: {
    height: 34,
    paddingHorizontal: Space.md,
    borderRadius: Radius.pill,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: Colors.inkCard },
  list: { paddingHorizontal: Space.lg, paddingBottom: Space.xxl, gap: Space.sm },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Space.md,
    padding: Space.md,
    borderRadius: Radius.md,
    backgroundColor: Colors.surface,
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  rowCurrent: { borderColor: Colors.text },
  pressed: { opacity: 0.7 },
});
