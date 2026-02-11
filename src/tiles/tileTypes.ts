export type TileId = string & { readonly __tileId: unique symbol };

export interface TileProperties {
  walkable?: boolean;
  buildable?: boolean;
  movementCost?: number;
  editorAnimated?: boolean;
  editorAnimationDelay?: number; // ms per frame
  cascading?: boolean;
  [key: string]: unknown;
}

export interface TileDef {
  id: TileId;
  kind: "tile";
  images: Record<string, string>;
  variants: string[];

  uiColor: string;
  phaserColor: number;

  properties: TileProperties;

  metadata?: {
    sourceModel?: string;
    [key: string]: unknown;
  };
}

export interface TilesJson {
  version: number;
  generatedBy: string;
  tiles: TileDef[];
}
