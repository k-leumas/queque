import { execSync } from 'child_process';
import { config } from 'dotenv';
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { syncProviderIcons } from './sync-provider-icons.mjs';

config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const src = path.join(root, 'project-files');
const dist = path.join(root, 'dist');

const isWatch = process.argv.includes('--watch');

const staticFiles = [
  ['manifest.json', 'manifest.json'],
  ['domains.json', 'domains.json'],
  ['icons/icon.svg', 'icons/icon.svg'],
  ['icons/icon-16.png', 'icons/icon-16.png'],
  ['icons/icon-32.png', 'icons/icon-32.png'],
  ['icons/icon-48.png', 'icons/icon-48.png'],
  ['icons/icon-128.png', 'icons/icon-128.png'],
  ['src/options.html', 'src/options.html'],
  ['src/options.css', 'src/options.css'],
  ['src/collections.html', 'src/collections.html'],
  ['src/collections.css', 'src/collections.css'],
  ['src/welcome.html', 'src/welcome.html'],
  ['src/welcome.css', 'src/welcome.css'],
  ['src/bookmark-card.css', 'src/bookmark-card.css'],
  ['src/content.css', 'src/content.css'],
];

function copyDirectoryContents(srcDir, destDir) {
  if (!fs.existsSync(srcDir)) return;
  fs.mkdirSync(destDir, { recursive: true });
  for (const entry of fs.readdirSync(srcDir, { withFileTypes: true })) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      copyDirectoryContents(srcPath, destPath);
    } else {
      fs.mkdirSync(path.dirname(destPath), { recursive: true });
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

function copyStaticFiles() {
  for (const [srcRel, destRel] of staticFiles) {
    const destPath = path.join(dist, destRel);
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    fs.copyFileSync(path.join(src, srcRel), destPath);
  }
  copyDirectoryContents(
    path.join(src, 'icons', 'providers'),
    path.join(dist, 'icons', 'providers'),
  );
  copyDirectoryContents(path.join(src, 'src', 'assets'), path.join(dist, 'src', 'assets'));
}

async function finalizeStaticAssets() {
  await syncProviderIcons(src);
  copyStaticFiles();
}

function getBuildSha() {
  try {
    const sha = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { encoding: 'utf8' }).trim();
    return dirty ? `${sha}*` : sha;
  } catch {
    return '';
  }
}

const buildOptions = {
  entryPoints: {
    'src/background': path.join(src, 'src/background.js'),
    'src/content': path.join(src, 'src/content.js'),
    'src/options': path.join(src, 'src/options.js'),
    'src/collections': path.join(src, 'src/collections.js'),
    'src/welcome': path.join(src, 'src/welcome.js'),
  },
  bundle: true,
  minify: true,
  outdir: dist,
  format: 'iife',
  platform: 'browser',
  define: {
    __POSTHOG_TOKEN__: JSON.stringify(process.env.POSTHOG_PROJECT_TOKEN ?? ''),
    __BUILD_SHA__: JSON.stringify(getBuildSha()),
  },
};

if (isWatch) {
  const ctx = await esbuild.context({
    ...buildOptions,
    plugins: [
      {
        name: 'copy-static',
        setup(build) {
          build.onStart(() => {
            build.initialOptions.define.__BUILD_SHA__ = JSON.stringify(getBuildSha());
          });
          build.onEnd(() => copyStaticFiles());
        },
      },
    ],
  });
  await finalizeStaticAssets();
  await ctx.watch();
  console.log('Watching for changes…');
} else {
  await esbuild.build(buildOptions);
  await finalizeStaticAssets();
  console.log('Build complete → dist/');
}
