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
import { TileService } from "../service/TileService";

import { CharacterService } from "@/service/CharacterService";

import type {
  InteractionService,
  InteractionState,
} from "@/service/InteractionService";

import {
  PlaceTileCommand,
  type PlacedTileScene,
} from "./commands/PlaceTileCommand";
import type { EditorCommand } from "./commands/EditorCommand";
import type { TileId } from "@/tiles/tileTypes";
import { loadTileImages } from "@/tiles/loadPhaserTileAssets";

import {
  GRID_EXTENT,
  HALF_GRID,
  HALF_PIXEL,
  GRID_COLOR,
  AXIS_COLOR,
  AXIS_THICKNESS,
  TICK_COLOR,
  LABEL_COLOR,
  UNITS_PER_TICK,
  DEPTH,
} from "../data/gridEditorConfig";
import { registerCharacterAnimations } from "@/characters/registerCharacterAnimations";
import { loadCharacterAssets } from "@/characters/loadCharacterAssets";

import {
  PlaceCharacterCommand,
  type PlacedCharacter,
} from "./commands/PlaceCharacterCommand";
import { DEFAULT_LAYER, LayeredOccupancy } from "./layeredOccupancy";

const gridLineOffset = (units: number) =>
  units >= 0 ? -HALF_GRID : +HALF_GRID;

export default class GameEditor extends Phaser.Scene {
  private tileTypeMap!: ReturnType<typeof getTileRegistry>;

  private occupancy!: LayeredOccupancy<Phaser.GameObjects.GameObject>;

  // Hover character (headshot preview)
  private hoverCharacter?: Phaser.GameObjects.Image;

  public tileService!: TileService;
  private characterService = new CharacterService();
  // -----------------------------
  // Character group dragging
  // -----------------------------
  private draggingCharacters: PlacedCharacter[] = [];
  private characterDragStart = new Map<
    PlacedCharacter,
    { x: number; y: number }
  >();

  private isPainting = false;
  private groupDragStart = new Map<PlacedTile, { gx: number; gy: number }>();

  // -----------------------
  // Group Selection
  //
  // store interaction so we can execute commands + undo/redo with UI updates
  private interaction?: InteractionService;

  async preload() {
    loadTileImages(this);
    loadCharacterAssets(this);
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

  private get selectedTile(): TileId | undefined {
    return this.interactionState.selectedTile;
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

  // Hover preview (create mode)
  private hoverTile?: Phaser.GameObjects.Rectangle;

  // Move highlight
  private hoveredTile: PlacedTile | null = null;
  private hoveredCharacter: PlacedCharacter | null = null;

  private gridStatusCallback?: (status: GridStatus) => void;

  private removeMouseLeave?: () => void;

  // ============================================================
  //  PUBLIC API
  // ============================================================
  /**
   * Call this once from PhaserCanvas after the scene is ready:
   *   scene.attachInteractionService(interaction)
   */

  private clearCharacterHover() {
    if (!this.hoveredCharacter) return;

    const outline = this.hoveredCharacter.getData("hoverOutline") as
      | Phaser.GameObjects.Graphics
      | undefined;

    outline?.destroy();
    this.hoveredCharacter.setData("hoverOutline", null);
    this.hoveredCharacter = null;
  }

  private applyCharacterHover(char: PlacedCharacter) {
    if (this.hoveredCharacter === char) return;

    this.clearCharacterHover();

    const g = this.add.graphics();
    g.lineStyle(2, 0xffff00, 1);

    const padding = 2;
    g.strokeRect(
      -GRID_SIZE / 2 + padding,
      -GRID_SIZE + padding,
      GRID_SIZE - padding * 2,
      GRID_SIZE - padding * 2,
    );

    g.setDepth(DEPTH.HOVER);
    char.add(g);

    char.setData("hoverOutline", g);
    this.hoveredCharacter = char;
  }

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

  // In GameEditor class

  public addPlacedCharacter(character: PlacedCharacter) {
    // Add to Phaser scene
    this.add.existing(character);

    // Register in occupancy
    this.occupancy.set(character.gx, character.gy, character, DEFAULT_LAYER);
  }

  public removePlacedCharacter(character: PlacedCharacter) {
    // Remove from occupancy
    this.occupancy.delete(character.gx, character.gy, DEFAULT_LAYER);

    // Remove from scene
    character.destroy();
  }

  private get tileLayer() {
    return this.occupancy.getLayer(DEFAULT_LAYER) as GridOccupancy<PlacedTile>;
  }

  private get tileOccupancy(): GridOccupancy<PlacedTile> {
    // Grab the actual layer occupancy
    const layer = this.occupancy.getLayer(
      DEFAULT_LAYER,
    ) as GridOccupancy<PlacedTile>;

    return layer;
  }

  // ============================================================
  //  LIFECYCLE
  // ============================================================
  create() {
    console.debug("[GridEditorScene] create started");
    this.occupancy = new LayeredOccupancy<Phaser.GameObjects.GameObject>(
      DEFAULT_LAYER,
    );
    this.tileTypeMap = getTileRegistry();

    // --- Register Character Animations ---------------------------------
    registerCharacterAnimations(this);
    // ------------------------------------------------

    this.tileService = new TileService(
      this, // Phaser.Scene
      this.tileLayer, // GridOccupancy
      this.tileTypeMap, // tileTypeMap
    );

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

    this.hoverCharacter = this.add
      .image(0, 0, "") // placeholder texture; will be set dynamically
      .setDepth(DEPTH.HOVER + 1)
      .setVisible(false)
      .setOrigin(0.5, 0.5); // center pivot

    this.interaction?.subscribeSelection((event) => {
      for (const [, layer] of this.occupancy.layersEntries()) {
        for (const obj of layer.values()) {
          if (
            obj instanceof Phaser.GameObjects.Container &&
            obj.getData("kind") === "character"
          ) {
            const char = obj as PlacedCharacter;
            switch (event.phase) {
              case "start":
                char.onSelectionStart(event.rect);
                break;
              case "update":
                char.onSelectionUpdate(event.rect);
                break;
              case "end":
                char.onSelectionEnd(event.rect);
                break;
              case "clear":
                char.onSelectionClear();
                break;
            }
          }
        }
      }
    });

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
    this.hoverCharacter?.setVisible(false);
  }

  private clearMoveHighlight() {
    if (this.hoveredTile) {
      const rect = this.hoveredTile.rect;

      const color = rect.getData("baseStrokeColor");
      const width = rect.getData("baseStrokeWidth");
      const alpha = rect.getData("baseStrokeAlpha");

      rect.setStrokeStyle(width, color, alpha);
      rect.setDepth(DEPTH.TILES);
      this.hoveredTile = null;
    }

    this.clearCharacterHover();
  }

  private hideHoverPreviewAndSelection() {
    this.hideHoverPreview();
    this.clearMoveHighlight();
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

  private updatePlacedTileInteractivity(tile: PlacedTile) {
    if (!tile.input) return;

    const draggable = this.effectiveTool === ToolMode.MOVE;
    this.input.setDraggable(tile, draggable);

    // Never override canvas cursor except in MOVE
    tile.input.cursor = draggable ? "pointer" : "default";
  }

  private updateHoverCharacter(pointer: Phaser.Input.Pointer) {
    if (!this.hoverCharacter) return;

    const charId = this.interaction?.selectedCharacter;
    if (!charId) {
      this.hoverCharacter.setVisible(false);
      return;
    }

    // Determine direction: could enhance to match pointer/cursor
    const direction: "left" | "right" | "top" | "bottom" = "left";

    // Construct texture key
    const textureKey = `${charId}_head_${direction}`;

    // If texture isn't loaded yet, hide hover
    if (!this.textures.exists(textureKey)) {
      this.hoverCharacter.setVisible(false);
      return;
    }

    // Get grid coordinates
    const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
    const pos = gridToWorld(gx, gy);

    // Get actual image size to scale to grid
    const frame = this.textures
      .get(textureKey)
      .getSourceImage() as HTMLImageElement;
    const scale = GRID_SIZE / frame.height; // scale image height to grid

    // Apply texture, origin, scale, and position
    this.hoverCharacter
      .setTexture(textureKey)
      .setOrigin(0.5, 1) // pivot at bottom-center
      .setScale(scale)
      .setPosition(Math.round(pos.x), Math.round(pos.y + GRID_SIZE / 2)) // bottom aligns with tile
      .setVisible(true);
  }

  private updateHoverTile(pointer: Phaser.Input.Pointer) {
    if (!this.hoverTile) return;

    const tileId = this.selectedTile;
    if (!tileId) {
      this.hoverTile.setVisible(false);
      return;
    }

    const tileDef = this.tileTypeMap[tileId];
    if (!tileDef) {
      this.hoverTile.setVisible(false);
      return;
    }

    const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
    const pos = gridToWorld(gx, gy);

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
              Phaser.Math.Clamp(this.zoomStart * zoomFactor, 0.25, 4),
            );
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }

        case ToolMode.CREATE: {
          this.clearMoveHighlight();
          this.updateHoverTile(pointer);
          this.updateHoverCharacter(pointer);

          // 🔥 Paint-while-dragging (fast tile placement)
          if (this.isPainting) {
            const tileId = this.selectedTile;
            if (!tileId) return;

            const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
            this.tileService.paintSingleCell(gx, gy, this.selectedTile);
          }

          this.emitGridStatus(pointer.worldX, pointer.worldY);
          return;
        }

        case ToolMode.MOVE: {
          this.hideHoverPreview();

          // ------------------------------------
          // GROUP DRAG: rigid movement
          // ------------------------------------
          if (
            this.tileService.isGroupDragging &&
            this.groupDragStart.size > 0
          ) {
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
          if (
            this.tileService.isSelecting &&
            this.tileService.selectionStart &&
            this.tileService.selectionRect
          ) {
            const start = this.tileService.selectionStart;
            const x = (start.x + pointer.worldX) / 2;
            const y = (start.y + pointer.worldY) / 2;
            const w = Math.abs(pointer.worldX - start.x);
            const h = Math.abs(pointer.worldY - start.y);

            // Update visual rectangle
            this.tileService.selectionRect.setPosition(x, y).setSize(w, h);

            // Send selection info to InteractionService using existing method
            if (this.interaction) {
              this.interaction.updateSelection({
                x: Math.min(start.x, pointer.worldX),
                y: Math.min(start.y, pointer.worldY),
                width: w,
                height: h,
              });
            }

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
          } else if (
            hit instanceof Phaser.GameObjects.Container &&
            hit.getData("kind") === "character"
          ) {
            this.applyCharacterHover(hit as PlacedCharacter);
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
        if (hit instanceof Phaser.GameObjects.Container) {
          const kind = hit.getData?.("kind");

          // -----------------
          // TILE
          // -----------------
          if (kind === "tile" && hit instanceof Phaser.GameObjects.Container) {
            const { gx, gy } = worldToGrid(hit.x, hit.y);
            this.occupancy.delete(gx, gy, DEFAULT_LAYER);
            hit.destroy();
          }

          // -----------------
          // CHARACTER
          // -----------------
          else if (
            kind === "character" &&
            hit instanceof Phaser.GameObjects.Sprite
          ) {
            const gx = hit.getData("gx");
            const gy = hit.getData("gy");

            if (gx !== undefined && gy !== undefined) {
              this.occupancy.delete(gx, gy, DEFAULT_LAYER);
            }

            hit.destroy();
          }
        }
        return;
      }

      if (tool === ToolMode.CREATE && pointer.leftButtonDown()) {
        this.isPainting = true;

        // Reset last painted
        this.tileService.lastPainted = undefined;

        // Initialize paint command for tiles (if any)
        if (this.selectedTile) {
          this.tileService.paintCommand = new CompositeCommand("Paint Tiles");
        }

        const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);

        // -----------------------------
        // Paint Tile
        // -----------------------------
        if (this.selectedTile) {
          this.tileService.paintSingleCell(gx, gy, this.selectedTile);
        }

        // -----------------------------
        // Spawn Character
        // -----------------------------
        const charId = this.interaction?.selectedCharacter;
        if (charId) {
          const existingChar = this.occupancy.get(gx, gy, DEFAULT_LAYER) as
            | PlacedCharacter
            | undefined;
          const worldPos = gridToWorld(gx, gy);
          const charX = worldPos.x;
          const charY = worldPos.y + GRID_SIZE / 2; // bottom of cell
          const cmd = new PlaceCharacterCommand(this as any, {
            characterId: charId,
            x: charX,
            y: charY,
            gx,
            gy,
            replaced: existingChar,
            direction: "left",
            depth: DEPTH.HUD + 1,
          });

          this.interaction?.executeCommand(cmd);
        }
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

          this.tileService.primaryDragTile = primary;

          // Determine group: selection or just this tile
          const group =
            this.tileService.selectedTiles.size > 0 &&
            this.tileService.selectedTiles.has(primary)
              ? Array.from(this.tileService.selectedTiles)
              : [primary];

          this.tileService.draggingGroup = group;

          this.tileService.groupDragStartPositions.clear();
          this.tileService.groupDragStartCells.clear();

          for (const tile of group) {
            this.tileService.groupDragStartPositions.set(tile, {
              x: tile.x,
              y: tile.y,
            });

            const { gx, gy } = worldToGrid(tile.x, tile.y);
            this.tileService.groupDragStartCells.set(tile, { gx, gy });
          }

          return;
        }

        // Handle character drag (multi-selection)
        const hitChar =
          hit instanceof Phaser.GameObjects.Container &&
          hit.getData("kind") === "character"
            ? (hit as PlacedCharacter)
            : undefined;

        if (hitChar) {
          // Determine group: all selected characters, or just this one
          const group = this.characterService?.selectedCharacters?.size
            ? Array.from(this.characterService.selectedCharacters)
            : [hitChar];

          this.draggingCharacters = group;
          this.characterDragStart.clear();

          for (const char of group) {
            this.characterDragStart.set(char, { x: char.x, y: char.y });
          }

          return; // prevent starting box selection when clicking a character
        }

        // Case 2: Clicked empty space → start box select
        this.tileService.isSelecting = true;
        this.tileService.selectionStart = {
          x: pointer.worldX,
          y: pointer.worldY,
        };

        this.tileService.selectionRect = this.add
          .rectangle(pointer.worldX, pointer.worldY, 1, 1, 0x3399ff, 0.2)
          .setStrokeStyle(1, 0x3399ff)
          .setDepth(DEPTH.HUD);

        // 🔑 Call InteractionService to start selection
        if (this.interaction && this.tileService.selectionStart) {
          const start = this.tileService.selectionStart;

          this.interaction.beginSelection({
            x: start.x, // use stored selection start
            y: start.y,
            width: 0,
            height: 0,
          });
        }

        return;
      }

      // CREATE place/replace
      if (tool === ToolMode.CREATE) {
        const { gx, gy } = worldToGrid(pointer.worldX, pointer.worldY);
        const existing = this.tileOccupancy.get?.(gx, gy) ?? undefined;

        const tileId = this.selectedTile;
        if (!tileId) return;

        const cmd = new PlaceTileCommand(
          this as unknown as PlacedTileScene,
          this.tileOccupancy,
          this.tileService,
          gx,
          gy,
          this.selectedTile,
          existing,
        );

        this.interaction?.executeCommand(cmd);
      }
    });

    this.input.on("pointerup", (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.isZooming = false;

      // Tile selection (tileService internal)
      const finalRect = this.tileService.selectionRect; // <-- save before clearing
      this.tileService.finishBoxSelect(pointer, this.effectiveTool);

      if (finalRect) {
        this.interaction?.endSelection({
          x: finalRect.x,
          y: finalRect.y,
          width: finalRect.width,
          height: finalRect.height,
        });
      } else {
        this.interaction?.clearSelection();
      }

      // Generic cleanup for painting, dragging, etc.
      this.isPainting = false;
      this.tileService.lastPainted = undefined;

      if (
        this.tileService.paintCommand &&
        !this.tileService.paintCommand.isEmpty
      ) {
        this.interaction?.executeCommand(
          this.tileService.paintCommand as unknown as EditorCommand,
        );
      }
      this.tileService.paintCommand = undefined;
    });

    // 🔑 THIS IS THE KEY FIX
    this.input.on("pointerupoutside", (pointer: Phaser.Input.Pointer) => {
      this.isPanning = false;
      this.isZooming = false;

      this.tileService.finishBoxSelect(pointer, this.effectiveTool);

      this.isPainting = false;
      this.tileService.lastPainted = undefined;

      if (
        this.tileService.paintCommand &&
        !this.tileService.paintCommand.isEmpty
      ) {
        this.interaction?.executeCommand(
          this.tileService.paintCommand as unknown as EditorCommand,
        );
      }
      this.tileService.paintCommand = undefined;
    });

    // Drag (MOVE only — Phaser handles draggable flag)
    this.input.on(
      "drag",
      (
        _pointer: Phaser.Input.Pointer,
        obj: Phaser.GameObjects.GameObject,
        dragX: number,
        dragY: number,
      ) => {
        if (this.effectiveTool !== ToolMode.MOVE) return;

        /* ============================================
        TILE DRAG (existing logic, unchanged)
        ============================================ */
        if (isTile(obj)) {
          const primary =
            this.tileService.primaryDragTile ?? (obj as PlacedTile);
          const primaryStart =
            this.tileService.groupDragStartPositions.get(primary);
          if (!primaryStart) return;

          const dx = dragX - primaryStart.x;
          const dy = dragY - primaryStart.y;

          // rigid body move: apply same delta to all selected tiles
          for (const t of this.tileService.draggingGroup) {
            const start = this.tileService.groupDragStartPositions.get(t);
            if (!start) continue;
            t.x = start.x + dx;
            t.y = start.y + dy;
          }

          return;
        }

        /* ============================================
        CHARACTER DRAG (new, mirrors tile behavior)
        ============================================ */
        if (
          obj instanceof Phaser.GameObjects.Container &&
          obj.getData("kind") === "character"
        ) {
          const primary = obj as PlacedCharacter;
          const primaryStart = this.characterDragStart.get(primary);
          if (!primaryStart) return;

          const dx = dragX - primaryStart.x;
          const dy = dragY - primaryStart.y;

          for (const [char, start] of this.characterDragStart.entries()) {
            char.x = start.x + dx;
            char.y = start.y + dy;
          }
        }
      },
    );

    // Drag end → snap
    this.input.on(
      "dragend",
      (_pointer: Phaser.Input.Pointer, obj: Phaser.GameObjects.GameObject) => {
        if (this.effectiveTool !== ToolMode.MOVE) return;

        // ----------------------------
        // TILE DRAG END
        // ----------------------------
        if (isTile(obj) && this.tileService.primaryDragTile) {
          const primary = this.tileService.primaryDragTile;
          const fromPrimary = this.tileService.groupDragStartCells.get(primary);
          if (!fromPrimary) return;

          const toPrimary = worldToGrid(primary.x, primary.y);
          const dGX = toPrimary.gx - fromPrimary.gx;
          const dGY = toPrimary.gy - fromPrimary.gy;

          // No movement → snap back
          if (dGX === 0 && dGY === 0) {
            for (const t of this.tileService.draggingGroup) {
              const p = this.tileService.groupDragStartPositions.get(t);
              if (p) t.setPosition(p.x, p.y);
            }
            this.tileService.primaryDragTile = undefined;
            this.tileService.draggingGroup = [];
            this.tileService.groupDragStartPositions.clear();
            this.tileService.groupDragStartCells.clear();
            return;
          }

          // Collision check
          const groupSet = new Set<Phaser.GameObjects.GameObject>(
            this.tileService.draggingGroup,
          );
          for (const t of this.tileService.draggingGroup) {
            const from = this.tileService.groupDragStartCells.get(t);
            if (!from) continue;

            const toGX = from.gx + dGX;
            const toGY = from.gy + dGY;
            const atDest = this.occupancy.get(toGX, toGY, DEFAULT_LAYER) as
              | Phaser.GameObjects.GameObject
              | undefined;

            if (atDest && !groupSet.has(atDest)) {
              // Snap back visually
              for (const tt of this.tileService.draggingGroup) {
                const p = this.tileService.groupDragStartPositions.get(tt);
                if (p) tt.setPosition(p.x, p.y);
              }
              this.tileService.primaryDragTile = undefined;
              this.tileService.draggingGroup = [];
              this.tileService.groupDragStartPositions.clear();
              this.tileService.groupDragStartCells.clear();
              return;
            }
          }

          // Build composite move command
          const composite = new CompositeCommand("Move Tiles");
          for (const t of this.tileService.draggingGroup) {
            const from = this.tileService.groupDragStartCells.get(t);
            if (!from) continue;

            const toGX = from.gx + dGX;
            const toGY = from.gy + dGY;

            const cmd = new MoveTileCommand(
              this,
              this.tileOccupancy,
              t,
              from.gx,
              from.gy,
              toGX,
              toGY,
              undefined,
            );
            composite.add(cmd);
          }

          this.interaction?.executeCommand(
            composite as unknown as EditorCommand,
          );

          // Cleanup
          this.tileService.primaryDragTile = undefined;
          this.tileService.draggingGroup = [];
          this.tileService.groupDragStartPositions.clear();
          this.tileService.groupDragStartCells.clear();
          return;
        }

        // ----------------------------
        // CHARACTER DRAG END
        // ----------------------------
        if (
          obj instanceof Phaser.GameObjects.Container &&
          obj.getData("kind") === "character"
        ) {
          // Build ignore set (characters being dragged together)
          const groupSet = new Set<Phaser.GameObjects.GameObject>(
            this.draggingCharacters,
          );

          // First pass: validate all destinations
          for (const char of this.draggingCharacters) {
            const { gx, gy } = worldToGrid(char.x, char.y);

            const atDest = this.occupancy.get(gx, gy, DEFAULT_LAYER);
            if (atDest && !groupSet.has(atDest)) {
              // ❌ collision → snap everyone back
              for (const [c, start] of this.characterDragStart.entries()) {
                c.setPosition(start.x, start.y);
              }

              this.draggingCharacters = [];
              this.characterDragStart.clear();
              return;
            }
          }

          // Second pass: commit snap
          for (const char of this.draggingCharacters) {
            const oldGx = char.gx;
            const oldGy = char.gy;

            const { gx, gy } = worldToGrid(char.x, char.y);
            const pos = gridToWorld(gx, gy);

            this.occupancy.delete(oldGx, oldGy, DEFAULT_LAYER);

            char.setPosition(
              Math.round(pos.x),
              Math.round(pos.y + GRID_SIZE / 2),
            );
            char.gx = gx;
            char.gy = gy;

            this.occupancy.set(gx, gy, char, DEFAULT_LAYER);
          }

          this.draggingCharacters = [];
          this.characterDragStart.clear();
          return;
        }
      },
    );
  }
}
