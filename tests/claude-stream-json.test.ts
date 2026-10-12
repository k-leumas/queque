import { StringDecoder } from 'node:string_decoder';
import { describe, expect, it, vi } from 'vitest';
import {
  createLineParser,
  isInitEvent,
  STREAM_JSON_CARRY_CAP_BYTES,
  textDeltaOf,
} from '../src/providers/stream-json.js';

// Pure parser tests (Phase 09.1, D-04): whole lines only, UTF-8 intact across chunk
// splits, noise skipped, and a bounded carry. Event shapes follow 09.1-RESEARCH Probe 2.

function textDeltaLine(text: string): string {
  return `${JSON.stringify({
    type: 'stream_event',
    event: { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } },
  })}\n`;
}

function collect(options?: Parameters<typeof createLineParser>[1]): {
  feed: (chunk: string) => void;
  events: unknown[];
} {
  const events: unknown[] = [];
  const feed = createLineParser((event) => {
    events.push(event);
  }, options);
  return { feed, events };
}

describe('createLineParser', () => {
  it('joins a line split across three chunks into one event', () => {
    const { feed, events } = collect();
    const line = `${JSON.stringify({ type: 'system', subtype: 'init', session_id: 's' })}\n`;
    const a = Math.floor(line.length / 3);
    const b = Math.floor((2 * line.length) / 3);

    feed(line.slice(0, a));
    feed(line.slice(a, b));
    expect(events).toEqual([]);
    feed(line.slice(b));

    expect(events).toEqual([{ type: 'system', subtype: 'init', session_id: 's' }]);
  });

  it('emits two lines in one chunk as two events, in order', () => {
    const { feed, events } = collect();

    feed(`${JSON.stringify({ n: 1 })}\n${JSON.stringify({ n: 2 })}\n`);

    expect(events).toEqual([{ n: 1 }, { n: 2 }]);
  });

  it('skips blank lines and non-JSON lines', () => {
    const { feed, events } = collect();

    feed(`\n   \nWarning: something\n${JSON.stringify({ n: 1 })}\n\r\n{not json\n`);

    expect(events).toEqual([{ n: 1 }]);
  });

  it('keeps a multi-byte character intact when its bytes are split across two Buffers', () => {
    const { feed, events } = collect();
    const decoder = new StringDecoder('utf8');
    const bytes = Buffer.from(textDeltaLine('ⓘ Solve an SMT-LIB2 file'), 'utf8');
    const at = bytes.indexOf(Buffer.from('ⓘ', 'utf8'));
    expect(at).toBeGreaterThan(-1);

    // Cut inside the 3-byte sequence, as the runner's setEncoding('utf8') decoder sees it.
    feed(decoder.write(bytes.subarray(0, at + 1)));
    feed(decoder.write(bytes.subarray(at + 1)));

    expect(events).toHaveLength(1);
    expect(textDeltaOf(events[0])).toBe('ⓘ Solve an SMT-LIB2 file');
  });

  it('calls onOverflow once when the carry passes maxCarryBytes and ignores later input', () => {
    const onOverflow = vi.fn();
    const { feed, events } = collect({ maxCarryBytes: 64, onOverflow });

    feed('x'.repeat(40));
    expect(onOverflow).not.toHaveBeenCalled();
    feed('y'.repeat(40));
    expect(onOverflow).toHaveBeenCalledTimes(1);

    feed(`\n${JSON.stringify({ n: 1 })}\n`);
    feed('z'.repeat(200));

    expect(onOverflow).toHaveBeenCalledTimes(1);
    expect(events).toEqual([]);
  });

  it('counts multi-byte characters by their UTF-8 bytes toward the cap', () => {
    const onOverflow = vi.fn();
    const { feed } = collect({ maxCarryBytes: 30, onOverflow });

    // 12 characters, 36 bytes: over a 30-byte cap although under 30 characters.
    feed('ⓘ'.repeat(12));

    expect(onOverflow).toHaveBeenCalledTimes(1);
  });

  it('does not overflow when complete lines keep the carry under the cap', () => {
    const onOverflow = vi.fn();
    const { feed, events } = collect({ maxCarryBytes: 64, onOverflow });

    for (let n = 0; n < 50; n += 1) {
      feed(`${JSON.stringify({ n })}\n`);
    }

    expect(onOverflow).not.toHaveBeenCalled();
    expect(events).toHaveLength(50);
  });

  it('defaults the cap to STREAM_JSON_CARRY_CAP_BYTES', () => {
    expect(STREAM_JSON_CARRY_CAP_BYTES).toBe(1024 * 1024);
    const onOverflow = vi.fn();
    const { feed } = collect({ onOverflow });

    feed('a'.repeat(STREAM_JSON_CARRY_CAP_BYTES));
    expect(onOverflow).not.toHaveBeenCalled();
    feed('a');

    expect(onOverflow).toHaveBeenCalledTimes(1);
  });
});

describe('textDeltaOf', () => {
  it('returns the text of a text_delta stream event only', () => {
    expect(textDeltaOf(JSON.parse(textDeltaLine('ls -la')))).toBe('ls -la');
    expect(
      textDeltaOf({
        type: 'stream_event',
        event: { type: 'message_start', message: { role: 'assistant', content: [] } },
      }),
    ).toBeUndefined();
    expect(
      textDeltaOf({
        type: 'stream_event',
        event: {
          type: 'content_block_delta',
          index: 0,
          delta: { type: 'input_json_delta', partial_json: '{}' },
        },
      }),
    ).toBeUndefined();
    expect(
      textDeltaOf({
        type: 'assistant',
        message: { role: 'assistant', content: [{ type: 'text', text: 'ls' }] },
      }),
    ).toBeUndefined();
    expect(textDeltaOf({ type: 'result', is_error: false, result: '[]' })).toBeUndefined();
    expect(textDeltaOf(null)).toBeUndefined();
    expect(textDeltaOf('text')).toBeUndefined();
  });
});

describe('isInitEvent', () => {
  it('matches only the system init event', () => {
    expect(isInitEvent({ type: 'system', subtype: 'init', session_id: 's' })).toBe(true);
    expect(isInitEvent({ type: 'system', subtype: 'status', status: 'requesting' })).toBe(false);
    expect(isInitEvent({ type: 'result', subtype: 'init' })).toBe(false);
    expect(isInitEvent(null)).toBe(false);
  });
});
