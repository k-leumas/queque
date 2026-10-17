import { closeSync, openSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import * as tty from 'node:tty';

import { restartDaemon } from '../../daemon/bootstrap.js';
import { listOllamaModels, type OllamaModelList } from '../../providers/ollama.js';
import {
  loadProviderPin,
  type ProviderPin,
  writeProviderPin,
} from '../../providers/provider-pin.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../../shared/env-file.js';
import { initCommand } from './init.js';

// `qq init provider` (D-04, D-05, D-14, D-15): the one opt-in place that asks which backend
// to use. It runs only when the user types it: never from `qq init zsh`, the ?? widget,
// the foreground client, or the daemon, so a working Claude user never sees it (D-03).
// Every line goes to the terminal stream it is given (/dev/tty), never to process.stdout,
// so `qq init provider >> ~/.zshrc` cannot write into an rc file.

/** The ask-once menu, in D-04 order. The order is the prompt, not a probe chain. */
export const PROVIDER_MENU = [
  {
    id: 'claude',
    label: 'Claude',
    hint: 'Claude Code (`claude /login`) or ANTHROPIC_API_KEY',
  },
  { id: 'openai', label: 'OpenAI', hint: 'uses OPENAI_API_KEY' },
  { id: 'ollama', label: 'Ollama', hint: 'local models on this machine' },
] as const satisfies readonly {
  id: ProviderPin['provider'];
  label: string;
  hint: string;
}[];

export interface PickerIo {
  input: Readable;
  output: Writable;
}

export interface PickerDeps {
  /** Opens a URL in the browser; only ever called with OLLAMA_DOWNLOAD_URL after a y. */
  openUrl: (url: string) => void;
  /** Restarts the qq daemon so it inherits this process's environment. */
  restartDaemon: (socketPath: string) => Promise<void>;
  /** Lists local Ollama models (one GET /api/tags, 2s budget). */
  listOllamaModels: () => Promise<OllamaModelList>;
}

const NO_CHANGES = 'No changes made.';
const CLAUDE_AUTH_HINT =
  'If ?? says Claude is not authenticated, run `claude /login` or set ANTHROPIC_API_KEY (docs: https://code.claude.com/docs/en/authentication).';
const OPENAI_KEY_MISSING =
  'OPENAI_API_KEY is not set. Add `export OPENAI_API_KEY=...` to ~/.zshrc (before the queque source line) or put it in .env.local, open a new terminal, and run `qq init provider` again.';

export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

const defaultDeps: PickerDeps = {
  openUrl: () => {
    throw new Error('openUrl: not implemented');
  },
  restartDaemon,
  listOllamaModels: () => listOllamaModels(),
};

/**
 * Line-at-a-time prompts over the given streams. The readline async iterator buffers lines,
 * so an answer typed (or pasted) before its prompt is printed is not lost.
 */
class Prompter {
  private readonly rl;
  private readonly lines: AsyncIterator<string>;

  constructor(private readonly io: PickerIo) {
    this.rl = createInterface({
      input: io.input,
      terminal: false,
      crlfDelay: Number.POSITIVE_INFINITY,
    });
    this.lines = this.rl[Symbol.asyncIterator]();
  }

  say(line: string): void {
    this.io.output.write(`${line}\n`);
  }

  /** The trimmed answer, or null when the input ended first. */
  async ask(prompt: string): Promise<string | null> {
    this.io.output.write(prompt);
    const next = await this.lines.next();
    return next.done ? null : String(next.value).trim();
  }

  /** A 1-based choice where Enter picks 1, or null on end of input or an invalid answer. */
  async choose(prompt: string, count: number): Promise<number | null> {
    const answer = await this.ask(prompt);
    if (answer === null) {
      return null;
    }
    if (answer === '') {
      return 1;
    }
    const choice = /^\d+$/.test(answer) ? Number.parseInt(answer, 10) : Number.NaN;
    return choice >= 1 && choice <= count ? choice : null;
  }

  close(): void {
    this.rl.close();
  }
}

function describeCurrent(prompter: Prompter): void {
  const state = loadProviderPin();
  if (state.kind === 'pinned') {
    const { pin } = state;
    const model = 'model' in pin && pin.model ? ` (${pin.model})` : '';
    prompter.say(`Current: ${pin.provider}${model}`);
  } else if (state.kind === 'invalid') {
    prompter.say('Current provider.json is invalid; your choice below replaces it.');
  }
}

function openAiKeyPresent(): boolean {
  // Presence only: the value is never printed, logged, prompted for, or stored.
  return (
    (usableSecret(process.env.OPENAI_API_KEY) ??
      usableSecret(readEnvValueFromDotEnvLocal('OPENAI_API_KEY'))) !== undefined
  );
}

async function pickOllamaModel(prompter: Prompter, deps: PickerDeps): Promise<string | null> {
  const listed = await deps.listOllamaModels();
  if (!listed.ok || listed.models.length === 0) {
    return null;
  }
  const { models } = listed;
  prompter.say('Installed Ollama models:');
  models.forEach((model, index) => {
    prompter.say(`  ${index + 1}. ${model}`);
  });
  const choice = await prompter.choose(`Model 1-${models.length} [1]: `, models.length);
  return choice === null ? null : models[choice - 1];
}

/**
 * The interactive picker. Writes only to `io.output`; returns the exit code (0 after a
 * saved pin, 1 when nothing was written).
 */
export async function runProviderPicker(
  io: PickerIo,
  deps: Partial<PickerDeps> = {},
): Promise<number> {
  const resolved: PickerDeps = { ...defaultDeps, ...deps };
  const prompter = new Prompter(io);
  try {
    prompter.say('QueQue provider setup');
    describeCurrent(prompter);
    PROVIDER_MENU.forEach((entry, index) => {
      prompter.say(`  ${index + 1}. ${entry.label.padEnd(7)} ${entry.hint}`);
    });

    const choice = await prompter.choose(
      `Choose 1-${PROVIDER_MENU.length} [1]: `,
      PROVIDER_MENU.length,
    );
    if (choice === null) {
      prompter.say(NO_CHANGES);
      return 1;
    }

    const provider = PROVIDER_MENU[choice - 1].id;
    if (provider === 'claude') {
      const path = writeProviderPin({ version: 1, provider: 'claude' });
      prompter.say(`Saved ${path}: Claude.`);
      prompter.say(CLAUDE_AUTH_HINT);
      return 0;
    }

    if (provider === 'openai') {
      if (!openAiKeyPresent()) {
        prompter.say(OPENAI_KEY_MISSING);
        return 1;
      }
      const path = writeProviderPin({ version: 1, provider: 'openai' });
      prompter.say(
        `Saved ${path}: OpenAI (default model; add "model" to provider.json to change it).`,
      );
      return 0;
    }

    const model = await pickOllamaModel(prompter, resolved);
    if (model === null) {
      prompter.say(NO_CHANGES);
      return 1;
    }
    const path = writeProviderPin({ version: 1, provider: 'ollama', model });
    prompter.say(
      `Saved ${path}: Ollama (${model}). Using a remote Ollama? Add "baseUrl" to provider.json.`,
    );
    return 0;
  } finally {
    prompter.close();
  }
}

function endStream(stream: Writable): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

/**
 * `qq init provider`: runs the picker on the controlling terminal and sets process.exitCode.
 * Input and output use separate /dev/tty descriptors so each stream owns (and closes) its own.
 */
export async function providerInitCommand(): Promise<void> {
  const inFd = openSync('/dev/tty', 'r');
  let outFd: number;
  try {
    outFd = openSync('/dev/tty', 'w');
  } catch (error) {
    closeSync(inFd);
    throw error;
  }
  const input = new tty.ReadStream(inFd);
  const output = new tty.WriteStream(outFd);
  try {
    process.exitCode = await runProviderPicker({ input, output });
  } finally {
    input.destroy();
    await endStream(output);
    output.destroy();
  }
}

export interface InitHandlers {
  provider: () => Promise<void>;
  shell: (shell: string) => void;
}

/**
 * The `qq init <shell>` dispatcher (D-05): only the literal `provider` reaches the picker;
 * every other value (`zsh`, unsupported shells) goes to initCommand unchanged.
 */
export async function dispatchInit(
  shell: string,
  handlers: InitHandlers = { provider: providerInitCommand, shell: initCommand },
): Promise<void> {
  if (shell === 'provider') {
    await handlers.provider();
    return;
  }
  handlers.shell(shell);
}
