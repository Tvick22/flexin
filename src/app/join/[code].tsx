import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Colors } from '@/constants/flexin-theme';
import { challengeActions } from '@/stores/challenge-store';
import { normalizeJoinCode } from '@/utils/join-code';

/** Target of shared invite links: flexin://join/K7Q2MX. Joins, then shows the lobby. */
export default function JoinLinkRoute() {
  const { code } = useLocalSearchParams<{ code: string }>();

  useEffect(() => {
    const normalized = normalizeJoinCode(code ?? '');
    const challenge = challengeActions.join(normalized);
    if (challenge) router.replace({ pathname: '/challenge/[id]', params: { id: challenge.id } });
    else router.replace({ pathname: '/join', params: { code: normalized, notFound: '1' } });
  }, [code]);

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: Colors.background }}>
      <ActivityIndicator color={Colors.text} />
    </View>
  );
}
