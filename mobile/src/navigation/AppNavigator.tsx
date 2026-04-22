import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { WardrobeScreen } from '../screens/WardrobeScreen';
import { RecommendScreen } from '../screens/RecommendScreen';
import { OutfitRecordScreen } from '../screens/OutfitRecordScreen';
import { ProfileScreen } from '../screens/ProfileScreen';

const Tab = createBottomTabNavigator();

const ICONS: Record<string, string> = {
  Wardrobe: '👗',
  Recommend: '✨',
  Records: '📋',
  Profile: '👤',
};

type Props = { onLogout: () => void };

export function AppNavigator({ onLogout }: Props) {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        tabBarIcon: () => <Text style={{ fontSize: 20 }}>{ICONS[route.name]}</Text>,
        headerShown: false,
        tabBarActiveTintColor: '#222',
        tabBarInactiveTintColor: '#aaa',
        tabBarStyle: { borderTopColor: '#eee' },
        tabBarLabelStyle: { fontSize: 11, marginBottom: 2 },
      })}
    >
      <Tab.Screen name="Wardrobe"  component={WardrobeScreen}      options={{ tabBarLabel: '衣橱' }} />
      <Tab.Screen name="Recommend" component={RecommendScreen}     options={{ tabBarLabel: '推薦' }} />
      <Tab.Screen name="Records"   component={OutfitRecordScreen}  options={{ tabBarLabel: '紀錄' }} />
      <Tab.Screen name="Profile"   options={{ tabBarLabel: '設定' }}>
        {() => <ProfileScreen onLogout={onLogout} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}
