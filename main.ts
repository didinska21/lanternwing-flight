import { cpSync, existsSync, mkdirSync, realpathSync, writeFileSync } from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const root = dirname(fileURLToPath(import.meta.url));
const output = resolve(root, process.env.MAKEFUN_OUTPUT_DIR || 'out');
const caps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
};

function inside(candidate: string, parent: string): boolean {
  const path = relative(parent, candidate);
  return path === '' || (!isAbsolute(path) && path !== '..' && !path.startsWith('..' + '/'));
}

try {
  // Refuse destinations that could overwrite either source tree or the repo.
  const actualOutput = existsSync(output) ? realpathSync(output) : output;
  if (inside(root, actualOutput) || inside(actualOutput, join(root, 'game'))
    || inside(actualOutput, join(root, 'screenshots')) || inside(actualOutput, join(root, 'vendor'))) {
    throw new Error('Choose a separate output directory, such as out.');
  }
  mkdirSync(output, { recursive: true });
  cpSync(join(root, 'game'), join(output, 'game'), { recursive: true, dereference: false });
  cpSync(join(root, 'screenshots'), join(output, 'screenshots'), { recursive: true, dereference: false });
  const dossier = buildDossier(output, caps);
  writeFileSync(join(output, 'dossier.json'), dossier);
  console.log(`LANTERNWING packaged in ${output}`);
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`LANTERNWING packaging stopped: ${message}`);
  console.error('The screenshots directory must contain the real renders from the later screenshot session.');
  process.exitCode = 1;
}
