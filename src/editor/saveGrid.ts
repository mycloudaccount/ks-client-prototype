import type GameEditor from "./GameEditor";
import { createSaveFile } from "./createSaveFile";
import { downloadJson } from "./downloadJson";

export function saveGrid(scene: GameEditor) {
  const saveFile = createSaveFile(scene);
  downloadJson(saveFile, "grid.json");
}
