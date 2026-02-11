// assets/AssetLoaderService.ts

import { loadTileAssets } from "@/tiles/loadUITileAssets";
import { loadTileRegistry } from "@/tiles/tileLoader";
import { loadCharacterRegistry } from "@/characters/characterRegistry";

let loaded = false;

export async function loadGameAssets(): Promise<void> {
  if (loaded) return;

  console.group("[Assets] Loading game assets");

  await loadTileRegistry();
  await loadCharacterRegistry();

  await Promise.all([
    loadTileAssets(),
    // character assets are scene-bound, loaded later
  ]);

  loaded = true;
  console.groupEnd();
}
