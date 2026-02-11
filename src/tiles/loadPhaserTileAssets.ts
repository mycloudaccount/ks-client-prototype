import Phaser from "phaser";
import { getAllTiles } from "./tileLoader";

const DEBUG_TILE_PRELOAD = true;

/**
 * Queues all tile images into Phaser's Loader.
 * Synchronous (Phaser loader is event-driven).
 * Safe to call multiple times.
 */
export function loadTileImages(scene: Phaser.Scene): void {
  if (DEBUG_TILE_PRELOAD) {
    console.group("[TilePreload] Begin");
  }

  const tiles = getAllTiles();

  const uniqueFiles = new Set<string>();
  for (const tile of tiles) {
    for (const file of Object.values(tile.images)) {
      uniqueFiles.add(file);
    }
  }

  if (DEBUG_TILE_PRELOAD) {
    console.log(`[TilePreload] Found ${uniqueFiles.size} unique image files`);
    console.table([...uniqueFiles].map((f) => ({ file: f })));
  }

  let queued = 0;
  let skipped = 0;

  // ---- Attach COMPLETE listener FIRST (debug only) ----
  if (DEBUG_TILE_PRELOAD) {
    scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      const keys = scene.textures.getTextureKeys();
      const missing: string[] = [];

      for (const file of uniqueFiles) {
        if (!keys.includes(file)) {
          missing.push(file);
        }
      }

      if (missing.length > 0) {
        console.error("[TilePreload] Missing textures after load:", missing);
      } else {
        console.log("[TilePreload] All tile textures loaded successfully");
      }

      console.groupEnd();
    });
  }

  // ---- Queue files ----
  for (const file of uniqueFiles) {
    if (scene.textures.exists(file)) {
      skipped++;
      if (DEBUG_TILE_PRELOAD) {
        console.debug(`[TilePreload] Skip (already loaded): ${file}`);
      }
      continue;
    }

    queued++;
    if (DEBUG_TILE_PRELOAD) {
      console.debug(`[TilePreload] Queue load: ${file}`);
    }

    scene.load.image(file, `/assets/tiles/${file}`);
  }

  if (DEBUG_TILE_PRELOAD) {
    console.log(`[TilePreload] Queued ${queued}, skipped ${skipped}`);
    console.debug("[TilePreload] Loader state:", {
      isLoading: scene.load.isLoading(),
      totalQueued: scene.load.totalToLoad,
    });
  }

  // ---- Explicitly start loader if needed ----
  if (queued > 0 && !scene.load.isLoading()) {
    scene.load.start();
  } else if (queued === 0 && DEBUG_TILE_PRELOAD) {
    console.log("[TilePreload] Nothing to load");
    console.groupEnd();
  }
}
