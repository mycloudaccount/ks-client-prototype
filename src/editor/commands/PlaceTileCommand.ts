import type Phaser from "phaser";
import type { EditorCommand } from "./EditorCommand";
import type { TileId } from "@/tiles/tileTypes";
import type { PlacedTile } from "../types";
import type { TileData } from "../tileData";
import { v4 as uuid } from "uuid";
import type { TileService } from "@/service/TileService";
import type { OccupancyView } from "@/editor/occupancy";

export type PlacedTileScene = Phaser.Scene & {
  stopEditorTileAnimation?(tile: PlacedTile): void;
  resolveEditorAnimationForTile?(tile: PlacedTile): void;
  getCascadeChain?(gx: number, gy: number, tileId: TileId): PlacedTile[];
};

export class PlaceTileCommand implements EditorCommand {
  label = "Place Tile";

  private scene: PlacedTileScene;
  private occupancy: OccupancyView<PlacedTile>;
  private gx: number;
  private gy: number;
  private tileId: TileId;
  private tileService: TileService;
  private replaced?: PlacedTile;

  constructor(
    scene: PlacedTileScene,
    occupancy: OccupancyView<PlacedTile>,
    tileService: TileService,
    gx: number,
    gy: number,
    tileId: TileId,
    replaced?: PlacedTile,
  ) {
    this.scene = scene;
    this.occupancy = occupancy;
    this.gx = gx;
    this.gy = gy;
    this.tileId = tileId;
    this.replaced = replaced;
    this.tileService = tileService;
  }

  apply(): void {
    const affected: PlacedTile[] = [];

    const current = this.occupancy.get(this.gx, this.gy);
    if (current) {
      if (this.scene.getCascadeChain) {
        affected.push(
          ...this.scene.getCascadeChain(
            current.tileData.gx,
            current.tileData.gy,
            current.tileData.type,
          ),
        );
      }

      this.scene.stopEditorTileAnimation?.(current);
      current.destroy();
      this.occupancy.delete(this.gx, this.gy);
    }

    const data: TileData = {
      id: uuid(),
      type: this.tileId,
      gx: this.gx,
      gy: this.gy,
    };

    this.tileService.resolveTileView(data);

    const tile = this.tileService.createPlacedTile(data);
    this.occupancy.set(this.gx, this.gy, tile);

    this.tileService.onTileChanged(tile);

    for (const t of affected) {
      this.tileService.onTileChanged(t);
    }
  }

  revert(): void {
    const affected: PlacedTile[] = [];

    const current = this.occupancy.get(this.gx, this.gy);
    if (current) {
      if (this.scene.getCascadeChain) {
        affected.push(
          ...this.scene.getCascadeChain(
            current.tileData.gx,
            current.tileData.gy,
            current.tileData.type,
          ),
        );
      }

      this.scene.stopEditorTileAnimation?.(current);
      current.destroy();
      this.occupancy.delete(this.gx, this.gy);
    }

    if (this.replaced) {
      this.scene.add.existing(this.replaced);
      this.occupancy.set(this.gx, this.gy, this.replaced);
      this.tileService.onTileChanged(this.replaced);
    }

    for (const t of affected) {
      this.tileService.onTileChanged(t);
    }
  }
}
