# SHADOW REQUIEM

**SHADOW REQUIEM** is an Android-first dark anime action RPG vertical slice. This repository begins with a polished MVP instead of attempting the entire AAA roadmap at once.

The current implementation is **v0.1.0 — playable prototype / vertical slice**.

## What is playable now

- Main menu with **New Game**, **Continue**, controls, and implemented settings.
- Cinematic intro sequence for Chapter 1: **The Awakening**.
- Third-person over-the-shoulder tutorial arena built with procedural original 3D shapes.
- One playable shadow-style protagonist: **Noctis Veyr / SHADOW**.
- Seven original Nocturne commanders with data-driven stats, skills, ultimates, roles, portraits, and combat switching.
- Mobile-first touch controls:
  - left virtual joystick
  - attack
  - dodge
  - three skills
  - ultimate
  - portrait character switching with swipe/Q/E fallback
- Keyboard fallback for desktop testing:
  - WASD / arrows to move
  - J or Enter to attack
  - Space to dodge
  - K / L / I for skills
  - U for ultimate
- Three enemy archetypes:
  - Eclipse Cultist — melee pressure
  - Eclipsed Arcanist — ranged kiting
  - Null Guard — tank/heavy strikes
- One mini-boss: **Abyss Knight Initiate**.
- One major boss: **Eclipse Warden**, with four health-based phases.
- Expanded RPG shell loop:
  - story mission objectives
  - procedural Abyss Dungeon prototype
  - Capital Arena boss-rush prototype
  - Nocturne Garden HQ room routing
  - node-based world map
  - archive/lore screen
  - combat rewards
  - materials inventory
  - weapon crafting/equipment
  - XP, gold, level-up
  - character upgrade screen
  - save and return to menu
  - continue from save
- Secure local save envelope with checksum validation.
- Procedural original audio using Web Audio; no copied music or voice assets.
- Capacitor Android wrapper and GitHub Actions APK build workflow.


## Mobile-first UI redesign

The UI has been rebuilt around **one screen = one purpose** instead of one large scrolling dashboard. The current shell now follows mobile action game usability principles:

- Full-screen 3D Nocturne Garden HQ lobby after the short logo/loading transition
- Full-screen gothic purple fantasy castle lobby background using image cover cropping, transparent 3D hero overlay, subtle lightning/particle/reflection effects, and UI-safe layering
- Transparent premium modern 3D/MOBA lobby UI overlay: beveled glass/holographic profile, currencies, utility icons, Shop/Events/Starlight/Missions/Friends/Guild shortcuts, preserved promotional banner, friends panel, chat preview, Ranked/Classic selector, Vault/Weapon/Preset/Collection/Lab bottom nav, and large glowing START button with the center kept clear for the 3D hero
- Transparent animated 3D lobby layer with selected hero, reflection rings, particles, aura, and lighting over the castle background
- Large selected 3D hero in the center with idle breathing, aura/weapon animation, tap reaction, drag rotation, pinch zoom, and double-tap camera reset
- Shadow-specific lobby treatment with darker lighting/music layer and heavier aura
- Compact top-left profile with avatar, level, rank, and EXP bar
- Compact top-right currency, mail badge, and settings controls
- Rebuilt landscape lobby structure with compact top HUD, angled side dock, right friends panel, small chat strip, bottom navigation, Ranked/Classic mode cards, and a large bottom-right START button
- START opens a compact STORY / DUNGEON / BOSS / ARENA / EVENT mode overlay
- Fixed 5-item bottom navigation tuned for the lobby: VAULT / WEAPON / PRESET / COLLECTION / LAB with non-placeholder geometric glyphs
- Separate character screen with carousel portraits and tabs: Overview, Skills, Equipment, Talents, Stats
- Separate inventory screen with category tabs and grid items
- Separate mission screen with Story/Daily/Weekly/Boss/Dungeon/Event tabs
- Compact battle preparation screen with selected team, enemy type, rewards, and START button
- Full-screen map with overlay nodes instead of a map inside a scrolling page
- More screen for secondary destinations: Map, Garden, Dungeon, Arena, Shop, Archive, Settings
- Contextual victory/defeat popups instead of long result pages
- Landscape combat HUD with right-side skill cluster and one-tap party portraits

## UI/UX skill installation

The requested UI/UX Pro Max skill is installed locally in:

```text
.agents/skills/ui-ux-pro-max/
```

The generated design system is persisted in:

```text
design-system/shadow-requiem/MASTER.md
design-system/shadow-requiem/pages/game-hud.md
```

The MVP HUD applies the skill guidance with a dark premium anime interface, glass panels, neon purple/rose accents, strong contrast, large touch targets, safe-area padding, visible focus states, and reduced-motion support.

## Tech stack

This MVP uses a lightweight Android-first web runtime:

- TypeScript
- Vite
- Three.js
- Capacitor Android
- Vitest
- GitHub Actions

Unity remains a strong option for a later full 3D production rewrite, but this stack allows the repository to immediately provide a playable demo and an APK build path inside normal CI infrastructure.

## Install and run

```bash
npm install
npm run dev
```

Open the local dev URL shown by Vite. In Arena, the dev server must bind to `0.0.0.0`, which is already configured.

## Test

```bash
npm test
npm run build
```

## Android build

Prepare the Capacitor Android project:

```bash
npm run android:prepare
```

Build a debug APK on a machine with Java 21 and the Android SDK installed:

```bash
npm run android:debug
```

Build an unsigned release APK:

```bash
npm run android:release
```

The Arena sandbox used for this implementation does not include Java or the Android SDK, so local APK compilation cannot be completed here. The repository includes `.github/workflows/android-apk.yml`, which installs Java and Android tooling on GitHub-hosted runners and uploads debug/release APK artifacts.

## GitHub Actions APK workflow

Workflow: `.github/workflows/android-apk.yml`

On push, pull request, manual dispatch, and `v*.*.*` tags, it:

1. checks out the repository
2. installs Node dependencies
3. runs unit tests
4. builds the web vertical slice
5. installs Java 17
6. installs Android SDK tooling
7. prepares/syncs Capacitor Android
8. builds debug APK
9. builds unsigned release APK
10. signs the release APK when signing secrets exist
11. uploads APK artifacts
12. creates a GitHub Release for version tags

Signing secrets expected by the workflow:

```text
ANDROID_KEYSTORE_BASE64
ANDROID_KEYSTORE_PASSWORD
ANDROID_KEY_ALIAS
ANDROID_KEY_PASSWORD
```

No keystore password, API key, or signing secret is hard-coded.

## Project structure

```text
.agents/skills/                    Installed UI/UX skill files
design-system/shadow-requiem/      UI/UX Pro Max design system output
.github/workflows/                 CI and Android APK workflow
android/                           Capacitor Android native project
public/                            PWA manifest and original SVG app icon
scripts/                           Build helpers
src/data/characters/               Data-driven character definitions
src/data/enemies/                  Data-driven enemy definitions
src/data/missions/                 Data-driven mission definitions
src/data/weapons/                  Data-driven weapon definitions
src/game/                          Gameplay, UI, audio, save, combat systems
src/tests/                         Automated tests
```

## Roadmap

The user-facing master prompt describes the full future game. The repo intentionally starts with a vertical slice.

### v0.1 — Prototype, current

- Movement
- Camera
- Basic sword combat
- Dodge
- Three skills
- Ultimate
- One arena
- Three enemy types
- Mini-boss
- Major boss
- HUD
- Upgrade screen
- Save/load
- Android wrapper and CI build path

### v0.2 — Combat feel

- Better attack chains
- Heavy attack
- perfect parry
- launch/juggle
- hit-stop tuning
- lock-on options
- richer boss telegraphs

### v0.3 — Characters

- Deepen the seven Nocturne commanders with bespoke animations/VFX
- Add heavy/team switch combo routes
- Add team passives
- Add per-character skill trees

### v0.4 — First map

- Shadow City hub
- mission board
- training arena
- blacksmith placeholder
- NPC dialogue prototype

### v0.5 — Story

- Chapter transitions
- anime-style dialogue portraits
- choices/reputation placeholders
- skippable cutscenes

### v0.6+ — Systems expansion

- Multi-floor dungeon modifiers
- arena seasons and leaderboard service
- advanced equipment/artifact sets
- achievements
- accessibility menu expansion
- localization tables
- Android performance profiling
- cloud-save/leaderboard architecture

## Copyright and licensing policy

This prototype uses original procedural artwork, original UI, original procedural audio, and original story/world terms created for this repository. Do not add copyrighted anime footage, ripped models, extracted music, logos, or voice recordings.

Licensed character content can be added later only through a legally approved content pipeline.
