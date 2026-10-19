import { beforeEach, describe, expect, it, vi } from 'vitest';
import { commandCandidateSchema } from '../src/contracts/candidates.js';
import { SDK_MAX_TOKENS, TRUNCATED_RESPONSE_MESSAGE } from '../src/providers/claude.js';
import { abortError, isAbortError } from '../src/providers/provider.js';
import {
  CANDIDATE_LIST_JSON_SCHEMA,
  candidatesWithCutOffRetry,
  MAX_OUTPUT_TOKENS,
  type ModelTurn,
  WRAPPED_CANDIDATE_LIST_JSON_SCHEMA,
} from '../src/providers/structured-output.js';

const { appendDebugLogMock } = vi.hoisted(() => ({
  appendDebugLogMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../src/shared/debug-log.js', () => ({
  appendDebugLog: appendDebugLogMock,
}));

const LS = { command: 'ls -la', explanation: 'List files' };
const PWD = { command: 'pwd', explanation: 'Print directory' };
const LIST_JSON = JSON.stringify([LS]);
const CLOSED_THEN_CUT = `[${JSON.stringify(LS)},{"command":"rm -`;

function turn(content: string, finishedNormally: boolean): ModelTurn {
  return { content, finishedNormally };
}

beforeEach(() => {
  appendDebugLogMock.mockClear();
});

describe('candidate list JSON schema', () => {
  it('mirrors the candidate contract exactly', () => {
    const schema = CANDIDATE_LIST_JSON_SCHEMA;
    expect(schema.type).toBe('array');
    expect(schema.minItems).toBe(1);
    expect(schema.maxItems).toBe(5);
    expect(schema.items.type).toBe('object');
    expect(schema.items.additionalProperties).toBe(false);
    const contractKeys = Object.keys(commandCandidateSchema.shape).sort();
    expect(Object.keys(schema.items.properties).sort()).toEqual(contractKeys);
    expect([...schema.items.required].sort()).toEqual(contractKeys);
    for (const property of Object.values(schema.items.properties)) {
      expect(property.type).toBe('string');
    }
    expect(schema.items.properties.command.minLength).toBe(1);
  });

  it('wraps the list under a required candidates key with an object root', () => {
    const schema = WRAPPED_CANDIDATE_LIST_JSON_SCHEMA;
    expect(schema.type).toBe('object');
    expect(schema.required).toEqual(['candidates']);
    expect(schema.additionalProperties).toBe(false);
    expect(schema.properties.candidates).toEqual(CANDIDATE_LIST_JSON_SCHEMA);
  });

  it('caps output at the Claude SDK ceiling', () => {
    expect(MAX_OUTPUT_TOKENS).toBe(SDK_MAX_TOKENS);
    expect(MAX_OUTPUT_TOKENS).toBe(16_000);
  });
});

describe('candidatesWithCutOffRetry', () => {
  it('(a) returns a normally finished turn without retrying', async () => {
    const retry = vi.fn<() => Promise<ModelTurn>>();

    await expect(candidatesWithCutOffRetry(turn(LIST_JSON, true), retry)).resolves.toEqual([LS]);
    expect(retry).not.toHaveBeenCalled();
  });

  it.each([
    ['a bare array', LIST_JSON],
    ['a candidates object', JSON.stringify({ candidates: [LS] })],
  ])('(b) returns a complete list in a non-stop turn (%s) without retrying', async (_name, text) => {
    const retry = vi.fn<() => Promise<ModelTurn>>();

    await expect(candidatesWithCutOffRetry(turn(text, false), retry)).resolves.toEqual([LS]);
    expect(retry).not.toHaveBeenCalled();
  });

  it('(c) retries a cut-off turn exactly once and returns the retry list', async () => {
    const retry = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValue(turn(JSON.stringify({ candidates: [PWD] }), true));

    await expect(
      candidatesWithCutOffRetry(turn('[{"command":"rm -', false), retry, { model: 'm' }),
    ).resolves.toEqual([PWD]);
    expect(retry).toHaveBeenCalledTimes(1);
    const retryLines = appendDebugLogMock.mock.calls.filter(
      (call) => call[1] === 'response cut off, retrying once',
    );
    expect(retryLines).toEqual([['provider', 'response cut off, retrying once', { model: 'm' }]]);
  });

  it('(d) rejects with TRUNCATED when the retry is cut off too and nothing closed', async () => {
    const retry = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValue(turn('[{"command":"rm -rf', false));

    await expect(
      candidatesWithCutOffRetry(turn('[{"command":"rm -', false), retry),
    ).rejects.toThrow(TRUNCATED_RESPONSE_MESSAGE);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('(e) keeps the first turn closed candidates when the retry fails', async () => {
    const retry = vi.fn<() => Promise<ModelTurn>>().mockRejectedValue(new Error('HTTP 500'));

    await expect(candidatesWithCutOffRetry(turn(CLOSED_THEN_CUT, false), retry)).resolves.toEqual([
      LS,
    ]);
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('(f) rethrows a user abort during the retry', async () => {
    const retry = vi.fn<() => Promise<ModelTurn>>().mockRejectedValue(abortError());

    const error = await candidatesWithCutOffRetry(turn(CLOSED_THEN_CUT, false), retry).catch(
      (caught: unknown) => caught,
    );

    expect(isAbortError(error)).toBe(true);
  });

  it('(g) keeps the first turn closed candidates when the retry is prose only', async () => {
    const retry = vi
      .fn<() => Promise<ModelTurn>>()
      .mockResolvedValue(turn('You can use ls.', true));

    await expect(candidatesWithCutOffRetry(turn(CLOSED_THEN_CUT, false), retry)).resolves.toEqual([
      LS,
    ]);
  });

  it('(h) treats an array inside unclosed thinking as cut off, never the draft', async () => {
    const draft = '<think>Maybe [{"command":"git reset --hard","explanation":"draft"}] hmm';
    const retry = vi.fn<() => Promise<ModelTurn>>().mockResolvedValue(turn('[{"command"', false));

    const error = await candidatesWithCutOffRetry(turn(draft, false), retry).catch(
      (caught: unknown) => caught,
    );

    expect(retry).toHaveBeenCalledTimes(1);
    expect((error as Error).message).toBe(TRUNCATED_RESPONSE_MESSAGE);
  });

  it('(i) reports a retry that ran out of the budget as cut off, not a timeout (IN-17)', async () => {
    const retry = vi
      .fn<() => Promise<ModelTurn>>()
      .mockRejectedValue(new Error('QueQue: Ollama did not answer within 25s'));

    await expect(
      candidatesWithCutOffRetry(turn('[{"command":"rm -', false), retry, {}, AbortSignal.abort()),
    ).rejects.toThrow(TRUNCATED_RESPONSE_MESSAGE);
  });

  it('(j) keeps a retry error that is not a budget timeout (IN-17)', async () => {
    const live = new AbortController().signal;
    const retry = vi.fn<() => Promise<ModelTurn>>().mockRejectedValue(new Error('HTTP 500'));

    await expect(
      candidatesWithCutOffRetry(turn('[{"command":"rm -', false), retry, {}, live),
    ).rejects.toThrow('HTTP 500');
  });

  it('(k) still rethrows a user abort after the budget fired (IN-17)', async () => {
    const retry = vi.fn<() => Promise<ModelTurn>>().mockRejectedValue(abortError());

    const error = await candidatesWithCutOffRetry(
      turn('[{"command":"rm -', false),
      retry,
      {},
      AbortSignal.abort(),
    ).catch((caught: unknown) => caught);

    expect(isAbortError(error)).toBe(true);
  });
});
