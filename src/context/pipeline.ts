import type { ContextEnvelope, NormalizedRequest } from '../contracts/request.js';
import { classifyIntent } from '../intent/router.js';
import { appendDebugLog } from '../shared/debug-log.js';
import { buildBaseContext } from './base-context.js';
import { filesystemContextProvider } from './providers/filesystem-context.js';
import { gitContextProvider } from './providers/git-context.js';

const BUILTIN_PROVIDERS = [gitContextProvider, filesystemContextProvider];

export async function gatherContext(request: NormalizedRequest): Promise<ContextEnvelope> {
  void appendDebugLog('context', 'pipeline start', {
    lbuffer: request.lbuffer,
    intent: request.intent,
  });

  const base = buildBaseContext(request);
  const decision = classifyIntent(request);

  void appendDebugLog('context', 'intent decision', {
    intent: decision.intent,
    signals: decision.signals,
  });

  const extras: ContextEnvelope['extras'] = [];

  for (const provider of BUILTIN_PROVIDERS) {
    const supportsAllIntents = provider.intents.includes('*');
    const supportsIntent = provider.intents.includes(decision.intent);

    if (!supportsAllIntents && !supportsIntent) {
      continue;
    }

    try {
      const chunk = await provider.gather({ base, decision });
      if (chunk !== null) {
        extras.push(chunk);
        void appendDebugLog('context', 'provider chunk gathered', {
          providerId: provider.id,
          kind: chunk.kind,
        });
      }
    } catch (error) {
      void appendDebugLog('context', 'provider error', {
        providerId: provider.id,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const envelope: ContextEnvelope = { base, extras };

  void appendDebugLog('context', 'envelope assembled', { extraCount: extras.length });

  return envelope;
}
