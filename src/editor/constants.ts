// constants.ts
import { GRID_SIZE } from "./gridMath";

export const GRID_EXTENT = 20000;
export const HALF_GRID = GRID_SIZE / 2;
export const HALF_PIXEL = 0.5;

export const GRID_COLOR = 0x3a3a3a;
export const AXIS_COLOR = 0x8fcfe6;
export const AXIS_THICKNESS = 3;

export const TICK_COLOR = 0xb0b0b0;
export const LABEL_COLOR = "#b0b0b0";
export const UNITS_PER_TICK = 10;

export const TILE_PADDING = 1;
export const TILE_VISUAL_SIZE = GRID_SIZE - TILE_PADDING * 2;

export const DEPTH = {
  GRID: 0,
  AXES: 1,
  AXIS_LABELS: 2,
  TILES: 10,
  HOVER: 100,
  HUD: 10000,
} as const;

export const gridLineOffset = (units: number) =>
  units >= 0 ? -HALF_GRID : +HALF_GRID;
