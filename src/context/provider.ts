import type {
  BaseContext,
  ContextChunk,
  IntentDecision,
  RequestIntent,
} from '../contracts/request.js';

/**
 * Input passed to every context provider's gather function.
 */
export interface GatherContextInput {
  base: BaseContext;
  decision: IntentDecision;
}

/**
 * A context provider gathers extra context relevant to a specific set of intents.
 * Built-in providers register through the context-providers registry in Phase 2.
 * Use ['*'] to run a provider unconditionally.
 */
export interface ContextProvider {
  id: string;
  intents: Array<RequestIntent | '*'>;
  gather(input: GatherContextInput): Promise<ContextChunk | null>;
}
