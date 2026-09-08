import { useEffect, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, TextInput, FlatList, Modal,
} from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { COURBE } from '@/theme/motion';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { GameParams } from '@fable/shared';
import {
  GENRES, HERO_TRAITS, NARRATIVE_STYLES, CHAPTER_LENGTHS, DIFFICULTIES,
} from '@/data/mock';
import { createGame, enrichBible, generateCover, getMe, ApiError } from '@/services/api';
import { useAppStore } from '@/state/store';
import { Button } from '@/components/Button';
import { Stylobate } from '@/components/Stylobate';
import { colors, spacing, radii, fonts } from '@/theme';

type Step = 'genre' | 'hero' | 'params';

/** Étapes visibles de la création, pour la barre de progression. */
const CREATE_STEPS = ['Charpente du récit', 'Prologue', 'Enrichissement du monde', 'La couverture sèche'];

/** Sous-titres d'étape (11.5px, gris) sous le titre en Didot. */
const STEP_SUBTITLES: Record<Step, string> = {
  genre: 'La charpente de ton récit',
  hero: "Celui qui vivra l'aventure",
  params: 'La cadence et la voix de ton récit',
};

/** Noms proposés par le tirage au sort du héros (aucune liste n'existait). */
const RANDOM_HERO_NAMES = ['Liam', 'Elena', 'Sacha', 'Iris', 'Noam', 'Aylin', 'Théo', 'Mila'];

const pickRandom = <T,>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export default function NewGameScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const setCurrentGame = useAppStore((s) => s.setCurrentGame);
  const setGameParams = useAppStore((s) => s.setGameParams);
  const setHeroState = useAppStore((s) => s.setHeroState);
  const isPremium = useAppStore((s) => s.isPremium);
  const age = useAppStore((s) => s.age);

  const [step, setStep] = useState<Step>('genre');
  const [genreCode, setGenreCode] = useState<string>('fantasy');
  const [subGenre, setSubGenre] = useState<string | null>(null);
  const [heroName, setHeroName] = useState('');
  const [heroTrait, setHeroTrait] = useState<string | null>(null);
  const [difficulty, setDifficulty] = useState<GameParams['difficulty']>('moyenne');
  const [chapterLength, setChapterLength] = useState<GameParams['chapterLength']>('moyen');
  const [style, setStyle] = useState<GameParams['style']>('classique');
  const [maxChoices, setMaxChoices] = useState<GameParams['maxChoices']>(3);
  const [creating, setCreating] = useState(false);
  const [createStep, setCreateStep] = useState(0);
  // Statut Fable+ lu côté serveur (le store local peut être périmé).
  const [mePremium, setMePremium] = useState<boolean | null>(null);

  useEffect(() => {
    let actif = true;
    getMe()
      .then((m) => { if (actif) setMePremium(m.isPremium); })
      .catch(() => { if (actif) setMePremium(false); });
    return () => { actif = false; };
  }, []);
  // Progression LISSE de la barre : le fetch de création est synchrone (aucun
  // événement intermédiaire) → la barre avance par paliers doux au fil des
  // étapes réelles, plus un tic-tac léger pendant l'attente.
  const [barP, setBarP] = useState(0);
  const fillStyle = useAnimatedStyle(() => ({
    width: `${withTiming(barP * 100, { duration: 520, easing: COURBE.sortie })}%`,
  }));
  const [error, setError] = useState<string | null>(null);

  const selectedGenre = GENRES.find((g) => g.code === genreCode)!;

  const startGame = async () => {
    const params: GameParams = {
      genre: genreCode as GameParams['genre'],
      subGenre: subGenre ?? undefined,
      difficulty,
      chapterLength,
      style,
      maxChoices,
    };
    setCreating(true);
    setCreateStep(0);
    setError(null);
    // Tic-tac doux pendant la longue attente synchrone (le fetch /create).
    setBarP(0.1);
    const tick = setInterval(() => setBarP((b) => Math.min(0.48, b + 0.012)), 320);
    try {
      // Étape 1 : charpente + prologue (la route /create fait les deux en série)
      const res = await createGame({
        genre: params.genre,
        subGenre: params.subGenre,
        difficulty,
        chapterLength,
        style,
        maxChoices,
        age: age ?? 'adult',
        heroName: heroName || undefined,
        heroTrait: heroTrait ?? undefined,
      });
      setCreateStep(1);
      setBarP(0.55);
      clearInterval(tick);
      setGameParams(params);
      setHeroState(null);
      setCurrentGame({
        gameId: res.gameId,
        title: res.game.title,
        genreLabel: res.game.genre,
        heroName: res.game.heroName || heroName || 'Le Héros',
        chapters: [{
          number: res.chapter.chapterNumber,
          title: res.chapter.title,
          text: res.chapter.content,
          choices: res.chapter.choices.map((c) => ({ libelle: c.libelle, consequenceResumee: c.consequenceResumee })),
          isEnd: false,
        }],
        currentIndex: 0,
        resume: res.game.resume,
        finished: false,
      });
      // Étape 2 : enrichissement de la bible EN ARRIÈRE-PLAN - ne bloque
      // pas la lecture, on part tout de suite lire le prologue.
      setCreateStep(2);
      setBarP(0.85);
      enrichBible(res.gameId);
      // Petite respiration pour afficher la barre "Enrichissement" avant
      // de basculer sur l'écran de lecture.
      await new Promise((r) => setTimeout(r, 1200));
      // La couverture IA part en arrière-plan (ne bloque pas la lecture). L'appel
      // est INCONDITIONNEL côté client : c'est le serveur qui tranche le
      // premium + le quota (402 sinon) — le statut local du store peut être
      // périmé (achat non resynchronisé dans la session).
      setCreateStep(3);
      setBarP(0.92);
      generateCover(res.gameId).catch(() => {});
      await new Promise((r) => setTimeout(r, 1100));
      setBarP(1);
      router.push(`/game/${res.gameId}`);
    } catch (e) {
      clearInterval(tick);
      if (e instanceof ApiError && e.paywall) {
        router.push('/paywall');
      } else {
        setError(e instanceof Error ? e.message : 'Erreur de création');
      }
    } finally {
      setCreating(false);
    }
  };

  const canContinue = step === 'hero' ? heroName.trim().length > 0 : true;

  /** « Tirer au sort pour moi » : tire les options de l'étape puis avance (ou lance). */
  const randomizeAndAdvance = () => {
    if (step === 'genre') {
      const g = pickRandom(GENRES);
      setGenreCode(g.code);
      if (g.subGenres.length > 0) {
        const choice = pickRandom([null, ...g.subGenres]);
        setSubGenre(choice ? choice.code : null);
      } else {
        setSubGenre(null);
      }
      setStep('hero');
    } else if (step === 'hero') {
      if (heroName.trim().length === 0) setHeroName(pickRandom(RANDOM_HERO_NAMES));
      if (!heroTrait) setHeroTrait(pickRandom(HERO_TRAITS));
      setStep('params');
    } else {
      setDifficulty(pickRandom(DIFFICULTIES).code as GameParams['difficulty']);
      setChapterLength(pickRandom(CHAPTER_LENGTHS).code as GameParams['chapterLength']);
      setStyle(pickRandom(NARRATIVE_STYLES).code as GameParams['style']);
      setMaxChoices(pickRandom([2, 3, 4]) as GameParams['maxChoices']);
      startGame();
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top + spacing.lg }]}>

      {creating && (
        <Modal visible transparent animationType="fade" onRequestClose={() => {}} style={styles.creationModal}>
          {/* Écran de chargement PLEIN DEVANT : rien d'autre n'est visible
              ni touchable pendant la création (les boutons de l'écran
              resteraient cliquables sinon → doubles appels).
              Même largeur que la coquille web (430 px). */}
          <View style={styles.creationOverlay}>
            <AttenteCreation />
            <View style={styles.progressTrack}>
              <Animated.View style={[styles.progressFill, fillStyle]} />
            </View>
            <Text style={styles.creationStep}>{CREATE_STEPS[Math.min(createStep, CREATE_STEPS.length - 1)]}</Text>
            {mePremium === false && createStep === 3 && (
              <Text style={styles.creationFableHint}>
                Les couvertures illustrées viennent avec Fable+.
              </Text>
            )}
          </View>
        </Modal>
      )}

      <View style={styles.header}>
        <Stylobate step={step === 'genre' ? 1 : step === 'hero' ? 2 : 3} />
        <Text style={styles.stepTitle}>
          {step === 'genre' ? 'Choisis ton univers' :
           step === 'hero' ? 'Ton héros' : 'Personnalisation'}
        </Text>
        <Text style={styles.stepSubtitle}>{STEP_SUBTITLES[step]}</Text>
      </View>

      {step === 'genre' && (
        <FlatList
          data={GENRES}
          keyExtractor={(g) => g.code}
          contentContainerStyle={styles.listContent}
          renderItem={({ item: g }) => (
            <View style={styles.genreBlock}>
              <TouchableOpacity
                style={[styles.genreCard, genreCode === g.code && styles.selected]}
                onPress={() => { setGenreCode(g.code); setSubGenre(null); }}
              >
                <Text style={styles.genreName}>{g.label}</Text>
                <Text style={styles.genreDesc}>{g.description}</Text>
              </TouchableOpacity>
              {genreCode === g.code && g.subGenres.length > 0 && (
                <View style={styles.subGenreRow}>
                  <TouchableOpacity
                    style={[styles.subGenreChip, subGenre === null && styles.selectedChip]}
                    onPress={() => setSubGenre(null)}
                  >
                    <Text style={styles.subGenreText}>Ambiance libre</Text>
                  </TouchableOpacity>
                  {g.subGenres.map((sg) => (
                    <TouchableOpacity
                      key={sg.code}
                      style={[styles.subGenreChip, subGenre === sg.code && styles.selectedChip]}
                      onPress={() => setSubGenre(sg.code)}
                    >
                      <Text style={styles.subGenreText}>{sg.label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}
            </View>
          )}
        />
      )}

      {step === 'hero' && (
        <View style={styles.formContent}>
          <Text style={styles.label}>Nom du héros</Text>
          <TextInput
            style={styles.input}
            value={heroName}
            onChangeText={setHeroName}
            placeholder="Entre un nom..."
            placeholderTextColor={colors.textMuted}
          />
          <Text style={styles.label}>Trait de personnalité (optionnel)</Text>
          <View style={styles.chipsRow}>
            {HERO_TRAITS.map((t) => (
              <TouchableOpacity
                key={t}
                style={[styles.chip, heroTrait === t && styles.selectedChip]}
                onPress={() => setHeroTrait(heroTrait === t ? null : t)}
              >
                <Text style={styles.subGenreText}>{t}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {step === 'params' && (
        <View style={styles.formContent}>
          <Text style={styles.label}>Difficulté</Text>
          <View style={styles.chipsRow}>
            {DIFFICULTIES.map((d) => (
              <TouchableOpacity
                key={d.code}
                style={[styles.chip, difficulty === d.code && styles.selectedChip]}
                onPress={() => setDifficulty(d.code as GameParams['difficulty'])}
              >
                <Text style={styles.subGenreText}>{d.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Longueur des chapitres</Text>
          <View style={styles.chipsRow}>
            {CHAPTER_LENGTHS.map((c) => (
              <TouchableOpacity
                key={c.code}
                style={[styles.chip, chapterLength === c.code && styles.selectedChip]}
                onPress={() => setChapterLength(c.code as GameParams['chapterLength'])}
              >
                <Text style={styles.subGenreText}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Style narratif</Text>
          <View style={styles.chipsRow}>
            {NARRATIVE_STYLES.map((s) => (
              <TouchableOpacity
                key={s.code}
                style={[styles.chip, style === s.code && styles.selectedChip]}
                onPress={() => setStyle(s.code as GameParams['style'])}
              >
                <Text style={styles.subGenreText}>{s.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Nombre de choix</Text>
          <View style={styles.chipsRow}>
            {[2, 3, 4].map((n) => (
              <TouchableOpacity
                key={n}
                style={[styles.chip, maxChoices === n && styles.selectedChip]}
                onPress={() => setMaxChoices(n as GameParams['maxChoices'])}
              >
                <Text style={styles.subGenreText}>{n} choix</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      <View style={styles.navRow}>
        {step !== 'genre' && (
          <Button
            label="Retour"
            variant="secondary"
            onPress={() => setStep(step === 'params' ? 'hero' : 'genre')}
            style={styles.flexButton}
          />
        )}
        {step === 'params' ? (
          <Button
            label={creating ? 'Création en cours...' : 'Commencer l\'aventure'}
            onPress={startGame}
            disabled={creating}
            style={styles.flexButton}
          />
        ) : (
          <Button
            label="Continuer"
            onPress={() => setStep(step === 'genre' ? 'hero' : 'params')}
            disabled={!canContinue}
            style={styles.flexButton}
          />
        )}
      </View>
      <Button
        label="Tirer au sort pour moi"
        variant="secondary"
        onPress={randomizeAndAdvance}
        disabled={creating}
        style={styles.randomButton}
      />
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

/** Phrases d'attente de la création — écrites à la main, AUCUN appel API.
 *  Littéraires, sur la CONSTRUCTION générale d'une histoire (pas de champ
 *  lexical d'imprimerie). Roulement toutes les ~3,5 s. */
const PHRASES_CREATION = [
  'Une histoire ne commence jamais là où elle commence',
  'Le premier chapitre ouvre une porte ; les suivants décident qui la franchit',
  'Un personnage n’existe qu’à partir du moment où il choisit',
  'Chaque intrigue est une promesse que la fin devra tenir',
  'Le héros ignore encore ce que le lecteur devine déjà',
  'Les dialogues sont des silences qui parlent',
  'La fin est déjà là, cachée dans la première page',
  'Les lieux sont des personnages qui n’ouvrent pas la bouche',
  'L’intrigue avance quand les questions restent en suspens',
  'Chaque chapitre doit changer quelque chose à celui qui le lit',
  'Le style, c’est la voix qu’on reconnaît sans voir le visage',
  'Les meilleures révélations sont celles qu’on préparait sans le savoir',
  'On n’écrit pas un livre, on le laisse respirer',
  'Le récit se souvient de tout ce qu’on lui confie',
];

function AttenteCreation() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((v) => (v + 1) % PHRASES_CREATION.length), 3500);
    return () => clearInterval(t);
  }, []);
  return (
    <View style={styles.creationPhraseWrap}>
      <Text style={styles.creationTitle}>{PHRASES_CREATION[i]}…</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background, paddingHorizontal: spacing.xxl, paddingBottom: spacing.xxl },
  creationBox: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    gap: spacing.sm,
  },
  creationOverlay: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  creationModal: {
    flex: 1,
    maxWidth: 430,
    width: '100%',
    alignSelf: 'center',
  },
  creationPhraseWrap: { marginBottom: spacing.xxl, paddingHorizontal: spacing.lg },
  creationTitle: { color: colors.text, fontSize: 15, fontWeight: '600', textAlign: 'center', lineHeight: 22 },
  progressTrack: {
    height: 8,
    borderRadius: 0,
    overflow: 'hidden',
    backgroundColor: colors.surfaceAlt,
    alignSelf: 'stretch',
    marginHorizontal: spacing.xxl,
  },
  progressFill: {
    height: 8,
    borderRadius: 0,
    backgroundColor: colors.primary,
  },
  creationStep: { color: colors.textSecondary, fontSize: 13 },
  creationFableHint: {
    color: colors.textSecondary,
    fontSize: 11,
    fontFamily: fonts.ia,
    marginTop: spacing.sm,
    textAlign: 'center',
    paddingHorizontal: spacing.xl,
  },
  listContent: { gap: spacing.md },
  formContent: { gap: spacing.xs },
  header: { alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  stepTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 22, textAlign: 'center' },
  stepSubtitle: { color: colors.textSecondary, fontSize: 11.5, textAlign: 'center' },
  genreBlock: { marginBottom: spacing.xs },
  genreCard: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selected: { borderColor: colors.primary },
  genreName: { color: colors.text, fontSize: 17, fontWeight: '600' },
  genreDesc: { color: colors.textSecondary, marginTop: spacing.xs },
  subGenreRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, paddingHorizontal: spacing.sm, paddingTop: spacing.sm },
  subGenreChip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    paddingVertical: 6,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  selectedChip: { borderColor: colors.primary, backgroundColor: colors.chipSelected },
  subGenreText: { color: colors.textBody },
  label: { color: colors.text, fontSize: 15, marginTop: spacing.sm },
  input: {
    backgroundColor: colors.surface,
    borderRadius: radii.md,
    padding: spacing.md,
    color: colors.text,
    fontSize: 16,
    borderWidth: 1,
    borderColor: colors.border,
    marginTop: 6,
  },
  chipsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: 6 },
  chip: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
  },
  navRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.xxl },
  flexButton: { flex: 1 },
  randomButton: { marginTop: spacing.md },
  error: { color: colors.danger, marginTop: spacing.md, textAlign: 'center' },
});