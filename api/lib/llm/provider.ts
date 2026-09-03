/**
 * Couche d'abstraction LLM - permet de basculer entre fournisseurs
 * sans toucher au code métier.
 * Référence : docs/2-analyse-strategique/choix-fournisseur-ia.txt
 *
 * Mapping décidé :
 * - STORY_BIBLE & PROLOGUE  -> Claude Sonnet 5 (qualité)
 * - CHAPITRE & RESUME       -> GPT-5.6 Luna (coût / volume)
 * - FIN / CLIMAX            -> Claude Sonnet 5 / Opus (le meilleur)
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';

export type PromptKind =
  | 'story_bible'
  | 'prologue'
  | 'chapter'
  | 'ending'
  | 'summary';

export interface LLMRequest {
  prompt: string;
  kind: PromptKind;
  /** demander un flux (streaming machine à écrire) */
  stream?: boolean;
  /** longueur max en tokens de sortie */
  maxTokens?: number;
}

export interface LLMResult {
  text: string;
  provider: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

/** Interface commune que chaque fournisseur implémente */
export interface LLMProvider {
  name: string;
  generate(request: LLMRequest): Promise<LLMResult>;
}

// ---------------------------------------------------------------------------
// Implémentations
// ---------------------------------------------------------------------------

export class AnthropicProvider implements LLMProvider {
  name = 'anthropic';
  private client: Anthropic;

  constructor() {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY manquante');
    this.client = new Anthropic({ apiKey: key });
  }

  async generate(request: LLMRequest): Promise<LLMResult> {
    // Le modèle est choisi par le router (Sonnet 5 par défaut)
    const model = MODEL_BY_KIND[request.kind].anthropic;
    const res = await this.client.messages.create({
      model,
      max_tokens: request.maxTokens ?? 2048,
      messages: [{ role: 'user', content: request.prompt }],
    });

    const text = res.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('');

    return {
      text,
      provider: this.name,
      model,
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
    };
  }
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai';
  private client: OpenAI;

  constructor() {
    const key = process.env.OPENAI_API_KEY;
    if (!key) throw new Error('OPENAI_API_KEY manquante');
    this.client = new OpenAI({ apiKey: key });
  }

  async generate(request: LLMRequest): Promise<LLMResult> {
    // GPT-5.6 Luna = le modèle budget par défaut (remplace nano/mini)
    const model = MODEL_BY_KIND[request.kind].openai ?? 'gpt-5.6-luna';
    const res = await this.client.chat.completions.create({
      model,
      max_tokens: request.maxTokens ?? 2048,
      messages: [{ role: 'user', content: request.prompt }],
      stream: false,
    });

    return {
      text: res.choices[0]?.message?.content ?? '',
      provider: this.name,
      model,
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
    };
  }
}

// ---------------------------------------------------------------------------
// Router : choisit le fournisseur selon le type de prompt
// ---------------------------------------------------------------------------

interface ModelMapping {
  anthropic: string;
  openai?: string;
}

/** Décisions docs/2-analyse-strategique/choix-fournisseur-ia.txt */
const MODEL_BY_KIND: Record<PromptKind, ModelMapping> = {
  story_bible: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.6-luna' },
  prologue: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.6-luna' },
  chapter: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.6-luna' },
  ending: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.6-luna' },
  summary: { anthropic: 'claude-sonnet-5', openai: 'gpt-5.6-luna' },
};

/**
 * Stratégie par défaut :
 * - Sonnet 5 si la clé Anthropic est dispo (meilleure qualité FR)
 * - Sinon GPT-5.6 Luna (fallback budget)
 * La variable d'env FABLE_LLM_PROVIDER force un fournisseur.
 */
export function createRouter(): LLMProvider {
  const forced = process.env.FABLE_LLM_PROVIDER;
  if (forced === 'openai') return new OpenAIProvider();
  if (forced === 'anthropic') return new AnthropicProvider();
  // Défaut : Anthropic si dispo, sinon OpenAI
  if (process.env.ANTHROPIC_API_KEY) return new AnthropicProvider();
  if (process.env.OPENAI_API_KEY) return new OpenAIProvider();
  throw new Error('Aucune clé LLM configurée (ANTHROPIC ou OPENAI)');
}