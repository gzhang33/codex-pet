import type { PetState, PetHookName, StateConfig, AtlasConfig, SectionDescriptor, SectionStyle, Position } from './types';

// --- Asset ---
export const DEFAULT_SPRITESHEET_SRC = '/pets/paris-muse.webp';
export const DEFAULT_ATLAS: AtlasConfig = { columns: 8, cellWidth: 192, cellHeight: 208 };

// --- Sizing ---
export const DESKTOP_SPRITE_WIDTH = 150;
export const MOBILE_SPRITE_WIDTH = 116;
export const MOBILE_BREAKPOINT = 768;

// --- Position ---
export const VIEWPORT_PADDING = 16;
export const DEFAULT_POSITION_RATIO: Position = { x: 0.88, y: 0.78 };
export const MOBILE_POSITION_RATIO: Position = { x: 0.72, y: 0.52 };
export const DEFAULT_STORAGE_KEY = 'codex-pet-position';

// --- Drag physics ---
export const DRAG_THRESHOLD = 12;
export const DRAG_SAMPLE_WINDOW_MS = 100;
export const DRAG_MIN_RELEASE_SPEED = 320;
export const DRAG_MAX_RELEASE_SPEED = 1600;
export const DRAG_RELEASE_DURATION_MS = 240;
export const FLOATING_DRAG_THRESHOLD = 12;

// --- Scroll ---
export const SCROLL_REACTION_DELTA = 6;
export const SCROLL_SESSION_IDLE_MS = 220;

// --- Cooldowns ---
export const SURFACE_REACTION_COOLDOWN_MS = 5000;
export const SECTION_REACTION_COOLDOWN_MS = 4000;
export const REVIEW_REACTION_COOLDOWN_MS = 6000;
export const FAILED_REACTION_COOLDOWN_MS = 8000;
export const AUTO_ACTION_COOLDOWN_MS = 12000;

// --- Timing ---
export const WAITING_TRIGGER_MS_IDLE = 60000;
export const MOUNT_SCROLL_GUARD_MS = 900;
export const TEXT_SELECTION_MIN_LENGTH = 12;

// --- Interaction ---
export const DEFAULT_INTERACTIVE_SELECTOR = 'a, button, [role="button"], input, textarea, select, [data-pet-react]';
export const DEFAULT_REVIEW_SELECTOR = '#projects';

// --- State config ---
export const DEFAULT_STATE_CONFIG: Record<PetState, StateConfig> = {
  idle: { row: 0, frames: 6, fps: 3, frameDurationsMs: [1400, 200, 200, 250, 200, 1800] },
  waving: { row: 3, frames: 4, fps: 4 },
  jumping: { row: 4, frames: 5, fps: 5 },
  failed: { row: 5, frames: 8, fps: 5 },
  waiting: { row: 6, frames: 6, fps: 3 },
  running: { row: 7, frames: 6, fps: 6 },
  review: { row: 8, frames: 6, fps: 4 },
  'running-left': { row: 2, frames: 8, fps: 6 },
  'running-right': { row: 1, frames: 8, fps: 6 },
};

export const ACTIVE_RETURN_MS: Partial<Record<PetState, number>> = {
  waving: 2200,
  jumping: 1600,
  failed: 2800,
  running: 1300,
  'running-left': 1300,
  'running-right': 1300,
  waiting: 3500,
  review: 3200,
};

// --- Section defaults ---
export const DEFAULT_SECTIONS: SectionDescriptor[] = [
  { id: 'about' },
  { id: 'projects' },
  { id: 'contact' },
];

export const DEFAULT_SECTION_REACTIONS: Record<string, PetState> = {
  hero: 'waving',
  about: 'waiting',
  projects: 'review',
  contact: 'waving',
};

export const DEFAULT_SECTION_STYLE: Record<string, SectionStyle> = {
  hero: {
    shadow: 'radial-gradient(ellipse, rgba(16, 185, 129, 0.38), rgba(15, 23, 42, 0.08) 68%)',
    glow: 'drop-shadow(0 0 18px rgba(16, 185, 129, 0.25))',
    trail: 'linear-gradient(90deg, rgba(16, 185, 129, 0), rgba(16, 185, 129, 0.34))',
  },
  about: {
    shadow: 'radial-gradient(ellipse, rgba(56, 189, 248, 0.30), rgba(15, 23, 42, 0.08) 68%)',
    glow: 'drop-shadow(0 0 18px rgba(56, 189, 248, 0.20))',
    trail: 'linear-gradient(90deg, rgba(56, 189, 248, 0), rgba(56, 189, 248, 0.30))',
  },
  projects: {
    shadow: 'radial-gradient(ellipse, rgba(168, 85, 247, 0.28), rgba(15, 23, 42, 0.08) 68%)',
    glow: 'drop-shadow(0 0 20px rgba(168, 85, 247, 0.22))',
    trail: 'linear-gradient(90deg, rgba(168, 85, 247, 0), rgba(168, 85, 247, 0.32))',
  },
  contact: {
    shadow: 'radial-gradient(ellipse, rgba(250, 204, 21, 0.24), rgba(15, 23, 42, 0.08) 68%)',
    glow: 'drop-shadow(0 0 18px rgba(250, 204, 21, 0.18))',
    trail: 'linear-gradient(90deg, rgba(250, 204, 21, 0), rgba(250, 204, 21, 0.28))',
  },
};

// --- Hook mapping ---
export const PET_STATE_HOOKS: Record<PetState, PetHookName> = {
  idle: 'default',
  waving: 'surface-hover',
  jumping: 'surface-activate',
  failed: 'cancel-or-error',
  running: 'page-scroll',
  'running-left': 'drag-left',
  'running-right': 'drag-right',
  waiting: 'idle-timeout',
  review: 'project-review',
};
