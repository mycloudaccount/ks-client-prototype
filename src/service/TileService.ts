/* eslint-disable @typescript-eslint/no-explicit-any */
// services/TileService.ts
import Phaser from "phaser";
import { gridToWorld } from "../editor/gridMath";
import type { TileData } from "../editor/tileData";
import type { TileId } from "@/tiles/tileTypes";
import { ToolMode, type PlacedTile } from "../editor/types";

import {
  DEPTH,
  TILE_PADDING,
  TILE_VISUAL_SIZE,
  VIEW_HISTORY_SIZE,
} from "../data/gridEditorConfig";
import { isTile } from "@/editor/tile/tileUtils";
import {
  PlaceTileCommand,
  type PlacedTileScene,
} from "@/editor/commands/PlaceTileCommand";
import type { CompositeCommand } from "@/editor/commands/CompositeCommand";
import type { OccupancyView } from "@/editor/occupancy";

export class TileService {
  public recentTileViews = new Map<TileId, string[]>();
  public lastPainted?: { gx: number; gy: number };
  // Tunable: how many recent picks to avoid
  public paintCommand?: CompositeCommand;

  private scene: Phaser.Scene;
  private occupancy: OccupancyView<PlacedTile>;
  public tileTypeMap: Record<string, any>;

  public isGroupDragging = false;

  // group dragging
  public draggingGroup: PlacedTile[] = [];
  public groupDragStartPositions = new Map<
    PlacedTile,
    { x: number; y: number }
  >();
  public groupDragStartCells = new Map<
    PlacedTile,
    { gx: number; gy: number }
  >();
  public primaryDragTile?: PlacedTile;

  public selectionRect?: Phaser.GameObjects.Rectangle;
  public isSelecting = false;
  public selectionStart?: { x: number; y: number };

  // selection
  public selectedTiles = new Set<PlacedTile>();

  constructor(
    scene: Phaser.Scene,
    occupancy: OccupancyView<PlacedTile>,
    tileTypeMap: Record<string, any>,
  ) {
    this.scene = scene;
    this.occupancy = occupancy;
    this.tileTypeMap = tileTypeMap;
  }

  private stopEditorTileAnimation(tile: PlacedTile) {
    if (tile.editorAnimTimer) {
      tile.editorAnimTimer.remove(false);
      tile.editorAnimTimer = undefined;
    }

    tile.editorAnimFrames = undefined;
    tile.cascadeIndex = undefined;
  }

  public getCascadeChain(gx: number, gy: number): PlacedTile[] {
    const origin = this.occupancy.get(gx, gy);

    // 🛑 Only cascading tiles can form a chain
    if (!origin || !origin.tileDef.properties?.cascading) {
      return [];
    }

    const result: PlacedTile[] = [];

    // 🔼 Walk UP from origin
    let y = gy;
    while (true) {
      const t = this.occupancy.get(gx, y);
      if (!t || !t.tileDef.properties?.cascading) break;
      y += 1;
    }

    // step back to first valid
    y -= 1;

    // 🔽 Walk DOWN collecting contiguous cascading tiles
    while (true) {
      const t = this.occupancy.get(gx, y);
      if (!t || !t.tileDef.properties?.cascading) break;

      result.push(t);
      y -= 1;
    }

    return result;
  }

  public resolveEditorAnimationForTile(tile: PlacedTile): void {
    const def = tile.tileDef;
    const props = def.properties;

    // 🚫 nothing to do
    if (!props?.editorAnimated) return;

    // 🟦 CASCADING PATH (new)
    if (props.cascading) {
      this.resolveCascadingEditorAnimation(tile);
      return;
    }

    // 🟩 LEGACY PATH (unchanged behavior)
    this.startEditorTileAnimation(tile, def);
  }

  private startEditorTileAnimation(
    tile: PlacedTile,
    tileDef: { images: Record<string, string>; properties?: any },
  ) {
    if (!tile.image) return;
    if (tile.editorAnimTimer) return;

    const frames = Object.values(tileDef.images);
    if (frames.length <= 1) return;

    const delay =
      typeof tileDef.properties?.editorAnimationDelay === "number"
        ? tileDef.properties.editorAnimationDelay
        : 500;

    // 🔀 Non-cascading (your existing behavior)
    tile.editorAnimFrames = shuffleArray(frames);
    tile.editorAnimIndex = 0;

    tile.editorAnimTimer = this.scene.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        const img = tile.image;

        if (
          !img ||
          !img.active ||
          !img.scene ||
          !img.scene.sys ||
          !img.scene.sys.isActive() ||
          !tile.editorAnimFrames
        ) {
          // Stop timer permanently once tile is gone
          tile.editorAnimTimer?.remove(false);
          tile.editorAnimTimer = undefined;
          return;
        }

        tile.editorAnimIndex =
          (tile.editorAnimIndex! + 1) % tile.editorAnimFrames.length;

        img.setTexture(tile.editorAnimFrames[tile.editorAnimIndex]);
      },
    });
  }

  public loadTiles(tileData: readonly TileData[]) {
    const created: PlacedTile[] = [];

    // Pass 1 — create tiles & populate occupancy
    for (const data of tileData) {
      const tile = this.createPlacedTile(data);
      this.occupancy.set(data.gx, data.gy, tile);
      created.push(tile);
    }

    // Pass 2 — resolve editor animations (cascading-safe)
    for (const tile of created) {
      this.resolveEditorAnimationForTile(tile);
    }
  }

  // ------------------------
  // Clear all tiles (TS-safe)
  // ------------------------
  public clearAllTiles() {
    // Destroy all placed tiles individually
    for (const tile of this.occupancy.values()) {
      this.stopEditorTileAnimation(tile);
      tile.image?.destroy();
      tile.destroy();
    }

    // Clear selection set
    this.clearSelection?.();
  }

  private startPulsing(tile: PlacedTile) {
    this.scene.tweens.add({
      targets: tile,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private applySelectedStyle(tile: PlacedTile, selected: boolean) {
    if (selected) {
      tile.rect.setStrokeStyle(2, 0x00ffff, 1);
      tile.setDepth(DEPTH.HOVER);
      this.startPulsing(tile);
    } else {
      const color = tile.rect.getData("baseStrokeColor");
      const width = tile.rect.getData("baseStrokeWidth");
      const alpha = tile.rect.getData("baseStrokeAlpha");

      tile.rect.setStrokeStyle(width, color, alpha);
      tile.setDepth(DEPTH.TILES);
      tile.alpha = 1;
      this.scene.tweens.killTweensOf(tile);
    }
  }

  private setSelection(tiles: PlacedTile[]) {
    this.clearSelection();
    for (const t of tiles) {
      this.selectedTiles.add(t);
      this.applySelectedStyle(t, true);
    }
  }

  private clearSelection() {
    for (const t of this.selectedTiles) this.applySelectedStyle(t, false);
    this.selectedTiles.clear();
  }

  public finishBoxSelect(
    pointer: Phaser.Input.Pointer,
    effectiveTool: ToolMode,
  ) {
    if (effectiveTool !== ToolMode.MOVE) return;
    if (!this.isSelecting || !this.selectionStart) return;

    this.isSelecting = false;

    // IMPORTANT: if released outside canvas, pointer.worldX/Y can be stale.
    // Use camera world point from screen coords.
    const cam = this.scene.cameras.main;
    const wp = cam.getWorldPoint(pointer.x, pointer.y);

    const x1 = this.selectionStart.x;
    const y1 = this.selectionStart.y;
    const x2 = wp.x;
    const y2 = wp.y;

    const left = Math.min(x1, x2);
    const top = Math.min(y1, y2);
    const right = Math.max(x1, x2);
    const bottom = Math.max(y1, y2);

    const picked = this.getAllPlacedTiles().filter((t) => {
      return t.x >= left && t.x <= right && t.y >= top && t.y <= bottom;
    });

    this.setSelection(picked);

    this.selectionStart = undefined;
    this.selectionRect?.destroy();
    this.selectionRect = undefined;
  }

  public onTileChanged(tile: PlacedTile): void {
    this.resolveEditorAnimationForTile(tile);
  }

  private getAllPlacedTiles(): PlacedTile[] {
    const tiles: PlacedTile[] = [];
    this.scene.children.each((child) => {
      if (isTile(child)) tiles.push(child);
    });
    return tiles;
  }

  public getPlacedTiles(): readonly PlacedTile[] {
    return this.getAllPlacedTiles();
  }

  private resolveCascadingEditorAnimation(tile: PlacedTile): void {
    const def = tile.tileDef;
    const frames = Object.values(def.images);
    if (frames.length <= 1) return;

    const delay = Number(def.properties?.editorAnimDelay ?? 500);

    // get full vertical chain
    const chain = this.getCascadeChain!(tile.tileData.gx, tile.tileData.gy);

    if (chain.length === 0) return;

    this.startCascadingColumnAnimation(chain, frames, delay);
  }

  private startCascadingColumnAnimation(
    chain: PlacedTile[],
    frames: string[],
    delay: number,
  ) {
    // 🔒 HARD FILTER (this is the fix)
    const cascadingChain = chain.filter(
      (t) => t.tileDef.properties?.cascading === true,
    );

    if (cascadingChain.length === 0) return;

    // 1️⃣ Stop ONLY cascading animations
    for (const tile of cascadingChain) {
      this.stopEditorTileAnimation(tile);
    }

    // 2️⃣ Assign indices (TOP → BOTTOM)
    cascadingChain.forEach((tile, i) => {
      tile.cascadeIndex = i;
      tile.editorAnimFrames = frames;
    });

    let tick = 0;

    const timer = this.scene.time.addEvent({
      delay,
      loop: true,
      callback: () => {
        tick++;

        let anyAlive = false;

        for (const tile of chain) {
          const img = tile.image;

          if (!img || !img.active || !img.scene || !img.scene.sys.isActive()) {
            continue;
          }

          anyAlive = true;

          const index = (tick + (tile.cascadeIndex ?? 0)) % frames.length;

          img.setTexture(frames[index]);
        }

        if (!anyAlive) {
          timer.remove(false);
        }
      },
    });

    // 3️⃣ Attach timer ONLY to cascading tiles
    for (const tile of cascadingChain) {
      tile.editorAnimTimer = timer;
    }
  }

  // ------------------------
  // Creation
  // ------------------------
  createPlacedTile(data: TileData): PlacedTile {
    const VISUAL_OFFSET = TILE_PADDING / 2;
    const pos = gridToWorld(data.gx, data.gy);
    const tileDef = this.tileTypeMap[data.type];

    const container = this.scene.add
      .container(Math.round(pos.x), Math.round(pos.y))
      .setDepth(DEPTH.TILES) as unknown as PlacedTile;

    container.tileData = data;
    container.tileDef = tileDef;

    container.setData("kind", "tile");
    container.setData("id", data.id);
    container.setData("type", data.type);
    container.setData("gx", data.gx);
    container.setData("gy", data.gy);

    const view = data.view!;
    const imageKey =
      tileDef.images[view] ??
      tileDef.images.default ??
      Object.values(tileDef.images)[0];

    if (imageKey && this.scene.textures.exists(imageKey)) {
      const img = this.scene.add.image(VISUAL_OFFSET, VISUAL_OFFSET, imageKey);
      img.setScale(TILE_VISUAL_SIZE / img.width, TILE_VISUAL_SIZE / img.height);
      img.disableInteractive();
      container.add(img);
      container.image = img;
    }

    const rect = this.scene.add.rectangle(
      VISUAL_OFFSET,
      VISUAL_OFFSET,
      TILE_VISUAL_SIZE,
      TILE_VISUAL_SIZE,
      tileDef.phaserColor,
      0,
    );

    rect
      .setOrigin(0.5)
      .setStrokeStyle(2, tileDef.phaserColor, 1)
      .setDepth(DEPTH.TILES);

    rect.setData("baseStrokeColor", tileDef.phaserColor);
    rect.setData("baseStrokeWidth", 2);
    rect.setData("baseStrokeAlpha", 1);

    rect.disableInteractive();
    container.add(rect);
    container.rect = rect;

    container.setSize(TILE_VISUAL_SIZE, TILE_VISUAL_SIZE);
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -TILE_VISUAL_SIZE / 2,
        -TILE_VISUAL_SIZE / 2,
        TILE_VISUAL_SIZE,
        TILE_VISUAL_SIZE,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    return container;
  }

  /*
  public createPlacedTile_delete(data: TileData): PlacedTile {
    const VISUAL_OFFSET = TILE_PADDING / 2;

    const pos = gridToWorld(data.gx, data.gy);
    const tileDef = this.tileTypeMap[data.type];

    // =========================
    // Container (single transform)
    // =========================
    const container = this.add
      .container(Math.round(pos.x), Math.round(pos.y))
      .setDepth(DEPTH.TILES) as PlacedTile;

    container.tileData = data;
    container.tileDef = tileDef; // ✅ ADD THIS

    container.setData("kind", "tile");
    container.setData("id", data.id);
    container.setData("type", data.type);
    container.setData("gx", data.gx);
    container.setData("gy", data.gy);

    // =========================
    // Resolve image key (VISUAL ONLY, RANDOMIZED)
    // =========================
    const view = data.view!;

    const imageKey =
      tileDef.images[view] ??
      tileDef.images["default"] ??
      Object.values(tileDef.images)[0];

    if (imageKey && this.textures.exists(imageKey)) {
      const img = this.add.image(VISUAL_OFFSET, VISUAL_OFFSET, imageKey);

      if (img.width > 0 && img.height > 0) {
        img.setScale(
          TILE_VISUAL_SIZE / img.width,
          TILE_VISUAL_SIZE / img.height,
        );
      } else {
        console.error("[Tile] Texture has zero size:", imageKey);
      }

      img.disableInteractive(); // 🔑 critical
      container.add(img);
      container.image = img;
    }

    // =========================
    // Rectangle (INTERACTION + OUTLINE)
    // =========================
    const rect = this.add.rectangle(
      VISUAL_OFFSET,
      VISUAL_OFFSET,
      TILE_VISUAL_SIZE,
      TILE_VISUAL_SIZE,
      tileDef.phaserColor,
      0,
    );

    rect.setOrigin(0.5, 0.5).setStrokeStyle(2, tileDef.phaserColor, 1); // 🔥 colored outline
    rect.setData("baseStrokeColor", tileDef.phaserColor);
    rect.setData("baseStrokeWidth", 2);
    rect.setData("baseStrokeAlpha", 1);
    rect.setDepth(DEPTH.TILES);
    rect.disableInteractive();

    container.add(rect);
    container.bringToTop(rect); // 🔑 ensure it sits above image
    container.rect = rect;

    // =========================
    // Interaction (single hit area)
    // =========================
    container.setSize(GRID_SIZE, GRID_SIZE);
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -GRID_SIZE / 2,
        -GRID_SIZE / 2,
        GRID_SIZE,
        GRID_SIZE,
      ),
      Phaser.Geom.Rectangle.Contains,
    );

    this.updatePlacedTileInteractivity(container);

    return container;
  }
  */

  // ------------------------
  // Views
  // ------------------------
  public resolveTileView(data: TileData) {
    if (data.view) return;
    const tileDef = this.tileTypeMap[data.type];
    data.view = this.pickRandomTileView(data.type, tileDef);
  }

  private placeTileCommandAt(
    gx: number,
    gy: number,
    selectedTile: TileId,
  ): PlaceTileCommand {
    const existing = this.occupancy.get(gx, gy);

    return new PlaceTileCommand(
      this as unknown as PlacedTileScene,
      this.occupancy,
      this,
      gx,
      gy,
      selectedTile,
      existing,
    );
  }

  public paintSingleCell(gx: number, gy: number, selectedTile: TileId) {
    // Prevent re-painting same cell
    if (this.lastPainted?.gx === gx && this.lastPainted?.gy === gy) return;

    this.lastPainted = { gx, gy };

    const cmd = this.placeTileCommandAt(gx, gy, selectedTile);

    // Apply immediately for visual feedback
    cmd.apply();

    // But DO NOT push to stack yet
    this.paintCommand?.add(cmd);
  }

  private pickRandomTileView(
    tileId: TileId,
    tileDef: { images: Record<string, string> },
  ): string {
    const keys = Object.keys(tileDef.images);

    // Prefer non-front if available
    const allViews =
      keys.length > 1 && keys.includes("front")
        ? keys.filter((k) => k !== "front")
        : keys;

    const history = this.recentTileViews.get(tileId) ?? [];

    // Prefer views NOT recently used
    const fresh = allViews.filter((v) => !history.includes(v));

    const pool = fresh.length > 0 ? fresh : allViews;
    const chosen = Phaser.Utils.Array.GetRandom(pool);

    // Update history
    const nextHistory = [...history, chosen].slice(-VIEW_HISTORY_SIZE);

    this.recentTileViews.set(tileId, nextHistory);

    return chosen;
  }

  // ------------------------
  // Occupancy helpers
  // ------------------------
  place(tile: PlacedTile) {
    const { gx, gy } = tile.tileData;
    this.occupancy.set(gx, gy, tile);
  }

  remove(tile: PlacedTile) {
    const { gx, gy } = tile.tileData;
    this.occupancy.delete(gx, gy);
    tile.destroy();
  }

  // TS-safe wrapper for occupancy removal (used in commands)
  public clearAll() {
    for (const tile of this.occupancy.values()) {
      tile.destroy();
    }

    // Reset selection set
    this.clearSelection?.();
  }
}

function shuffleArray<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
