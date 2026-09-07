import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, ScrollView, useWindowDimensions, Alert,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { streamChapter, reportGame, finalizeGame, ApiError, type HeroState } from '@/services/api';
import type { MockChapter } from '@/data/mock';
import { useRestoreGame } from '@/hooks/useRestoreGame';
import { colors, spacing, radii, fonts } from '@/theme';

/** Taille approximative d'une page de livre (mobile) : ~200-230 mots. */
const PAGE_CHARS = 1500;

/** Découpe un chapitre en PAGES (jamais de scroll : on tourne la page). */
function splitIntoPages(text: string, maxChars = PAGE_CHARS): string[] {
  const paragraphs = text.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paragraphs.length === 0) {
    return text ? [text] : [];
  }
  const pages: string[] = [];
  let current = '';
  for (const para of paragraphs) {
    if (current && current.length + para.length + 2 > maxChars) {
      pages.push(current);
      current = para;
    } else {
      current = current ? `${current}\n\n${para}` : para;
    }
  }
  if (current) pages.push(current);
  return pages.length ? pages : ['...'];
}

export default function GameScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ gameId: string }>();
  const { width: winWidth } = useWindowDimensions();
  const game = useAppStore((s) => s.currentGame);
  const heroState = useAppStore((s) => s.heroState);
  const setHeroState = useAppStore((s) => s.setHeroState);
  const updateCurrentGame = useAppStore((s) => s.updateCurrentGame);

  // Restauration serveur (réessaie si la partie a changé)
  useRestoreGame();

  const [isGenerating, setIsGenerating] = useState(false);
  const [streamText, setStreamText] = useState('');
  const [progressMsg, setProgressMsg] = useState<string | null>(null);
  const [pressedChoice, setPressedChoice] = useState<number | null>(null);
  const [streamError, setStreamError] = useState<string | null>(null);
  const [pageIndex, setPageIndex] = useState(0);
  const listRef = useRef<FlatList<string>>(null);
  const streamScrollRef = useRef<ScrollView>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastChoiceRef = useRef<number | null>(null);

  useEffect(() => {
    return () => abortRef.current?.abort();
  }, []);

  const finished = !!game?.finished;

  if (!game || params.gameId !== game.gameId) {
    return (
      <View style={styles.container}>
        <Text style={styles.meta}>Partie introuvable.</Text>
      </View>
    );
  }

  const current: MockChapter = game.chapters[game.currentIndex];

  // Pages du chapitre courant (mémoïsées) + remise à zéro quand le chapitre change
  const pages = useMemo(
    () => splitIntoPages(current.text),
    [current.text, current.number],
  );
  useEffect(() => {
    setPageIndex(0);
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }, [current.number]);

  const retryChoice = () => {
    const idx = lastChoiceRef.current;
    if (idx === null) return;
    setStreamError(null);
    handleChoice(idx);
  };

  // L'IA continue l'histoire naturellement, sans choix du lecteur
  const continueNaturally = () => handleChoice(-1);

  const handleReport = () => {
    Alert.alert(
      'Signaler ce contenu ?',
      'Ce chapitre te semble inapproprié ? Notre équipe le vérifiera.',
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Signaler',
          style: 'destructive',
          onPress: async () => {
            try {
              await reportGame(game.gameId);
              Alert.alert('Merci', 'Ton signalement a bien été envoyé.');
            } catch {
              Alert.alert('Erreur', 'Impossible d\'envoyer le signalement.');
            }
          },
        },
      ],
    );
  };

  const handleChoice = (index: number) => {
    if (isGenerating) return;
    setPressedChoice(index);
    lastChoiceRef.current = index;
    setIsGenerating(true);
    setStreamError(null);
    setStreamText('');
    setProgressMsg(null);

    const abort = new AbortController();
    abortRef.current = abort;

    streamChapter(
      game.gameId,
      index === -1 ? null : index,
      index === -1 ? null : (current.choices[index]?.libelle ?? null),
      {
        signal: abort.signal,
        onText: (delta) => setStreamText((prev) => prev + delta),
        onProgress: (message) => setProgressMsg(message),
        onDone: (done) => {
          const next: MockChapter = {
            number: done.chapter.chapterNumber,
            title: done.chapter.title,
            text: done.chapter.content,
            choices: done.chapter.choices.map((c) => ({ libelle: c.libelle, consequenceResumee: c.consequenceResumee })),
            isEnd: done.isEnd,
          };
          const updated = [...game.chapters, next];
          updateCurrentGame({
            chapters: updated,
            currentIndex: updated.length - 1,
            finished: done.isEnd,
          });
          // le state frais arrive par /finalize → au prochain chapitre ;
          // garde l'état courant tant que done.state est null.
          if (done.state) setHeroState(done.state);
          setIsGenerating(false);
          setPressedChoice(null);

          // POST-TRAITEMENT EN ARRIÈRE-PLAN : résumé/état/plan. Ne bloque
          // pas l'UI — le prochain /chapter attendra ce post s'il est court.
          finalizeGame(game.gameId).catch(() => {});

          if (done.isEnd) {
            router.push('/game/end');
          }
        },
        onError: (err) => {
          setIsGenerating(false);
          setPressedChoice(null);
          if (err instanceof ApiError && err.paywall) {
            router.push('/paywall');
          } else {
            // Partiel JETÉ : on reste sur le choix précédent, on propose réessayer
            setStreamError(err.message || 'Connexion perdue pendant l\'écriture du chapitre.');
          }
        },
        onModeration: (info) => {
          Alert.alert('Contenu signalé', info.message);
        },
      },
      // Conséquence annoncée du choix (alimente le résumé du tour suivant)
      index === -1 ? null : (current.choices[index]?.consequenceResumee ?? null),
    );
  };

  const statePreview = heroState ? renderState(heroState) : null;
  const showChoices =
    !isGenerating && !streamError && !current.isEnd && !finished;

  const renderPage = ({ item, index }: { item: string; index: number }) => {
    const isLast = index === pages.length - 1;
    return (
      // Scroll vertical PAR PAGE : la page fait ~200 mots mais quand le
      // texte (ou les choix) déborde, il reste accessible — un minimum
      // de défilement, jamais de texte coupé.
      <ScrollView
        style={[styles.page, { width: winWidth }]}
        contentContainerStyle={styles.pageContent}
        showsVerticalScrollIndicator={false}
      >
        <Text style={styles.chapterTitle}>
          {current.number === 0 ? 'Prologue' : `Chapitre ${current.number}`}
          {current.title && current.title !== 'Prologue' ? ` · ${current.title}` : ''}
        </Text>
        <Text style={styles.pageText}>{item}</Text>
        {isLast && (
          <>
            <Text style={styles.pageFooter}>— {current.number === 0 ? 'Prologue' : `Chapitre ${current.number}`} —</Text>
            {statePreview && !isGenerating && <View style={styles.stateBox}>{statePreview}</View>}
            {showChoices && current.choices.length > 0 && (
              <View style={styles.choices}>
                <Text style={styles.choicesLabel}>Que fais-tu ?</Text>
                {current.choices.map((c, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[styles.choiceButton, pressedChoice === i && styles.choicePressed]}
                    onPress={() => handleChoice(i)}
                    accessibilityRole="button"
                    accessibilityLabel={c.libelle}
                  >
                    <Text style={styles.choiceText}>{c.libelle}</Text>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={continueNaturally}
                  accessibilityRole="button"
                  accessibilityLabel="Continuer naturellement"
                >
                  <Text style={styles.continueText}>Continuer naturellement →</Text>
                </TouchableOpacity>
              </View>
            )}
            {showChoices && current.choices.length === 0 && (
              <View style={styles.choices}>
                <TouchableOpacity
                  style={styles.continueButton}
                  onPress={continueNaturally}
                  accessibilityRole="button"
                  accessibilityLabel="Continuer naturellement"
                >
                  <Text style={styles.continueText}>Continuer naturellement →</Text>
                </TouchableOpacity>
              </View>
            )}
          </>
        )}
      </ScrollView>
    );
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Text style={styles.headerBack} onPress={() => router.back()}>‹</Text>
          <Text style={styles.gameTitle}>{game.title}</Text>
        </View>
        <View style={styles.headerRight}>
          <Text style={styles.chapterPos}>
            {!isGenerating && pages.length > 1
              ? `p. ${pageIndex + 1} / ${pages.length}`
              : isGenerating ? 'L\'IA écrit…' : `${current.number === 0 ? 'Prologue' : `Ch. ${current.number}`}`}
          </Text>
          <TouchableOpacity onPress={handleReport} accessibilityRole="button" accessibilityLabel="Signaler ce contenu">
            <Text style={styles.reportBtn}>⚠</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isGenerating && (
        <View style={styles.generatingRow}>
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.generatingText}>
            {progressMsg && !streamText ? progressMsg : 'L\u2019IA écrit la suite...'}
          </Text>
        </View>
      )}

      {streamError && (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>{streamError}</Text>
          <TouchableOpacity style={styles.retryButton} onPress={retryChoice} accessibilityRole="button">
            <Text style={styles.retryText}>Réessayer</Text>
          </TouchableOpacity>
        </View>
      )}

      {isGenerating ? (
        // Pendant la génération : le texte écrit en direct, défilement
        // AUTO (invisible), sans pagination - on pagine uniquement le
        // texte final, une fois l'écriture terminée.
        <ScrollView
          ref={streamScrollRef}
          style={styles.body}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => streamScrollRef.current?.scrollToEnd({ animated: true })}
          contentContainerStyle={styles.streamContent}
        >
          <Text style={styles.chapterTitle}>
            {current.number === 0 ? 'Prologue' : `Chapitre ${current.number}`}
          </Text>
          <Text style={styles.pageText}>{streamText || '…'}</Text>
        </ScrollView>
      ) : (
        <FlatList
          ref={listRef}
          data={pages}
          keyExtractor={(_, i) => `${current.number}-${i}`}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          decelerationRate="fast"
          showsHorizontalScrollIndicator={false}
          onMomentumScrollEnd={(e) => {
            const w = e.nativeEvent.layoutMeasurement.width || 1;
            setPageIndex(Math.round(e.nativeEvent.contentOffset.x / w));
          }}
          style={styles.body}
        />
      )}
    </View>
  );
}

/** Affiche l'état structuré reçu du serveur (jamais modifié côté client).
 *  DÉFENSIF : les parties anciennes ont state = '{}' (migration 0004) —
 *  un champ manquant ne doit JAMAIS crasher le rendu (page blanche). */
function renderState(state: HeroState) {
  const wounds = (state.blessures ?? []).filter((b) => !b.soigne);
  const alive = (state.pnj ?? []).filter((p) => p.statut !== 'mort');
  const inventory = state.inventaire ?? [];
  if (wounds.length === 0 && inventory.length === 0 && alive.length === 0) {
    return null;
  }
  return (
    <>
      {wounds.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Blessures</Text>
          {wounds.map((b, i) => (
            <Text key={b.id || i} style={styles.stateItem}>• {b.quoi}</Text>
          ))}
        </View>
      )}
      {inventory.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Inventaire</Text>
          {inventory.map((it, i) => (
            <Text key={it.id || i} style={styles.stateItem}>• {it.objet}</Text>
          ))}
        </View>
      )}
      {alive.length > 0 && (
        <View>
          <Text style={styles.stateLabel}>Personnages</Text>
          {alive.map((p, i) => (
            <Text key={p.id || i} style={styles.stateItem}>• {p.nom}</Text>
          ))}
        </View>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: 48,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flex: 1 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  headerBack: { color: colors.primary, fontSize: 30, lineHeight: 32, paddingRight: spacing.xs },
  gameTitle: { color: colors.primary, fontSize: 14, fontWeight: '600', flexShrink: 1 },
  chapterPos: { color: colors.textSecondary, fontSize: 12 },
  reportBtn: { color: colors.textMuted, fontSize: 16, padding: 4 },
  body: { flex: 1 },
  page: {
    flex: 1,
    padding: spacing.xl,
  },
  pageContent: { paddingBottom: spacing.xxl },
  streamContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  chapterTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 22, marginBottom: spacing.md },
  pageText: { color: colors.textBody, fontSize: 17, lineHeight: 28 },
  pageFooter: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 1,
  },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  generatingText: { color: colors.textSecondary },
  choices: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: 10, marginTop: spacing.lg },
  choicesLabel: { color: colors.textSecondary, fontSize: 13, textTransform: 'uppercase' },
  choiceButton: {
    backgroundColor: colors.surface,
    borderRadius: radii.lg,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 48,
    justifyContent: 'center',
  },
  choicePressed: { borderColor: colors.primary, backgroundColor: colors.chipSelected },
  choiceText: { color: colors.text, fontSize: 15, lineHeight: 21 },
  continueButton: { marginTop: spacing.xs, paddingVertical: spacing.md, alignItems: 'center' },
  continueText: { color: colors.textMuted, fontSize: 14, textDecorationLine: 'underline' },
  meta: { color: colors.textSecondary, textAlign: 'center', marginTop: 40 },
  errorBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    borderWidth: 1,
    borderColor: colors.danger,
    marginHorizontal: spacing.xl,
    marginTop: spacing.lg,
    gap: spacing.md,
  },
  errorText: { color: colors.danger, lineHeight: 20 },
  retryButton: {
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radii.md,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    alignSelf: 'flex-start',
  },
  retryText: { color: colors.primary, fontWeight: '600' },
  stateBox: {
    backgroundColor: colors.surfaceAlt,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginTop: spacing.xl,
    gap: spacing.sm,
  },
  stateLabel: { color: colors.primary, fontSize: 12, textTransform: 'uppercase', marginTop: spacing.xs },
  stateItem: { color: colors.textBody, fontSize: 14, lineHeight: 20 },
});