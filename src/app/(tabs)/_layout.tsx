import { Tabs } from 'expo-router';
import { useEffect } from 'react';

import { Icon } from '@/components/flexin/ui';
import { Colors } from '@/constants/flexin-theme';
import { friendsActions, useFriendsStore } from '@/stores/friends-store';

export default function TabLayout() {
  const requests = useFriendsStore((s) => s.requests);
  const incoming = requests.filter((r) => r.direction === 'incoming').length;

  // Load as soon as you're in the app, so the request badge is right from any tab.
  useEffect(() => {
    friendsActions.load();
  }, []);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.text,
        tabBarInactiveTintColor: Colors.textFaint,
        tabBarStyle: { backgroundColor: Colors.surface, borderTopColor: Colors.line },
        tabBarLabelStyle: { fontWeight: '800' },
        sceneStyle: { backgroundColor: Colors.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Challenges', tabBarIcon: ({ color }) => <Icon name="trophy" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <Icon name="friends" size={22} color={color} />,
          tabBarBadge: incoming > 0 ? incoming : undefined,
          tabBarBadgeStyle: { backgroundColor: Colors.inkCard, color: Colors.onInkCard, fontWeight: '800' },
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ({ color }) => <Icon name="profile" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
