// src/editor/tileData.ts
import type { TileId } from "@/tiles/tileTypes";

export interface TileData {
  id: string; // stable identifier (uuid)
  type: TileId; // runtime tile identifier
  gx: number;
  gy: number;

  // extensible metadata
  rotation?: number;
  tags?: string[];
  custom?: Record<string, unknown>;
  view?: string;
}
