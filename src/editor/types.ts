/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import type { TileData } from "./tileData";

export const ToolMode = {
  PAN: "pan",
  MOVE: "move",
  CREATE: "create",
  ZOOM: "zoom",
} as const;

export type ToolMode = (typeof ToolMode)[keyof typeof ToolMode];

export type PlacedTile = Phaser.GameObjects.Container & {
  tileData: TileData;
  tileDef: {
    images: Record<string, string>;
    properties?: any;
  };
  rect: Phaser.GameObjects.Rectangle;
  image?: Phaser.GameObjects.Image;

  // editor-only
  editorAnimTimer?: Phaser.Time.TimerEvent;
  editorAnimFrames?: string[];
  editorAnimIndex?: number;

  cascadeIndex?: number;
};
