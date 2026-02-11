// layeredOccupancy.ts
import { GridOccupancy } from "./occupancy";

export type LayerId = string;
export const DEFAULT_LAYER = "default";

export class LayeredOccupancy<T = unknown> {
  private layers = new Map<LayerId, GridOccupancy<T>>();
  private readonly defaultLayerId: LayerId;

  constructor(defaultLayerId: LayerId = "default") {
    this.defaultLayerId = defaultLayerId;
    this.ensureLayer(defaultLayerId);
  }

  // --- layer management ---

  ensureLayer(layerId: LayerId): GridOccupancy<T> {
    let layer = this.layers.get(layerId);
    if (!layer) {
      layer = new GridOccupancy<T>();
      this.layers.set(layerId, layer);
    }
    return layer;
  }

  getLayer(layerId?: LayerId): GridOccupancy<T> {
    return this.ensureLayer(layerId ?? this.defaultLayerId);
  }

  // --- queries ---

  has(gx: number, gy: number, layerId?: LayerId): boolean {
    return this.getLayer(layerId).has(gx, gy);
  }

  get(gx: number, gy: number, layerId?: LayerId): T | undefined {
    return this.getLayer(layerId).get(gx, gy);
  }

  // --- mutation ---

  canPlace(gx: number, gy: number, layerId?: LayerId): boolean {
    // rule: only block within the same layer
    return !this.has(gx, gy, layerId);
  }

  set(gx: number, gy: number, item: T, layerId?: LayerId): boolean {
    if (!this.canPlace(gx, gy, layerId)) {
      return false;
    }
    this.getLayer(layerId).set(gx, gy, item);
    return true;
  }

  delete(gx: number, gy: number, layerId?: LayerId): void {
    this.getLayer(layerId).delete(gx, gy);
  }

  clearLayer(layerId?: LayerId): void {
    this.getLayer(layerId).clear();
  }

  // --- utilities ---

  *layersEntries(): IterableIterator<[LayerId, GridOccupancy<T>]> {
    yield* this.layers.entries();
  }
}
