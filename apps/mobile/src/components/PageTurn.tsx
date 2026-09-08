/**
 * PageTurn — wrapper « curl de page » prêt pour TOUTES les plateformes.
 *
 * Le module pagecurl importe Skia statiquement ; or sur le web,
 * Skia = JsiSkApi(global.CanvasKit) est FIGÉ à l'évaluation du module :
 * le WASM doit être chargé AVANT. Ce wrapper :
 *   1. charge le WASM (LoadSkiaWeb + l'URL exacte de l'asset, grâce à
 *      metro.config.js → assetExts 'wasm') ;
 *   2. n'importe le module curl qu'ENSUITE (lazy) — le composant Skia
 *      est donc toujours construit avec un CanvasKit prêt ;
 *   3. affiche un fond pierre pendant ce chargement (1er visite web).
 *
 * Sur natif, l'import paresseux est instantané et le module curl utilise
 * les bindings natifs (zéro WASM).
 */
import { lazy, Suspense } from 'react';
import { StyleSheet, View, Platform } from 'react-native';
import type { PageTurnProps } from './pagecurl';

let skiaReady: Promise<void> | null = null;
function ensureSkia(): Promise<void> {
  if (Platform.OS !== 'web') return Promise.resolve();
  if (!skiaReady) {
    skiaReady = (async () => {
      const [{ LoadSkiaWeb }, wasm] = await Promise.all([
        import('@shopify/react-native-skia/lib/module/web'),
        import('canvaskit-wasm/bin/full/canvaskit.wasm'),
      ]);
      const uri = (wasm as { default?: string }).default ?? (wasm as unknown as string);
      await LoadSkiaWeb({ locateFile: () => uri });
    })();
  }
  return skiaReady;
}

const Curl = lazy(async () => {
  await ensureSkia();
  return import('./pagecurl');
});

export function PageTurn(props: PageTurnProps) {
  const { width, height, backgroundColor = '#E4E2DC' } = props;
  return (
    <Suspense fallback={<View style={[styles.scene, { width, height, backgroundColor }]} />}>
      <Curl {...props} />
    </Suspense>
  );
}

const styles = StyleSheet.create({
  scene: { overflow: 'hidden' },
});