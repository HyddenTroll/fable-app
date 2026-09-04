/**
 * Point d'entrée du test de cohérence : re-exporte les libs de l'API
 * pour être bundlé par esbuild (Node ne lit pas le TS directement).
 */
export { getLLM } from '../api/lib/llm/provider';
export {
  buildStoryBiblePrompt,
  buildProloguePrompt,
  buildChapterPrompt,
  buildChapterMessages,
  buildChoicesPrompt,
  buildSummaryPrompt,
  buildSystemPrompt,
  buildStatePrompt,
} from '../api/lib/prompts';