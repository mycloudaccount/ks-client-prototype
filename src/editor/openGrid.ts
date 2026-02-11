import type GameEditor from "./GameEditor";
import type { GridSaveFile } from "./saveFile";
import { openJsonFile } from "./openJsonFile";
import { loadGrid } from "./loadGrid";

export async function openGrid(scene: GameEditor) {
  const data = await openJsonFile();
  if (!data) return;

  loadGrid(scene, data as GridSaveFile);
}
