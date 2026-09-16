# Petal Kingdom

A flower-matching shooter for children, themed around unicorns, flowers and
princesses. Bubble-shooter rules, but you fire flowers into a hanging garden.

Built for **iPad (9.7"–13")** and **desktop (13"–24")**.

## Running it

Double-click `index.html`. That is the whole install — no build step, no server,
no dependencies.

For the full experience (offline play and home-screen install) serve the folder
over HTTP instead. Service workers do not run from `file://`:

```
cd flower-shooter
python3 -m http.server 8000
```

Then open `http://localhost:8000/`. On iPad, Safari → Share → **Add to Home
Screen** installs it as a fullscreen app.

## Public build

- Play: <https://veeranuchlee.github.io/flower-shooter/>
- Repository: <https://github.com/VeeranuchLee/flower-shooter>

The public repository is a clean runtime export; this OneDrive folder remains
the source of truth. Future local changes must be published explicitly.

## Modes

- **Classic** — the original 12-garden game. Clear the board while rows descend
  every few shots. Existing v1 progress migrates here automatically.
- **Arcade** — 8 short challenges with score, pop, drop or clear objectives and
  a visible shot cap.
- **Puzzle** — 8 hand-authored fixed maps. Rows never descend; clear each map
  within its limited shot budget.

Each mode stores its own unlocked stage and stars. Puzzle also remembers the
best number of shots remaining. Sound and sparkle settings remain shared.

## Playing

- **Aim** — move the mouse, or touch and drag. A dotted line previews the
  flight path including wall bounces, with a ring on the landing spot.
- **Shoot** — click, or lift your finger. On a tablet a simple tap both aims and
  fires in one motion.
- **Match** — land three or more of the same flower touching each other and they
  bloom away. Anything left hanging with no path to the top falls too, and
  scores more.
- **Swap** — the ⇄ button (or `S`) exchanges the flower you are holding for the
  next one.
- **Keyboard** — `←` `→` aim, `Shift` for fine aim, `Space` shoots, `S` swaps.

In Classic, clear the whole garden before it grows past the dotted line. The ivy
band turns rose and pulses when the garden is one shot away from growing. Arcade
and Puzzle show their current objective in the HUD.

**Rainbow flowers** appear occasionally from garden 4 onward and take on
whichever neighbouring colour clears the most.

All stages award up to three stars based on efficiency. Progress is saved in the
browser and survives closing/reopening it unless site data is cleared.

## Accessibility and comfort

- Every flower has a **distinct silhouette as well as a distinct colour** —
  petal count and shape differ, so they are tellable apart without colour vision.
- **Calm mode** on the title screen reduces sparkle and particle counts.
- **Sound** can be turned off from either the title screen or the game HUD. All
  audio is synthesised in the browser; there are no audio files.
- `prefers-reduced-motion` is respected for all UI animation.
- Full keyboard control, ARIA labels throughout, 44 px minimum touch targets.

## Files

| File | What it is |
|---|---|
| `index.html` | Screens, HUD, overlay markup |
| `app.js` | Everything: grid, physics, matching, rendering, UI |
| `styles.css` | Chrome around the canvas; the playfield is drawn, not styled |
| `manifest.webmanifest` | PWA install config |
| `service-worker.js` | Offline cache |
| `ASSET-PLAN.md` | Spec for the optional generated artwork |
| `background-demo.html` | Owner-only all-mode/all-stage/three-device visual review page |
| `assets/art/` | Three installed realm backgrounds plus optional character/reward slots |
| `assets/icons/` | Optional home-screen icons (empty) |

## Artwork

The interactive playfield pieces remain **entirely code-drawn** — flowers,
petals, sparkles and shooter — so they stay crisp at any screen size. Three
illustrated mode backgrounds are installed: Secret Garden for Classic, Dawn
Kingdom for Arcade, and Golden Greenhouse for Puzzle. If an image cannot load,
the original code-drawn garden appears automatically.

The remaining optional generated-art slots cover the helper unicorn's three
moods, the win banner, title card, and optional castle layer. Drop a
correctly-named PNG into `assets/art/` and it replaces its fallback on the next
load; leave it out and nothing breaks.
Full specification in `ASSET-PLAN.md`.

## Notes for future turns

- `CONFIG` at the top of `app.js` holds the tuning knobs: `cols` (playfield
  width in cells), `speed`, `dropEvery` pressure, `snapTolerance`.
- `LEVELS`, `ARCADE_LEVELS` and `PUZZLE_LEVELS` hold the three stage sets.
  Classic/Arcade use `patternWants()`; Puzzle maps use letter-coded fixed rows.
- Adding a flower type means one entry in `FLOWERS` plus, if you want a new
  silhouette, one case in `petalPath()`. Give it a genuinely distinct shape, not
  just a new colour.
- The grid is an offset hex layout. `neighbourCells()` encodes the adjacency and
  `parity` tracks whether the top row is flush or half-shifted, so pushing a new
  ceiling row never moves an existing flower sideways. If you touch either, the
  turn record's verification harness checks neighbour symmetry and geometry.
- Bump `CACHE_NAME` in `service-worker.js` whenever app files change, or
  installed copies will keep serving the old version.
