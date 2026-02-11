import Phaser from "phaser";
import { getCharacterRegistry } from "./characterRegistry";

function getFrameNumber(filename: string): number | null {
  const match = filename.match(/(\d+)(?=\.\w+$)/);
  return match ? parseInt(match[1], 10) : null;
}

export function registerCharacterAnimations(scene: Phaser.Scene) {
  console.group("[Characters] Registering animations");

  const registry = getCharacterRegistry();

  for (const character of registry.values()) {
    for (const [viewName, view] of Object.entries(character.views2D)) {
      for (const [animName, anim] of Object.entries(view.animations)) {
        const animKey = `${character.id}.${animName}.${viewName}`;

        const configAnim = character.config.ANIMATIONS[animName];

        if (!configAnim) {
          console.warn(
            `[Characters] No config entry for ${character.id}.${animName}`,
          );
          continue;
        }

        const frameKeys = anim.frames
          .filter((path) => {
            const filename = path.split("/").pop()?.toLowerCase();
            if (!filename) return false;
            if (filename === "sheet.png") return false;
            return scene.textures.exists(path);
          })
          .sort((a, b) => {
            const aNum = getFrameNumber(a.split("/").pop()!);
            const bNum = getFrameNumber(b.split("/").pop()!);
            if (aNum === null || bNum === null) return 0;
            return aNum - bNum;
          });

        if (frameKeys.length === 0) {
          console.warn(
            `[Characters] Skipping ${animKey}: no valid frames found`,
          );
          continue;
        }

        scene.anims.create({
          key: animKey,
          frames: frameKeys.map((key) => ({ key })),
          frameRate: configAnim.FPS,
          repeat: -1,
        });

        console.log(
          `✓ ${animKey} (${frameKeys.length} frames @ ${configAnim.FPS}fps)`,
        );
      }
    }
  }

  console.groupEnd();
}
