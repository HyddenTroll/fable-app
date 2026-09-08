import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import {
  useFonts as useDidotFonts,
  GFSDidot_400Regular,
} from '@expo-google-fonts/gfs-didot';
import {
  useFonts as useManropeFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
} from '@expo-google-fonts/manrope';
import { colors } from '@/theme';

export default function RootLayout() {
  // Polices DA « Pierre & Lapis » : Didot (titres) + Manrope (texte).
  // Chargées en arrière-plan : si elles ne sont pas prêtes au premier
  // rendu, le système affiche des polices de secours (jamais de blocage).
  useDidotFonts({ GFSDidot_400Regular });
  useManropeFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
  });

  return (
    // GestureHandlerRootView : requis par react-native-gesture-handler
    // (pan de la pagination « livre » PageTurn).
    // eslint-disable-next-line react/no-unescaped-entities
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Fond clair pierre -> icônes de statut sombres */}
      <StatusBar style="dark" />
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
    </GestureHandlerRootView>
  );
}