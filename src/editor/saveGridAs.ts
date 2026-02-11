import type GameEditor from "./GameEditor";
import { createSaveFile } from "./createSaveFile";
import { downloadJson } from "./downloadJson";

export function saveGridAs(scene: GameEditor) {
  const defaultName = "scene.json";

  const filename = window.prompt("Save As…", defaultName);
  if (!filename) return; // user cancelled

  const saveFile = createSaveFile(scene);
  downloadJson(
    saveFile,
    filename.endsWith(".json") ? filename : `${filename}.json`,
  );
}
