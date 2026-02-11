// src/context/appState.ts

import type { TileId } from "@/tiles/tileTypes";
// ❌ remove TileType import

export type GridPoint = {
  gx: number;
  gy: number;
};

export type GridStatus = {
  center: GridPoint;
  cursor: GridPoint;
  zoom: number;
};

export type AppState = {
  gridStatus: GridStatus;
  selectedTile: TileId;
};

/**
 * NOTE:
 * Initial tile IDs must be valid runtime TileIds.
 * This assumes "grass" exists in tiles.json.
 */
export const initialAppState: AppState = {
  gridStatus: {
    center: { gx: 0, gy: 0 },
    cursor: { gx: 0, gy: 0 },
    zoom: 1,
  },
  selectedTile: "grass" as TileId,
};
