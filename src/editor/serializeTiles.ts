import type GameEditor from "./GameEditor";
import type { TileData } from "./tileData";

export function serializeTiles(scene: GameEditor): TileData[] {
  return scene.tileService.getPlacedTiles().map((tile) => tile.tileData);
}
