# ALTER

**A**daptive **L**imbframe for **T**actical **E**ngagement and **R**econnaissance.

A top-down 2D real-time mass battle game for the browser. The player flies one ace ALTER with 100 allies against an enemy army of 300–600 that reinforces in waves. The ace aims and fires automatically; the player controls movement, the active hardpoint, the target priority, dash, tools and super release.

**Play:** https://tabatasunao.github.io/alter-ace/

## Controls

| Key | Action |
| --- | --- |
| W A S D / arrow keys | Move (touch: drag anywhere on the field) |
| 1–4 | Select a weapon, or fire a tool |
| Q / E, 5–0 | Cycle or select the aim mode |
| Shift | Dash (brief invulnerability) |
| Space | Super release, when its gauge is full: a burst from every weapon, then every weapon fires and every tool runs its release effect for 3 s |
| R | Reload |
| + / − / mouse wheel | Zoom |
| P / Esc | Pause |

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

Bundled fonts: [Chakra Petch](public/licenses/OFL-ChakraPetch.txt), [IBM Plex Sans](public/licenses/OFL-IBMPlexSans.txt) and [IBM Plex Mono](public/licenses/OFL-IBMPlexMono.txt), under the SIL Open Font License 1.1. The font files are in `src/fonts/`.
