// tile/tileUtils.ts
import Phaser from "phaser";
import type { PlacedTile } from "../types";

export function isTile(obj: unknown): obj is PlacedTile {
  return (
    obj instanceof Phaser.GameObjects.Container &&
    (obj as PlacedTile).getData?.("kind") === "tile"
  );
}
