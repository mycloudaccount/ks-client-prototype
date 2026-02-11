import type GameEditor from "./GameEditor";
import type { GridSaveFile } from "./saveFile";

export function loadGrid(scene: GameEditor, saveFile: GridSaveFile) {
  // Future-proof version handling
  if (saveFile.version !== 1) {
    throw new Error(`Unsupported save version: ${saveFile.version}`);
  }

  scene.tileService.clearAllTiles();
  scene.tileService.loadTiles(saveFile.tiles);
}
