import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/flexin-theme';
import { startDevSimulation } from '@/dev/simulation';
import { authActions, useAuthStore } from '@/stores/auth-store';

SplashScreen.preventAutoHideAsync();
// Resume the previous session (if any) while the splash screen is up.
authActions.restore();
// DEV ONLY: fakes friends' sets and request accepts until the backend exists.
startDevSimulation();

export default function RootLayout() {
  const status = useAuthStore((s) => s.status);
  const onboarded = useAuthStore((s) => s.user?.onboarded ?? false);

  // Keep the native splash up until we know whether someone is signed in.
  if (status === 'restoring') return null;

  const signedIn = status === 'signedIn';

  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        {/* Signed in and set up: the app. */}
        <Stack.Protected guard={signedIn && onboarded}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="challenge/new" options={{ presentation: 'modal' }} />
          <Stack.Screen name="challenge/[id]" />
          <Stack.Screen name="challenge/pick-exercise" options={{ presentation: 'modal' }} />
          <Stack.Screen name="join/index" options={{ presentation: 'modal' }} />
          <Stack.Screen name="join/[code]" />
          <Stack.Screen name="settings" />
          <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
        </Stack.Protected>

        {/* Signed in for the first time: pick a name and handle. */}
        <Stack.Protected guard={signedIn && !onboarded}>
          <Stack.Screen name="onboarding" />
        </Stack.Protected>

        <Stack.Protected guard={!signedIn}>
          <Stack.Screen name="sign-in" />
        </Stack.Protected>
      </Stack>
      <AnimatedSplashOverlay />
    </>
  );
}
