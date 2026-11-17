// Sable Harbor: Night Run — the program that hands the game in (Node 22, standard
// library only). The game itself is this directory's game/ folder: plain static
// files a desktop browser loads fully offline (game/index.html plus its ES
// modules, no library, no network request). This program copies game/ and
// screenshots/ from beside this file to the output directory and writes
// dossier.json there with buildDossier from the vendored make.fun library —
// the summary the judge reads, byte-identical to what the scorer rebuilds.
//
// Play it locally with `node serve.ts`, then open http://localhost:8080.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps: at most 4 screenshots of 256 KiB each, at most 993
// files and 48 MiB under game/, and no game path over 1000 bytes — an entry
// past any of these is one the scorer would refuse, so the dossier says so.
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
