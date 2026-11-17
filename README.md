# Sable Harbor: Night Run

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/amber-owl-65/sable-harbor-night-run/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/amber-owl-65/sable-harbor-night-run/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

An original open-world crime game that runs in a desktop browser — no build
step, no network requests, no assets: every file it loads lives under `game/`.

You are a runner in Sable Harbor, a neon port city of seven-by-five blocks.
Explore it on foot and by car, steal rides, run Mara's five jobs — a first
steal, a package run, losing the harbor watch, a trail of dead drops, and a
75-second dash for the last ferry — while traffic flows, pedestrians scatter,
and the watch answers every crime with a rising wanted level.

## Play

```sh
node serve.ts          # then open http://localhost:8080
```

Any static file server pointed at `game/` works just as well.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrow keys | Move on foot, steer and drive |
| Shift | Run |
| E | Enter / exit a car (walk up to one first) |
| Mouse | Aim |
| Mouse click | Punch, or shoot with the pistol drawn |
| 1 / 2 or mouse wheel | Fists / pistol |
| Esc or P | Pause |
| F5 | Save (progress also saves after every mission) |
| M | Mute |

## What's in the game

- A living city: 24 traffic cars following right-hand lanes and turning at
  intersections, parked cars to steal, 40+ pedestrians who stroll, flee and
  fall, neon shop signs, a park, and a working dock with water and crates.
- A wanted system: stealing, crashing, fighting and shooting raise your
  stars; the harbor watch responds with foot patrols and pursuit cars that
  shoot at three stars and bust you at two or fewer if they corner you.
  Break line of sight for six seconds and a star fades.
- Combat with fists and a pistol, health, WASTED and BUSTED states with
  hospital and station respawns.
- Five story missions with markers, an objective line, a mission timer, cash
  rewards, and a free-roam city once the story is done.
- A HUD with health, cash, weapon and wanted stars, an off-screen objective
  arrow, and a live minimap with police and objective blips.
- Synthesized sound — engine, siren, gunshots, crashes and mission stings —
  generated with WebAudio; there are no audio files.
- Saving to `localStorage`: continue from the title screen after any mission.

## Layout

- `game/` — the game itself (static files, ES modules, zero dependencies).
- `main.ts` — the hand-in program: copies `game/` and `screenshots/` to the
  output directory and writes `dossier.json` with the vendored library.
- `screenshots/` — real renders of the game in a browser (title, on foot,
  driving, and a four-star chase); the first is the cover.
- `serve.ts` — a tiny static server for local play.
- `vendor/makefun-game.ts` — the make.fun dossier library, unchanged.

Everything — city, names, story, art, code and sound — is original to this
repository. No third-party game assets, names or material are used.

## License

MIT — see `LICENSE`.
