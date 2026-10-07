import { useLocalSearchParams } from 'expo-router';

import { PickExerciseScreen } from '@/components/screens/pick-exercise-screen';

export default function PickExerciseRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <PickExerciseScreen challengeId={id} />;
}
