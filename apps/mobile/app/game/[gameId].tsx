import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView, useWindowDimensions,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useAppStore } from '@/state/store';
import { streamChapter, reportGame, finalizeGame, warmGame, ApiError, type HeroState } from '@/services/api';
import type { MockChapter } from '@/data/mock';
import { useRestoreGame } from '@/hooks/useRestoreGame';
import { PageTurn } from '@/components/PageTurn';
import { Oves } from '@/components/Oves';
import { Chapiteau } from '@/components/Chapiteau';
import { ProgressionMeandre } from '@/components/ProgressionMeandre';
import { FilQuiEcrit } from '@/components/FilQuiEcrit';
import { ListeDeChoix } from '@/components/ListeDeChoix';
import { DialogueFable, type DialogueAction } from '@/components/DialogueFable';
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
  const [dialogue, setDialogue] = useState<{
    kind: 'confirm' | 'erreur';
    title?: string;
    message: string;
    actions: DialogueAction[];
  } | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const lastChoiceRef = useRef<number | null>(null);

  // AMORÇAGE DU CACHE pendant la lecture : le cache LLM a un TTL ~5 min
  // et la fonction Vercel refroidit (~5 min aussi) — un lecteur qui met
  // 5-7 min par chapitre a donc TOUJOURS un chaud/froid au clic suivant.
  // Warm fire-and-forget toutes les 4 min, hors génération.
  useEffect(() => {
    if (!game || isGenerating) return;
    const id = setInterval(() => {
      warmGame(game.gameId).catch(() => {});
    }, 240_000);
    return () => clearInterval(id);
  }, [game?.gameId, isGenerating]);

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

  const retryChoice = () => {
    const idx = lastChoiceRef.current;
    if (idx === null) return;
    setStreamError(null);
    handleChoice(idx);
  };

  // L'IA continue l'histoire naturellement, sans choix du lecteur
  const continueNaturally = () => handleChoice(-1);

  const handleReport = () => {
    setDialogue({
      kind: 'confirm',
      title: 'Signaler ce contenu ?',
      message: 'Ce chapitre te semble inapproprié ? Notre équipe le vérifiera.',
      actions: [
        { label: 'Annuler', kind: 'secondary', onPress: () => setDialogue(null) },
        {
          label: 'Signaler',
          kind: 'primary',
          onPress: () => {
            setDialogue(null);
            void (async () => {
              try {
                await reportGame(game.gameId);
                setDialogue({
                  kind: 'confirm',
                  title: 'Merci',
                  message: 'Ton signalement a bien été envoyé.',
                  actions: [{ label: 'Fermer', kind: 'primary', onPress: () => setDialogue(null) }],
                });
              } catch {
                setDialogue({
                  kind: 'erreur',
                  title: 'Signalement impossible',
                  message: "Impossible d'envoyer le signalement.",
                  actions: [{ label: 'Fermer', kind: 'secondary', onPress: () => setDialogue(null) }],
                });
              }
            })();
          },
        },
      ],
    });
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
          setDialogue({
            kind: 'confirm',
            title: 'La fin',
            message: info.message,
            actions: [{ label: 'Fermer', kind: 'primary', onPress: () => setDialogue(null) }],
          });
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
        {index === 0 && <Chapiteau />}
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
                <Oves />
                <Text style={styles.choicesLabel}>Que fais-tu ?</Text>
                <ListeDeChoix
                  choix={current.choices.map((c) => c.libelle)}
                  onChoisir={handleChoice}
                />
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
            <View style={styles.iaMention}>
              <View style={styles.iaThread} />
              <Text style={styles.iaMentionText}>La suite s'écrit à partir de ton choix.</Text>
            </View>
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
          <TouchableOpacity onPress={handleReport} accessibilityRole="button" accessibilityLabel="Signaler ce contenu">
            <Text style={styles.reportBtn}>⚠</Text>
          </TouchableOpacity>
        </View>
      </View>

      {isGenerating && (
        <View style={styles.generatingRow}>
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
        // texte final, une fois l'écriture terminée. Composant memo :
        // seuls le texte se re-rend à chaque chunk.
        <StreamText
          text={streamText}
          chapterLabel={current.number === 0 ? 'Prologue' : `Chapitre ${current.number}`}
        />
      ) : (
        // Pagination « livre » : la page suit le doigt (rotateY + snap),
        // avec scroll vertical minimal dans la page quand elle déborde.
        <PageTurn
          pages={pages}
          width={winWidth}
          renderPage={renderPage}
          onPageChange={(i) => setPageIndex(i)}
          chapterKey={current.number}
        />
      )}

      {!isGenerating && pages.length > 1 && (
        <View style={styles.readerFooter}>
          <ProgressionMeandre page={pageIndex + 1} total={pages.length} />
          <Text style={styles.folio}>p. {pageIndex + 1} / {pages.length}</Text>
        </View>
      )}

      <DialogueFable
        visible={!!dialogue}
        title={dialogue?.title}
        message={dialogue?.message ?? ''}
        kind={dialogue?.kind ?? 'confirm'}
        actions={dialogue?.actions ?? []}
        onClose={() => setDialogue(null)}
      />
    </View>
  );
}

/** Texte en cours de génération — ISOLÉ (memo) : seul ce composant
 *  re-rend à chaque chunk reçu (sinon l'écran entier, header + choix
 *  compris, re-rendait ~1-3×/s pendant toute la génération). */
const StreamText = memo(function StreamText({
  text,
  chapterLabel,
}: {
  text: string;
  chapterLabel: string;
}) {
  const ref = useRef<ScrollView>(null);
  return (
    <ScrollView
      ref={ref}
      style={styles.body}
      showsVerticalScrollIndicator={false}
      onContentSizeChange={() => ref.current?.scrollToEnd({ animated: true })}
      contentContainerStyle={styles.streamContent}
    >
      <Text style={styles.chapterTitle}>{chapterLabel}</Text>
      <Text style={styles.pageText}>{text || '…'}</Text>
      <FilQuiEcrit actif />
    </ScrollView>
  );
});

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
    // Pages « papier blanc » (le livre) sur le fond pierre de l'écran.
    backgroundColor: '#FFFFFF',
  },
  pageContent: { paddingBottom: spacing.xxl },
  streamContent: { padding: spacing.xl, paddingBottom: spacing.xxl },
  chapterTitle: { color: colors.text, fontFamily: fonts.grec, fontSize: 19, lineHeight: 24, marginBottom: spacing.md },
  pageText: { color: colors.text, fontFamily: fonts.ia, fontSize: 15, lineHeight: 26 },
  pageFooter: {
    color: colors.textMuted,
    fontSize: 12,
    textAlign: 'center',
    marginTop: spacing.xl,
    letterSpacing: 1,
  },
  generatingRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: spacing.xl, paddingVertical: spacing.sm },
  generatingText: { color: colors.textSecondary, fontSize: 12 },
  choices: { padding: spacing.lg, borderTopWidth: 1, borderTopColor: colors.border, gap: 10, marginTop: spacing.lg },
  choicesLabel: { color: colors.textSecondary, fontSize: 11, fontFamily: fonts.ia, textTransform: 'uppercase' },
  choiceButton: {
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.text,
    borderRadius: 0,
    paddingHorizontal: 13,
    paddingVertical: 11,
    minHeight: 44,
    justifyContent: 'center',
  },
  choicePressed: { backgroundColor: colors.surfaceAlt },
  choiceText: { color: colors.text, fontSize: 12.5, lineHeight: 18 },
  continueButton: {
    marginTop: spacing.xs,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: 'transparent',
    paddingVertical: 12,
    alignItems: 'center',
  },
  continueText: { color: colors.textSecondary, fontSize: 12.5 },
  iaMention: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12 },
  iaThread: {
    width: 1,
    height: 10,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  iaMentionText: { color: colors.textSecondary, fontSize: 11, lineHeight: 16, fontFamily: fonts.ia },
  readerFooter: { paddingVertical: 12 },
  folio: {
    fontSize: 10,
    color: colors.textSecondary,
    textAlign: 'center',
    letterSpacing: 0.5,
    fontFamily: fonts.ia,
  },
  threadBase: {
    height: 2,
    backgroundColor: colors.primary,
    shadowColor: colors.shadow,
    shadowOpacity: 0.9,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    alignSelf: 'flex-start',
    width: '40%',
    transformOrigin: 'left',
    marginTop: spacing.md,
  },
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