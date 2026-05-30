import * as fs from 'node:fs';
import { cac } from 'cac';
import { bootstrapBuiltins } from '../registry/bootstrap.js';
import { clientCommand } from './commands/client.js';
import { daemonCommand } from './commands/daemon.js';
import { initCommand } from './commands/init.js';

type ClientOptions = {
  requestFile?: string;
  resultFile?: string;
  resultMode?: string;
};

type DaemonOptions = {
  socket?: string;
  ensure?: boolean;
};

function requiredOption(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required option: ${name}`);
  }

  return value;
}

// ---------------------------------------------------------------------------
// Top-level error handlers — FIFO safety net (RUN-02 Pitfall 3)
//
// These handlers fire when an error escapes the async main() chain entirely
// (e.g. a synchronous throw from Ink internals or a void async call that
// rejects after the Promise resolves). Without them a crash would leave the
// zsh widget blocking on the FIFO read for up to 30 seconds.
//
// Both handlers:
//   1. Read the FIFO path from process.env.QQ_RESULT_FILE (exported by the
//      zsh widget before zellij run, so it is always available in the env).
//   2. Write {"kind":"cancel"}\n to that path using synchronous writeFileSync
//      (writeShellResult is async-unsafe inside an exception handler).
//   3. Call process.exit(1) unconditionally — the exit prevents re-entry.
//
// Security note (T-04-03-01): QQ_RESULT_FILE is set by the trusted zsh widget
// (mktemp -d /tmp/qq-sess.XXXXXX), so we validate the path before writing to
// prevent an attacker-controlled env var from redirecting writes to arbitrary files.
// ---------------------------------------------------------------------------

// Matches paths created by: mktemp -d /tmp/qq-sess.XXXXXX
const QQ_RESULT_FILE_PATTERN = /^\/tmp\/qq-sess\.[A-Za-z0-9]+\//;

process.on('uncaughtException', (err: Error) => {
  console.error('QueQue: uncaught exception:', err.message);
  const resultFile = process.env.QQ_RESULT_FILE;
  if (resultFile && QQ_RESULT_FILE_PATTERN.test(resultFile)) {
    try {
      fs.writeFileSync(resultFile, '{"kind":"cancel"}\n');
    } catch {
      // Ignore write failures (FIFO reader may already be gone)
    }
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason: unknown) => {
  const message = reason instanceof Error ? reason.message : String(reason);
  console.error('QueQue: unhandled rejection:', message);
  const resultFile = process.env.QQ_RESULT_FILE;
  if (resultFile && QQ_RESULT_FILE_PATTERN.test(resultFile)) {
    try {
      fs.writeFileSync(resultFile, '{"kind":"cancel"}\n');
    } catch {
      // Ignore write failures (FIFO reader may already be gone)
    }
  }
  process.exit(1);
});

export async function main(argv = process.argv.slice(2)): Promise<void> {
  bootstrapBuiltins();
  const cli = cac('qq');

  cli
    .command('client')
    .option('--request-file <path>', 'Path to the serialized shell request')
    .option('--result-file <path>', 'Path to write the serialized shell result')
    .option('--result-mode <mode>', 'Result mode: llm | cancel | replace-buffer-fixture')
    .action(async (options: ClientOptions) => {
      const requestFile = requiredOption('--request-file', options.requestFile);
      const resultFile = requiredOption('--result-file', options.resultFile);

      await clientCommand({ requestFile, resultFile, resultMode: options.resultMode });
    });

  cli
    .command(
      'init <shell>',
      'Print shell integration script (add `eval "$(qq init zsh)"` to ~/.zshrc)',
    )
    .action((shell: string) => {
      initCommand(shell);
    });

  cli
    .command('daemon')
    .option('--socket <path>', 'Unix socket path for the daemon')
    .option('--ensure', 'Ensure the daemon is running before returning')
    .action(async (options: DaemonOptions) => {
      await daemonCommand(options);
    });

  cli.help();
  cli.parse(['node', 'qq', ...argv], { run: false });

  await cli.runMatchedCommand();
}

const isDirectRun = process.argv[1]
  ? import.meta.url === new URL(`file://${process.argv[1]}`).href
  : false;

if (isDirectRun) {
  void main().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exitCode = 1;
  });
}
