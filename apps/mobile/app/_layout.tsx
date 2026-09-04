import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/theme';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="age" />
        <Stack.Screen name="auth" />
        <Stack.Screen name="auth/callback" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="new-game" />
        <Stack.Screen name="game/[gameId]" />
        <Stack.Screen name="game/end" />
        <Stack.Screen name="paywall" />
        <Stack.Screen name="shop" />
        <Stack.Screen name="settings" />
      </Stack>
    </>
  );
}