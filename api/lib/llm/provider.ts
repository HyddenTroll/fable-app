/**
 * Couche d'abstraction LLM.
 * Décision (docs/2-analyse-strategique/choix-fournisseur-ia.txt) :
 * - CHAPITRES & RÉSUMÉS -> GPT-5.6 Luna (coût/volume, 0,20 $/1,20 $)
 * - BIBLE, PROLOGUE, FIN -> Sonnet 5 (qualité FR) si clé Anthropic dispo
 * Streaming natif + prompt caching + coûts calculés.
 */

import OpenAI from 'openai';

export type PromptKind =
  | 'story_bible'
  | 'prologue'
  | 'chapter'
  | 'ending'
  | 'summary'
  | 'choices';

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMRequest {
  messages: LLMMessage[];
  kind: PromptKind;
  stream?: boolean;
  maxTokens?: number;
  /** tokens à mettre en cache (préfixe stable : système + bible) */
  cachedPrefixTokens?: number;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  cachedInputTokens: number;
}

export interface LLMResult {
  text: string;
  provider: string;
  model: string;
  usage: LLMUsage;
  /** coût estimé en USD */
  costUsd: number;
}

/** Tarifs $ / 1M tokens (entrée, sortie, cache) - sept. 2026 */
const PRICES: Record<string, { input: number; output: number; cachedInput: number }> = {
  'gpt-5.6-luna': { input: 0.2, output: 1.2, cachedInput: 0.02 },
  'claude-sonnet-5': { input: 2, output: 10, cachedInput: 0.2 },
};

function costFor(model: string, usage: LLMUsage): number {
  const p = PRICES[model] ?? { input: 2, output: 10, cachedInput: 0.2 };
  return (
    ((usage.inputTokens - usage.cachedInputTokens) * p.input +
      usage.cachedInputTokens * p.cachedInput +
      usage.outputTokens * p.output) /
    1_000_000
  );
}

/** Modèle par type de prompt. */
const MODEL_BY_KIND: Record<PromptKind, { openai: string; anthropic: string }> = {
  story_bible: { openai: 'gpt-5.6-luna', anthropic: 'claude-sonnet-5' },
  prologue: { openai: 'gpt-5.6-luna', anthropic: 'claude-sonnet-5' },
  chapter: { openai: 'gpt-5.6-luna', anthropic: 'gpt-5.6-luna' },
  ending: { openai: 'gpt-5.6-luna', anthropic: 'claude-sonnet-5' },
  summary: { openai: 'gpt-5.6-luna', anthropic: 'gpt-5.6-luna' },
  choices: { openai: 'gpt-5.6-luna', anthropic: 'gpt-5.6-luna' },
};

export class LLM {
  private openai: OpenAI | null = null;
  private provider: 'openai' | 'anthropic' | null = null;

  constructor() {
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      this.provider = 'openai';
    } else if (process.env.ANTHROPIC_API_KEY) {
      this.provider = 'anthropic';
    } else {
      throw new Error('Aucune clé LLM configurée (OPENAI_API_KEY ou ANTHROPIC_API_KEY)');
    }
  }

  /** Fournisseur réellement utilisé. */
  get activeProvider(): 'openai' | 'anthropic' {
    return this.provider ?? 'openai';
  }

  private modelFor(kind: PromptKind): string {
    const m = MODEL_BY_KIND[kind];
    return this.provider === 'anthropic' ? m.anthropic : m.openai;
  }

  async generate(req: LLMRequest): Promise<LLMResult> {
    if (this.provider === 'anthropic') {
      return this.generateAnthropic(req);
    }
    return this.generateOpenAI(req);
  }

  /**
   * Génère puis parse un JSON, avec 2 nouvelles tentatives si l'IA
   * produit du JSON cassé (fiabilité ~100 %, tolère l'intermittence).
   */
  async generateJson<T>(req: LLMRequest): Promise<{ result: LLMResult; json: T }> {
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      if (attempt > 0) {
        await new Promise((r) => setTimeout(r, 500 * attempt));
      }
      const result = await this.generate({ ...req, maxTokens: req.maxTokens ?? 3000 });
      try {
        const json = JSON.parse(extractJson(result.text)) as T;
        return { result, json };
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError instanceof Error ? lastError : new Error('Réponse IA sans JSON valide');
  }

  /**
   * Streaming (SSE). Itérateur de chunks texte ; la valeur de retour
   * du générateur contient le LLMResult final (usage/coût).
   */
  async *stream(req: LLMRequest): AsyncGenerator<string, LLMResult, unknown> {
    const inner = this.provider === 'anthropic'
      ? this.streamAnthropic(req)
      : this.streamOpenAI(req);
    let result: LLMResult = {
      text: '',
      provider: this.provider!,
      model: this.modelFor(req.kind),
      usage: { inputTokens: 0, outputTokens: 0, cachedInputTokens: 0 },
      costUsd: 0,
    };
    for (;;) {
      const { value, done } = await inner.next();
      if (done) {
        result = (value ?? result) as LLMResult;
        return result;
      }
      yield value;
    }
  }

  // ------------------------------------------------------------------
  // OpenAI (GPT-5.6 Luna)
  // ------------------------------------------------------------------

  private async generateOpenAI(req: LLMRequest): Promise<LLMResult> {
    const client = this.openai!;
    const model = this.modelFor(req.kind);
    const userContent = req.messages.map((m) => m.content).join(' ');
    const wantsJson = /JSON/i.test(userContent);
    const res = await client.chat.completions.create({
      model,
      max_completion_tokens: req.maxTokens ?? 2048,
      messages: req.messages,
      stream: false,
      // Force un JSON valide quand le prompt le demande (Luna produit sinon du JSON cassé)
      ...(wantsJson ? { response_format: { type: 'json_object' } as const } : {}),
    });

    const usage: LLMUsage = {
      inputTokens: res.usage?.prompt_tokens ?? 0,
      outputTokens: res.usage?.completion_tokens ?? 0,
      cachedInputTokens: res.usage?.prompt_tokens_details?.cached_tokens ?? 0,
    };

    return {
      text: res.choices[0]?.message?.content ?? '',
      provider: this.provider!,
      model,
      usage,
      costUsd: costFor(model, usage),
    };
  }

  private async *streamOpenAI(req: LLMRequest): AsyncGenerator<string, LLMResult, unknown> {
    const client = this.openai!;
    const model = this.modelFor(req.kind);
    const stream = await client.chat.completions.create({
      model,
      max_completion_tokens: req.maxTokens ?? 2048,
      messages: req.messages,
      stream: true,
      stream_options: { include_usage: true },
    });

    let inputTokens = 0;
    let outputTokens = 0;
    let cachedInputTokens = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
      if (chunk.usage) {
        inputTokens = chunk.usage.prompt_tokens;
        outputTokens = chunk.usage.completion_tokens;
        cachedInputTokens = chunk.usage.prompt_tokens_details?.cached_tokens ?? 0;
      }
    }

    const usage: LLMUsage = { inputTokens, outputTokens, cachedInputTokens };
    return {
      text: '',
      provider: this.provider!,
      model,
      usage,
      costUsd: costFor(model, usage),
    };
  }

  // ------------------------------------------------------------------
  // Anthropic (Sonnet 5) - fallback qualité
  // ------------------------------------------------------------------

  private async generateAnthropic(req: LLMRequest): Promise<LLMResult> {
    // Import dynamique pour ne pas charger le SDK si inutilisé côté Vercel
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY! });
    const model = this.modelFor(req.kind);

    const res = await client.messages.create({
      model,
      max_tokens: req.maxTokens ?? 2048,
      system: req.messages.find((m) => m.role === 'system')?.content,
      messages: req.messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content })),
    });

    const text = res.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('');

    const usage: LLMUsage = {
      inputTokens: res.usage.input_tokens,
      outputTokens: res.usage.output_tokens,
      cachedInputTokens: res.usage.cache_read_input_tokens ?? 0,
    };

    return {
      text,
      provider: 'anthropic',
      model,
      usage,
      costUsd: costFor(model, usage),
    };
  }

  private async *streamAnthropic(req: LLMRequest): AsyncGenerator<string, LLMResult, unknown> {
    const result = await this.generateAnthropic(req);
    yield result.text;
    return result;
  }
}

/** Instance partagée (créée paresseusement). */
let llm: LLM | null = null;
export function getLLM(): LLM {
  if (!llm) llm = new LLM();
  return llm;
}

/** Extrait le premier objet JSON d'une réponse LLM (robuste au texte parasite). */
function extractJson(text: string): string {
  const start = text.indexOf('{');
  if (start === -1) throw new Error('Réponse IA sans JSON valide');
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = start; i < text.length; i++) {
    const c = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (c === '\\') escaped = true;
      else if (c === '"') inString = false;
      continue;
    }
    if (c === '"') inString = true;
    else if (c === '{') depth++;
    else if (c === '}') {
      depth--;
      if (depth === 0) return text.slice(start, i + 1);
    }
  }
  throw new Error('Réponse IA sans JSON valide');
}