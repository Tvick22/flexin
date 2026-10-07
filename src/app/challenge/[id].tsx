import { useLocalSearchParams } from 'expo-router';

import { ChallengeScreen } from '@/components/screens/challenge-screen';

export default function ChallengeRoute() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ChallengeScreen id={id} />;
}
