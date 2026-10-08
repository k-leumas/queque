import { describe, expect, it } from 'vitest';
import {
  type ContextEnvelope,
  contextChunkSchema,
  contextEnvelopeSchema,
  strictInstalledToolsChunkSchema,
} from '../src/contracts/request.js';
import { buildSteeringText, buildSystemPrompt, QUEQUE_SYSTEM } from '../src/providers/steering.js';
import {
  CATALOG,
  CATALOG_SET,
  INSTALLED_TOOLS_MAX,
  installedCatalogTools,
  TOOL_NAME_MAX_LENGTH,
  TOOL_NAME_RE,
} from '../src/shared/tool-catalog.js';

function buildEnvelope(extras: ContextEnvelope['extras'] = []): ContextEnvelope {
  return {
    base: {
      queryText: 'find big files',
      cwd: '/repo',
      ttyPath: '/dev/tty',
      shellPid: 1234,
      shellName: 'zsh',
      platform: 'darwin',
      timestamp: '2026-10-08T00:00:00.000Z',
    },
    extras,
  };
}

function toolsChunk(tools: string[]): ContextEnvelope['extras'][number] {
  return { kind: 'installed-tools', payload: { tools } };
}

describe('catalog', () => {
  it('has 196 unique names seeded from spike 003', () => {
    expect(CATALOG).toHaveLength(196);
    expect(new Set(CATALOG).size).toBe(196);
    expect(CATALOG_SET.size).toBe(196);
  });

  it('only holds plain tool names within the structural caps', () => {
    for (const name of CATALOG) {
      expect(name).toMatch(TOOL_NAME_RE);
      expect(name.length).toBeLessThanOrEqual(TOOL_NAME_MAX_LENGTH);
    }
    expect(CATALOG.length).toBeLessThanOrEqual(INSTALLED_TOOLS_MAX);
    expect(INSTALLED_TOOLS_MAX).toBe(512);
    expect(TOOL_NAME_MAX_LENGTH).toBe(64);
  });

  it('includes notable tools and omits basic POSIX utilities', () => {
    for (const name of ['rg', 'fd', 'fzf', 'jq', 'nvm', 'z']) {
      expect(CATALOG_SET.has(name)).toBe(true);
    }
    for (const name of ['ls', 'grep', 'find', 'sed', 'awk', 'du']) {
      expect(CATALOG_SET.has(name)).toBe(false);
    }
  });

  it('is frozen', () => {
    expect(Object.isFrozen(CATALOG)).toBe(true);
  });

  it('installedCatalogTools keeps catalog members only, sorted', () => {
    expect(installedCatalogTools((name) => ['rg', 'fd', 'qqprivate'].includes(name))).toEqual([
      'fd',
      'rg',
    ]);
  });
});

describe('installed-tools chunk schema', () => {
  describe('lenient daemon-side variant (contextChunkSchema)', () => {
    it('parses catalog names unchanged', () => {
      const parsed = contextChunkSchema.parse(toolsChunk(['fd', 'rg']));
      expect(parsed).toEqual({ kind: 'installed-tools', payload: { tools: ['fd', 'rg'] } });
    });

    it('filters unknown names and duplicates instead of rejecting (catalog drift)', () => {
      const result = contextChunkSchema.safeParse(toolsChunk(['fd', 'qqfuturetool', 'fd']));
      expect(result.success).toBe(true);
      expect(result.data).toEqual({ kind: 'installed-tools', payload: { tools: ['fd'] } });
    });

    it.each([
      ['a shell command', 'rm -rf ~'],
      ['a path', '../x'],
      ['a 65-character name', 'a'.repeat(65)],
    ])('rejects %s', (_label, name) => {
      expect(contextChunkSchema.safeParse(toolsChunk(['fd', name])).success).toBe(false);
    });

    it('rejects more than 512 entries', () => {
      const tools = Array.from({ length: 513 }, () => 'fd');
      expect(contextChunkSchema.safeParse(toolsChunk(tools)).success).toBe(false);
    });

    it('filters through contextEnvelopeSchema (the ipcRequestSchema path)', () => {
      const result = contextEnvelopeSchema.safeParse(
        buildEnvelope([toolsChunk(['fd', 'qqfuturetool'])]),
      );
      expect(result.success).toBe(true);
      const chunk = result.data?.extras[0];
      expect(chunk?.kind).toBe('installed-tools');
      if (chunk?.kind === 'installed-tools') {
        expect(chunk.payload.tools).toEqual(['fd']);
      }
    });
  });

  describe('strict client-side schema', () => {
    it('accepts catalog names', () => {
      expect(strictInstalledToolsChunkSchema.safeParse(toolsChunk(['fd', 'rg'])).success).toBe(
        true,
      );
    });

    it('rejects a non-catalog name with the D-04 message', () => {
      const result = strictInstalledToolsChunkSchema.safeParse(toolsChunk(['fd', 'qqprivate']));
      expect(result.success).toBe(false);
      expect(result.error?.issues.map((issue) => issue.message)).toContain(
        'installed-tools may only carry curated catalog names (D-04)',
      );
    });

    it('rejects more entries than the catalog holds', () => {
      const tools = [...CATALOG, 'rg'];
      expect(strictInstalledToolsChunkSchema.safeParse(toolsChunk(tools)).success).toBe(false);
    });

    it('rejects a malformed name', () => {
      expect(strictInstalledToolsChunkSchema.safeParse(toolsChunk(['rm -rf ~'])).success).toBe(
        false,
      );
    });
  });
});

describe('buildSystemPrompt', () => {
  it('returns the system constant byte-for-byte without an installed-tools chunk', () => {
    expect(buildSystemPrompt(buildEnvelope())).toBe(QUEQUE_SYSTEM);
    expect(
      buildSystemPrompt(
        buildEnvelope([{ kind: 'filesystem', payload: { cwd: '/repo', apparentFilename: null } }]),
      ),
    ).toBe(QUEQUE_SYSTEM);
  });

  it('appends the D-15/D-16/D-17 steering after a blank line when the chunk is present', () => {
    const system = buildSystemPrompt(buildEnvelope([toolsChunk(['fd', 'rg'])]));
    expect(system.startsWith(`${QUEQUE_SYSTEM}\n\n`)).toBe(true);
    const steering = system.slice(QUEQUE_SYSTEM.length + 2);
    expect(steering).toContain('fd rg');
    expect(steering).toContain('standard system utilities are also present');
    expect(steering).toContain('Prefer installed tools');
    expect(steering).toContain('At least one candidate must use only installed tools');
    expect(steering).toContain('Never include install steps');
  });

  it('still emits the rules with a no-notable-tools sentence for an empty list', () => {
    const system = buildSystemPrompt(buildEnvelope([toolsChunk([])]));
    expect(system.startsWith(`${QUEQUE_SYSTEM}\n\n`)).toBe(true);
    expect(system).toContain('No notable command-line tools from the QueQue catalog were found');
    expect(system).toContain('Prefer installed tools');
    expect(system).toContain('At least one candidate must use only installed tools');
    expect(system).toContain('Never include install steps');
  });

  it('never carries a non-catalog name even if one slips into the envelope', () => {
    const system = buildSystemPrompt(buildEnvelope([toolsChunk(['rg', 'qqprivate'])]));
    expect(system).toContain('rg');
    expect(system).not.toContain('qqprivate');
  });
});

describe('buildSteeringText', () => {
  it('re-filters to the catalog and dedupes', () => {
    const text = buildSteeringText(['rg', 'qqprivate', 'rg']);
    expect(text).not.toContain('qqprivate');
    expect(text.match(/\brg\b/g)).toHaveLength(1);
  });

  it('sorts the tool list', () => {
    expect(buildSteeringText(['rg', 'fd', 'bat'])).toContain(': bat fd rg.');
  });

  it('is four lines: tools, preference, installed-only candidate, no install steps', () => {
    const lines = buildSteeringText(['fd']).split('\n');
    expect(lines).toEqual([
      'Notable command-line tools installed on this machine (standard system utilities are also present): fd.',
      'Prefer installed tools. A tool that is not installed is acceptable only when it is clearly better for the task.',
      'At least one candidate must use only installed tools or standard system utilities.',
      'Never include install steps in a candidate: no brew, apt, dnf or pacman install commands and no curl-to-shell installers.',
    ]);
  });
});
