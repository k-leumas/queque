import { spawn } from 'node:child_process';
import { closeSync, openSync } from 'node:fs';
import { createInterface } from 'node:readline';
import type { Readable, Writable } from 'node:stream';
import * as tty from 'node:tty';

import { restartDaemon } from '../../daemon/bootstrap.js';
import { listOllamaModels, type OllamaModelList } from '../../providers/ollama.js';
import {
  loadProviderPin,
  OLLAMA_DEFAULT_BASE_URL,
  type ProviderPin,
  providerPinPath,
  writeProviderPin,
} from '../../providers/provider-pin.js';
import { readEnvValueFromDotEnvLocal, usableSecret } from '../../shared/env-file.js';
import { socketPath } from '../../shared/socket-path.js';
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

/** The only URL the picker ever opens, and only after an explicit y. */
export const OLLAMA_DOWNLOAD_URL = 'https://ollama.com/download';

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

/** Invalid answers allowed per prompt before the picker gives up. */
const MAX_ATTEMPTS = 3;
const MAX_REASON = 120;

const NO_CHANGES = 'No changes made.';
const CLAUDE_AUTH_HINT =
  'If ?? says Claude is not authenticated, run `claude /login` or set ANTHROPIC_API_KEY (docs: https://code.claude.com/docs/en/authentication).';
const OPENAI_KEY_MISSING =
  'OPENAI_API_KEY is not set. Add `export OPENAI_API_KEY=...` to ~/.zshrc (before the queque source line) or put it in .env.local, open a new terminal, and run `qq init provider` again.';

/**
 * Opens the Ollama download page with the platform opener, without a shell. Spawn failures
 * are swallowed: the URL is already printed.
 */
function openDownloadUrl(url: string): void {
  if (url !== OLLAMA_DOWNLOAD_URL) {
    return;
  }
  const opener = process.platform === 'darwin' ? 'open' : 'xdg-open';
  try {
    const child = spawn(opener, [url], { stdio: 'ignore', detached: true });
    child.on('error', () => undefined);
    child.unref();
  } catch {
    // printing the URL is enough
  }
}

const defaultDeps: PickerDeps = {
  openUrl: openDownloadUrl,
  restartDaemon,
  listOllamaModels: () => listOllamaModels(),
};

/** One line, capped, for an error reason shown on the terminal. */
function shortReason(error: unknown): string {
  const code = (error as NodeJS.ErrnoException | null)?.code;
  const message = error instanceof Error ? error.message : String(error);
  const flat = (typeof code === 'string' ? code : message).replace(/\s+/g, ' ').trim();
  return flat.length > MAX_REASON ? `${flat.slice(0, MAX_REASON)}…` : flat;
}

function choiceHint(count: number): string {
  if (count === 1) {
    return 'Choose 1.';
  }
  if (count === 2) {
    return 'Choose 1 or 2.';
  }
  if (count === 3) {
    return 'Choose 1, 2, or 3.';
  }
  return `Choose a number from 1 to ${count}.`;
}

type Choice = { kind: 'choice'; value: number } | { kind: 'eof' } | { kind: 'invalid' };

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

  /** The trimmed answer, or null when the input ended (or closed) first. */
  async ask(prompt: string): Promise<string | null> {
    this.io.output.write(prompt);
    try {
      const next = await this.lines.next();
      return next.done ? null : String(next.value).trim();
    } catch {
      // A closed or aborted input is the same as end of input: nothing is written.
      return null;
    }
  }

  /** A 1-based choice where Enter picks 1; re-asks up to MAX_ATTEMPTS times. */
  async choose(prompt: string, count: number): Promise<Choice> {
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const answer = await this.ask(prompt);
      if (answer === null) {
        return { kind: 'eof' };
      }
      if (answer === '') {
        return { kind: 'choice', value: 1 };
      }
      const value = /^\d+$/.test(answer) ? Number.parseInt(answer, 10) : Number.NaN;
      if (value >= 1 && value <= count) {
        return { kind: 'choice', value };
      }
      this.say(choiceHint(count));
    }
    return { kind: 'invalid' };
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

/** Ollama is down or not Ollama: print the next step and offer (only) the download page. */
async function explainOllamaDown(prompter: Prompter, deps: PickerDeps): Promise<void> {
  prompter.say(`Ollama is not answering at ${OLLAMA_DEFAULT_BASE_URL}.`);
  prompter.say(
    `Install it from ${OLLAMA_DOWNLOAD_URL}, start it with \`ollama serve\`, then run \`qq init provider\` again.`,
  );
  const answer = await prompter.ask(`Open ${OLLAMA_DOWNLOAD_URL} in your browser? [y/N]: `);
  if (answer !== null && /^(y|yes)$/i.test(answer)) {
    deps.openUrl(OLLAMA_DOWNLOAD_URL);
  }
}

/** The chosen Ollama model, or null after printing why nothing can be pinned. */
async function pickOllamaModel(prompter: Prompter, deps: PickerDeps): Promise<string | null> {
  const listed = await deps.listOllamaModels();
  if (!listed.ok) {
    await explainOllamaDown(prompter, deps);
    return null;
  }
  const { models } = listed;
  if (models.length === 0) {
    prompter.say(
      'Ollama is running but has no models. Run `ollama pull gemma4` (or any model), then run `qq init provider` again.',
    );
    return null;
  }
  prompter.say('Installed Ollama models:');
  models.forEach((model, index) => {
    prompter.say(`  ${index + 1}. ${model}`);
  });
  const choice = await prompter.choose(`Model 1-${models.length} [1]: `, models.length);
  if (choice.kind !== 'choice') {
    prompter.say(NO_CHANGES);
    return null;
  }
  return models[choice.value - 1];
}

/** Writes the pin; on failure prints the reason and returns null (nothing changed). */
function savePin(prompter: Prompter, pin: ProviderPin): string | null {
  try {
    return writeProviderPin(pin);
  } catch (error) {
    prompter.say(`Could not save ${providerPinPath()} (${shortReason(error)}). ${NO_CHANGES}`);
    return null;
  }
}

/** After a saved pin: a fresh daemon picks up this shell's environment (keys just exported). */
async function refreshDaemon(prompter: Prompter, deps: PickerDeps): Promise<void> {
  try {
    await deps.restartDaemon(socketPath());
    prompter.say(
      'Restarted the QueQue daemon so the next ?? uses this provider and your current environment.',
    );
  } catch (error) {
    prompter.say(
      `Pin saved, but the QueQue daemon could not restart (${shortReason(error)}). Open a new terminal before the next ??.`,
    );
  }
}

/** Asks for the provider (and Ollama model), saves the pin, and returns the exit code. */
async function pickAndSave(prompter: Prompter, deps: PickerDeps): Promise<number> {
  prompter.say('QueQue provider setup');
  describeCurrent(prompter);
  PROVIDER_MENU.forEach((entry, index) => {
    prompter.say(`  ${index + 1}. ${entry.label.padEnd(7)} ${entry.hint}`);
  });

  const choice = await prompter.choose(
    `Choose 1-${PROVIDER_MENU.length} [1]: `,
    PROVIDER_MENU.length,
  );
  if (choice.kind !== 'choice') {
    prompter.say(NO_CHANGES);
    return 1;
  }

  const provider = PROVIDER_MENU[choice.value - 1].id;
  if (provider === 'claude') {
    const path = savePin(prompter, { version: 1, provider: 'claude' });
    if (path === null) {
      return 1;
    }
    prompter.say(`Saved ${path}: Claude.`);
    prompter.say(CLAUDE_AUTH_HINT);
  } else if (provider === 'openai') {
    if (!openAiKeyPresent()) {
      prompter.say(OPENAI_KEY_MISSING);
      return 1;
    }
    const path = savePin(prompter, { version: 1, provider: 'openai' });
    if (path === null) {
      return 1;
    }
    prompter.say(
      `Saved ${path}: OpenAI (default model; add "model" to provider.json to change it).`,
    );
  } else {
    const model = await pickOllamaModel(prompter, deps);
    if (model === null) {
      return 1;
    }
    const path = savePin(prompter, { version: 1, provider: 'ollama', model });
    if (path === null) {
      return 1;
    }
    prompter.say(
      `Saved ${path}: Ollama (${model}). Using a remote Ollama? Add "baseUrl" to provider.json.`,
    );
  }

  await refreshDaemon(prompter, deps);
  return 0;
}

/**
 * The interactive picker. Writes only to `io.output`; returns the exit code (0 after a
 * saved pin, even when the daemon restart fails; 1 when nothing was written).
 */
export async function runProviderPicker(
  io: PickerIo,
  deps: Partial<PickerDeps> = {},
): Promise<number> {
  const prompter = new Prompter(io);
  try {
    return await pickAndSave(prompter, { ...defaultDeps, ...deps });
  } finally {
    prompter.close();
  }
}

function endStream(stream: Writable): Promise<void> {
  return new Promise((resolve) => {
    stream.end(() => resolve());
  });
}

/** Opens /dev/tty for reading and for writing, or returns null when there is no terminal. */
function openTerminal(): { inFd: number; outFd: number } | null {
  let inFd: number | undefined;
  try {
    inFd = openSync('/dev/tty', 'r');
    return { inFd, outFd: openSync('/dev/tty', 'w') };
  } catch {
    if (inFd !== undefined) {
      closeSync(inFd);
    }
    return null;
  }
}

/**
 * `qq init provider`: runs the picker on the controlling terminal and sets process.exitCode.
 * Input and output use separate /dev/tty descriptors so each stream owns (and closes) its own.
 * Without a terminal it prints one stderr line and exits 1, writing nothing.
 */
export async function providerInitCommand(): Promise<void> {
  const terminal = openTerminal();
  if (terminal === null) {
    console.error('qq init provider needs an interactive terminal (/dev/tty).');
    process.exitCode = 1;
    return;
  }
  const input = new tty.ReadStream(terminal.inFd);
  const output = new tty.WriteStream(terminal.outFd);
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
