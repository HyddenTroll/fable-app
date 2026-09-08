/**
 * COUVERTURE IA — génération d'une vraie image de couverture à la création.
 * Modèle : gpt-image-2 (obligatoire, décision produit). L'image est uploadée
 * dans le bucket Supabase 'covers' (créé à la volée, clé service_role) et son
 * URL publique est enregistrée sur le chapitre 0 (le prologue).
 * La DA impose un art d'éditeur sobre : lisible en miniature, sans texte.
 */
import { getDb } from './auth';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';

/** Styles visuels tirés côté serveur (variété par tirage, jamais température). */
const STYLES = [
  'linogravure deux tons, traces de presse',
  'sérigraphie au trait, aplats nets, un seul élément',
  'gravure ancienne au burin, hachures serrées',
  'collage de papiers déchirés, ombres franches',
  'aquatinte sombre, fondu de valeurs',
  'tissu sérigraphié, motifs répétés discrets',
  'photogravure granuleuse, fort contraste',
  'fresque murale écaillée, pigments bruts',
];

export async function generateCoverImage(opts: {
  title: string;
  genre: string;
  resume: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquante (génération de couverture)');

  const seed = (opts.title + opts.genre).length % STYLES.length;
  const resume = opts.resume ? opts.resume.slice(0, 240) : '';

  const prompt = [
    `Couverture de roman — art d'éditeur indépendant, SOBRE, sans aucun texte ni lettrage.`,
    `Genre : ${opts.genre}. Titre : ${opts.title}.`,
    resume ? `L'histoire : ${resume}` : '',
    `Style : ${STYLES[seed]}.`,
    `Règles : composition lisible en miniature (la couverture s'affiche à 48 px de large) ; `,
    `aucune typographie, aucun mot, aucun chiffre ; pas de silhouettes génériques de dos, `,
    `pas de clichés d'illustrateur (dragon éclairé, cape au vent, épée levée) ; palette sobre `,
    `(argile, obsidienne, bronze, pierre, un seul accent) ; UN seul élément fort, le reste épuré ; `,
    `la moitié basse reste calme pour accueillir le titre en surimpression.`,
  ].filter(Boolean).join(' ');

  const res = await fetch(OPENAI_IMAGES_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      // PORTRAIT 3/4 (le format de la niche) : moins cher que le carré sur
      // gpt-image-2 à chaque palier de qualité.
      size: '1024x1536',
      quality: 'medium',
      output_format: 'jpeg',
      n: 1,
    }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Image génération ${res.status}: ${detail.slice(0, 200)}`);
  }

  const data = (await res.json()) as { data?: { b64_json?: string; url?: string }[] };
  const b64 = data.data?.[0]?.b64_json;
  const directUrl = data.data?.[0]?.url;
  if (!b64 && !directUrl) throw new Error('Réponse image vide');

  return storeCover(b64 ?? null, directUrl ?? null);
}

async function storeCover(b64: string | null, directUrl: string | null): Promise<string> {
  const sb = getDb();
  const url = process.env.SUPABASE_URL ?? '';

  if (b64) {
    const buffer = Buffer.from(b64, 'base64');
    const path = `covers/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.jpg`;
    await sb.storage.createBucket('covers', { public: true }).catch(() => {});
    const { error } = await sb.storage.from('covers').upload(path, buffer, {
      contentType: 'image/jpeg',
    });
    if (error) throw new Error(`Upload couverture : ${error.message}`);
    return `${url}/storage/v1/object/public/covers/${path}`;
  }

  // Fallback : URL directe renvoyée par l'API (rare avec gpt-image-2).
  return directUrl ?? '';
}