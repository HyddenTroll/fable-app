/**
 * BIBLIOTHÈQUE — la collection du lecteur, en pierre et obsidienne.
 * « En cours » : lignes nues (filet veine), balayage gauche pour supprimer.
 * « Terminées » : étagère de dos vus par la tranche, graine du titre.
 * Le lapis est INTERDIT ici (l'IA n'écrit pas la collection ; le bronze, oui).
 */
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type DimensionValue,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { SoldeEncres } from '@/components/SoldeEncres';
import { CouvertureLivre } from '@/components/CouvertureLivre';
import { DialogueFable, type DialogueAction } from '@/components/DialogueFable';
import { Button } from '@/components/Button';
import { formatDateRelative, progression } from '@/lib/dates';
import { deleteGame, listGames } from '@/services/api';
import { useAppStore } from '@/state/store';
import { colors, fonts, spacing } from '@/theme';

interface Livre {
  id: string;
  title: string;
  genre: string;
  heroName: string;
  chapterCount: number;
  createdAt: string;
  status: string;
  coverImageUrl?: string | null;
}

/** Balayage : amplitude max du glissement (px), seuil d'accroche, bloc révélé. */
const AMPLITUDE = -70;
const SEUIL = -45;
const LARGEUR_COUVERTURE = 48;
const HAUTEUR_DOS = 58;

export default function LibraryScreen() {
  const router = useRouter();
  const credits = useAppStore((s) => s.credits);

  const [jeux, setJeux] = useState<Livre[] | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [dialog, setDialog] = useState<{
    kind: 'confirm' | 'erreur';
    title?: string;
    message: string;
    actions: DialogueAction[];
  } | null>(null);

  const charger = useCallback(async () => {
    try {
      setErreur(null);
      const liste = await listGames();
      setJeux(liste);
    } catch {
      setErreur('Bibliothèque indisponible pour le moment.');
    }
  }, []);

  // Rafraîchit à chaque retour sur l'onglet (chapitre ajouté, histoire
  // créée ou supprimée ailleurs).
  useFocusEffect(
    useCallback(() => {
      void charger();
    }, [charger]),
  );

  const ouvrir = (jeu: Livre) => {
    router.push(`/game/${jeu.id}`);
  };

  const supprimer = async (jeu: Livre) => {
    try {
      await deleteGame(jeu.id);
      await charger();
    } catch {
      // Les erreurs ne s'excusent pas : elles disent ce qui s'est passé.
      setDialog({
        kind: 'erreur',
        title: 'Suppression impossible',
        message: "L'histoire n'a pas pu être supprimée.",
        actions: [{ label: 'Fermer', kind: 'secondary', onPress: () => setDialog(null) }],
      });
    }
  };

  const confirmerSuppression = (jeu: Livre) => {
    setDialog({
      kind: 'confirm',
      title: 'Supprimer',
      message: `« ${jeu.title} » et tous ses chapitres ne seront plus visibles.`,
      actions: [
        { label: 'Annuler', kind: 'secondary', onPress: () => setDialog(null) },
        {
          label: 'Supprimer',
          kind: 'primary',
          onPress: () => {
            setDialog(null);
            void supprimer(jeu);
          },
        },
      ],
    });
  };

  const enCours = (jeux ?? [])
    .filter((g) => g.status === 'active')
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  const terminees = (jeux ?? []).filter((g) => g.status === 'finished');

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.contenu}>
        <View style={styles.barreHaute}>
          <Text style={styles.titrePage}>Bibliothèque</Text>
          <SoldeEncres solde={credits} denticules={5} />
        </View>

        {jeux === null && (
          <ActivityIndicator color={colors.textSecondary} style={styles.charge} />
        )}
        {erreur && <Text style={styles.erreur}>{erreur}</Text>}

        {jeux !== null && jeux.length === 0 && (
          <View style={styles.vide}>
            <Text style={styles.videTexte}>Ta bibliothèque est vide.</Text>
            <Button
              label="Commencer une histoire"
              variant="secondary"
              onPress={() => router.push('/new-game')}
              style={styles.videBouton}
            />
          </View>
        )}

        {jeux !== null && jeux.length > 0 && (
          <>
            {enCours.length > 0 && (
              <View style={styles.section}>
                <EnTeteSection titre="En cours" compte={enCours.length} unite="histoire" />
                {enCours.map((g) => (
                  <LigneEnCours
                    key={g.id}
                    jeu={g}
                    onOuvrir={ouvrir}
                    onSupprimer={confirmerSuppression}
                  />
                ))}
              </View>
            )}

            {terminees.length > 0 && (
              <View style={styles.section}>
                <EnTeteSection titre="Terminées" compte={terminees.length} unite="livre" />
                <TouchableOpacity
                  style={styles.etagere}
                  onPress={() => ouvrir(terminees[0])}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir ${terminees[0].title}`}
                >
                  <View style={styles.rangeeDos}>
                    {terminees.map((g) => (
                      <DosLivre key={g.id} titre={g.title} chapitres={g.chapterCount} />
                    ))}
                  </View>
                  <View style={styles.planche} />
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>

      <DialogueFable
        visible={!!dialog}
        title={dialog?.title}
        message={dialog?.message ?? ''}
        kind={dialog?.kind ?? 'confirm'}
        actions={dialog?.actions ?? []}
        onClose={() => setDialog(null)}
      />
    </>
  );
}

/** En-tête de section : titre Didot + compteur gris, alignés sur la baseline. */
function EnTeteSection({ titre, compte, unite }: { titre: string; compte: number; unite: string }) {
  return (
    <View style={styles.enTete}>
      <Text style={styles.enTeteTitre}>{titre}</Text>
      <Text style={styles.enTeteCompte}>
        {compte} {compte === 1 ? unite : `${unite}s`}
      </Text>
    </View>
  );
}

/** Ligne « En cours » : balayage vers la gauche pour révéler « Supprimer ». */
function LigneEnCours({
  jeu,
  onOuvrir,
  onSupprimer,
}: {
  jeu: Livre;
  onOuvrir: (jeu: Livre) => void;
  onSupprimer: (jeu: Livre) => void;
}) {
  const tx = useSharedValue(0);
  const [revelee, setRevelee] = useState(false);

  const pan = Gesture.Pan()
    .activeOffsetX([-12, 12])
    .failOffsetY([-14, 14])
    .onUpdate((e) => {
      tx.value = Math.min(0, Math.max(AMPLITUDE, e.translationX));
    })
    .onEnd((e) => {
      if (e.translationX < SEUIL) {
        tx.value = withTiming(AMPLITUDE, { duration: 180 });
        runOnJS(setRevelee)(true);
      } else {
        tx.value = withTiming(0, { duration: 180 });
        runOnJS(setRevelee)(false);
      }
    });

  const styleAvant = useAnimatedStyle(() => ({
    transform: [{ translateX: tx.value }],
  }));

  const pct = Math.round(progression(1, jeu.chapterCount) * 100);

  return (
    <GestureDetector gesture={pan}>
      <View style={styles.rangee}>
        <TouchableOpacity
          style={styles.supprimer}
          onPress={() => onSupprimer(jeu)}
          accessibilityRole="button"
          accessibilityLabel={`Supprimer ${jeu.title}`}
          accessibilityElementsHidden={!revelee}
          importantForAccessibility={revelee ? 'yes' : 'no-hide-descendants'}
        >
          <Text style={styles.supprimerTexte}>Supprimer</Text>
        </TouchableOpacity>
        <Animated.View style={[styles.avant, styleAvant]}>
          <TouchableOpacity
            style={styles.ligneContenu}
            onPress={() => onOuvrir(jeu)}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel={`${jeu.title}, chapitre 1 sur ${jeu.chapterCount}`}
          >
            <CouvertureLivre titre={jeu.title} genre={jeu.genre} largeur={LARGEUR_COUVERTURE} coverImageUrl={jeu.coverImageUrl} />
            <View style={styles.infos}>
              <Text style={styles.titre} numberOfLines={2}>
                {jeu.title}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                Chapitre 1 sur {jeu.chapterCount} · {formatDateRelative(jeu.createdAt)}
              </Text>
              <View style={styles.jaugeFond}>
                <View style={[styles.jaugeRemplie, { width: `${pct}%` as DimensionValue }]} />
              </View>
            </View>
            <Text style={styles.cheuron}>›</Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </GestureDetector>
  );
}

/** Dos de livre vu par la tranche : largeur selon les chapitres, graine du titre. */
function DosLivre({ titre, chapitres }: { titre: string; chapitres: number }) {
  const largeur = Math.round(16 + chapitres * 0.55);
  const plein = (titre.length * 9301 + 49297) % 3 === 0;
  return (
    <View style={[styles.dos, { width: largeur }, plein && styles.dosPlein]} />
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  contenu: { padding: spacing.xxl, paddingBottom: spacing.xxl * 2 },
  barreHaute: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  titrePage: { fontFamily: fonts.grec, fontSize: 21, color: colors.text },
  charge: { marginVertical: spacing.xl * 2 },
  erreur: { color: colors.alerte, fontSize: 13, marginTop: spacing.lg },

  section: {},

  enTete: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: spacing.sm,
    marginTop: 22,
    marginBottom: spacing.xs,
  },
  enTeteTitre: { fontFamily: fonts.grec, fontSize: 17, color: colors.text },
  enTeteCompte: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.textSecondary },

  rangee: {
    borderTopWidth: 1,
    borderTopColor: colors.surfaceAlt,
    overflow: 'hidden',
  },
  supprimer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    right: 0,
    width: 48,
    backgroundColor: colors.alerte,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supprimerTexte: {
    fontFamily: fonts.iaMedium,
    fontSize: 10,
    color: '#FFFFFF',
    transform: [{ rotate: '90deg' }],
  },
  avant: { backgroundColor: colors.background },
  ligneContenu: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  infos: { flex: 1, minWidth: 0, gap: spacing.xs + 1 },
  titre: { fontFamily: fonts.grec, fontSize: 15, color: colors.text },
  meta: { fontFamily: fonts.ia, fontSize: 10.5, color: colors.textSecondary },
  jaugeFond: { height: 2, backgroundColor: colors.surfaceAlt, overflow: 'hidden' },
  jaugeRemplie: { height: 2, backgroundColor: colors.text },
  cheuron: { color: colors.textSecondary, fontSize: 20, paddingHorizontal: spacing.xs },

  etagere: { marginTop: spacing.md },
  rangeeDos: { flexDirection: 'row', alignItems: 'flex-end', gap: 3 },
  dos: {
    height: HAUTEUR_DOS,
    borderWidth: 1,
    borderColor: colors.text,
    backgroundColor: colors.background,
  },
  dosPlein: { backgroundColor: colors.text },
  planche: { height: 3, backgroundColor: colors.text, marginTop: 3 },

  vide: { alignItems: 'center', paddingTop: spacing.xxl * 3, gap: spacing.xl },
  videTexte: {
    fontFamily: fonts.grec,
    fontSize: 19,
    color: colors.text,
    textAlign: 'center',
  },
  videBouton: { minWidth: 240, alignSelf: 'center' },
});