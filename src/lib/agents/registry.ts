import type { ConversationRow, AgentType } from "@/lib/supabase/types";
import { runFeedbackTurn } from "@/lib/agents/feedback/agent";
import { runInfoTurn } from "@/lib/agents/info/agent";
import { runIntakeTurn } from "@/lib/agents/intake/agent";

export type { AgentType };

export interface AgentRunInput {
  conversation: ConversationRow;
  userText: string;
}

export interface AgentRunResult {
  /** Texto a enviar al cliente. Cadena vacia = no responder en este turno. */
  reply: string;
}

export type AgentHandler = (input: AgentRunInput) => Promise<AgentRunResult>;

/**
 * Registro de agentes. Para agregar un nuevo agente:
 *
 *   1. Crear `src/lib/agents/<nombre>/{agent.ts, tools.ts, prompt.ts, types.ts, state.ts}`
 *      con un export `runXxxTurn: AgentHandler`.
 *   2. Agregar la entrada aqui.
 *   3. Ampliar el CHECK constraint de `conversations.agent_type` con una migracion
 *      y actualizar el type `AgentType` en `src/lib/supabase/types.ts`.
 *
 * El router de conversacion (`src/lib/conversation/router.ts`) consulta este
 * registro para despachar cada turno al agente correcto sin tocar codigo.
 */
export const agentRegistry: Record<AgentType, AgentHandler> = {
  feedback: runFeedbackTurn,
  info: runInfoTurn,
  intake: runIntakeTurn,
};

export function dispatchAgent(agentType: string): AgentHandler {
  const handler = agentRegistry[agentType as AgentType];
  if (!handler) {
    throw new Error(`unknown agent_type: ${agentType}`);
  }
  return handler;
}
