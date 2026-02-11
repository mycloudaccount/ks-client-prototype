// src/editor/gridMath.ts

export const GRID_SIZE = 32;

/**
 * Convert grid coords → world coords
 * Tiles are CENTERED in cells
 */
export function gridToWorld(gx: number, gy: number) {
  return {
    x: gx * GRID_SIZE + GRID_SIZE / 2,
    y: gy * GRID_SIZE + GRID_SIZE / 2,
  };
}

/**
 * Convert world coords → grid coords
 * Uses FLOOR so each cell owns its interior
 */
export function worldToGrid(x: number, y: number) {
  return {
    gx: Math.floor(x / GRID_SIZE),
    gy: Math.floor(y / GRID_SIZE),
  };
}
