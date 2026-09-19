# Contributing to SHADOW REQUIEM

Thank you for helping build SHADOW REQUIEM.

## Development principles

1. **Feel before content quantity** — keep combat responsive before adding more maps or systems.
2. **Never fake functionality** — if a button or system is not implemented, mark it TODO or do not expose it in UI.
3. **Data-driven content** — characters, enemies, missions, skills, and items should live in data files where practical.
4. **Android-first performance** — avoid large textures, expensive shaders, unbounded particles, and memory-heavy assets.
5. **Original assets only** — do not add copyrighted anime footage, extracted game files, ripped models, copied music, logos, or voice recordings.

## Local checks

Run before opening a pull request:

```bash
npm test
npm run build
```

If Java 21 and Android SDK are installed locally, also run:

```bash
npm run android:debug
```

## Commit style

Prefer Conventional Commit style:

```text
feat: add combat lock-on prototype
fix: prevent corrupted save from loading
chore: update android workflow cache
```

## Branching note

Arena sessions are tied to their assigned branch. In this environment, continue working on `arena/01a09116-shadow-requiem`.
