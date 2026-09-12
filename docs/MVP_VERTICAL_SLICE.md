# SHADOW REQUIEM MVP Vertical Slice

## Implementation order status

The master development prompt requires incremental development. This document records what is implemented now and what remains TODO.

| Order | System | MVP status |
|---:|---|---|
| 1 | Project setup | Done — Vite/TypeScript/Three.js project created |
| 2 | Android configuration | Done — Capacitor Android project and CI workflow |
| 3 | Player movement | Done — joystick and keyboard movement |
| 4 | Camera | Done — third-person over-the-shoulder follow camera |
| 5 | Basic combat | Done — sword attack with hit feedback |
| 6 | Enemy AI | Done — melee, ranged, tank, mini-boss, boss logic |
| 7 | Dodge | Done — invulnerable dash and perfect-dodge reward window |
| 8 | Skills | Done — Shadow Step, Umbral Bloom, Nocturne Barrier |
| 9 | Ultimate | Done — Eclipse Requiem cinematic slow/impact sequence |
| 10 | Boss | Done — Eclipse Warden with four health phases |
| 11 | HUD | Done — health, XP, gold, objective, mini-map, boss bar, combo |
| 12 | Character data system | Done — JSON character/enemy/mission data |
| 13 | Character switching | Done — four-character active party, swipe/Q/E switching, switch attack |
| 14 | Progression | Partial — level, XP, gold, upgrades |
| 15 | Inventory | Partial — materials, unlockable/equippable weapons, forge UI |
| 16 | Quest system | Partial — mission objectives/waves |
| 17 | Dialogue | TODO v0.5 |
| 18 | Save system | Done — localStorage envelope with checksum |
| 19 | World | Partial — functional node map and Nocturne Garden hub shell |
| 20 | Dungeon | Partial — procedural 3-room Abyss Dungeon combat run |
| 21 | Arena | Partial — tutorial arena plus boss-rush mode |
| 22 | Audio | Partial — procedural original audio |
| 23 | VFX | Partial — procedural rings, particles, labels, camera shake |
| 24 | Optimization | Partial — quality preset architecture, no heavy assets |
| 25 | QA | Partial — unit tests and build checks |
| 26 | GitHub Actions | Done |
| 27 | APK build | CI-ready; local sandbox lacks Java/Android SDK |
| 28 | Release | TODO — tag v0.1.0 when ready |

## Current game loop

```text
Main Menu
  -> New Game
  -> Intro
  -> Tutorial mission
  -> Wave enemies
  -> Mini-boss
  -> Main boss
  -> Reward screen
  -> Character upgrade
  -> Second mission / Abyss Dungeon / Arena Boss Rush
  -> Inventory / Forge / Map / Garden HQ
  -> Save and return to menu
  -> Continue
```

## UI/UX decisions from installed skill

- Product direction: gaming / dark anime action RPG / mobile.
- Visual direction: premium dark HUD + sci-fi FUI + glassmorphism.
- Color tokens: deep navy, neon purple, rose red, cyan highlights.
- Typography: bold condensed display treatment with readable system body fallback.
- Touch rules: 48dp+ Android hit targets, safe-area padding, 8dp spacing between actions.
- Accessibility: visible focus, no emoji structural icons, reduced-motion setting, screen-shake toggle.

## Original content boundaries

The MVP intentionally avoids protected anime/game assets. All current models are procedural primitives. Audio is generated at runtime with Web Audio oscillators/noise. Story, names, UI, and gameplay code are original placeholders suitable for replacing with licensed content later only if rights are secured.

## Mobile-first UX status

The previous large overlay/dashboard approach has been replaced with dedicated mobile screens. Important features are no longer hidden in a giant scroll page. Main navigation is fixed at the bottom where appropriate, mission start goes through a compact preparation screen, and combat keeps the joystick/actions/portraits visible without opening menus. The HOME screen now renders over the existing full-screen gothic castle lobby and transparent 3D hero scene instead of a flat/website dashboard: selected hero remains clear in the center as a procedural hooded dark-coat 3D model with gold trim, cloak motion, weapon glow, shadow orb/pet companion, rune platform, particles, and lighting; UI uses beveled glass/holographic top HUD, angled side shortcuts for Shop/Events/Starlight/Missions/Friends/Guild, preserved event banner, right friends panel, chat strip, Ranked/Classic selector, large bottom-right START button, geometric bottom navigation, and a compact mode-selection overlay.
