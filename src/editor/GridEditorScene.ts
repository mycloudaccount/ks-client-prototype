/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import { ToolMode, type PlacedTile } from "./types";
import { GRID_SIZE, worldToGrid, gridToWorld } from "./gridMath";
import { GridOccupancy } from "./occupancy";
import type { GridStatus } from "../context/appState";
import { getTileRegistry } from "@/tiles/tileLoader";
import { MoveTileCommand } from "./commands/MoveTileCommand";
import { CompositeCommand } from "./commands/CompositeCommand";
import { isTile } from "./tile/tileUtils";

import type {
  InteractionService,
  InteractionState,
} from "@/service/InteractionService";

import {
  PlaceTileCommand,
  type PlacedTileScene,
} from "./commands/PlaceTileCommand";
import type { EditorCommand } from "./commands/EditorCommand";
import type { TileData } from "./tileData";
import type { TileId } from "@/tiles/tileTypes";
import { loadTileImages } from "@/tiles/loadPhaserTileAssets";

const GRID_EXTENT = 20000;

const HALF_GRID = GRID_SIZE / 2;
const HALF_PIXEL = 0.5;

// Visual constants
const GRID_COLOR = 0x3a3a3a;
const AXIS_COLOR = 0x8fcfe6;
const AXIS_THICKNESS = 3;

const TICK_COLOR = 0xb0b0b0;
const LABEL_COLOR = "#b0b0b0";
const UNITS_PER_TICK = 10;

const TILE_PADDING = 1; // pixels on each side
const TILE_VISUAL_SIZE = GRID_SIZE - TILE_PADDING * 2;

const DEPTH = {
  GRID: 0,
  AXES: 1,
  AXIS_LABELS: 2,
  TILES: 10,
  HOVER: 100,
  HUD: 10000,
};

const gridLineOffset = (units: number) =>
  units >= 0 ? -HALF_GRID : +HALF_GRID;

export default class GridEditorScene extends Phaser.Scene {
  private tileTypeMap!: ReturnType<typeof getTileRegistry>;
  // Recent visual history per tile type
  private recentTileViews = new Map<TileId, string[]>();

  // Tunable: how many recent picks to avoid
  private static readonly VIEW_HISTORY_SIZE = 2;
  private paintCommand?: CompositeCommand;
  private lastPainted?: { gx: number; gy: number };
  private isPainting = false;
  private occupancy = new GridOccupancy();
  private groupDragStart = new Map<PlacedTile, { gx: number; gy: number }>();

  private selectionRect?: Phaser.GameObjects.Rectangle;
  private isSelecting = false;
  private selectionStart?: { x: number; y: number };

  // -----------------------
  // Group Selection
  //
  // store interaction so we can execute commands + undo/redo with UI updates
  private interaction?: InteractionService;
  private isGroupDragging = false;

  // selection
  private selectedTiles = new Set<PlacedTile>();

  // group dragging
  private draggingGroup: PlacedTile[] = [];
  private groupDragStartPositions = new Map<
    PlacedTile,
    { x: number; y: number }
  >();
  private groupDragStartCells = new Map<
    PlacedTile,
    { gx: number; gy: number }
  >();
  private primaryDragTile?: PlacedTile;

  public stopEditorTileAnimation(tile: PlacedTile) {
    if (tile.editorAnimTimer) {
      tile.editorAnimTimer.remove(false);
      tile.editorAnimTimer = undefined;
    }

    tile.editorAnimFrames = undefined;
    tile.cascadeIndex = undefined;
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

  private startEditorTileAnimation(
    tile: PlacedTile,
    tileDef: { images: Record<string, string>; properties?: any }
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

    tile.editorAnimTimer = this.time.addEvent({
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

  private startCascadingColumnAnimation(
    chain: PlacedTile[],
    frames: string[],
    delay: number
  ) {
    // 🔒 HARD FILTER (this is the fix)
    const cascadingChain = chain.filter(
      (t) => t.tileDef.properties?.cascading === true
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

    const timer = this.time.addEvent({
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

  public resolveTileView(data: TileData): void {
    if (data.view) return;

    const tileDef = this.tileTypeMap[data.type];
    data.view = this.pickRandomTileView(data.type, tileDef);
  }

  async preload() {
    loadTileImages(this);
  }

  private startPulsing(tile: PlacedTile) {
    this.tweens.add({
      targets: tile,
      alpha: { from: 1, to: 0.4 },
      duration: 800,
      yoyo: true,
      repeat: -1,
      ease: "Sine.easeInOut",
    });
  }

  private pickRandomTileView(
    tileId: TileId,
    tileDef: { images: Record<string, string> }
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
    const nextHistory = [...history, chosen].slice(
      -GridEditorScene.VIEW_HISTORY_SIZE
    );

    this.recentTileViews.set(tileId, nextHistory);

    return chosen;
  }

  public createPlacedTile(data: TileData): PlacedTile {
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
          TILE_VISUAL_SIZE / img.height
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
      0
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
        GRID_SIZE
      ),
      Phaser.Geom.Rectangle.Contains
    );

    this.updatePlacedTileInteractivity(container);

    return container;
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
      this.tweens.killTweensOf(tile);
    }
  }

  private clearSelection() {
    for (const t of this.selectedTiles) this.applySelectedStyle(t, false);
    this.selectedTiles.clear();
  }

  private setSelection(tiles: PlacedTile[]) {
    this.clearSelection();
    for (const t of tiles) {
      this.selectedTiles.add(t);
      this.applySelectedStyle(t, true);
    }
  }

  private getAllPlacedTiles(): PlacedTile[] {
    const tiles: PlacedTile[] = [];
    this.children.each((child) => {
      if (isTile(child)) tiles.push(child);
    });
    return tiles;
  }

  public getPlacedTiles(): readonly PlacedTile[] {
    return this.getAllPlacedTiles();
  }

  // -----------------------
  // Interaction (external)
  // -----------------------
  private interactionUnsub?: () => void;
  private interactionState: InteractionState = {
    baseTool: ToolMode.CREATE,
    selectedTile: "grass" as TileId,
  };

  private get effectiveTool(): ToolMode {
    return (
      this.interactionState.transientTool ?? this.interactionState.baseTool
    );
  }

  private get selectedTile(): TileId {
    return this.interactionState.selectedTile;
  }

  private placeTileCommandAt(gx: number, gy: number): PlaceTileCommand {
    const existing = this.occupancy.get(gx, gy);

    return new PlaceTileCommand(
      this as unknown as PlacedTileScene,
      this.occupancy,
      gx,
      gy,
      this.selectedTile,
      existing
    );
  }

  // -----------------------
  // Transient mouse state
  // -----------------------
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;

  private isZooming = false;
  private zoomStartY = 0;
  private zoomStart = 1;

  //private draggingFromGrid: { gx: number; gy: number } | null = null;

  // Hover preview (create mode)
  private hoverTile?: Phaser.GameObjects.Rectangle;

  // Move highlight
  private hoveredTile: PlacedTile | null = null;

  private gridStatusCallback?: (status: GridStatus) => void;

  private removeMouseLeave?: () => void;

  private paintSingleCell(gx: number, gy: number) {
    // Prevent re-painting same cell
    if (this.lastPainted?.gx === gx && this.lastPainted?.gy === gy) return;

    this.lastPainted = { gx, gy };

    const cmd = this.placeTileCommandAt(gx, gy);

    // Apply immediately for visual feedback
    cmd.apply();

    // But DO NOT push to stack yet
    this.paintCommand?.add(cmd);
  }

  private finishBoxSelect(pointer: Phaser.Input.Pointer) {
    if (this.effectiveTool !== ToolMode.MOVE) return;
    if (!this.isSelecting || !this.selectionStart) return;

    this.isSelecting = false;

    // IMPORTANT: if released outside canvas, pointer.worldX/Y can be stale.
    // Use camera world point from screen coords.
    const cam = this.cameras.main;
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

  // ============================================================
  //  PUBLIC API
  // ============================================================
  /**
   * Call this once from PhaserCanvas after the scene is ready:
   *   scene.attachInteractionService(interaction)
   */

  public attachInteractionService(service: InteractionService) {
    this.interaction = service;

    this.interactionUnsub?.();
    this.interactionUnsub = undefined;

    this.interactionUnsub = service.subscribe((state) => {
      const prev =
        this.interactionState.transientTool ?? this.interactionState.baseTool;

      this.interactionState = state;

      const next = state.transientTool ?? state.baseTool;

      if (prev !== next) {
        this.resetTransientInteractionState();
        this.applyCursor(next);
        this.refreshPlacedTileInteractivity();
        // selection is per-tool: keep it, or clear if you prefer
        // this.clearSelection();
      }
    });

    this.applyCursor(this.effectiveTool);
    this.refreshPlacedTileInteractivity();
  }

  public setGridStatusCallback(cb: (status: GridStatus) => void) {
    this.gridStatusCallback = cb;
  }

  public recenter(resetZoom = true) {
    const cam = this.cameras.main;

    const baseOrigin = gridToWorld(0, 0);
    const originX = baseOrigin.x + HALF_PIXEL;
    const originY = baseOrigin.y + HALF_PIXEL;

    if (resetZoom) cam.setZoom(1);
    cam.centerOn(originX, originY);
  }

  public zoomBy(delta: number) {
    const cam = this.cameras.main;
    cam.setZoom(Phaser.Math.Clamp(cam.zoom + delta, 0.25, 4));
    this.emitGridStatus();
  }

  public resetView() {
    this.recenter(true);
    this.emitGridStatus();
  }

  // ============================================================
  //  LIFECYCLE
  // ============================================================
  create() {
    console.debug("[GridEditorScene] create started");

    this.tileTypeMap = getTileRegistry();

    this.input.mouse?.disableContextMenu();
    this.input.keyboard?.addCapture(["Z", "Y"]);

    const cam = this.cameras.main;
    cam.setBackgroundColor("#1e1e1e");
    cam.setRoundPixels(true);

    this.drawGrid();
    this.drawAxesAndUnits();

    // hover preview (never interactive)
    this.hoverTile = this.add
      .rectangle(0, 0, GRID_SIZE, GRID_SIZE, 0xffffff, 0.35)
      .setDepth(DEPTH.HOVER)
      .setVisible(false);

    this.hoverTile.disableInteractive();

    // center camera on origin
    const origin = gridToWorld(0, 0);
    cam.centerOn(origin.x, origin.y);

    // Hide hover when leaving canvas
    const onLeave = () => this.hideHoverPreviewAndSelection();
    const canvas = this.game.canvas;
    canvas.addEventListener("mouseleave", onLeave);
    this.removeMouseLeave = () =>
      canvas.removeEventListener("mouseleave", onLeave);

    // Important: cleanup on shutdown/destroy
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.events.once(Phaser.Scenes.Events.DESTROY, () => this.cleanup());

    this.registerInput();

    // cursor + interactivity will be applied once interaction service attaches,
    // but set a safe default until then:
    this.applyCursor(this.effectiveTool);

    this.input.keyboard?.on("keydown-Z", (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();

      if (e.shiftKey) this.interaction?.redo();
      else this.interaction?.undo();
    });

    this.input.keyboard?.on("keydown-Y", (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      this.interaction?.redo();
    });
    console.debug("[GridEditorScene] create ended");
  }

  private cleanup() {
    if (this.interactionUnsub) {
      this.interactionUnsub();
    }
    this.interactionUnsub = undefined;

    this.removeMouseLeave?.();
    this.removeMouseLeave = undefined;
  }

  // ============================================================
  //  GRID STATUS
  // ============================================================
  private emitGridStatus(pointerWorldX?: number, pointerWorldY?: number) {
    if (!this.gridStatusCallback) return;

    const cam = this.cameras.main;
    const centerWorld = cam.getWorldPoint(cam.width / 2, cam.height / 2);
    const center = worldToGrid(centerWorld.x, centerWorld.y);

    const cursor =
      pointerWorldX !== undefined
        ? worldToGrid(pointerWorldX, pointerWorldY!)
        : center;

    this.gridStatusCallback({ center, cursor, zoom: cam.zoom });
  }

  // ============================================================
  //  VISUALS
  // ============================================================
  private drawGrid() {
    const g = this.add.graphics();
    g.setDepth(DEPTH.GRID);
    g.lineStyle(1, GRID_COLOR, 0.35);

    for (let x = -GRID_EXTENT; x <= GRID_EXTENT; x += GRID_SIZE) {
      g.lineBetween(x + HALF_PIXEL, -GRID_EXTENT, x + HALF_PIXEL, GRID_EXTENT);
    }

    for (let y = -GRID_EXTENT; y <= GRID_EXTENT; y += GRID_SIZE) {
      g.lineBetween(-GRID_EXTENT, y + HALF_PIXEL, GRID_EXTENT, y + HALF_PIXEL);
    }
  }

  private drawAxesAndUnits() {
    const origin = gridToWorld(0, 0);
    const originX = origin.x + gridLineOffset(0) + HALF_PIXEL;
    const originY = origin.y + gridLineOffset(0) + HALF_PIXEL;

    const g = this.add.graphics();
    g.setDepth(DEPTH.AXES);

    g.lineStyle(AXIS_THICKNESS, AXIS_COLOR, 0.75);
    g.lineBetween(-GRID_EXTENT, originY, GRID_EXTENT, originY);
    g.lineBetween(originX, -GRID_EXTENT, originX, GRID_EXTENT);

    const tickHalf = 6;
    g.lineStyle(1, TICK_COLOR, 0.85);

    const maxUnits =
      Math.floor(GRID_EXTENT / GRID_SIZE / UNITS_PER_TICK) * UNITS_PER_TICK;

    for (
      let units = UNITS_PER_TICK;
      units <= maxUnits;
      units += UNITS_PER_TICK
    ) {
      for (const signedUnits of [units, -units]) {
        // X tick
        {
          const x =
            gridToWorld(signedUnits, 0).x +
            gridLineOffset(signedUnits) +
            HALF_PIXEL;

          g.lineBetween(x, originY - tickHalf, x, originY + tickHalf);

          this.add
            .text(x + 2, originY + 8, String(signedUnits), {
              fontSize: "12px",
              color: LABEL_COLOR,
              fontFamily: "monospace",
            })
            .setDepth(DEPTH.AXIS_LABELS);
        }

        // Y tick
        {
          const y =
            gridToWorld(0, signedUnits).y +
            gridLineOffset(signedUnits) +
            HALF_PIXEL;

          g.lineBetween(originX - tickHalf, y, originX + tickHalf, y);

          this.add
            .text(originX + 8, y - 2, String(signedUnits), {
              fontSize: "12px",
              color: LABEL_COLOR,
              fontFamily: "monospace",
            })
            .setOrigin(0, 1)
            .setDepth(DEPTH.AXIS_LABELS);
        }
      }
    }

    this.add
      .text(originX + 8, originY + 8, "0", {
        fontSize: "16px",
        color: LABEL_COLOR,
        fontFamily: "monospace",
      })
      .setDepth(DEPTH.AXIS_LABELS);
  }

  // ============================================================
  //  INTERACTION HELPERS
  // ============================================================

  public onTileChanged(tile: PlacedTile): void {
    this.resolveEditorAnimationForTile(tile);
  }

  private applyCursor(tool: ToolMode) {
    const canvas = this.game.canvas;
    canvas.style.cursor =
      tool === ToolMode.PAN
        ? "grab"
        : tool === ToolMode.ZOOM
        ? "ns-resize"
        : tool === ToolMode.MOVE
        ? "pointer"
        : "crosshair";
  }

  private resetTransientInteractionState() {
    this.isPanning = false;
    this.isZooming = false;
    //this.draggingFromGrid = null;
    this.clearMoveHighlight();
    this.hideHoverPreview();
  }

  private hideHoverPreview() {
    this.hoverTile?.setVisible(false);
  }

  private hideHoverPreviewAndSelection() {
    this.hideHoverPreview();
    this.clearMoveHighlight();
  }

  private clearMoveHighlight() {
    if (!this.hoveredTile) return;

    const rect = this.hoveredTile.rect;

    const color = rect.getData("baseStrokeColor");
    const width = rect.getData("baseStrokeWidth");
    const alpha = rect.getData("baseStrokeAlpha");

    rect.setStrokeStyle(width, color, alpha);
    rect.setDepth(DEPTH.TILES);

    this.hoveredTile = null;
  }

  private refreshPlacedTileInteractivity() {
    // Only apply to placed tiles (not hoverTile, grid, etc)
    this.children.each((child) => {
      if (!(child instanceof Phaser.GameObjects.Container)) return;

      const tile = child as PlacedTile;
      if (tile.getData("kind") !== "tile") return;

      this.updatePlacedTileInteractivity(tile);
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

  public clearAllTiles() {
    // Destroy all placed tiles
    for (const tile of this.occupancy.values()) {
      this.stopEditorTileAnimation(tile as PlacedTile);
      (tile as PlacedTile).image?.destroy();
      tile.destroy();
    }

    // Clear occupancy bookkeeping
    this.occupancy.clear();

    // Optional editor cleanup
    this.clearSelection?.();
  }

  private updatePlacedTileInteractivity(tile: PlacedTile) {
    if (!tile.input) return;

    const draggable = this.effectiveTool === ToolMode.MOVE;
    this.input.setDraggable(tile, draggable);

    // Never override canvas cursor except in MOVE
    tile.input.cursor = draggable ? "pointer" : "default";
  }

  private updateHoverTile(pointer: Phaser.Input.Pointer) {
    if (!this.hoverTile) return;

    const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
    const pos = gridToWorld(gx, gy);

    const tileDef = this.tileTypeMap[this.selectedTile];

    this.hoverTile
      .setPosition(Math.round(pos.x), Math.round(pos.y))
      .setFillStyle(tileDef.phaserColor, 0.35)
      .setStrokeStyle(1, 0xffffff, 0.35)
      .setVisible(true);
  }

  // ============================================================
  //  INPUT
  // ============================================================
  private registerInput() {
    const cam = this.cameras.main;

    // Wheel zoom (optional: integrate later as transient tool)
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer) => {
      // keep as-is or integrate with InteractionService later
      if (!_pointer) console.log(_pointer);
    });

    // When pointer leaves game bounds (Phaser-level)
    this.input.on("gameout", () => {
      this.hideHoverPreviewAndSelection();
    });

    // Pointer move
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      const tool = this.effectiveTool;

      switch (tool) {
        case ToolMode.PAN: {
          this.clearMoveHighlight();
          this.hideHoverPreview();

          if (this.isPanning) {
            cam.scrollX -= (pointer.x - this.panStartX) / cam.zoom;
            cam.scrollY -= (pointer.y - this.panStartY) / cam.zoom;
            this.panStartX = pointer.x;
            this.panStartY = pointer.y;
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }

        case ToolMode.ZOOM: {
          this.clearMoveHighlight();
          this.hideHoverPreview();

          if (this.isZooming) {
            const dy = pointer.y - this.zoomStartY;
            const zoomFactor = 1 - dy * 0.005;
            cam.setZoom(
              Phaser.Math.Clamp(this.zoomStart * zoomFactor, 0.25, 4)
            );
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }

        case ToolMode.CREATE: {
          this.clearMoveHighlight();
          this.updateHoverTile(pointer);

          // 🔥 Paint-while-dragging (fast tile placement)
          if (this.isPainting) {
            const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
            this.paintSingleCell(gx, gy);
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }

        case ToolMode.MOVE: {
          this.hideHoverPreview();

          // ------------------------------------
          // GROUP DRAG: rigid movement
          // ------------------------------------
          if (this.isGroupDragging && this.groupDragStart.size > 0) {
            const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
            const first = [...this.groupDragStart.values()][0];

            const dx = gx - first.gx;
            const dy = gy - first.gy;

            for (const [tile, start] of this.groupDragStart.entries()) {
              const pos = gridToWorld(start.gx + dx, start.gy + dy);
              tile.setPosition(Math.round(pos.x), Math.round(pos.y));
            }

            this.emitGridStatus(pointer.worldX, pointer.worldY);
            return;
          }

          // ------------------------------------
          // Box selection
          // ------------------------------------
          if (this.isSelecting && this.selectionStart && this.selectionRect) {
            const x = (this.selectionStart.x + pointer.worldX) / 2;
            const y = (this.selectionStart.y + pointer.worldY) / 2;

            const w = Math.abs(pointer.worldX - this.selectionStart.x);
            const h = Math.abs(pointer.worldY - this.selectionStart.y);

            this.selectionRect.setPosition(x, y).setSize(w, h);

            this.emitGridStatus(pointer.worldX, pointer.worldY);
            return;
          }

          // ------------------------------------
          // Hover highlighting
          // ------------------------------------
          const hit = this.input.hitTestPointer(pointer)[0];

          this.clearMoveHighlight();

          if (isTile(hit)) {
            this.hoveredTile = hit;
            hit.rect.setStrokeStyle(2, 0xffff00);
            hit.rect.setDepth(DEPTH.HOVER);
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }
      }
    });

    // Pointer down
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      const tool = this.effectiveTool;
      const hit = this.input.hitTestPointer(pointer)[0];

      // Right-click delete (only placed tiles)
      if (pointer.rightButtonDown()) {
        if (
          hit instanceof Phaser.GameObjects.Container &&
          (hit as PlacedTile).getData?.("kind") === "tile"
        ) {
          const { gx, gy } = worldToGrid(hit.x, hit.y);
          this.occupancy.delete(gx, gy);
          hit.destroy();
        }
        return;
      }

      if (tool === ToolMode.CREATE && pointer.leftButtonDown()) {
        this.isPainting = true;
        this.lastPainted = undefined;

        this.paintCommand = new CompositeCommand("Paint Tiles");

        const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
        this.paintSingleCell(gx, gy);
        return;
      }

      // PAN start
      if (tool === ToolMode.PAN) {
        this.isPanning = true;
        this.panStartX = pointer.x;
        this.panStartY = pointer.y;
        return;
      }

      // ZOOM start
      if (tool === ToolMode.ZOOM) {
        this.isZooming = true;
        this.zoomStartY = pointer.y;
        this.zoomStart = cam.zoom;
        return;
      }

      // MOVE begin drag (only placed tiles)
      if (tool === ToolMode.MOVE) {
        // Case 1: Clicked a tile → drag it (or group)
        if (isTile(hit)) {
          const primary = hit;

          this.primaryDragTile = primary;

          // Determine group: selection or just this tile
          const group =
            this.selectedTiles.size > 0 && this.selectedTiles.has(primary)
              ? Array.from(this.selectedTiles)
              : [primary];

          this.draggingGroup = group;

          this.groupDragStartPositions.clear();
          this.groupDragStartCells.clear();

          for (const tile of group) {
            this.groupDragStartPositions.set(tile, { x: tile.x, y: tile.y });

            const { gx, gy } = worldToGrid(tile.x, tile.y);
            this.groupDragStartCells.set(tile, { gx, gy });
          }

          return;
        }

        // Case 2: Clicked empty space → start box select
        this.isSelecting = true;
        this.selectionStart = { x: pointer.worldX, y: pointer.worldY };

        this.selectionRect = this.add
          .rectangle(pointer.worldX, pointer.worldY, 1, 1, 0x3399ff, 0.2)
          .setStrokeStyle(1, 0x3399ff)
          .setDepth(DEPTH.HUD);

        return;
      }

      // CREATE place/replace
      if (tool === ToolMode.CREATE) {
        const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
        const existing = this.occupancy.get?.(gx, gy) ?? undefined;

        const cmd = new PlaceTileCommand(
          this as unknown as PlacedTileScene,
          this.occupancy,
          gx,
          gy,
          this.selectedTile,
          existing
        );

        this.interaction?.executeCommand(cmd);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.isZooming = false;

      // finish selection box if we were selecting
      this.finishBoxSelect(pointer);

      // (optional but recommended) also end painting here
      this.isPainting = false;
      this.lastPainted = undefined;

      // if you are using paintCommand, you probably also want:
      if (this.paintCommand && !this.paintCommand.isEmpty) {
        this.interaction?.executeCommand(
          this.paintCommand as unknown as EditorCommand
        );
      }
      this.paintCommand = undefined;
    });

    // 🔑 THIS IS THE KEY FIX
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.isZooming = false;

      this.finishBoxSelect(pointer);

      this.isPainting = false;
      this.lastPainted = undefined;

      if (this.paintCommand && !this.paintCommand.isEmpty) {
        this.interaction?.executeCommand(
          this.paintCommand as unknown as EditorCommand
        );
      }
      this.paintCommand = undefined;
    });

    // Drag (MOVE only — Phaser handles draggable flag)
    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number
      ) => {
        if (this.effectiveTool !== ToolMode.MOVE) return;
        if (!isTile(obj)) return;

        const primary = this.primaryDragTile ?? (obj as PlacedTile);
        const primaryStart = this.groupDragStartPositions.get(primary);
        if (!primaryStart) return;

        const dx = dragX - primaryStart.x;
        const dy = dragY - primaryStart.y;

        // rigid body move: apply same delta to all selected tiles
        for (const t of this.draggingGroup) {
          const start = this.groupDragStartPositions.get(t);
          if (!start) continue;
          t.x = start.x + dx;
          t.y = start.y + dy;
        }
      }
    );

    // Drag end → snap
    // Drag end → snap (single OR group)
    this.input.on(
      "dragend",
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
        if (this.effectiveTool !== ToolMode.MOVE) return;
        if (!isTile(obj)) return;
        if (!this.primaryDragTile) return;

        const primary = this.primaryDragTile;

        const fromPrimary = this.groupDragStartCells.get(primary);
        if (!fromPrimary) return;

        // compute where primary ended up (grid)
        const toPrimary = worldToGrid(primary.x, primary.y);

        const dGX = toPrimary.gx - fromPrimary.gx;
        const dGY = toPrimary.gy - fromPrimary.gy;

        // If no movement, snap visuals back (or leave as-is)
        if (dGX === 0 && dGY === 0) {
          // restore original exact positions
          for (const t of this.draggingGroup) {
            const p = this.groupDragStartPositions.get(t);
            if (p) t.setPosition(p.x, p.y);
          }
          this.primaryDragTile = undefined;
          this.draggingGroup = [];
          this.groupDragStartPositions.clear();
          this.groupDragStartCells.clear();
          return;
        }

        // collision check (only against tiles NOT in the moving group)
        const groupSet = new Set(this.draggingGroup);

        for (const t of this.draggingGroup) {
          const from = this.groupDragStartCells.get(t);
          if (!from) continue;

          const toGX = from.gx + dGX;
          const toGY = from.gy + dGY;

          const atDest = this.occupancy.get(toGX, toGY);

          if (atDest && !groupSet.has(atDest)) {
            // blocked -> snap group back visually
            for (const tt of this.draggingGroup) {
              const p = this.groupDragStartPositions.get(tt);
              if (p) tt.setPosition(p.x, p.y);
            }

            this.primaryDragTile = undefined;
            this.draggingGroup = [];
            this.groupDragStartPositions.clear();
            this.groupDragStartCells.clear();
            return;
          }
        }

        // build composite move command (single undo step)
        const composite = new CompositeCommand("Move Tiles");

        for (const t of this.draggingGroup) {
          const from = this.groupDragStartCells.get(t);
          if (!from) continue;

          const toGX = from.gx + dGX;
          const toGY = from.gy + dGY;

          // no replaced tile because we disallowed collision above
          const cmd = new MoveTileCommand(
            this,
            this.occupancy,
            t,
            from.gx,
            from.gy,
            toGX,
            toGY,
            undefined
          );
          composite.add(cmd);
        }

        // execute via InteractionService so menu state updates
        this.interaction?.executeCommand(composite as unknown as EditorCommand);

        // cleanup drag state
        this.primaryDragTile = undefined;
        this.draggingGroup = [];
        this.groupDragStartPositions.clear();
        this.groupDragStartCells.clear();
      }
    );
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
