import type { TileDef, TilesJson, TileId } from "./tileTypes";

let cachedRegistry: Record<TileId, TileDef> | null = null;
let loadingPromise: Promise<Record<TileId, TileDef>> | null = null;

function asTileId(id: string): TileId {
  return id as TileId;
}

/* ============================
   ASYNC INITIALIZER (IDEMPOTENT)
============================ */
export async function loadTileRegistry(): Promise<Record<TileId, TileDef>> {
  // Fast path
  if (cachedRegistry) return cachedRegistry;

  // Shared in-flight promise
  if (loadingPromise) return loadingPromise;

  loadingPromise = (async () => {
    const res = await fetch("/assets/tiles/tiles.json");
    if (!res.ok) {
      throw new Error("Failed to load /assets/tiles/tiles.json");
    }

    const data = (await res.json()) as TilesJson;

    const registry: Record<TileId, TileDef> = {} as Record<TileId, TileDef>;

    for (const tile of data.tiles) {
      if (typeof tile.id !== "string") {
        throw new Error("Invalid tile id");
      }

      const id = asTileId(tile.id);

      registry[id] = {
        ...tile,
        id,
      };
    }

    cachedRegistry = registry;
    return registry;
  })();

  return loadingPromise;
}

/* ============================
   SYNC ACCESSORS (UNCHANGED)
============================ */
export function getTileRegistry(): Record<TileId, TileDef> {
  if (!cachedRegistry) {
    throw new Error("Tile registry not loaded. Call loadTileRegistry() first.");
  }
  return cachedRegistry;
}

export function getAllTiles(): TileDef[] {
  return Object.values(getTileRegistry());
}

/* ============================
   OPTIONAL HELPERS (NON-BREAKING)
============================ */

/**
 * Safe check for consumers that want to avoid throwing.
 */
export function isTileRegistryLoaded(): boolean {
  return cachedRegistry !== null;
}

/**
 * Returns all unique image keys used by all tiles (all variants).
 * Useful for Phaser preload or UI warmup.
 */
export function getAllTileImageKeys(): string[] {
  const tiles = getAllTiles();
  const keys = new Set<string>();

  for (const tile of tiles) {
    for (const key of Object.values(tile.images)) {
      keys.add(key);
    }
  }

  return [...keys];
}
