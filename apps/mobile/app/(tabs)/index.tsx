/**
 * ACCUEIL — l'objet principal de l'écran est la couverture du livre le
 * plus récent, encadré par les encres et les deux gestes (reprendre /
 * commencer). Pierre & Lapis : le lapis reste réservé à l'IA — il ne
 * réapparaît ici que dans le fil du logotype (et son « b »).
 */
import { useCallback, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { CouvertureLivre } from '@/components/CouvertureLivre';
import { Logo } from '@/components/Logo';
import { SoldeEncres } from '@/components/SoldeEncres';
import { formatDateRelative, progression } from '@/lib/dates';
import { listGames, readGame } from '@/services/api';
import { useAppStore } from '@/state/store';
import { colors, fonts, spacing } from '@/theme';

const COUVERTURE = 210;
const JAUGE_LARGEUR = 150;
const JAUGE_HAUTEUR = 2;
const BOUTON_HAUTEUR = 46;

interface Histoire {
  id: string;
  title: string;
  genre: string;
  heroName: string;
  chapterCount: number;
  createdAt: string;
  status: string;
}

/** Les plus récentes d'abord (le serveur trie déjà, on re-trie par sûreté). */
const parRecence = (a: Histoire, b: Histoire): number =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export default function HomeScreen() {
  const router = useRouter();
  const credits = useAppStore((s) => s.credits);

  // null = chargement : logotype + solde restent en place, le reste est vide.
  const [games, setGames] = useState<Histoire[] | null>(null);
  const [chapitreCourant, setChapitreCourant] = useState<number | null>(null);
  const [couvertureUrl, setCouvertureUrl] = useState<string | null>(null);

  // Rafraîchit la liste à chaque retour sur l'accueil (histoire créée,
  // chapitre ajouté ou histoire supprimée ailleurs).
  useFocusEffect(
    useCallback(() => {
      let actif = true;
      listGames()
        .then((liste) => {
          if (!actif) return;
          const triee = [...liste].sort(parRecence);
          setGames(triee);
          // La couverture peut avoir été générée en arrière-plan pendant
          // l'absence (création, retour d'un autre onglet) : on la relit à
          // CHAQUE focus — c'est ce qui manquait (l'image restait en
          // « préparation » même une fois prête).
          const premier = triee[0];
          if (premier) {
            readGame(premier.id)
              .then(({ chapters }) => {
                if (!actif) return;
                setChapitreCourant(Math.max(1, Math.min(chapters.length || 1, premier.chapterCount)));
                const couverture = chapters[0]?.coverImageUrl ?? null;
                if (couverture) setCouvertureUrl(couverture);
              })
              .catch(() => {});
          }
        })
        .catch(() => {
          if (actif) setGames([]);
        });
      return () => {
        actif = false;
      };
    }, []),
  );

  const livre = games?.[0] ?? null;
  const autres = games ? games.length - 1 : 0;
  const total = livre ? Math.max(1, livre.chapterCount) : 0;

  // Chapitre courant : les chapitres réellement écrits, bornés au total.
  // En attente, on affiche « Chapitre 1 ».
  useEffect(() => {
    if (!livre) {
      setChapitreCourant(null);
      return;
    }
    let actif = true;
    setChapitreCourant(1);
    readGame(livre.id)
      .then(({ chapters }) => {
        if (!actif) return;
        const n = chapters.length || 1;
        setChapitreCourant(Math.max(1, Math.min(n, total)));
        const couverture = chapters[0]?.coverImageUrl ?? null;
        if (couverture) setCouvertureUrl(couverture);
      })
      .catch(() => {
        if (actif) setChapitreCourant(1);
      });
    return () => {
      actif = false;
    };
  }, [livre?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const reprendre = () => {
    if (livre) router.push(`/game/${livre.id}`);
  };
  const creer = () => router.push('/new-game');
  const bibliotheque = () => router.push('/library');

  return (
    <ScrollView style={styles.ecran} contentContainerStyle={styles.contenu}>
      <View style={styles.enTete}>
        <Logo size={54} />
        <SoldeEncres solde={credits} />
      </View>

      {/* Chargement : le reste de l'écran se remplit, rien ne clignote. */}
      {games === null ? null : !livre ? (
        <View style={styles.vide}>
          <Text style={styles.videTitre}>Ton premier livre n'est pas encore écrit.</Text>
          <TouchableOpacity
            style={styles.boutonPlein}
            onPress={creer}
            accessibilityRole="button"
          >
            <Text style={styles.boutonPleinTexte}>Commencer une histoire</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.bloc}>
          <View style={styles.oeuvre}>
            <CouvertureLivre largeur={COUVERTURE} titre={livre.title} coverImageUrl={couvertureUrl} />
            <Text style={styles.lecture}>EN COURS DE LECTURE</Text>
            <Text style={styles.titre}>{livre.title}</Text>
            <Text style={styles.meta}>
              Chapitre {chapitreCourant ?? 1} sur {total} · {formatDateRelative(livre.createdAt)}
            </Text>
            <View style={styles.jauge}>
              <View
                style={[
                  styles.jaugeRemplie,
                  { width: JAUGE_LARGEUR * progression(chapitreCourant ?? 1, total) },
                ]}
              />
            </View>
            {!couvertureUrl && (
              <Text style={styles.pasEncore}>
                La couverture arrive avec la création du livre.
              </Text>
            )}
          </View>

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.boutonPlein}
              onPress={reprendre}
              accessibilityRole="button"
            >
              <Text style={styles.boutonPleinTexte}>Reprendre la lecture</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.boutonContour}
              onPress={creer}
              accessibilityRole="button"
            >
              <Text style={styles.boutonContourTexte}>Commencer une histoire</Text>
            </TouchableOpacity>
          </View>

          {/* Disparaît s'il n'y a qu'un seul livre. */}
          {autres > 0 && (
            <View style={styles.pied}>
              <View style={styles.filet} />
              <TouchableOpacity
                style={styles.piedLigne}
                onPress={bibliotheque}
                accessibilityRole="button"
              >
                <Text style={styles.piedTexte}>
                  {autres} autre{autres > 1 ? 's' : ''} histoire{autres > 1 ? 's' : ''} en cours
                </Text>
                <Text style={styles.piedChevron}>›</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  ecran: { flex: 1, backgroundColor: colors.background },
  contenu: { flexGrow: 1, padding: spacing.xxl, gap: spacing.xl },
  enTete: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  vide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xl,
  },
  videTitre: {
    fontFamily: fonts.grec,
    fontSize: 19,
    lineHeight: 24,
    color: colors.text,
    textAlign: 'center',
  },
  bloc: { flex: 1, gap: spacing.xl },
  oeuvre: { alignItems: 'center', gap: spacing.lg },
  lecture: {
    fontFamily: fonts.ia,
    fontSize: 10,
    color: colors.textSecondary,
    letterSpacing: 0.6, // 0.06 em sur 10 px
    textAlign: 'center',
  },
  titre: {
    fontFamily: fonts.grec,
    fontSize: 23,
    lineHeight: 26.5, // ~1.15 x
    color: colors.text,
    textAlign: 'center',
  },
  meta: {
    fontFamily: fonts.ia,
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  jauge: {
    width: JAUGE_LARGEUR,
    height: JAUGE_HAUTEUR,
    backgroundColor: colors.surfaceAlt, // veine
    overflow: 'hidden',
  },
  jaugeRemplie: {
    height: JAUGE_HAUTEUR,
    backgroundColor: colors.text, // obsidienne
  },
  actions: { gap: spacing.sm, alignSelf: 'stretch' },
  boutonPlein: {
    height: BOUTON_HAUTEUR,
    backgroundColor: colors.text, // obsidienne
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  boutonPleinTexte: {
    fontFamily: fonts.iaMedium,
    fontSize: 13.5,
    color: colors.background, // pierre
  },
  boutonContour: {
    height: BOUTON_HAUTEUR,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: colors.text, // obsidienne
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 0,
  },
  boutonContourTexte: {
    fontFamily: fonts.iaMedium,
    fontSize: 13.5,
    color: colors.text,
  },
  pied: { marginTop: 'auto', gap: spacing.lg },
  filet: { height: 1, backgroundColor: colors.surfaceAlt }, // veine
  pasEncore: {
    marginTop: spacing.sm,
    color: colors.textSecondary,
    fontFamily: fonts.ia,
    fontSize: 10.5,
    textAlign: 'center',
  },
  piedLigne: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  piedTexte: {
    fontFamily: fonts.ia,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
  piedChevron: {
    fontFamily: fonts.ia,
    fontSize: 11.5,
    color: colors.textSecondary,
  },
});