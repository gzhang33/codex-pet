# codex-pet

Interactive spritesheet pet component for React.

9-state state machine with drag physics, scroll reaction, section awareness, and zero re-renders during interaction.

## Features

- **9 animation states**: idle, waving, jumping, failed, running, running-left, running-right, waiting, review
- **Drag physics**: velocity tracking, release momentum, floating detection
- **Scroll reaction**: pet runs when user scrolls, direction-aware
- **Section awareness**: different animations when scrolling into page sections
- **Interactive surface detection**: reacts to hover/click on links, buttons, and other elements
- **Global signals**: reacts to text selection, Escape key, resource errors
- **Zero re-renders**: imperative DOM updates via refs during drag/scroll
- **rAF animation loop**: requestAnimationFrame accumulator replaces setInterval
- **Position persistence**: saves position to localStorage as viewport ratios
- **Accessibility**: respects `prefers-reduced-motion`, ARIA labeled
- **Fully configurable**: all props optional, zero props = sensible defaults

## Install

```bash
npm install codex-pet
```

## Quick Start

```tsx
import CodexPet from 'codex-pet';
import 'codex-pet/style.css'; // optional: minimal base styles

function App() {
  return (
    <>
      <main id="about">...</main>
      <main id="projects">...</main>
      <main id="contact">...</main>
      <CodexPet />
    </>
  );
}
```

## Props

All props are optional. Defaults are designed for a personal portfolio site.

| Prop | Type | Default | Description |
|---|---|---|---|
| `spritesheetSrc` | `string` | `'/pets/paris-muse.webp'` | Spritesheet image URL |
| `atlas` | `AtlasConfig` | `{ columns:8, cellWidth:192, cellHeight:208 }` | Atlas grid layout |
| `stateConfig` | `Record<PetState, StateConfig>` | (see defaults.ts) | Per-state animation config |
| `sections` | `SectionDescriptor[]` | `[{id:'about'},...]` | DOM sections to detect by id |
| `sectionReactions` | `Record<string, PetState>` | `{hero:'waving',...}` | State to play per section |
| `sectionStyles` | `Record<string, SectionStyle>` | (color per section) | Shadow, glow, trail colors |
| `interactiveSelector` | `string` | `'a, button, ...'` | CSS selector for interactive surfaces |
| `reviewSelector` | `string \| null` | `'#projects'` | Review zone selector |
| `desktopSpriteWidth` | `number` | `150` | Sprite width on desktop (px) |
| `mobileSpriteWidth` | `number` | `116` | Sprite width on mobile (px) |
| `mobileBreakpoint` | `number` | `768` | Viewport width breakpoint |
| `storageKey` | `string \| null` | `'codex-pet-position'` | localStorage key; null disables |
| `cooldowns` | `CooldownConfig` | (see defaults.ts) | Cooldown durations (ms) |
| `activeReturnDurations` | `Partial<Record<PetState, number>>` | (see defaults.ts) | Time before returning to idle |
| `waitingIdleMs` | `number` | `60000` | Idle timeout for waiting animation |
| `ariaLabel` | `string` | `'Interactive site mascot'` | Accessible label |
| `respectReducedMotion` | `boolean` | `true` | Disable auto-reactions when reduced-motion |
| `defaultPositionRatio` | `Position` | `{x:0.88, y:0.78}` | Default position as viewport ratio |
| `onStateChange` | `(state, hook) => void` | — | State change callback |
| `onSectionChange` | `(section) => void` | — | Section change callback |

## Spritesheet Format

The spritesheet is a single image arranged as a grid:

- **Columns**: defined by `atlas.columns` (default: 8)
- **Cell size**: `atlas.cellWidth` x `atlas.cellHeight` (default: 192x208)
- **Rows**: each row maps to a state via `stateConfig[state].row`
- **Frames**: each state uses `stateConfig[state].frames` consecutive cells in its row

## Exports

```ts
// Component
import CodexPet from 'codex-pet';

// Types
import type { PetState, PetHookName, CodexPetProps, ... } from 'codex-pet';

// Defaults (for partial override)
import { DEFAULT_STATE_CONFIG, DEFAULT_SECTION_REACTIONS, ... } from 'codex-pet';
```

## Architecture

```
commitDOM() — imperative DOM sync, bypasses React render cycle
useRef<PetInternalState> — 6 former useState values consolidated
rAF accumulator loop — frame timing with per-frame duration support
```

## License

MIT
