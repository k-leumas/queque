import { cac } from 'cac';
import { daemonCommand } from './commands/daemon.js';

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

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const cli = cac('qq');

  cli
    .command('client')
    .option('--request-file <path>', 'Path to the serialized shell request')
    .option('--result-file <path>', 'Path to write the serialized shell result')
    .option(
      '--result-mode <mode>',
      'Deterministic result mode: cancel | replace-buffer-fixture',
    )
    .action(async (options: ClientOptions) => {
      const requestFile = requiredOption('--request-file', options.requestFile);
      const resultFile = requiredOption('--result-file', options.resultFile);

      const { clientCommand } = await import('./commands/client.js');
      await clientCommand({ requestFile, resultFile, resultMode: options.resultMode });
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
