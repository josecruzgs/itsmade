import Anthropic from "@anthropic-ai/sdk";
import { env } from "@/lib/env";

let cached: Anthropic | null = null;

/**
 * Cliente singleton del SDK de Anthropic. Compartido por todos los agentes.
 */
export function anthropic(): Anthropic {
  if (cached) return cached;
  cached = new Anthropic({ apiKey: env().ANTHROPIC_API_KEY });
  return cached;
}

/**
 * Modelos por agente. Cada agente puede leer su propio env override
 * (ej: ANTHROPIC_FEEDBACK_MODEL) o caer al default global ANTHROPIC_MODEL.
 *
 * Para agregar un agente nuevo, agrega aqui su entrada:
 *
 *   support: () => process.env.ANTHROPIC_SUPPORT_MODEL ?? env().ANTHROPIC_MODEL,
 */
export const MODELS = {
  feedback: () => env().ANTHROPIC_MODEL,
} as const;

export function resetAnthropicCache(): void {
  cached = null;
}
