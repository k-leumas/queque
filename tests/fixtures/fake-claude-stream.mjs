// Fake `claude -p --input-format stream-json --output-format stream-json --verbose
// --include-partial-messages` for runner tests (Phase 09.1).
//
// A real child process that replays the event shapes recorded from Claude Code 2.1.285
// (09.1-RESEARCH Probes 2, 3, 5 and 8). The scenario is argv[2]. Like the real CLI it
// writes nothing to stdout until the first stdin line arrives, exits 0 on stdin EOF with
// no line, and rejects a first line that is not a stream-json user message.
//
// Env:
//   FAKE_CLAUDE_STDIN_FILE  write the stdin text received (rewritten on every chunk)
//   FAKE_CLAUDE_ARGV_FILE   write JSON of the argv received after the scenario name
//
// New scenarios slot into SCENARIOS without touching the existing ones.
import { writeFileSync } from 'node:fs';

const scenarioName = process.argv[2] ?? 'success';
const SESSION_ID = '00000000-0000-4000-8000-000000000000';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function writeLine(event) {
  process.stdout.write(`${JSON.stringify(event)}\n`);
}

/** Writes one event line with its bytes split inside `splitChar`, `gapMs` apart. */
async function writeLineSplitInside(event, splitChar, gapMs) {
  const bytes = Buffer.from(`${JSON.stringify(event)}\n`, 'utf8');
  const charBytes = Buffer.from(splitChar, 'utf8');
  const at = bytes.indexOf(charBytes);
  if (at === -1 || charBytes.length < 2) {
    process.stdout.write(bytes);
    return;
  }
  const cut = at + 1;
  process.stdout.write(bytes.subarray(0, cut));
  await sleep(gapMs);
  process.stdout.write(bytes.subarray(cut));
}

function initEvent() {
  return {
    type: 'system',
    subtype: 'init',
    cwd: process.cwd(),
    session_id: SESSION_ID,
    tools: [],
    mcp_servers: [],
    model: 'claude-opus-5-5',
    permissionMode: 'default',
    apiKeySource: 'none',
    claude_code_version: '2.1.285',
  };
}

function streamEvent(event) {
  return { type: 'stream_event', event, session_id: SESSION_ID, parent_tool_use_id: null };
}

function textDelta(text) {
  return streamEvent({
    type: 'content_block_delta',
    index: 0,
    delta: { type: 'text_delta', text },
  });
}

function assistantMessage(text, extra = {}) {
  return {
    type: 'assistant',
    message: {
      model: 'claude-opus-5-5',
      role: 'assistant',
      content: [{ type: 'text', text }],
    },
    session_id: SESSION_ID,
    ...extra,
  };
}

const SUCCESS_ANSWER = JSON.stringify([
  { command: 'tldr z3', explanation: 'Show concise usage examples for z3' },
  { command: 'z3 -smt2 <file>', explanation: 'ⓘ Solve an SMT-LIB2 file with z3' },
]);

/** Splits the answer into delta fragments; ⓘ is never cut across two fragments. */
function successFragments() {
  const size = Math.ceil(SUCCESS_ANSWER.length / 6);
  const fragments = [];
  for (let start = 0; start < SUCCESS_ANSWER.length; start += size) {
    fragments.push(SUCCESS_ANSWER.slice(start, start + size));
  }
  return fragments;
}

const SCENARIOS = {
  async success() {
    writeLine(initEvent());
    writeLine({ type: 'system', subtype: 'status', status: 'requesting', session_id: SESSION_ID });
    writeLine(
      streamEvent({
        type: 'message_start',
        message: { model: 'claude-opus-5-5', role: 'assistant', content: [] },
      }),
    );
    writeLine(
      streamEvent({
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' },
      }),
    );
    for (const fragment of successFragments()) {
      await sleep(20);
      if (fragment.includes('ⓘ')) {
        // The stdout bytes of ⓘ (U+24D8, 3 bytes in UTF-8) go out in two writes.
        await writeLineSplitInside(textDelta(fragment), 'ⓘ', 20);
      } else {
        writeLine(textDelta(fragment));
      }
    }
    writeLine(assistantMessage(SUCCESS_ANSWER));
    writeLine(streamEvent({ type: 'content_block_stop', index: 0 }));
    writeLine(streamEvent({ type: 'message_delta', delta: { stop_reason: 'end_turn' } }));
    writeLine(streamEvent({ type: 'message_stop' }));
    writeLine({ type: 'rate_limit_event', session_id: SESSION_ID });
    writeLine({
      type: 'result',
      subtype: 'success',
      is_error: false,
      duration_ms: 3458,
      duration_api_ms: 3397,
      num_turns: 1,
      stop_reason: 'end_turn',
      terminal_reason: 'completed',
      result: SUCCESS_ANSWER,
      session_id: SESSION_ID,
    });
    await sleep(300);
    process.exit(0);
  },

  async auth() {
    // Probe 3: the auth failure result is subtype "success" with is_error true; exit 1.
    writeLine(initEvent());
    writeLine(
      assistantMessage('Not logged in · Please run /login', {
        error: 'authentication_failed',
        is_api_error_message: true,
      }),
    );
    writeLine({
      type: 'result',
      subtype: 'success',
      is_error: true,
      terminal_reason: 'api_error',
      api_error_status: null,
      duration_api_ms: 0,
      result: 'Not logged in · Please run /login',
      session_id: SESSION_ID,
    });
    await sleep(50);
    process.exit(1);
  },

  async 'sigterm-slow'() {
    // Probe 8: Claude Code catches SIGTERM, keeps streaming for a while, then exits with
    // code 143 and a null signal.
    process.on('SIGTERM', () => {
      setTimeout(() => process.exit(143), 300);
    });
    writeLine(initEvent());
    let n = 0;
    const timer = setInterval(() => {
      n += 1;
      writeLine(textDelta(`chunk-${n} `));
    }, 100);
    await sleep(10_000);
    clearInterval(timer);
    writeLine({ type: 'result', subtype: 'success', is_error: false, result: '[]' });
    process.exit(0);
  },
};

function isUserLine(line) {
  try {
    const event = JSON.parse(line);
    return event?.type === 'user' && event?.message?.role === 'user';
  } catch {
    return false;
  }
}

if (process.env.FAKE_CLAUDE_ARGV_FILE) {
  writeFileSync(process.env.FAKE_CLAUDE_ARGV_FILE, JSON.stringify(process.argv.slice(3)));
}

const scenario = SCENARIOS[scenarioName];
if (!scenario) {
  process.stderr.write(`fake-claude-stream: unknown scenario ${scenarioName}\n`);
  process.exit(2);
}

let received = '';
let started = false;
process.stdin.setEncoding('utf8');
process.stdin.on('data', (chunk) => {
  received += chunk;
  if (process.env.FAKE_CLAUDE_STDIN_FILE) {
    writeFileSync(process.env.FAKE_CLAUDE_STDIN_FILE, received);
  }
  const nl = received.indexOf('\n');
  if (started || nl === -1) {
    return;
  }
  started = true;
  if (!isUserLine(received.slice(0, nl))) {
    process.stderr.write(
      'Error: Input must be provided either through stdin or as a prompt argument when using --print\n',
    );
    process.exit(1);
  }
  void scenario();
});
process.stdin.on('end', () => {
  if (!started) {
    // Idle retire: EOF on stdin with no message is a clean exit (Probe 5).
    process.exit(0);
  }
});
