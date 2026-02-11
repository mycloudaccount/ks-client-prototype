export type AnimationSpec = {
  key: string;
  frameRate: number;
  repeat: number; // -1 = loop
};

const DEFAULT_FPS = 8;

export function inferAnimationSpec(
  characterId: string,
  direction: string,
  animName: string,
): AnimationSpec {
  const baseKey = `${characterId}.${animName}.${direction}`;

  // Rules by animation name
  switch (animName) {
    case "idle":
      return {
        key: baseKey,
        frameRate: 4,
        repeat: -1,
      };

    case "walk":
      return {
        key: baseKey,
        frameRate: 8,
        repeat: -1,
      };

    case "run":
      return {
        key: baseKey,
        frameRate: 12,
        repeat: -1,
      };

    case "attack":
      return {
        key: baseKey,
        frameRate: 10,
        repeat: 0,
      };

    case "death":
      return {
        key: baseKey,
        frameRate: 6,
        repeat: 0,
      };

    default:
      return {
        key: baseKey,
        frameRate: DEFAULT_FPS,
        repeat: -1,
      };
  }
}
