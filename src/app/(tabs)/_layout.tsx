import { Tabs } from 'expo-router';

import { Icon } from '@/components/flexin/ui';
import { Colors } from '@/constants/flexin-theme';

export default function TabLayout() {
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
        options={{ title: 'Home', tabBarIcon: ({ color }) => <Icon name="home" size={22} color={color} /> }}
      />
      <Tabs.Screen
        name="friends"
        options={{ title: 'Friends', tabBarIcon: ({ color }) => <Icon name="friends" size={22} color={color} /> }}
      />
    </Tabs>
  );
}
