import { useLocalSearchParams } from 'expo-router';

import { PlaceholderScreen } from '@/components/screens/placeholder-screen';

export default function WorkoutDetailRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PlaceholderScreen title="Workout detail" note={`Workout ${id}`} />;
}
