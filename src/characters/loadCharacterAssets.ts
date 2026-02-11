// characters/loadCharacterAssets.ts
import Phaser from "phaser";
import {
  loadCharacterRegistry,
  getCharacterRegistry,
} from "./characterRegistry";
import type { FacingDirection } from "./characterConfig";

let enqueued = false;

const DIRECTIONS: FacingDirection[] = ["left", "right", "top", "bottom"];

function isAnimFrame(animName: string, framePath: string): boolean {
  const filename = framePath.split("/").pop()?.toLowerCase() ?? "";
  const animPrefix = animName.toLowerCase();

  return (
    filename.endsWith(".png") &&
    (filename === `${animPrefix}.png` ||
      filename.startsWith(`${animPrefix}_`) ||
      filename.startsWith(`${animPrefix}-`))
  );
}

export async function loadCharacterAssets(scene: Phaser.Scene): Promise<void> {
  if (enqueued) return;

  console.group("[Characters] Enqueueing character assets");

  loadCharacterRegistry();
  const registry = getCharacterRegistry();

  for (const character of registry.values()) {
    const { id, configPath, views2D } = character;

    // ---------------------------------------
    // Config JSON
    // ---------------------------------------
    if (configPath && !scene.cache.json.exists(configPath)) {
      scene.load.json(configPath, configPath);
    }

    // ---------------------------------------
    // 🔥 Directional headshots (data-driven)
    // ---------------------------------------
    const supportedDirs = new Set(Object.keys(views2D) as FacingDirection[]);

    for (const dir of DIRECTIONS) {
      if (!supportedDirs.has(dir)) continue;

      const key = `${id}_head_${dir}`;
      const path = `/assets/characters/${id}/2d_${dir}/headshot.png`;

      if (scene.textures.exists(key)) continue;

      scene.load.image(key, path);
    }

    // ---------------------------------------
    // Animation frames (unchanged)
    // ---------------------------------------
    for (const view of Object.values(views2D)) {
      for (const anim of Object.values(view.animations)) {
        for (const framePath of anim.frames) {
          if (!isAnimFrame(anim.name, framePath)) continue;
          if (scene.textures.exists(framePath)) continue;

          scene.load.image(framePath, framePath);
        }
      }
    }
  }

  enqueued = true;
  console.groupEnd();
}
