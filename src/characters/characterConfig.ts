/**
 * Animation definition per state (walk, idle, etc.)
 */
export type CharacterAnimationConfig = {
  FRAME_COUNT: number;
  FPS: number;
  START_FRAME: number;
  END_FRAME: number;
  SAMPLED: boolean;
};

/**
 * Directions supported by animations & headshots
 */
export type FacingDirection = "left" | "right" | "top" | "bottom";

/**
 * Optional directional headshots
 * Example:
 * {
 *   left: "2d_left/headshot.png"
 * }
 */
export type CharacterHeadshotConfig = Partial<Record<FacingDirection, string>>;

/**
 * Master character config
 */
export type CharacterConfig = {
  CHAR_NAME: string;
  JUMP_STRENGTH: number;
  SPRITE_SCALE_FACTOR: number;
  RENDER_SIZE: number;
  DEFAULT_ANIMATION_NAME: string;

  // ----------------------------------
  // Optional UI headshots
  // ----------------------------------
  HEADSHOTS?: CharacterHeadshotConfig;

  // ----------------------------------
  // Animations keyed by state name
  // ----------------------------------
  ANIMATIONS: Record<string, CharacterAnimationConfig>;
};
