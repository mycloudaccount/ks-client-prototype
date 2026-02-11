import type { CharacterConfig } from "./characterConfig";

export type CharacterAnimation = {
  name: string;
  frames: string[];
};

export type CharacterView = {
  direction: string;
  animations: Record<string, CharacterAnimation>;
};

export type DiscoveredCharacter = {
  id: string;
  views2D: Record<string, CharacterView>;
  config: CharacterConfig;
  configPath: string; // added
};

export class CharacterDiscoveryService {
  private configFiles = import.meta.glob<{ default: CharacterConfig }>(
    "/public/assets/characters/*/*.json",
    {
      eager: true,
    },
  );

  discoverAll(): Map<string, DiscoveredCharacter> {
    const files = import.meta.glob(
      "/public/assets/characters/**/2d_*/**/*.png",
      {
        eager: true,
      },
    );

    const characters = new Map<string, DiscoveredCharacter>();

    for (const fullPath of Object.keys(files)) {
      const rel = fullPath.replace("/public/assets/characters/", "");
      const parts = rel.split("/");

      const [charId, viewDir, animName] = parts;

      if (!charId || !viewDir || !animName) continue;

      const direction = viewDir.replace("2d_", "");

      let character = characters.get(charId);

      if (!character) {
        const config = this.getCharacterConfig(charId);

        character = {
          id: charId,
          views2D: {},
          config,
          configPath: `/public/assets/characters/${charId}/${charId}.json`, // set here
        };

        characters.set(charId, character);
      }

      let view = character.views2D[direction];
      if (!view) {
        view = { direction, animations: {} };
        character.views2D[direction] = view;
      }

      let anim = view.animations[animName];
      if (!anim) {
        anim = { name: animName, frames: [] };
        view.animations[animName] = anim;
      }

      anim.frames.push(fullPath.replace("/public", ""));
    }

    // Ensure frame order
    for (const character of characters.values()) {
      for (const view of Object.values(character.views2D)) {
        for (const anim of Object.values(view.animations)) {
          anim.frames.sort();
        }
      }
    }

    return characters;
  }

  private getCharacterConfig(charId: string): CharacterConfig {
    const configPath = `/public/assets/characters/${charId}/${charId}.json`;

    const configModule = this.configFiles[configPath];

    if (!configModule) {
      throw new Error(`[Characters] Missing config for: ${charId}`);
    }

    return configModule.default;
  }
}
