import type GameEditor from "./GameEditor";
import type { GridSaveFile } from "./saveFile";
import { serializeTiles } from "./serializeTiles";

export function createSaveFile(scene: GameEditor): GridSaveFile {
  return {
    version: 1,
    tiles: serializeTiles(scene),
  };
}
