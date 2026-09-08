/**
 * COUVERTURE IA — génération d'une vraie image de couverture à la création.
 * Modèle : gpt-image-2 (obligatoire, décision produit). L'image est uploadée
 * dans le bucket Supabase 'covers' (créé à la volée, clé service_role) et son
 * URL publique est enregistrée sur le chapitre 0 (le prologue).
 * La DA impose un art d'éditeur sobre : lisible en miniature, sans texte
 * (le titre est composé par l'application par-dessus l'image).
 */
import { getDb } from './auth';

const OPENAI_IMAGES_URL = 'https://api.openai.com/v1/images/generations';
const IMAGE_MODEL = process.env.OPENAI_IMAGE_MODEL ?? 'gpt-image-2';

/**
 * Directions artistiques tirées au sort à chaque génération : de VRAIS
 * courants de librairie, par rayon. Chaque direction fixe un langage
 * graphique, une palette et une place de typographie — jamais une formule
 * unique, jamais un fond marron par défaut.
 */
const DIRECTIONS_PAR_GENRE: Record<string, { nom: string; consigne: string }[]> = {
  horreur: [
    { nom: 'poche noir américain des années 70', consigne: 'affiche peinte à la gouache grenée, une image inquiétante encadrée, titre énorme en haut, palette rouge sombre et bleu nuit' },
    { nom: 'photo argentique froide', consigne: 'une photographie grise d’un lieu vide (couloir, champ, maison), fort contraste, beaucoup de gris, titre blanc en haut, palette graphite et ivoire' },
    { nom: 'bois gravé gothique', consigne: 'gravure sur bois, hachures serrées, camaïeu noir et blanc cassé, un arbre ou une silhouette unique, atmosphère de vieux livre' },
    { nom: 'minimalisme contemporain', consigne: 'un seul objet incongru posé au centre d’un fond absolument uni et profond (vert bouteille ou bleu nuit), énormément d’air, sobriété totale' },
    { nom: 'franco-belge tranché', consigne: 'dessin sec au trait noir, une seule couleur d’appoint (orange brûlé), cadrage serré, énergie de bande dessinée adulte' },
    { nom: 'éditorial typographique', consigne: 'design de poche contemporain : une petite photographie en médaillon, de grands aplats de couleur (noir et chartreuse), modernité nette' },
  ],
  science_fiction: [
    { nom: 'poche SF des années 60', consigne: 'peinture à l’huile épaisse : un vaisseau dans la fumée, rouge vermillon et bleu nuit, allure de collection de science-fiction rétro' },
    { nom: 'hard SF française', consigne: 'géométrie de chantier spatial : lignes de construction, treillis, gris métal et orange brûlé, exactitude technique' },
    { nom: 'contre-jour de film', consigne: 'composition cinématographique : une petite silhouette devant un horizon artificiel immense, contre-jour, bleu froid et jaune pâle' },
    { nom: 'néons et pluie', consigne: 'megalopole nocturne : néons magenta et cyan, pluie, reflets sur verre et bitume, dessin nerveux' },
    { nom: 'solarpunk', consigne: 'végétation qui envahit une architecture blanche, lumière dorée de fin d’après-midi, verts profonds et crème' },
    { nom: 'astronef minimaliste', consigne: 'un casque ou un visage au centre d’un fond d’étoiles très épuré, typographie fine, presque du vide, tons acier et étain' },
  ],
  fantasy: [
    { nom: 'enluminure', consigne: 'or et bleu lapis, décor médiéval stylisé, entrelacs, patine de manuscrit, pas de texte' },
    { nom: 'romantisme brumeux', consigne: 'peinture vaporeuse : forêt dans la brume, tons sourds verts et gris-bleu, une lumière trouée, mélancolie' },
    { nom: 'objet féerique contemporain', consigne: 'un objet unique en gros plan très net (clé, pendule, plume, boussole) sur un fond dégradé doux, édition moderne, tons de pierre et de bronze clair' },
    { nom: 'expressionnisme allongé', consigne: 'formes longues et déformées, ombres portées dramatiques, rouge sombre et noir, tension' },
    { nom: 'aquarelle sombre', consigne: 'lavis d’aquarelle sur papier, tons de terre, de sauge et de prune, une tour ou un château lointain' },
    { nom: 'gravure victorienne', consigne: 'entrelacs végétaux gravés, encres chaudes retenues, bords travaillés, objet relic d’un autre âge' },
  ],
  policier: [
    { nom: 'Série Noire', consigne: 'dessin dur en deux couleurs, angle tranchant, homme en chapeau ou arme en gros plan, noir et jaune ou noir et rouge, typographie massue' },
    { nom: 'noir urbain', consigne: 'ville la nuit, contre-jour, pluie ou brume, bleu nuit et jaune sodium, une silhouette lointaine' },
    { nom: 'polar du Nord', consigne: 'paysage désolé sous la neige, gris-bleu et blanc, une petite silhouette qui marche, silence' },
    { nom: 'l’énigme en un objet', consigne: 'un objet-clé (clé, gant, photographie, loupe) au centre d’un fond uni sombre, lumière de lampe, mystère calme' },
    { nom: 'affiche des sixties', consigne: 'collage graphique, angles et hachures, rouge et noir, allure de thriller vintage' },
    { nom: 'documentaire net', consigne: 'photographie réaliste d’un lieu ordinaire (rue, hall d’immeuble, escalier), netteté médicale, typographie sobre, tons gris et ivoire' },
  ],
  historique: [
    { nom: 'eau-forte d’époque', consigne: 'gravure à l’eau-forte, hachures croisées, ivoire et gris-bleu froid, un monument ou une scène de rue ancienne' },
    { nom: 'portrait de la Renaissance', consigne: 'peinture à l’huile en clair-obscur, un visage ou un détail de costume, rouge et or retenus, cadre sobre' },
    { nom: 'bois gravé du XIXe', consigne: 'trait dense et noir, scène de travail ou de ville ancienne, noir et blanc, patine de journal ancien' },
    { nom: 'bande dessinée historique', consigne: 'dessin précis au lavis gris-bleu, une scène vivante (rue, marché, bataille), cadrage de roman graphique' },
    { nom: 'marbre et dorures', consigne: 'arrière-plan de marbre veiné, un détail doré, une colonne, épure antique, tons de pierre et d’or' },
    { nom: 'archive documentaire', consigne: 'photographie grisée d’archive, un document ou un objet du passé, tampons et usures (sans texte lisible), sépia froid' },
  ],
  romance: [
    { nom: 'couchant d’été', consigne: 'lumière de fin de journée, corail, orange et bleu lavande, douceur de vacances, un couple flou ou deux espaces qui se frôlent' },
    { nom: 'détail intime', consigne: 'photographie nette d’un détail doux (deux mains, une tasse de café, une fleur cueillie), fond clair très doux, édition contemporaine' },
    { nom: 'rétro des années 50', consigne: 'motifs géométriques et aplats, bleu et vanille, allure de romance classique, charme suranné' },
    { nom: 'deux objets éloignés', consigne: 'deux objets (deux chaises, deux tasses, deux fenêtres) très éloignés sur un fond uni, beaucoup d’air, tension douce, tons de sauge et de crème' },
    { nom: 'aquarelle florale', consigne: 'fleurs peintes en lavis, camaïeu de corail pâle et de vert, papiers, délicatesse' },
    { nom: 'nuit et rouge profond', consigne: 'éclairage basal doux, une courbe ou un tissu, noir et rouge profond, sensualité retenue' },
  ],
};

/** Directions de secours (genre inconnu). */
const DIRECTIONS_DEFAUT: { nom: string; consigne: string }[] =
  DIRECTIONS_PAR_GENRE.fantasy;

export async function generateCoverImage(opts: {
  title: string;
  genre: string;
  resume: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY manquante (génération de couverture)');

  const resume = opts.resume ? opts.resume.slice(0, 240) : '';
  // Alias : le code de l'app est 'science_fiction'.
  const genreCle = opts.genre?.toLowerCase() === 'science-fiction' ? 'science_fiction' : opts.genre?.toLowerCase() ?? '';
  const directions = DIRECTIONS_PAR_GENRE[genreCle] ?? DIRECTIONS_DEFAUT;
  // Tirage serveur : variété par direction, jamais une formule unique.
  const direction = directions[Math.floor(Math.random() * directions.length)];

  const prompt = [
    `Conçois la couverture d'un roman publié — un VRAI objet de librairie, pas une illustration, pas une affiche.`,
    `LA COUVERTURE EST L'IMAGE ENTIÈRE : vue de FACE, à plat, plein cadre vertical 3:4, bord à bord, occupée à 100 %. AUCUN livre en perspective, aucun livre posé ou penché, aucune table, aucun sol, aucun mur ni fond autour, aucune main, aucun reflet d'étagère, aucun cadre ni liseré autour de l'image.`,
    `Titre : ${opts.title}. Genre : ${opts.genre}.`,
    resume ? `L'histoire : ${resume}` : '',
    `Direction artistique : ${direction.nom} — ${direction.consigne}. La palette de cette direction est OBLIGATOIRE : jamais de brun, jamais d'argile dominant.`,
    `Le titre sera composé séparément par l'éditeur : réserve une zone calme en haut (ou selon la direction) sans y mettre aucun texte, aucun lettrage, aucune lettre.`,
    `UN seul élément fort, le reste épuré. Lisible en miniature (l'image s'affiche à 48 px de large dans une bibliothèque).`,
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