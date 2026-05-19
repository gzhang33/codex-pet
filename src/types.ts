export type PetState =
  | 'idle'
  | 'waving'
  | 'jumping'
  | 'failed'
  | 'running'
  | 'running-left'
  | 'running-right'
  | 'waiting'
  | 'review';

export type PetHookName =
  | 'default'
  | 'surface-hover'
  | 'surface-activate'
  | 'cancel-or-error'
  | 'page-scroll'
  | 'drag-left'
  | 'drag-right'
  | 'idle-timeout'
  | 'project-review';

export interface Position {
  x: number;
  y: number;
}

export type PetRatio = Position;

export interface DragSample {
  x: number;
  y: number;
  timeMs: number;
}

export interface StateConfig {
  row: number;
  frames: number;
  fps: number;
  frameDurationsMs?: number[];
}

export interface AtlasConfig {
  columns: number;
  cellWidth: number;
  cellHeight: number;
}

export interface SectionDescriptor {
  id: string;
}

export interface SectionStyle {
  shadow: string;
  glow: string;
  trail: string;
}

export interface CooldownConfig {
  surface?: number;
  section?: number;
  review?: number;
  failed?: number;
  autoAction?: number;
  waitingIdle?: number;
  scrollSessionIdle?: number;
}

export interface CodexPetProps {
  /** Spritesheet image URL */
  spritesheetSrc?: string;
  /** Atlas grid layout */
  atlas?: AtlasConfig;
  /** Per-state animation config (row, frames, fps) */
  stateConfig?: Record<PetState, StateConfig>;

  /** DOM sections to detect (by element id) */
  sections?: SectionDescriptor[];
  /** State to play when entering a section */
  sectionReactions?: Record<string, PetState>;
  /** Visual style per section (shadow, glow, trail) */
  sectionStyles?: Record<string, SectionStyle>;

  /** CSS selector for interactive elements (hover/click triggers reaction) */
  interactiveSelector?: string;
  /** CSS selector for review-zone elements; null to disable */
  reviewSelector?: string | null;

  /** Sprite width on desktop (px) */
  desktopSpriteWidth?: number;
  /** Sprite width on mobile (px) */
  mobileSpriteWidth?: number;
  /** Viewport width breakpoint for mobile layout */
  mobileBreakpoint?: number;

  /** localStorage key for position persistence; null to disable */
  storageKey?: string | null;

  /** Override cooldown durations (ms) */
  cooldowns?: CooldownConfig;
  /** Duration (ms) before auto-returning to idle after an active state */
  activeReturnDurations?: Partial<Record<PetState, number>>;
  /** Idle timeout (ms) before playing the waiting animation */
  waitingIdleMs?: number;

  /** Accessible label for the pet button */
  ariaLabel?: string;
  /** Respect prefers-reduced-motion: disable auto-reactions when active */
  respectReducedMotion?: boolean;

  /** Default position as viewport ratio (0–1) */
  defaultPositionRatio?: Position;

  /** Called when the pet state changes */
  onStateChange?: (state: PetState, hook: PetHookName) => void;
  /** Called when the active section changes */
  onSectionChange?: (section: string) => void;
}

export interface PetInternalState {
  petState: PetState;
  isDragging: boolean;
  isEngaged: boolean;
  dragVector: Position;
  activeSection: string;
  isScrollReacting: boolean;
}
