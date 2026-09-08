/**
 * ÉCRAN IMAGES — la frise des images générées.
 * Architecture grecque : rangées de métopes et triglyphes, architrave
 * obsidienne sur la première rangée. Les emplacements vides restent
 * visibles : ce sont des métopes, pas un manque. Lapis réservé au fil
 * de la mention IA (l'origine des images), aucun accès autrement.
 */
import { useCallback, useMemo, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Image, Modal, TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useAppStore } from '@/state/store';
import { listGames, readGame, type ApiChapter } from '@/services/api';
import { SoldeEncres } from '@/components/SoldeEncres';
import { colors, fonts, spacing } from '@/theme';

/** L'API ne déclare pas les champs d'illustration : on les assume. */
type ChapitreImage = ApiChapter & { coverImageUrl?: string | null; createdAt?: string };

interface ImageCollectee {
  cle: string;
  uri: string;
  gameId: string;
  gameTitle: string;
}

const MAX_IMAGES = 12; // 12 métopes

export default function ImagesScreen() {
  const solde = useAppStore((s) => s.credits);
  const email = useAppStore((s) => s.email);

  const [images, setImages] = useState<ImageCollectee[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [filtre, setFiltre] = useState<string | null>(null);
  const [filtreOuvert, setFiltreOuvert] = useState(false);
  const [apercu, setApercu] = useState<string | null>(null);

  // Collecte les couvertures de chapitres de toutes les histoires (borné à 12).
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      if (!email) {
        setImages([]);
        return () => { actif = false; };
      }
      (async () => {
        try {
          const jeux = await listGames();
          const collecte: ImageCollectee[] = [];
          for (const g of jeux) {
            const donnees = await readGame(g.id);
            const chapitres = (donnees.chapters ?? []) as ChapitreImage[];
            for (const ch of chapitres) {
              const uri = ch.coverImageUrl ? String(ch.coverImageUrl) : null;
              if (uri && uri.trim()) {
                collecte.push({ cle: `${g.id}:${ch.chapterNumber}`, uri, gameId: g.id, gameTitle: g.title });
                if (collecte.length >= MAX_IMAGES) break;
              }
            }
            if (collecte.length >= MAX_IMAGES) break;
          }
          if (actif) {
            setImages(collecte.slice(0, MAX_IMAGES));
            setErreur(null);
          }
        } catch (e) {
          if (actif) {
            setImages((prev) => prev ?? []);
            setErreur(e instanceof Error ? e.message : 'Galerie indisponible.');
          }
        }
      })();
      return () => { actif = false; };
    }, [email]),
  );

  const total = images?.length ?? 0;

  const jeuxAvecImages = useMemo(() => {
    const vus = new Set<string>();
    const liste: { id: string; title: string }[] = [];
    for (const im of images ?? []) {
      if (!vus.has(im.gameId)) {
        vus.add(im.gameId);
        liste.push({ id: im.gameId, title: im.gameTitle });
      }
    }
    return liste;
  }, [images]);

  // Filtre LOCAL : la frise montre une seule histoire, sans backend.
  const affichees = filtre ? (images ?? []).filter((im) => im.gameId === filtre) : (images ?? []);
  const rangees = Math.max(2, Math.ceil(affichees.length / 2));

  const rendreMetope = (img: ImageCollectee | undefined, cle: string) => (
    <View key={cle} style={styles.metope}>
      {img ? (
        <TouchableOpacity
          style={styles.metopeTouch}
          onPress={() => setApercu(img.uri)}
          activeOpacity={0.85}
          accessibilityRole="imagebutton"
          accessibilityLabel={`Image de ${img.gameTitle}`}
        >
          <Image source={{ uri: img.uri }} style={styles.metopeImage} resizeMode="cover" />
        </TouchableOpacity>
      ) : null}
    </View>
  );

  const rendreRangee = (ri: number) => {
    const base = ri * 2;
    const a = affichees[base];
    const b = affichees[base + 1];
    return (
      <View key={ri} style={[styles.rangee, ri === 0 && styles.premiereRangee]}>
        <Triglyphe />
        {rendreMetope(a, `m-${ri}-0`)}
        <Triglyphe />
        {rendreMetope(b, `m-${ri}-1`)}
        <Triglyphe />
      </View>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.titre}>Images</Text>
        <SoldeEncres solde={solde} denticules={5} />
      </View>

      <ScrollView style={styles.defilant} contentContainerStyle={styles.contenu}>
        <Text style={styles.sousTitre}>
          {total} image{total > 1 ? 's' : ''} sur {MAX_IMAGES} métopes
        </Text>

        <TouchableOpacity
          style={styles.boutonFiltre}
          onPress={() => setFiltreOuvert((v) => !v)}
          accessibilityRole="button"
        >
          <Text style={styles.boutonFiltreTexte}>Filtrer par histoire</Text>
        </TouchableOpacity>

        {filtreOuvert && jeuxAvecImages.length > 0 && (
          <View style={styles.filtres}>
            <FiltreChip
              label="Toutes"
              actif={filtre === null}
              onPress={() => setFiltre(null)}
            />
            {jeuxAvecImages.map((j) => (
              <FiltreChip
                key={j.id}
                label={j.title}
                actif={filtre === j.id}
                onPress={() => setFiltre(filtre === j.id ? null : j.id)}
              />
            ))}
          </View>
        )}

        {erreur && <Text style={styles.erreur}>{erreur}</Text>}

        {images === null && !erreur && (
          <ActivityIndicator color={colors.primary} style={styles.chargeur} />
        )}

        <View style={styles.frise}>{Array.from({ length: rangees }, (_, ri) => rendreRangee(ri))}</View>
      </ScrollView>

      {/* Mention IA — le fil lapis (halo) est la seule ombre de l'écran */}
      <View style={styles.pied}>
        <View style={styles.iaFil} />
        <Text style={styles.iaTexte}>Images générées par une intelligence artificielle.</Text>
      </View>

      <Modal
        visible={apercu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setApercu(null)}
      >
        <TouchableOpacity
          style={styles.apercuFond}
          activeOpacity={1}
          onPress={() => setApercu(null)}
          accessibilityRole="button"
          accessibilityLabel="Fermer l'aperçu"
        >
          {apercu ? (
            <Image source={{ uri: apercu }} style={styles.apercuImage} resizeMode="contain" />
          ) : null}
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

/** Triglyphe : 13px de veine, deux rainures verticales obsidienne à 35 %. */
function Triglyphe() {
  return (
    <View style={styles.triglyphe}>
      <View style={styles.rainure} />
      <View style={styles.rainure} />
    </View>
  );
}

function FiltreChip({ label, actif, onPress }: { label: string; actif: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: actif }}
      style={styles.chip}
    >
      <Text style={[styles.chipTexte, actif && styles.chipTexteActif]}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xxl,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  titre: { color: colors.text, fontFamily: fonts.grec, fontSize: 21 },
  defilant: { flex: 1 },
  contenu: { paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  sousTitre: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 10.5, marginBottom: spacing.xl },
  boutonFiltre: {
    height: 46,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.xl,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: 'transparent',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: spacing.xl,
  },
  boutonFiltreTexte: { color: colors.text, fontFamily: fonts.iaMedium, fontSize: 14 },
  filtres: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.xl },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipTexte: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 12 },
  chipTexteActif: { color: colors.text, fontFamily: fonts.iaSemiBold },
  erreur: { color: colors.danger, fontFamily: fonts.ia, fontSize: 13, marginBottom: spacing.lg },
  chargeur: { marginVertical: spacing.xxl },
  frise: { marginTop: spacing.sm },
  rangee: { height: 78, flexDirection: 'row', borderTopWidth: 0 },
  premiereRangee: { borderTopWidth: 2, borderTopColor: colors.text },
  triglyphe: {
    width: 13,
    backgroundColor: colors.surfaceAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    overflow: 'hidden',
  },
  rainure: { width: 2, backgroundColor: colors.text, opacity: 0.35, alignSelf: 'stretch' },
  metope: {
    flex: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    borderColor: colors.surfaceAlt,
    backgroundColor: colors.background,
    overflow: 'hidden',
  },
  metopeTouch: { flex: 1 },
  metopeImage: { flex: 1, width: '100%', height: '100%' },
  pied: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.xxl,
    paddingVertical: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
  },
  iaFil: {
    width: 1,
    height: 20,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  iaTexte: { color: colors.textSecondary, fontFamily: fonts.ia, fontSize: 11, lineHeight: 16 },
  apercuFond: {
    flex: 1,
    backgroundColor: 'rgba(16, 17, 20, 0.9)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  apercuImage: { width: '100%', height: '85%' },
});