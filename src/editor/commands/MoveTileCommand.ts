import type Phaser from "phaser";
import type { GridOccupancy } from "../occupancy";
import { gridToWorld } from "../gridMath";
import type { EditorCommand } from "../commands";
import type { PlacedTile } from "../types";

export class MoveTileCommand implements EditorCommand {
  label = "Move Tile";

  private scene: Phaser.Scene;
  private occupancy: GridOccupancy;

  private tile: PlacedTile;

  private fromGX: number;
  private fromGY: number;

  private toGX: number;
  private toGY: number;

  private replaced?: PlacedTile;

  constructor(
    scene: Phaser.Scene,
    occupancy: GridOccupancy,
    tile: PlacedTile,
    fromGX: number,
    fromGY: number,
    toGX: number,
    toGY: number,
    replaced?: PlacedTile
  ) {
    this.scene = scene;
    this.occupancy = occupancy;
    this.tile = tile;
    this.fromGX = fromGX;
    this.fromGY = fromGY;
    this.toGX = toGX;
    this.toGY = toGY;
    this.replaced = replaced;
  }

  apply() {
    // Remove any tile already at destination
    if (this.replaced) {
      this.replaced.destroy();
      this.occupancy.delete(this.toGX, this.toGY);
    }

    // Update occupancy
    this.occupancy.delete(this.fromGX, this.fromGY);
    this.occupancy.set(this.toGX, this.toGY, this.tile);

    // Snap tile visually
    const pos = gridToWorld(this.toGX, this.toGY);
    this.tile.setPosition(Math.round(pos.x), Math.round(pos.y));

    // 🔑 UPDATE SERIALIZED DATA
    this.tile.tileData.gx = this.toGX;
    this.tile.tileData.gy = this.toGY;

    // Keep Phaser data manager in sync (optional)
    this.tile.setData("gx", this.toGX);
    this.tile.setData("gy", this.toGY);
  }

  revert() {
    // Remove from destination
    this.occupancy.delete(this.toGX, this.toGY);

    // Restore original position
    this.occupancy.set(this.fromGX, this.fromGY, this.tile);

    const pos = gridToWorld(this.fromGX, this.fromGY);
    this.tile.setPosition(Math.round(pos.x), Math.round(pos.y));

    // 🔑 RESTORE SERIALIZED DATA
    this.tile.tileData.gx = this.fromGX;
    this.tile.tileData.gy = this.fromGY;

    this.tile.setData("gx", this.fromGX);
    this.tile.setData("gy", this.fromGY);

    // Restore replaced tile if there was one
    if (this.replaced) {
      const replacedPos = gridToWorld(this.toGX, this.toGY);
      this.replaced.setPosition(
        Math.round(replacedPos.x),
        Math.round(replacedPos.y)
      );

      this.scene.add.existing(this.replaced);
      this.occupancy.set(this.toGX, this.toGY, this.replaced);
    }
  }
}
