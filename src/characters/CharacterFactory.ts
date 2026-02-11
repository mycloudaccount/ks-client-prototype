import Phaser from "phaser";
import { getCharacterRegistry } from "./characterRegistry";
import type { DiscoveredCharacter } from "./CharacterDiscoveryService";

/**
 * Cardinal / facing directions used by animations & headshots
 */
export type FacingDirection = "left" | "right" | "top" | "bottom";

export type SpawnCharacterOptions = {
  id: string;
  x: number;
  y: number;
  direction?: FacingDirection;
  depth?: number;
  animation?: string;
};

export class CharacterFactory {
  static spawn(
    scene: Phaser.Scene,
    options: SpawnCharacterOptions,
  ): Phaser.GameObjects.Sprite {
    const { id, x, y, direction = "bottom", depth, animation } = options;

    const registry = getCharacterRegistry();
    const character = registry.get(id);

    if (!character) {
      throw new Error(`[Characters] Character not found: ${id}`);
    }

    const sprite = scene.add.sprite(x, y, id);

    // Anchor feet to tile
    sprite.setOrigin(0.5, 1);

    if (depth !== undefined) {
      sprite.setDepth(depth);
    }

    // -----------------------------
    // Apply scale from config
    // -----------------------------
    sprite.setScale(character.config.SPRITE_SCALE_FACTOR);

    // -----------------------------
    // Resolve animation name
    // -----------------------------
    const animName =
      animation ??
      character.config.DEFAULT_ANIMATION_NAME ??
      CharacterFactory.getFirstAnimationName(character);

    if (!animName) {
      console.warn(`[Characters] No animation found for ${id}`);
      return sprite;
    }

    const animKey = `${id}.${animName}.${direction}`;

    if (!scene.anims.exists(animKey)) {
      console.warn(`[Characters] Missing animation: ${animKey}`);
      return sprite;
    }

    sprite.play(animKey);

    return sprite;
  }

  // --------------------------------------------------
  // Headshot resolver (UI / dialogue / HUD use)
  // --------------------------------------------------
  static getHeadshotPath(
    character: DiscoveredCharacter,
    direction: FacingDirection,
  ): string | undefined {
    const headshots = character.config.HEADSHOTS;
    if (!headshots) return undefined;

    // Prefer exact direction, then bottom, then any
    return (
      headshots[direction] ?? headshots["bottom"] ?? Object.values(headshots)[0]
    );
  }

  private static getFirstAnimationName(
    character: DiscoveredCharacter,
  ): string | undefined {
    return Object.keys(character.config.ANIMATIONS)[0];
  }
}
