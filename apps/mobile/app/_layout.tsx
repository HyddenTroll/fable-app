import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="age" />
        <Stack.Screen name="home" />
        <Stack.Screen name="new-game" />
        <Stack.Screen name="game/[gameId]" />
        <Stack.Screen name="game/end" />
      </Stack>
    </>
  );
}