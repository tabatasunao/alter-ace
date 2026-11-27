# ALTER

**A**daptive **L**imbframe for **T**actical **E**ngagement and **R**econnaissance.

A top-down 2D real-time mass battle game for the browser. The player flies one ace ALTER with 100 allies against an enemy army of 300–600 that reinforces in waves. The ace aims and fires automatically; the player controls movement, the active weapon, the target priority, dash and Full Arms.

**Play:** https://tabatasunao.github.io/alter-ace/

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrow keys | Move (touch: drag anywhere on the field) |
| 1–4 | Select a weapon |
| Q / E, 5–0 | Cycle or select the aim mode |
| Shift | Dash (brief invulnerability) |
| Space | Full Arms, when its gauge is full: a burst from every weapon, then every weapon fires for 3 s |
| R | Reload |
| + / − / mouse wheel | Zoom |
| P / Esc | Pause |

These are the defaults; Options (in the hangar and the pause card) rebinds them and sets screen shake, screen flash and HUD size. In the hangar, Enter launches; any key skips the launch sequence. On the result card, Space sorties again and Esc returns to the hangar.

Languages: English, 日本語, 简体中文, 한국어, picked at the top right of the hangar.

## Documentation

- [docs/game.md](docs/game.md): how a sortie works, HUD, visual legend
- [docs/weapons.md](docs/weapons.md), [docs/units.md](docs/units.md): equipment and enemies
- [docs/mechanics.md](docs/mechanics.md): exact rules
- [docs/reference.md](docs/reference.md): every value (generated from the data)
- Contributors: [AGENTS.md](AGENTS.md), [docs/architecture.md](docs/architecture.md), [docs/data.md](docs/data.md)

Index: [docs/README.md](docs/README.md).

## Build from source

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev
```

Open http://localhost:5173. `?seed=123` fixes the deployment.

| Command | Effect |
| --- | --- |
| `npm run dev` | Dev server with hot reload, including data files |
| `npm test` | Tests (headless simulation, data, docs) |
| `npm run typecheck` | TypeScript check |
| `npm run docs` | Regenerate `docs/reference.md` from the data |
| `npm run build` | Typecheck, then production build into `dist/` |
| `npm run preview` | Serve the production build |

The game is TypeScript and the 2D canvas, bundled by [Vite](https://vite.dev/) and tested with [Vitest](https://vitest.dev/). No runtime dependencies; fonts are bundled. Tuning values are in `public/data/*.json`.

## License

Code and data: [MIT](LICENSE).

Bundled fonts, under the SIL Open Font License 1.1:

- [M PLUS 1 Code](public/licenses/OFL-MPLUS1Code.txt): Latin and Latin Extended (`src/fonts/`), and Japanese (from `@fontsource-variable/m-plus-1-code`).
- [Noto Sans SC](public/licenses/OFL-NotoSansSC.txt): Simplified Chinese (from `@fontsource-variable/noto-sans-sc`).
- [Nanum Gothic Coding](public/licenses/OFL-NanumGothicCoding.txt): Korean (from `@fontsource/nanum-gothic-coding`).
