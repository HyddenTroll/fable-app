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

/** Ton graphique par genre : une direction, pas une formule — le modèle compose
 *  librement la composition, la palette et le langage à partir de cette couleur. */
const TONS_PAR_GENRE: Record<string, string> = {
  horreur: 'froid et sourd, presque abstrait : une seule image inquiétante, silence, espaces vides',
  thriller: 'tendu et net : contrastes durs, lignes coupantes, lumière basse',
  fantastique: 'matière ancienne : objets curieux, lumière rasante, patine du temps',
  'science-fiction': 'formes pures, horizons artificiels, froid industriel, exactitude',
  drame: 'intime : matières, corps, lumière douce, pudeur',
  western: 'ciel immense, terre, couleurs séchées par le soleil',
  romance: 'chaud : dégradé doux, motif intime, tendresse retenue',
  comédie: 'clair et simple : presque une affiche d’opérette, énergie sobre',
};

export async function generateCoverImage(opts: {
  title: string;
  genre: string;
  resume: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquante (génération de couverture)');

  const resume = opts.resume ? opts.resume.slice(0, 240) : '';
  const ton = TONS_PAR_GENRE[opts.genre?.toLowerCase() ?? ''] ?? 'sobre, éditeur indépendant';

  const prompt = [
    `Conçois la couverture d'un roman publié — un VRAI objet de librairie, pas une illustration, pas une affiche.`,
    `Titre : ${opts.title}.`,
    `Genre : ${opts.genre}.`,
    resume ? `L'histoire : ${resume}` : '',
    `Couleur de ton : ${ton}. La composition, la palette et le langage graphique doivent être UNIQUES et nés de ce thème — jamais une formule générique.`,
    `Règles : aucun texte ni lettrage (le titre est imprimé séparément, la moitié basse reste calme pour l'accueillir en surimpression) ; `,
    `pas de silhouette générique de dos ; pas de clichés d'illustrateur (dragon éclairé, cape au vent, épée levée) ; `,
    `pas de rendu photographique de banque d'images ; palette restreinte (deux ou trois couleurs maximum, dominante sombre ou argile) ; `,
    `UN seul élément fort, le reste épuré ; composition lisible en miniature (la couverture s'affiche à 48 px de large dans une bibliothèque).`,
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