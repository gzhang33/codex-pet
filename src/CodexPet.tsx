import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useReduceMotion } from './useReduceMotion';
import type {
  PetState,
  PetHookName,
  StateConfig,
  Position,
  PetRatio,
  DragSample,
  CodexPetProps,
  PetInternalState,
  SectionDescriptor,
  SectionStyle,
} from './types';
import {
  DEFAULT_SPRITESHEET_SRC,
  DEFAULT_ATLAS,
  DEFAULT_VIEWPORT_CROP,
  DESKTOP_SPRITE_WIDTH,
  MOBILE_SPRITE_WIDTH,
  MOBILE_BREAKPOINT,
  VIEWPORT_PADDING,
  DEFAULT_POSITION_RATIO,
  MOBILE_POSITION_RATIO,
  DEFAULT_STORAGE_KEY,
  DRAG_THRESHOLD,
  DRAG_SAMPLE_WINDOW_MS,
  DRAG_MIN_RELEASE_SPEED,
  DRAG_MAX_RELEASE_SPEED,
  DRAG_RELEASE_DURATION_MS,
  FLOATING_DRAG_THRESHOLD,
  SCROLL_REACTION_DELTA,
  SCROLL_SESSION_IDLE_MS,
  SURFACE_REACTION_COOLDOWN_MS,
  SECTION_REACTION_COOLDOWN_MS,
  REVIEW_REACTION_COOLDOWN_MS,
  FAILED_REACTION_COOLDOWN_MS,
  AUTO_ACTION_COOLDOWN_MS,
  WAITING_TRIGGER_MS_IDLE,
  MOUNT_SCROLL_GUARD_MS,
  TEXT_SELECTION_MIN_LENGTH,
  DEFAULT_INTERACTIVE_SELECTOR,
  DEFAULT_REVIEW_SELECTOR,
  DEFAULT_STATE_CONFIG,
  ACTIVE_RETURN_MS,
  DEFAULT_SECTIONS,
  DEFAULT_SECTION_REACTIONS,
  DEFAULT_SECTION_STYLE,
  NEUTRAL_SECTION_STYLE,
  PET_STATE_HOOKS,
} from './defaults';

const createFullCellCrop = (
  atlas: { cellWidth: number; cellHeight: number },
): { left: number; top: number; width: number; height: number } => ({
  left: 0,
  top: 0,
  width: atlas.cellWidth,
  height: atlas.cellHeight,
});

const normalizeViewportCrop = (
  crop: { left: number; top: number; width: number; height: number } | null | undefined,
  atlas: { cellWidth: number; cellHeight: number },
) => {
  if (!crop) return createFullCellCrop(atlas);

  const left = Math.max(0, Math.min(atlas.cellWidth - 1, Math.round(crop.left)));
  const top = Math.max(0, Math.min(atlas.cellHeight - 1, Math.round(crop.top)));
  const width = Math.max(1, Math.min(atlas.cellWidth - left, Math.round(crop.width)));
  const height = Math.max(1, Math.min(atlas.cellHeight - top, Math.round(crop.height)));

  return { left, top, width, height };
};

const cropsEqual = (
  a: { left: number; top: number; width: number; height: number },
  b: { left: number; top: number; width: number; height: number },
) => a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height;

const inferViewportCrop = async (
  spritesheetSrc: string,
  atlas: { cellWidth: number; cellHeight: number },
  stateConfig: Record<string, { row: number; frames: number }>,
) => {
  if (typeof window === 'undefined') return null;

  const image = new Image();
  image.crossOrigin = 'anonymous';

  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error(`Failed to load spritesheet: ${spritesheetSrc}`));
    image.src = spritesheetSrc;
  });

  const canvas = document.createElement('canvas');
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(image, 0, 0);

  let imageData: ImageData;
  try {
    imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  } catch {
    return null;
  }

  const { data, width: imageWidth } = imageData;
  let minLeft = atlas.cellWidth;
  let minTop = atlas.cellHeight;
  let maxRight = 0;
  let maxBottom = 0;
  let foundOpaquePixel = false;

  for (const cfg of Object.values(stateConfig)) {
    for (let frame = 0; frame < cfg.frames; frame += 1) {
      const offsetX = frame * atlas.cellWidth;
      const offsetY = cfg.row * atlas.cellHeight;
      let cellMinX = atlas.cellWidth;
      let cellMinY = atlas.cellHeight;
      let cellMaxX = -1;
      let cellMaxY = -1;

      for (let y = 0; y < atlas.cellHeight; y += 1) {
        for (let x = 0; x < atlas.cellWidth; x += 1) {
          const alphaIndex = ((offsetY + y) * imageWidth + (offsetX + x)) * 4 + 3;
          if (data[alphaIndex] === 0) continue;
          if (x < cellMinX) cellMinX = x;
          if (y < cellMinY) cellMinY = y;
          if (x > cellMaxX) cellMaxX = x;
          if (y > cellMaxY) cellMaxY = y;
        }
      }

      if (cellMaxX === -1 || cellMaxY === -1) continue;

      foundOpaquePixel = true;
      if (cellMinX < minLeft) minLeft = cellMinX;
      if (cellMinY < minTop) minTop = cellMinY;
      if (cellMaxX + 1 > maxRight) maxRight = cellMaxX + 1;
      if (cellMaxY + 1 > maxBottom) maxBottom = cellMaxY + 1;
    }
  }

  if (!foundOpaquePixel) return null;

  return normalizeViewportCrop(
    {
      left: minLeft,
      top: minTop,
      width: maxRight - minLeft,
      height: maxBottom - minTop,
    },
    atlas,
  );
};

const CodexPet: React.FC<CodexPetProps> = ({
  spritesheetSrc = DEFAULT_SPRITESHEET_SRC,
  atlas = DEFAULT_ATLAS,
  viewportCrop = DEFAULT_VIEWPORT_CROP,
  stateConfig = DEFAULT_STATE_CONFIG,
  sections = DEFAULT_SECTIONS,
  sectionReactions = DEFAULT_SECTION_REACTIONS,
  sectionStyles = DEFAULT_SECTION_STYLE,
  interactiveSelector = DEFAULT_INTERACTIVE_SELECTOR,
  reviewSelector = DEFAULT_REVIEW_SELECTOR,
  desktopSpriteWidth = DESKTOP_SPRITE_WIDTH,
  mobileSpriteWidth = MOBILE_SPRITE_WIDTH,
  mobileBreakpoint = MOBILE_BREAKPOINT,
  storageKey = DEFAULT_STORAGE_KEY,
  cooldowns,
  activeReturnDurations = ACTIVE_RETURN_MS,
  waitingIdleMs = WAITING_TRIGGER_MS_IDLE,
  ariaLabel = 'Interactive site mascot',
  respectReducedMotion = true,
  defaultPositionRatio = DEFAULT_POSITION_RATIO,
  onStateChange,
  onSectionChange,
}) => {
  const cdSurface = cooldowns?.surface ?? SURFACE_REACTION_COOLDOWN_MS;
  const cdSection = cooldowns?.section ?? SECTION_REACTION_COOLDOWN_MS;
  const cdReview = cooldowns?.review ?? REVIEW_REACTION_COOLDOWN_MS;
  const cdFailed = cooldowns?.failed ?? FAILED_REACTION_COOLDOWN_MS;
  const cdAutoAction = cooldowns?.autoAction ?? AUTO_ACTION_COOLDOWN_MS;
  const cdScrollIdle = cooldowns?.scrollSessionIdle ?? SCROLL_SESSION_IDLE_MS;

  const reduceMotion = respectReducedMotion ? useReduceMotion() : false;

  // React state (triggers re-render)
  const [position, setPosition] = useState<Position | null>(null);
  const [isCompact, setIsCompact] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint
  );
  const [resolvedViewportCrop, setResolvedViewportCrop] = useState(() =>
    normalizeViewportCrop(viewportCrop, atlas)
  );

  // Imperative state (no re-render)
  const stateRef = useRef<PetInternalState>({
    petState: 'idle',
    isDragging: false,
    isEngaged: false,
    dragVector: { x: 0, y: 0 },
    activeSection: '',
    isScrollReacting: false,
  });

  // Refs for DOM elements
  const containerRef = useRef<HTMLButtonElement>(null);
  const spriteRef = useRef<HTMLDivElement>(null);
  const trailRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);

  // Animation refs
  const frameRef = useRef(0);
  const lastFrameTimeRef = useRef(0);
  const rafIdRef = useRef<number | null>(null);

  // Timer refs
  const returnTimerRef = useRef<number | null>(null);
  const waitingTimerRef = useRef<number | null>(null);
  const scrollIdleTimerRef = useRef<number | null>(null);

  // Tracking refs
  const scrollSessionActiveRef = useRef(false);
  const scrollDeltaAccRef = useRef(0);
  const lastScrollYRef = useRef(0);
  const mountedAtRef = useRef(0);
  const lastAutoActionAtRef = useRef(0);
  const positionRef = useRef<Position | null>(null);
  const positionRatioRef = useRef<PetRatio | null>(null);
  const isCompactRef = useRef(typeof window !== 'undefined' && window.innerWidth < mobileBreakpoint);

  // Drag refs
  const dragPointerIdRef = useRef<number | null>(null);
  const dragStartPointRef = useRef<Position | null>(null);
  const dragStartPositionRef = useRef<Position | null>(null);
  const dragSamplesRef = useRef<DragSample[]>([]);
  const hasMovedRef = useRef(false);
  const releaseRafRef = useRef<number | null>(null);

  // Cooldown refs
  const lastSurfaceReactionAtRef = useRef(0);
  const lastSectionReactionAtRef = useRef(0);
  const lastReviewReactionAtRef = useRef(0);
  const lastFailedReactionAtRef = useRef(0);

  // --- Computed sprite dimensions ---
  const spriteWidth = isCompact ? mobileSpriteWidth : desktopSpriteWidth;
  const spriteScale = spriteWidth / resolvedViewportCrop.width;
  const spriteHeight = Math.round(resolvedViewportCrop.height * spriteScale);
  const scaledCellWidth = Math.round(atlas.cellWidth * spriteScale);
  const scaledCellHeight = Math.round(atlas.cellHeight * spriteScale);
  const scaledAtlasWidth = Math.round(atlas.columns * atlas.cellWidth * spriteScale);
  const scaledCropLeft = Math.round(resolvedViewportCrop.left * spriteScale);
  const scaledCropTop = Math.round(resolvedViewportCrop.top * spriteScale);

  // --- Viewport helpers ---
  const getViewportBounds = useCallback(() => {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return {
      minX: VIEWPORT_PADDING,
      minY: VIEWPORT_PADDING,
      maxX: Math.max(VIEWPORT_PADDING, vw - spriteWidth - VIEWPORT_PADDING),
      maxY: Math.max(VIEWPORT_PADDING, vh - spriteHeight - VIEWPORT_PADDING),
      vw,
      vh,
    };
  }, [spriteWidth, spriteHeight]);

  const ratioToPixel = useCallback((ratio: PetRatio): Position => {
    const { vw, vh } = getViewportBounds();
    return { x: Math.round(ratio.x * vw), y: Math.round(ratio.y * vh) };
  }, [getViewportBounds]);

  const pixelToRatio = useCallback((pos: Position): PetRatio => {
    const { vw, vh } = getViewportBounds();
    return { x: vw > 0 ? pos.x / vw : 0, y: vh > 0 ? pos.y / vh : 0 };
  }, [getViewportBounds]);

  const clampPosition = useCallback((next: Position) => {
    const b = getViewportBounds();
    return {
      x: Math.min(Math.max(next.x, b.minX), b.maxX),
      y: Math.min(Math.max(next.y, b.minY), b.maxY),
    };
  }, [getViewportBounds]);

  // --- Persistence ---
  const persistPosition = useCallback((pos: Position) => {
    if (!storageKey) return;
    const ratio = pixelToRatio(pos);
    positionRatioRef.current = ratio;
    window.localStorage.setItem(storageKey, JSON.stringify(ratio));
  }, [storageKey, pixelToRatio]);

  const loadPersistedPosition = useCallback((): Position | null => {
    if (!storageKey) return null;
    const saved = window.localStorage.getItem(storageKey);
    if (!saved) return null;
    try {
      const parsed = JSON.parse(saved) as Partial<PetRatio>;
      if (typeof parsed.x !== 'number' || typeof parsed.y !== 'number') return null;
      if (parsed.x < 0 || parsed.x > 1 || parsed.y < 0 || parsed.y > 1) return null;
      const ratio: PetRatio = { x: parsed.x, y: parsed.y };
      positionRatioRef.current = ratio;
      return clampPosition(ratioToPixel(ratio));
    } catch {
      return null;
    }
  }, [storageKey, ratioToPixel, clampPosition]);

  // --- commitDOM: imperative DOM sync ---
  const commitDOM = useCallback(() => {
    const container = containerRef.current;
    const sprite = spriteRef.current;
    const trail = trailRef.current;
    const shadow = shadowRef.current;
    if (!container || !sprite) return;

    const s = stateRef.current;
    const pos = positionRef.current;
    if (!pos) return;

    // Position
    container.style.left = `${pos.x}px`;
    container.style.top = `${pos.y}px`;

    // Data attributes
    container.dataset.petState = s.petState;
    container.dataset.petHook = PET_STATE_HOOKS[s.petState];
    container.dataset.petSection = s.activeSection;
    container.dataset.petScrollReacting = s.isScrollReacting ? 'true' : 'false';

    // Cursor
    container.style.cursor = s.isDragging ? 'grabbing' : 'grab';

    // Section style
    const sectionStyle = sectionStyles[s.activeSection] ?? NEUTRAL_SECTION_STYLE;

    // Sprite scale + opacity
    const isCompactMode = isCompactRef.current;
    let scale: number, opacity: number;
    if (isCompactMode) {
      scale = s.isDragging ? 1.05 : s.isEngaged ? 1 : 0.94;
      opacity = s.isDragging ? 1 : s.isEngaged ? 1 : 0.78;
    } else {
      scale = s.isDragging ? 1.08 : s.isEngaged ? 1.03 : 1;
      opacity = 1;
    }
    sprite.style.transform = `scale(${scale})`;
    sprite.style.opacity = `${opacity}`;

    // Sprite background position
    const cfg = stateConfig[s.petState];
    const x = frameRef.current * scaledCellWidth + scaledCropLeft;
    const y = cfg.row * scaledCellHeight + scaledCropTop;
    sprite.style.backgroundPosition = `-${x}px -${y}px`;

    // Floating drag
    const isFloating = s.isDragging
      && s.dragVector.y <= -FLOATING_DRAG_THRESHOLD
      && Math.abs(s.dragVector.y) >= Math.abs(s.dragVector.x) * 0.65;
    const floatingLift = isFloating ? Math.min(18, Math.max(8, Math.abs(s.dragVector.y) * 0.12)) : 0;
    const baseTranslateY = isFloating ? -floatingLift : 0;
    sprite.style.transform = baseTranslateY ? `translateY(${baseTranslateY}px) scale(${scale})` : `scale(${scale})`;

    // will-change during drag
    sprite.style.willChange = s.isDragging ? 'transform' : 'auto';

    // Drop shadow
    let dropShadow: string;
    if (isCompactMode) {
      dropShadow = isFloating
        ? 'drop-shadow(0 24px 32px rgba(0, 0, 0, 0.32))'
        : s.isDragging
          ? 'drop-shadow(0 18px 26px rgba(0, 0, 0, 0.52))'
          : 'drop-shadow(0 10px 18px rgba(0, 0, 0, 0.42))';
    } else {
      dropShadow = isFloating
        ? 'drop-shadow(0 28px 42px rgba(0, 0, 0, 0.34))'
        : s.isDragging
          ? 'drop-shadow(0 18px 26px rgba(0, 0, 0, 0.52))'
          : 'drop-shadow(0 14px 26px rgba(0, 0, 0, 0.5))';
    }
    sprite.style.filter = `${dropShadow} ${sectionStyle.glow}`;

    // Trail (only for running states)
    const isRunning = s.petState === 'running' || s.petState === 'running-left' || s.petState === 'running-right';
    if (trail) {
      trail.style.display = isRunning ? '' : 'none';
      if (isRunning) {
        trail.style.background = sectionStyle.trail;
        trail.style.opacity = s.isScrollReacting ? '0.8' : '0.5';
        const isLeft = s.petState === 'running-left';
        trail.style.left = isLeft ? '58%' : '';
        trail.style.right = isLeft ? '' : '58%';
        trail.style.transform = isLeft ? 'rotate(180deg)' : '';
      }
    }

    // Shadow
    if (shadow) {
      shadow.style.background = sectionStyle.shadow;
      if (isFloating) {
        shadow.style.transform = 'translateX(-50%) scale(0.75)';
        shadow.style.opacity = '0.35';
        shadow.style.filter = 'blur(24px)';
      } else if (s.isDragging) {
        shadow.style.transform = 'translateX(-50%) scale(1.1)';
        shadow.style.opacity = '0.85';
        shadow.style.filter = 'blur(16px)';
      } else {
        shadow.style.transform = 'translateX(-50%) scale(1)';
        shadow.style.opacity = '0.55';
        shadow.style.filter = 'blur(12px)';
      }
    }
  }, [stateConfig, sectionStyles, scaledCellWidth, scaledCellHeight, scaledCropLeft, scaledCropTop]);

  // --- Timer helpers ---
  const clearReturnTimer = useCallback(() => {
    if (returnTimerRef.current !== null) {
      window.clearTimeout(returnTimerRef.current);
      returnTimerRef.current = null;
    }
  }, []);

  const clearWaitingTimer = useCallback(() => {
    if (waitingTimerRef.current !== null) {
      window.clearTimeout(waitingTimerRef.current);
      waitingTimerRef.current = null;
    }
  }, []);

  const clearScrollIdleTimer = useCallback(() => {
    if (scrollIdleTimerRef.current !== null) {
      window.clearTimeout(scrollIdleTimerRef.current);
      scrollIdleTimerRef.current = null;
    }
  }, []);

  const clearReleaseAnimation = useCallback(() => {
    if (releaseRafRef.current !== null) {
      window.cancelAnimationFrame(releaseRafRef.current);
      releaseRafRef.current = null;
    }
  }, []);

  // --- State transitions ---
  const queueIdleReturn = useCallback((petState: PetState) => {
    const duration = activeReturnDurations[petState];
    clearReturnTimer();
    if (!duration) return;
    returnTimerRef.current = window.setTimeout(() => {
      stateRef.current.petState = 'idle';
      stateRef.current.isEngaged = false;
      commitDOM();
      onStateChange?.('idle', 'default');
    }, duration);
  }, [activeReturnDurations, clearReturnTimer, commitDOM, onStateChange]);

  const scheduleWaiting = useCallback(() => {
    clearWaitingTimer();
    waitingTimerRef.current = window.setTimeout(() => {
      const s = stateRef.current;
      if (s.petState !== 'idle') return;
      if (window.performance.now() - lastAutoActionAtRef.current < cdAutoAction) {
        scheduleWaiting();
        return;
      }
      lastAutoActionAtRef.current = window.performance.now();
      s.isEngaged = true;
      s.petState = 'waiting';
      frameRef.current = 0;
      commitDOM();
      queueIdleReturn('waiting');
      onStateChange?.('waiting', 'idle-timeout');
    }, waitingIdleMs);
  }, [clearWaitingTimer, cdAutoAction, waitingIdleMs, commitDOM, queueIdleReturn, onStateChange]);

  const triggerState = useCallback((
    nextState: PetState,
    source: 'auto' | 'manual' = 'manual',
    shouldMarkCooldown = true,
  ) => {
    if (reduceMotion && source === 'auto') return;
    clearReturnTimer();
    clearWaitingTimer();
    if (source === 'auto' && shouldMarkCooldown) {
      lastAutoActionAtRef.current = window.performance.now();
    }
    const s = stateRef.current;
    s.isEngaged = true;
    s.petState = nextState;
    frameRef.current = 0;
    commitDOM();
    queueIdleReturn(nextState);
    onStateChange?.(nextState, PET_STATE_HOOKS[nextState]);
  }, [reduceMotion, clearReturnTimer, clearWaitingTimer, commitDOM, queueIdleReturn, onStateChange]);

  // --- Drag velocity ---
  const trimDragSamples = useCallback((samples: DragSample[]) => {
    const latest = samples.at(-1);
    if (!latest) return samples;
    return samples.filter(sample => latest.timeMs - sample.timeMs <= DRAG_SAMPLE_WINDOW_MS);
  }, []);

  const getReleaseVelocity = useCallback(() => {
    const samples = dragSamplesRef.current;
    const latest = samples.at(-1);
    if (!latest) return null;
    const baseline = samples.find(sample => latest.timeMs - sample.timeMs > 16);
    if (!baseline) return null;
    const dur = (latest.timeMs - baseline.timeMs) / 1000;
    if (dur <= 0) return null;
    const vx = (latest.x - baseline.x) / dur;
    const vy = (latest.y - baseline.y) / dur;
    const speed = Math.hypot(vx, vy);
    if (speed < DRAG_MIN_RELEASE_SPEED) return null;
    if (speed <= DRAG_MAX_RELEASE_SPEED) return { x: vx, y: vy };
    const r = DRAG_MAX_RELEASE_SPEED / speed;
    return { x: vx * r, y: vy * r };
  }, []);

  const animateRelease = useCallback((velocity: { x: number; y: number }) => {
    const origin = positionRef.current;
    if (!origin) return;
    clearReleaseAnimation();
    const projected = clampPosition({
      x: origin.x + velocity.x * 0.09,
      y: origin.y + velocity.y * 0.09,
    });
    const startedAt = window.performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / DRAG_RELEASE_DURATION_MS);
      const eased = 1 - Math.pow(1 - progress, 3);
      const next: Position = {
        x: origin.x + (projected.x - origin.x) * eased,
        y: origin.y + (projected.y - origin.y) * eased,
      };
      positionRef.current = next;
      commitDOM();
      if (progress < 1) {
        releaseRafRef.current = window.requestAnimationFrame(tick);
        return;
      }
      releaseRafRef.current = null;
      persistPosition(next);
    };
    releaseRafRef.current = window.requestAnimationFrame(tick);
  }, [clampPosition, clearReleaseAnimation, commitDOM, persistPosition]);

  // --- rAF animation loop ---
  useEffect(() => {
    let running = true;

    const tick = (now: number) => {
      if (!running) return;

      const cfg = stateConfig[stateRef.current.petState];
      const durations = cfg.frameDurationsMs;
      const fps = cfg.fps;
      const frames = cfg.frames;

      const elapsed = now - lastFrameTimeRef.current;
      const frameDuration = durations && durations.length === frames
        ? (durations[frameRef.current] ?? 1000 / fps)
        : 1000 / fps;

      if (elapsed >= frameDuration) {
        lastFrameTimeRef.current = now - (elapsed % frameDuration);
        frameRef.current = (frameRef.current + 1) % frames;

        if (spriteRef.current) {
          const x = frameRef.current * scaledCellWidth + scaledCropLeft;
          const y = cfg.row * scaledCellHeight + scaledCropTop;
          spriteRef.current.style.backgroundPosition = `-${x}px -${y}px`;
        }
      }

      rafIdRef.current = window.requestAnimationFrame(tick);
    };

    lastFrameTimeRef.current = window.performance.now();
    rafIdRef.current = window.requestAnimationFrame(tick);

    return () => {
      running = false;
      if (rafIdRef.current !== null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [stateConfig, scaledCellWidth, scaledCellHeight, scaledCropLeft, scaledCropTop]);

  // --- Position sync ---
  useEffect(() => {
    positionRef.current = position;
  }, [position]);

  useEffect(() => {
    let cancelled = false;
    const explicitCrop = viewportCrop ? normalizeViewportCrop(viewportCrop, atlas) : null;

    if (explicitCrop) {
      setResolvedViewportCrop(prev => (cropsEqual(prev, explicitCrop) ? prev : explicitCrop));
      return () => {
        cancelled = true;
      };
    }

    const fullCellCrop = createFullCellCrop(atlas);
    setResolvedViewportCrop(prev => (cropsEqual(prev, fullCellCrop) ? prev : fullCellCrop));

    inferViewportCrop(spritesheetSrc, atlas, stateConfig)
      .then((nextCrop) => {
        if (cancelled || !nextCrop) return;
        setResolvedViewportCrop(prev => (cropsEqual(prev, nextCrop) ? prev : nextCrop));
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, [viewportCrop, spritesheetSrc, atlas, stateConfig]);

  // --- Resize ---
  useEffect(() => {
    const update = () => {
      const next = window.innerWidth < mobileBreakpoint;
      isCompactRef.current = next;
      setIsCompact(next);
    };
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, [mobileBreakpoint]);

  useEffect(() => {
    const handleResize = () => {
      const ratio = positionRatioRef.current;
      if (!ratio) return;
      const next = clampPosition(ratioToPixel(ratio));
      positionRatioRef.current = pixelToRatio(next);
      setPosition(next);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [clampPosition, ratioToPixel, pixelToRatio]);

  // --- Mount ---
  useEffect(() => {
    mountedAtRef.current = window.performance.now();
    lastScrollYRef.current = window.scrollY;
    const loaded = loadPersistedPosition();
    const ratio = defaultPositionRatio === DEFAULT_POSITION_RATIO && window.innerWidth < mobileBreakpoint
      ? MOBILE_POSITION_RATIO : defaultPositionRatio;
    const initial = clampPosition(loaded ?? ratioToPixel(ratio));
    positionRatioRef.current = pixelToRatio(initial);
    positionRef.current = initial;
    setPosition(initial);
    scheduleWaiting();

    return () => {
      clearReturnTimer();
      clearWaitingTimer();
      clearScrollIdleTimer();
      clearReleaseAnimation();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- Idle scheduling ---
  useEffect(() => {
    if (stateRef.current.petState === 'idle') {
      stateRef.current.isEngaged = false;
      scheduleWaiting();
      commitDOM();
    }
  }, [position, scheduleWaiting, commitDOM]);

  // --- Scroll reaction ---
  useEffect(() => {
    const handleScroll = () => {
      const now = window.performance.now();
      const currentY = window.scrollY;
      const delta = currentY - lastScrollYRef.current;
      lastScrollYRef.current = currentY;

      if (now - mountedAtRef.current < MOUNT_SCROLL_GUARD_MS) return;
      if (stateRef.current.isDragging) return;

      scrollDeltaAccRef.current += delta;
      if (!scrollSessionActiveRef.current && Math.abs(scrollDeltaAccRef.current) < SCROLL_REACTION_DELTA) return;

      const directionDelta = scrollSessionActiveRef.current ? delta : scrollDeltaAccRef.current;
      scrollDeltaAccRef.current = 0;

      clearScrollIdleTimer();

      const s = stateRef.current;
      if (!scrollSessionActiveRef.current || s.petState === 'idle') {
        scrollSessionActiveRef.current = true;
        s.isScrollReacting = true;
        s.isEngaged = true;
        s.petState = 'running';
        frameRef.current = 0;
        clearReturnTimer();
        commitDOM();
        onStateChange?.('running', 'page-scroll');
      } else if (s.petState === 'running' || s.petState === 'running-left' || s.petState === 'running-right') {
        if (Math.abs(directionDelta) > SCROLL_REACTION_DELTA * 3) {
          s.petState = 'running';
          frameRef.current = 0;
          commitDOM();
        }
      }

      scrollIdleTimerRef.current = window.setTimeout(() => {
        scrollSessionActiveRef.current = false;
        scrollDeltaAccRef.current = 0;
        stateRef.current.isScrollReacting = false;
        stateRef.current.isEngaged = false;
        stateRef.current.petState = 'idle';
        commitDOM();
        lastAutoActionAtRef.current = window.performance.now();
        scheduleWaiting();
        onStateChange?.('idle', 'default');
      }, cdScrollIdle);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', handleScroll);
      clearScrollIdleTimer();
    };
  }, [clearReturnTimer, clearScrollIdleTimer, commitDOM, scheduleWaiting, cdScrollIdle, onStateChange]);

  // --- Section detection ---
  useEffect(() => {
    let animationFrameId: number | null = null;

    const readActiveSection = (): string => {
      const viewportLine = window.innerHeight * 0.52;
      const sectionElements = sections.map(s => ({
        id: s.id,
        element: document.getElementById(s.id),
      }));

      let nextSection = '';
      for (const section of sectionElements) {
        if (!section.element) continue;
        const rect = section.element.getBoundingClientRect();
        if (rect.top <= viewportLine && rect.bottom >= viewportLine) {
          return section.id;
        }
        if (rect.top < viewportLine) {
          nextSection = section.id;
        }
      }
      return nextSection;
    };

    const updateActiveSection = () => {
      animationFrameId = null;
      const nextSection = readActiveSection();
      if (nextSection === stateRef.current.activeSection) return;

      stateRef.current.activeSection = nextSection;
      commitDOM();
      onSectionChange?.(nextSection);

      const now = window.performance.now();
      if (
        now - mountedAtRef.current > MOUNT_SCROLL_GUARD_MS
        && now - lastSectionReactionAtRef.current > cdSection
        && stateRef.current.petState === 'idle'
        && !stateRef.current.isDragging
        && !scrollSessionActiveRef.current
      ) {
        lastSectionReactionAtRef.current = now;
        const reaction = sectionReactions[nextSection];
        if (reaction) {
          triggerState(reaction, 'auto', false);
        }
      }
    };

    const requestUpdate = () => {
      if (animationFrameId !== null) return;
      animationFrameId = window.requestAnimationFrame(updateActiveSection);
    };

    requestUpdate();
    window.addEventListener('scroll', requestUpdate, { passive: true });
    window.addEventListener('resize', requestUpdate);

    return () => {
      if (animationFrameId !== null) window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener('scroll', requestUpdate);
      window.removeEventListener('resize', requestUpdate);
    };
  }, [sections, sectionReactions, cdSection, triggerState, commitDOM, onSectionChange]);

  // --- Interactive surface detection ---
  useEffect(() => {
    const findInteractiveSurface = (target: EventTarget | null) => {
      if (!(target instanceof Element)) return null;
      return target.closest(interactiveSelector);
    };

    const canReactToSurface = (surface: Element | null) => {
      if (!surface) return false;
      if (surface.closest(`[aria-label="${ariaLabel}"]`)) return false;
      if (stateRef.current.isDragging || scrollSessionActiveRef.current) return false;
      if (stateRef.current.petState !== 'idle') return false;
      return window.performance.now() - lastSurfaceReactionAtRef.current >= cdSurface;
    };

    const canReactToReviewSurface = (surface: Element | null) => {
      if (!surface || !reviewSelector) return false;
      if (!surface.closest(reviewSelector)) return false;
      if (surface.closest(`[aria-label="${ariaLabel}"]`)) return false;
      if (stateRef.current.isDragging || scrollSessionActiveRef.current) return false;
      if (stateRef.current.petState !== 'idle') return false;
      return window.performance.now() - lastReviewReactionAtRef.current >= cdReview;
    };

    const handleSurfaceHover = (event: PointerEvent | MouseEvent) => {
      const surface = findInteractiveSurface(event.target);
      if (canReactToReviewSurface(surface)) {
        lastReviewReactionAtRef.current = window.performance.now();
        triggerState('review', 'auto', false);
        return;
      }
      if (canReactToSurface(surface)) {
        lastSurfaceReactionAtRef.current = window.performance.now();
        triggerState('waving', 'auto', false);
      }
    };

    const handleSurfaceClick = (event: MouseEvent) => {
      const surface = findInteractiveSurface(event.target);
      if (canReactToReviewSurface(surface)) {
        lastReviewReactionAtRef.current = window.performance.now();
        triggerState('review', 'auto', false);
        return;
      }
      if (canReactToSurface(surface)) {
        lastSurfaceReactionAtRef.current = window.performance.now();
        triggerState('jumping', 'auto', false);
      }
    };

    const handleSurfaceFocus = (event: FocusEvent) => {
      const surface = findInteractiveSurface(event.target);
      if (canReactToReviewSurface(surface)) {
        lastReviewReactionAtRef.current = window.performance.now();
        triggerState('review', 'auto', false);
        return;
      }
      if (canReactToSurface(surface)) {
        lastSurfaceReactionAtRef.current = window.performance.now();
        triggerState('waving', 'auto', false);
      }
    };

    document.addEventListener('pointerover', handleSurfaceHover, true);
    document.addEventListener('mouseover', handleSurfaceHover, true);
    document.addEventListener('click', handleSurfaceClick, true);
    document.addEventListener('focusin', handleSurfaceFocus, true);

    return () => {
      document.removeEventListener('pointerover', handleSurfaceHover, true);
      document.removeEventListener('mouseover', handleSurfaceHover, true);
      document.removeEventListener('click', handleSurfaceClick, true);
      document.removeEventListener('focusin', handleSurfaceFocus, true);
    };
  }, [interactiveSelector, reviewSelector, ariaLabel, cdSurface, cdReview, triggerState]);

  // --- Global signals ---
  useEffect(() => {
    const canReactToGlobalSignal = (lastReactionRef: React.MutableRefObject<number>, cd: number) => {
      if (stateRef.current.isDragging || scrollSessionActiveRef.current) return false;
      if (stateRef.current.petState !== 'idle') return false;
      return window.performance.now() - lastReactionRef.current >= cd;
    };

    const triggerReview = () => {
      if (!canReactToGlobalSignal(lastReviewReactionAtRef, cdReview)) return;
      lastReviewReactionAtRef.current = window.performance.now();
      triggerState('review', 'auto', false);
    };

    const triggerFailed = () => {
      if (!canReactToGlobalSignal(lastFailedReactionAtRef, cdFailed)) return;
      lastFailedReactionAtRef.current = window.performance.now();
      triggerState('failed', 'auto', false);
    };

    const handleSelectionChange = () => {
      const text = window.getSelection()?.toString().trim() ?? '';
      if (text.length >= TEXT_SELECTION_MIN_LENGTH) triggerReview();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') triggerFailed();
    };

    const handleResourceError = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) return;
      if (target.closest(`[aria-label="${ariaLabel}"]`)) return;
      if (target instanceof HTMLImageElement || target instanceof HTMLVideoElement) {
        triggerFailed();
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('error', handleResourceError, true);

    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('error', handleResourceError, true);
    };
  }, [ariaLabel, cdReview, cdFailed, triggerState]);

  // --- Pet interaction handlers ---
  const handleHover = useCallback(() => {
    if (stateRef.current.isDragging) return;
    if (stateRef.current.petState !== 'idle') return;
    if (window.performance.now() - lastAutoActionAtRef.current < cdAutoAction) return;
    triggerState('waving', 'auto');
  }, [cdAutoAction, triggerState]);

  const handleActivate = useCallback(() => {
    if (stateRef.current.isDragging) return;
    triggerState('jumping', 'manual');
  }, [triggerState]);

  const handlePointerDown = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (position === null) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    dragPointerIdRef.current = event.pointerId;
    dragStartPointRef.current = { x: event.clientX, y: event.clientY };
    dragStartPositionRef.current = position;
    dragSamplesRef.current = trimDragSamples([{ x: event.clientX, y: event.clientY, timeMs: event.timeStamp }]);
    hasMovedRef.current = false;
    clearReleaseAnimation();
    clearReturnTimer();
    clearWaitingTimer();
  }, [position, trimDragSamples, clearReleaseAnimation, clearReturnTimer, clearWaitingTimer]);

  const handlePointerMove = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    if (!dragStartPointRef.current || !dragStartPositionRef.current) return;

    const deltaX = event.clientX - dragStartPointRef.current.x;
    const deltaY = event.clientY - dragStartPointRef.current.y;

    if (!hasMovedRef.current && Math.hypot(deltaX, deltaY) < DRAG_THRESHOLD) return;

    dragSamplesRef.current = trimDragSamples([...dragSamplesRef.current, { x: event.clientX, y: event.clientY, timeMs: event.timeStamp }]);
    hasMovedRef.current = true;

    const s = stateRef.current;
    s.isDragging = true;
    s.isEngaged = true;
    s.dragVector = { x: deltaX, y: deltaY };

    const isFloating = deltaY <= -FLOATING_DRAG_THRESHOLD && Math.abs(deltaY) >= Math.abs(deltaX) * 0.65;
    s.petState = isFloating
      ? 'jumping'
      : deltaX >= DRAG_THRESHOLD
        ? 'running-right'
        : deltaX <= -DRAG_THRESHOLD
          ? 'running-left'
          : 'idle';
    frameRef.current = 0;

    const next = clampPosition({
      x: dragStartPositionRef.current.x + deltaX,
      y: dragStartPositionRef.current.y + deltaY,
    });
    positionRef.current = next;
    commitDOM();
  }, [trimDragSamples, clampPosition, commitDOM]);

  const finishDrag = useCallback(() => {
    dragPointerIdRef.current = null;
    dragStartPointRef.current = null;
    dragStartPositionRef.current = null;
    dragSamplesRef.current = [];
  }, []);

  const handlePointerUp = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    const dragged = hasMovedRef.current;
    const releaseVelocity = getReleaseVelocity();
    finishDrag();

    if (dragged) {
      if (positionRef.current) persistPosition(positionRef.current);
      const s = stateRef.current;
      s.isDragging = false;
      s.isEngaged = false;
      s.dragVector = { x: 0, y: 0 };
      s.petState = 'idle';
      commitDOM();
      lastAutoActionAtRef.current = window.performance.now();
      if (releaseVelocity && !reduceMotion) {
        animateRelease(releaseVelocity);
      }
      scheduleWaiting();
      return;
    }

    stateRef.current.isDragging = false;
    stateRef.current.dragVector = { x: 0, y: 0 };
    commitDOM();
    handleActivate();
  }, [getReleaseVelocity, finishDrag, persistPosition, commitDOM, reduceMotion, animateRelease, scheduleWaiting, handleActivate]);

  const handlePointerCancel = useCallback((event: React.PointerEvent<HTMLButtonElement>) => {
    if (dragPointerIdRef.current !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    finishDrag();
    const s = stateRef.current;
    s.isDragging = false;
    s.isEngaged = false;
    s.dragVector = { x: 0, y: 0 };
    s.petState = 'idle';
    commitDOM();
    scheduleWaiting();
  }, [finishDrag, commitDOM, scheduleWaiting]);

  // --- Render ---
  if (position === null) return null;

  const sectionStyle = sectionStyles[stateRef.current.activeSection] ?? NEUTRAL_SECTION_STYLE;

  return (
    <button
      ref={containerRef}
      type="button"
      onMouseEnter={handleHover}
      onFocus={(e) => {
        handleHover();
        e.currentTarget.style.borderRadius = '12px';
        e.currentTarget.style.boxShadow = '0 0 0 2px rgba(16, 185, 129, 0.55)';
      }}
      onBlur={(e) => {
        e.currentTarget.style.boxShadow = '';
      }}
      onTouchStart={() => { stateRef.current.isEngaged = true; commitDOM(); }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'fixed',
        zIndex: 30,
        appearance: 'none',
        border: 0,
        background: 'transparent',
        padding: 0,
        userSelect: 'none',
        touchAction: 'none',
        left: `${position.x}px`,
        top: `${position.y}px`,
        cursor: 'grab',
        outline: 'none',
        contain: 'layout style',
      }}
      aria-label={ariaLabel}
      data-pet-state="idle"
      data-pet-hook="default"
      data-pet-section=""
      data-pet-scroll-reacting="false"
    >
      <div
        ref={trailRef}
        className="pet-trail"
        style={{
          position: 'absolute',
          top: '42%',
          zIndex: -1,
          width: '96px',
          height: '36px',
          borderRadius: '9999px',
          filter: 'blur(12px)',
          pointerEvents: 'none',
          display: 'none',
          background: sectionStyle.trail,
        }}
      />
      <div
        ref={shadowRef}
        className="pet-shadow"
        style={{
          position: 'absolute',
          left: '16%',
          top: '78%',
          zIndex: -1,
          width: '68%',
          height: '20px',
          borderRadius: '9999px',
          filter: 'blur(12px)',
          pointerEvents: 'none',
          transform: 'translateX(-50%)',
          background: sectionStyle.shadow,
        }}
      />
      <div
        ref={spriteRef}
        style={{
          pointerEvents: 'none',
          backgroundRepeat: 'no-repeat',
          transition: 'transform 200ms ease, opacity 200ms ease',
          width: `${spriteWidth}px`,
          height: `${spriteHeight}px`,
          backgroundImage: `url(${spritesheetSrc})`,
          backgroundSize: `${scaledAtlasWidth}px auto`,
          backgroundPosition: `-${scaledCropLeft}px -${scaledCropTop}px`,
          imageRendering: 'auto',
        }}
      />
    </button>
  );
};

export default React.memo(CodexPet);
