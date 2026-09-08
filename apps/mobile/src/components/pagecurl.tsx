/**
 * PageTurn — le papier S'ENROULE sur un cylindre, le pli suit le doigt
 * (port Skia du modèle validé par l'utilisateur, implémentation déclarative).
 *
 *   • partie encore à plat : [0, xt]    avec xt = W − d
 *   • le rouleau           : [xt, xt+R] consomme π·R de papier
 *   • le verso retombé     : [xt−v, xt] avec v = max(0, d − π·R)
 *
 * Les pages sont rendues en React React natif (renderPage) puis capturées
 * en SkImage (makeImageFromView) : on garde TOUT le rendu de page existant,
 * le texte n'est jamais re-layouté par frame. Le rouleau est un dégradé dont
 * les arrêts reprennent la courbe d'éclairement du cylindre (sin θ) ; le pli
 * s'incline selon la hauteur de la prise (θ = (y0/H − .5)·.40) ; snap à
 * 42 % ou 700 px/s. Retour : la feuille précédente part entièrement enroulée
 * (d ≈ DMAX) → aucun saut au changement de sens. Tout le geste vit sur le
 * thread UI (derived values), zéro re-render React pendant le drag.
 *
 * ⚠ IMPORTANT : ce module importe Skia STATIQUEMENT et ne doit être chargé
 * qu'APRÈS LoadSkiaWeb() (le WASM web) — le wrapper PageTurn.tsx l'importe
 * paresseusement (lazy) : sur le web, Skia = JsiSkApi(global.CanvasKit) est
 * figé à l'évaluation du module, et le WASM n'est chargé qu'après.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import {
  Canvas,
  Group,
  Image as SkiaImage,
  LinearGradient,
  Rect,
  Skia,
  makeImageFromView,
  vec,
  type SkImage,
  type SkRect,
} from '@shopify/react-native-skia';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';

const PIERRE = '#E4E2DC';
const R = 38; // rayon d'enroulement, constant
const ARC = Math.PI * R;

export type PageTurnProps = {
  /** Rendu d'une page (React natif, capturé en SkImage). */
  renderPage: (index: number) => React.ReactNode;
  count: number;
  /** Page courante — prop contrôlée par le parent. */
  index: number;
  onChangeIndex: (next: number) => void;
  /** false pendant le streaming : la pagination ne bouge pas. */
  enabled?: boolean;
  width: number;
  height: number;
  /** Overlay « état + choix » par-dessus la dernière page (s'efface au geste). */
  tail?: React.ReactNode;
  backgroundColor?: string;
};

export default function PageCurl({
  renderPage,
  count,
  index,
  onChangeIndex,
  enabled = true,
  width: W,
  height: H,
  tail,
  backgroundColor = PIERRE,
}: PageTurnProps) {
  const DMAX = W + 2 * R;

  /* ── Captures des pages en SkImage ─────────────────────────── */
  const refPrec = useRef<View>(null);
  const refCour = useRef<View>(null);
  const refSuiv = useRef<View>(null);
  const [imgs, setImgs] = useState<{ prec: SkImage | null; cour: SkImage | null; suiv: SkImage | null }>({
    prec: null,
    cour: null,
    suiv: null,
  });

  useEffect(() => {
    let vivant = true;
    const t = setTimeout(async () => {
      const shot = async (r: React.RefObject<View | null>, ok: boolean) => {
        if (!ok || !r.current) return null;
        try {
          if (Platform.OS === 'web') {
            // Sur le web, makeImageFromView délègue à un callback : on
            // rasterise le noeud DOM (SVG foreignObject → canvas → PNG) et
            // on crée l'image Skia depuis les octets encodés.
            return await makeImageFromView(r as React.RefObject<View>, async (viewRef) => {
              const node = viewRef.current as unknown as HTMLElement;
              const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
              svg.setAttribute('width', String(W));
              svg.setAttribute('height', String(H));
              svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
              const fo = document.createElementNS('http://www.w3.org/2000/svg', 'foreignObject');
              fo.setAttribute('width', String(W));
              fo.setAttribute('height', String(H));
              const body = document.createElementNS('http://www.w3.org/1999/xhtml', 'body');
              body.style.margin = '0';
              body.appendChild(node.cloneNode(true));
              fo.appendChild(body);
              svg.appendChild(fo);
              const xml = new XMLSerializer().serializeToString(svg);
              const url = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(xml)}`;
              const img = new Image();
              await new Promise<void>((res, rej) => {
                img.onload = () => res();
                img.onerror = () => rej(new Error('svg capture failed'));
                img.src = url;
              });
              const c = document.createElement('canvas');
              const dpr = Math.min(window.devicePixelRatio || 1, 2);
              c.width = Math.round(W * dpr);
              c.height = Math.round(H * dpr);
              const ctx2d = c.getContext('2d');
              if (!ctx2d) throw new Error('no 2d context');
              ctx2d.scale(dpr, dpr);
              ctx2d.fillStyle = '#E4E2DC'; // fond pierre si la page est transparente
              ctx2d.fillRect(0, 0, W, H);
              ctx2d.drawImage(img, 0, 0, W, H);
              const dataUrl = c.toDataURL('image/png');
              const bytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (ch) => ch.charCodeAt(0));
              const sk = Skia.Image.MakeImageFromEncoded(Skia.Data.fromBytes(bytes));
              if (!sk) throw new Error('skia decode failed');
              return sk;
            });
          }
          return await makeImageFromView(r as React.RefObject<View>);
        } catch (e) {
          return null;
        }
      };
      const [prec, cour, suiv] = await Promise.all([
        shot(refPrec, index > 0),
        shot(refCour, true),
        shot(refSuiv, index < count - 1),
      ]);
      if (vivant) setImgs({ prec, cour, suiv });
    }, 32); // laisse une frame au rendu avant la capture
    return () => {
      vivant = false;
      clearTimeout(t);
    };
  }, [index, count, W, H]);

  /* ── État animé ────────────────────────────────────────────── */
  const d = useSharedValue(0); // distance tirée
  const theta = useSharedValue(0); // inclinaison du pli
  const py = useSharedValue(H / 2); // hauteur de la prise
  const dir = useSharedValue<1 | -1>(1);
  const [sens, setSens] = useState<1 | -1>(1);

  const majSens = useCallback((s: 1 | -1) => setSens(s), []);

  const repos = useCallback(() => {
    d.value = 0;
    theta.value = 0;
    dir.value = 1;
    setSens(1);
  }, [d, theta, dir]);

  const commit = useCallback(
    (delta: number) => {
      onChangeIndex(index + delta);
      repos();
    },
    [index, onChangeIndex, repos],
  );

  /* ── Geste ─────────────────────────────────────────────────── */
  const pan = Gesture.Pan()
    .enabled(enabled)
    .activeOffsetX([-15, 15])
    .failOffsetY([-14, 14])
    .onBegin((e) => {
      py.value = Math.min(Math.max(e.y, 0), H);
      theta.value = (e.y / H - 0.5) * 0.4; // prise : ±~11°
    })
    .onUpdate((e) => {
      const avant = e.translationX < 0;
      const s: 1 | -1 = avant ? 1 : -1;
      if (s !== dir.value) {
        dir.value = s;
        runOnJS(majSens)(s);
      }
      const possible = avant ? index < count - 1 : index > 0;
      const tire = Math.min(Math.abs(e.translationX), DMAX);
      // au retour, la feuille précédente part ENTIÈREMENT enroulée
      // (d ≈ DMAX, invisible) : aucun saut au changement de sens.
      if (!possible) {
        d.value = avant ? tire * 0.1 : DMAX - tire * 0.1;
      } else {
        d.value = avant ? tire : DMAX - tire;
      }
    })
    .onEnd((e) => {
      const avant = dir.value === 1;
      const possible = avant ? index < count - 1 : index > 0;
      const prog = avant ? d.value / DMAX : 1 - d.value / DMAX;
      const valide = possible && (prog > 0.42 || Math.abs(e.velocityX) > 700);
      const cible = valide ? (avant ? DMAX : 0) : avant ? 0 : DMAX;

      d.value = withTiming(cible, { duration: 280, easing: Easing.out(Easing.cubic) }, (fini) => {
        if (!fini) return;
        if (valide) runOnJS(commit)(avant ? 1 : -1);
        else runOnJS(repos)();
      });
    });

  /* ── Géométrie dérivée (thread UI) ─────────────────────────── */
  const xt = useDerivedValue(() => W - d.value); // le pli
  const vLen = useDerivedValue(() => Math.max(0, d.value - ARC)); // verso
  const xVerso = useDerivedValue(() => xt.value - vLen.value);
  const largeurRouleau = useDerivedValue(() =>
    Math.min(R, R * Math.sin(Math.min(Math.PI / 2, d.value / R))),
  );
  const xCrete = useDerivedValue(() => xt.value + largeurRouleau.value - 1);

  /* Découpe de la partie encore à plat : rectangle [0..pli], porté par la
     MÊME rotation que le rouleau → la ligne de coupe suit le pli incliné
     (pas de Skia.Path ici : Skia.Path.Make() crash sur web avant la fin
     du chargement du WASM). */
  const rectPlat = useDerivedValue<SkRect>(() => ({
    x: 0,
    y: -H * 2,
    width: Math.max(0, xt.value),
    height: H * 4,
  }));

  /* Rotation du plat (pli), du rouleau et du verso autour du pli. */
  const transformCurl = useDerivedValue(() => [
    { translateX: xt.value },
    { translateY: py.value },
    { rotate: theta.value },
    { translateX: -xt.value },
    { translateY: -py.value },
  ]);

  const visible = useDerivedValue(() => (d.value > 0.5 && d.value < DMAX - 0.5 ? 1 : 0));
  const opaquePlat = useDerivedValue(() => (d.value >= DMAX - 0.5 ? 0 : 1));

  const imgFeuille = sens === 1 ? imgs.cour : imgs.prec;
  const imgDessous = sens === 1 ? imgs.suiv : imgs.cour;

  const T = -H;
  const HH = H * 3;

  // Runtime Skia pas prêt (premier chargement web : WASM) : fond pierre.
  // (PageTurn.tsx — le wrapper — monte ce module en lazy APRÈS LoadSkiaWeb,
  // donc ce retour anticipé ne se produit pas en pratique ; il est ici par
  // robustesse si le lazy échouait.)
  if (Platform.OS === 'web' && typeof globalThis !== 'undefined' && !(globalThis as any).CanvasKit) {
    return <View style={[styles.scene, { width: W, height: H, backgroundColor }]} />;
  }

  /* ── Overlay « tail » (état + choix) : s'efface quand le pli s'ouvre ── */
  const tailStyle = useAnimatedStyle(() => ({
    opacity: d.value < 3 ? 1 : 0,
    transform: [{ translateY: d.value < 3 ? 0 : 14 }],
  }));

  return (
    <GestureDetector gesture={pan}>
      <View style={[styles.scene, { width: W, height: H, backgroundColor }]}>
        {/* Pages rendues hors écran puis capturées en SkImage */}
        <View style={styles.hors} pointerEvents="none">
          <View ref={refPrec} collapsable={false} style={{ width: W, height: H }}>
            {index > 0 ? renderPage(index - 1) : null}
          </View>
          <View ref={refCour} collapsable={false} style={{ width: W, height: H }}>
            {renderPage(index)}
          </View>
          <View ref={refSuiv} collapsable={false} style={{ width: W, height: H }}>
            {index < count - 1 ? renderPage(index + 1) : null}
          </View>
        </View>

        <Canvas style={{ width: W, height: H }}>
          {/* 1. la page révélée dessous */}
          {imgDessous ? (
            <SkiaImage image={imgDessous} x={0} y={0} width={W} height={H} fit="fill" />
          ) : (
            <Rect x={0} y={0} width={W} height={H} color={backgroundColor} />
          )}

          {/* 2. partie encore à plat, coupée par la ligne de pli */}
          <Group clip={rectPlat} transform={transformCurl} opacity={opaquePlat}>
            {imgFeuille ? <SkiaImage image={imgFeuille} x={0} y={0} width={W} height={H} fit="fill" /> : null}
          </Group>

          {/* 3. rouleau + verso, dans le repère incliné */}
          <Group transform={transformCurl} opacity={visible}>
            {/* 3a. ombre portée à gauche du verso */}
            <Rect x={xVerso} y={T} width={24} height={HH}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(24, 0)}
                colors={['rgba(16,17,20,0)', 'rgba(16,17,20,0.20)']}
              />
            </Rect>

            {/* 3b. verso retombé à plat */}
            <Rect x={xVerso} y={T} width={vLen} height={HH}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(W, 0)}
                colors={['#f1efeb', '#e7e4dd', '#d4d0c7']}
                positions={[0, 0.7, 1]}
              />
            </Rect>

            {/* 3c. LE ROULEAU — dégradé reprenant la courbe d'éclairement du cylindre */}
            <Rect x={xt} y={T} width={largeurRouleau} height={HH}>
              <LinearGradient
                start={vec(0, 0)}
                end={vec(R, 0)}
                colors={[
                  '#c8c5be', // raccord, dans l'ombre
                  '#e3e0d9',
                  '#f6f4ef',
                  '#ffffff', // le reflet
                  '#f2efe9',
                  '#d9d5cc', // crête
                ]}
                positions={[0, 0.18, 0.45, 0.62, 0.82, 1]}
              />
            </Rect>

            {/* 3d. crête nette */}
            <Rect x={xCrete} y={T} width={1.2} height={HH} color="rgba(16,17,20,0.18)" />
          </Group>
        </Canvas>

        {/* état + choix : au-dessus du canvas, s'effacent dès que le pli bouge */}
        {tail && index === count - 1 && (
          <Animated.View style={[styles.tailBox, tailStyle]}>{tail}</Animated.View>
        )}
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  scene: { backgroundColor: PIERRE, overflow: 'hidden' },
  // hors écran : rendu réel des pages, jamais visible
  hors: { position: 'absolute', left: -10000, top: 0, opacity: 0 },
  tailBox: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
});