import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Tabs } from 'expo-router';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors, fonts } from '@/theme';

type OngletProps = {
  actif: boolean;
};

const TAILLE_ICONE = 21;

function Icone({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  return (
    <Svg
      width={TAILLE_ICONE}
      height={TAILLE_ICONE}
      viewBox="0 0 24 24"
      fill="none"
      stroke={actif ? colors.text : colors.textSecondary}
      strokeWidth={actif ? 2 : 1.6}
      strokeLinecap="square"
      strokeLinejoin="miter"
    >
      {children}
    </Svg>
  );
}

/** Colonne d'un onglet : filet obsidienne (actif seulement) · icône 21px · espace 2px. */
function Onglet({ actif, children }: { actif: boolean; children: React.ReactNode }) {
  return (
    <View style={styles.colonne}>
      <View style={styles.filetZone}>{actif ? <View style={styles.filet} /> : null}</View>
      {children}
      <View style={styles.espaceBasse} />
    </View>
  );
}

function IconeAccueil({ actif }: OngletProps) {
  return (
    <Icone actif={actif}>
      <Path d="M2.5 10.5 L12 3.5 L21.5 10.5" />
      <Path d="M3.5 12.5 H20.5" />
      <Path d="M6 13.5 V20.5 M12 13.5 V20.5 M18 13.5 V20.5" />
    </Icone>
  );
}

function IconeBibliotheque({ actif }: OngletProps) {
  return (
    <Icone actif={actif}>
      <Rect x={3} y={5.5} width={3} height={12.5} />
      <Rect x={7.5} y={3.5} width={3.5} height={14.5} />
      <Rect x={12.5} y={6.5} width={3} height={11.5} />
      <Rect x={17} y={4.5} width={3.5} height={13.5} />
      <Path d="M2 18.5 H22" />
    </Icone>
  );
}

function IconeImages({ actif }: OngletProps) {
  return (
    <Icone actif={actif}>
      <Path d="M4 20.5 V10 A8 8 0 0 1 20 10 V20.5 Z" />
      <Path d="M4 16.5 L9.5 12 L14 16 L17 14 L20 16.5" />
    </Icone>
  );
}

function IconeProfil({ actif }: OngletProps) {
  return (
    <Icone actif={actif}>
      <Circle cx={12} cy={7.8} r={3.9} />
      <Path d="M4.5 20.5 V18.4 L8 14.8 H16 L19.5 18.4 V20.5" />
    </Icone>
  );
}

const styles = StyleSheet.create({
  colonne: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 25,
  },
  filetZone: {
    width: 18,
    height: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filet: {
    width: 18,
    height: 2,
    backgroundColor: colors.text,
  },
  espaceBasse: {
    height: 2,
  },
});

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopWidth: 1,
          borderTopColor: colors.surfaceAlt,
          height: 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: {
          fontFamily: fonts.iaMedium,
          fontSize: 10,
          letterSpacing: 0.2,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Accueil',
          tabBarIcon: ({ focused }) => (
            <Onglet actif={focused}>
              <IconeAccueil actif={focused} />
            </Onglet>
          ),
        }}
      />
      <Tabs.Screen
        name="library"
        options={{
          title: 'Bibliothèque',
          tabBarIcon: ({ focused }) => (
            <Onglet actif={focused}>
              <IconeBibliotheque actif={focused} />
            </Onglet>
          ),
        }}
      />
      <Tabs.Screen
        name="images"
        options={{
          title: 'Images',
          tabBarIcon: ({ focused }) => (
            <Onglet actif={focused}>
              <IconeImages actif={focused} />
            </Onglet>
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profil',
          tabBarIcon: ({ focused }) => (
            <Onglet actif={focused}>
              <IconeProfil actif={focused} />
            </Onglet>
          ),
        }}
      />
    </Tabs>
  );
}