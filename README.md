<h1 align="center">codex-pet</h1>

<p align="center">
  <strong>An interactive, draggable spritesheet pet component for React.</strong><br>
  9-state state machine &middot; drag physics &middot; scroll reaction &middot; section awareness &middot; zero re-renders
</p>

<p align="center">
  <a href="https://github.com/gzhang33/codex-pet/blob/main/LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <img alt="gzip size" src="https://img.shields.io/badge/gzip-6.2%20kB-44cc11.svg">
  <img alt="react" src="https://img.shields.io/badge/react-%E2%89%A518-61dafb.svg">
</p>

<p align="center">
  <img src="docs/example.gif" alt="CodexPet demo — idle, dragging, scrolling, section reactions" width="600">
</p>

<br>

## Why codex-pet?

Most web pet/mascot libraries are either a simple cursor-following cat (oneko.js) or a heavy Live2D widget (2MB+). **codex-pet** fills the gap: a lightweight React component with a full state machine, physics-based drag, scroll reaction, and section-aware behavior — all without triggering React re-renders during interaction.

## Features

| Category | Details |
|---|---|
| **9 animation states** | `idle`, `waving`, `jumping`, `failed`, `running`, `running-left`, `running-right`, `waiting`, `review` |
| **Drag physics** | Velocity tracking, release momentum with easing, floating detection |
| **Scroll reaction** | Pet runs when the user scrolls; direction-aware |
| **Section awareness** | Different animations and visual styles per page section |
| **Surface detection** | Reacts to hover/click on links, buttons, and custom elements |
| **Global signals** | Reacts to text selection, Escape key, resource errors |
| **Zero re-renders** | Imperative DOM updates via `commitDOM()` during drag/scroll |
| **rAF animation** | `requestAnimationFrame` accumulator replaces `setInterval`/`setTimeout` |
| **Position persistence** | Saves position to `localStorage` as viewport ratios |
| **Accessibility** | Respects `prefers-reduced-motion`, ARIA labeled |
| **Fully configurable** | All props optional — zero props = working defaults |

## Install

```bash
npm install codex-pet
```

Peer dependencies: `react >= 18`, `react-dom >= 18`.

## Quick Start

```tsx
import CodexPet from 'codex-pet';

function App() {
  return (
    <>
      <section id="about">About</section>
      <section id="projects">Projects</section>
      <section id="contact">Contact</section>
      <CodexPet />
    </>
  );
}
```

Zero props works out of the box. Pass `sections`, `sectionReactions`, and `sectionStyles` to enable section-aware behavior.

## Configuration

```tsx
import CodexPet, {
  DEFAULT_STATE_CONFIG,
  NEUTRAL_SECTION_STYLE,
} from 'codex-pet';

<CodexPet
  spritesheetSrc="/my-pet.webp"
  atlas={{ columns: 8, cellWidth: 192, cellHeight: 208 }}
  desktopSpriteWidth={150}
  mobileSpriteWidth={116}
  sections={[{ id: 'hero' }, { id: 'about' }, { id: 'projects' }]}
  sectionReactions={{ hero: 'waving', about: 'waiting', projects: 'review' }}
  sectionStyles={{
    hero: {
      shadow: 'radial-gradient(ellipse, rgba(16,185,129,.38), transparent 68%)',
      glow: 'drop-shadow(0 0 18px rgba(16,185,129,.25))',
      trail: 'linear-gradient(90deg, transparent, rgba(16,185,129,.34))',
    },
  }}
  cooldowns={{ surface: 5000, section: 4000 }}
  storageKey="my-pet-position"
  onStateChange={(state, hook) => console.log(state, hook)}
/>
```

### Props

| Prop | Type | Default | Description |
|---|---|---|---|
| `spritesheetSrc` | `string` | `'/pets/paris-muse.webp'` | Spritesheet image URL |
| `atlas` | `AtlasConfig` | `{ columns:8, cellWidth:192, cellHeight:208 }` | Atlas grid layout |
| `stateConfig` | `Record<PetState, StateConfig>` | _(9 states)_ | Per-state animation config |
| `sections` | `SectionDescriptor[]` | `[]` | DOM sections to detect by id |
| `sectionReactions` | `Record<string, PetState>` | `{}` | State to play per section |
| `sectionStyles` | `Record<string, SectionStyle>` | `{}` | Shadow, glow, trail per section |
| `interactiveSelector` | `string` | `'a, button, [role="button"], input, textarea, select, [data-pet-react]'` | CSS selector for interactive surfaces |
| `reviewSelector` | `string \| null` | `null` | Review-zone selector; null to disable |
| `desktopSpriteWidth` | `number` | `150` | Sprite width on desktop (px) |
| `mobileSpriteWidth` | `number` | `116` | Sprite width on mobile (px) |
| `mobileBreakpoint` | `number` | `768` | Viewport width breakpoint |
| `storageKey` | `string \| null` | `'codex-pet-position'` | localStorage key; null disables |
| `cooldowns` | `CooldownConfig` | _(see defaults)_ | Cooldown durations (ms) |
| `activeReturnDurations` | `Partial<Record<PetState, number>>` | _(per state)_ | Time before returning to idle |
| `waitingIdleMs` | `number` | `60000` | Idle timeout for waiting animation |
| `ariaLabel` | `string` | `'Interactive site mascot'` | Accessible label |
| `respectReducedMotion` | `boolean` | `true` | Disable auto-reactions when reduced-motion active |
| `defaultPositionRatio` | `{ x: number, y: number }` | `{x:.88, y:.78}` | Default position as viewport ratio (0–1) |
| `onStateChange` | `(state, hook) => void` | — | State change callback |
| `onSectionChange` | `(section) => void` | — | Section change callback |

## Spritesheet Format

Arrange animation frames in a grid:

```
Row 0: idle      (6 frames)
Row 1: running-right (8 frames)
Row 2: running-left  (8 frames)
Row 3: waving     (4 frames)
Row 4: jumping    (5 frames)
Row 5: failed     (8 frames)
Row 6: waiting    (6 frames)
Row 7: running    (6 frames)
Row 8: review     (6 frames)
```

Configure via `stateConfig` and `atlas` props to match your own layout.

## Architecture

```
┌─────────────────────────────────────────────┐
│  React re-renders (2 useState only)         │
│  ├─ position (initial placement + resize)   │
│  └─ isCompact (responsive breakpoint)       │
├─────────────────────────────────────────────┤
│  Imperative DOM (commitDOM bypasses React)  │
│  ├─ stateRef (6 consolidated useState→ref)  │
│  ├─ frame animation (rAF accumulator)       │
│  ├─ position updates (drag + release)       │
│  └─ visual effects (shadow, trail, glow)    │
└─────────────────────────────────────────────┘
```

Result: **zero React re-renders** during drag and scroll.

## Exports

```ts
// Component
import CodexPet from 'codex-pet';

// Types
import type { PetState, PetHookName, CodexPetProps, AtlasConfig, ... } from 'codex-pet';

// Defaults (for partial override)
import { DEFAULT_STATE_CONFIG, NEUTRAL_SECTION_STYLE, ACTIVE_RETURN_MS, ... } from 'codex-pet';
```

## Comparison

| | codex-pet | oneko.js | live2d-widget | clippy.js |
|---|---|---|---|---|
| Size (gzip) | **6.2 KB** | ~7 KB | ~2.25 MB | ~30 KB |
| React | Native | Vanilla JS | Vanilla JS | jQuery |
| States | **9** | 4 | N/A | ~10 |
| Drag physics | Yes | No | Yes | No |
| Scroll reaction | Yes | No | No | No |
| Section awareness | Yes | No | No | No |
| Zero re-renders | Yes | N/A | N/A | N/A |
| prefers-reduced-motion | Yes | Yes | No | No |

## License

[MIT](./LICENSE)
