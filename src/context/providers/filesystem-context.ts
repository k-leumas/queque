import type { ContextChunk } from '../../contracts/request.js';
import type { ContextProvider, GatherContextInput } from '../provider.js';

const FILENAME_RE = /\b[\w.-]+\.\w{2,6}\b/g;

export const filesystemContextProvider: ContextProvider = {
  id: 'filesystem-context',
  intents: ['filesystem'],
  async gather(input: GatherContextInput): Promise<ContextChunk> {
    const match = input.base.queryText.match(FILENAME_RE);

    return {
      kind: 'filesystem',
      payload: {
        cwd: input.base.cwd,
        apparentFilename: match?.[0] ?? null,
      },
    };
  },
};
