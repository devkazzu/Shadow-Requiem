# Changelog

## v0.1.0 — 2026-09-11

### Added

- Reworked the lobby into an original AAA mobile multiplayer-style home scene with a procedural hooded shadow hero, animated cloak, weapon glow, shadow orb/pet companion, summoning platform, rune rings, floating crystals, plus beveled glass-metal/holographic UI for profile, top-center currency counters, expanded utility icons, Shop/Events/Starlight/Missions/Friends/Guild shortcuts, preserved promotional banner/timer, friends panel, bottom-left chat input, lower-right Ranked/Classic selector, and Preparation/Heroes/Collection/Inventory bottom nav.
- Added a full-screen gothic purple fantasy castle lobby background image with CSS cover cropping, transparent Three.js hero canvas, lightning glow, particle drift, and reflective light overlays while keeping lobby UI above it.
- Rebuilt the main home screen as a transparent full-screen 3D Nocturne Garden lobby over the castle background with an interactive center hero, hero switching, compact top HUD, angled side shortcuts, friends panel, chat strip, lower-right game-mode cards, bottom navigation with geometric glyphs, and compact START mode-selection overlay.
- Mobile-first UI rebuild: cinematic lobby, fixed bottom navigation, separate one-purpose screens, tabbed character/inventory/mission/settings panels, battle preparation, full-screen map, More hub, compact popups, and landscape combat HUD adjustments.
- Independent mobile screen renderers in `src/game/ui/mobileScreens.ts`.
- Installed UI/UX Pro Max skill for local design guidance.
- Persisted SHADOW REQUIEM design system and game HUD override.
- Created TypeScript/Vite/Three.js playable vertical slice.
- Added Android-first Capacitor project configuration.
- Added main menu, intro, tutorial arena, combat HUD, touch controls, rewards, upgrade screen, save/load, and second mission loop.
- Added one protagonist, seven original commanders, three enemy types, one mini-boss, and one four-phase boss using data-driven JSON.
- Added real-time character switching, portrait bar, switch attack, world map, mission board, Nocturne Garden HQ, archive, inventory, weapon crafting/equipment, Abyss Dungeon prototype, and Arena boss rush.
- Added procedural original audio effects/music bed using Web Audio.
- Added unit tests for combat math and save validation.
- Added GitHub Actions workflow to build Android debug/release APK artifacts.
