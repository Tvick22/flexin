import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { Colors } from '@/constants/flexin-theme';
import { startDevSimulation } from '@/dev/simulation';

SplashScreen.preventAutoHideAsync();
// DEV ONLY: fakes friends' sets and request accepts until the backend exists.
startDevSimulation();

export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: Colors.background } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="challenge/new" options={{ presentation: 'modal' }} />
        <Stack.Screen name="challenge/[id]" />
        <Stack.Screen name="challenge/pick-exercise" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="join/[code]" />
        <Stack.Screen name="settings" />
        <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
      </Stack>
      <AnimatedSplashOverlay />
    </>
  );
}
