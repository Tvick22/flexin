import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IconButton } from '@/components/flexin/ui';
import { Colors, Space, Type } from '@/constants/flexin-theme';

/** Stand-in for screens that aren't built yet. */
export function PlaceholderScreen({ title, note }: { title: string; note?: string }) {
  return (
    <SafeAreaView style={styles.safe}>
      <IconButton
        icon="back"
        label="Back"
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
      <View style={styles.body}>
        <Text style={[Type.title, { color: Colors.text }]}>{title}</Text>
        <Text style={[Type.body, { color: Colors.textMuted }]}>{note ?? 'Coming soon.'}</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Space.lg,
  },
  body: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Space.sm,
  },
});
