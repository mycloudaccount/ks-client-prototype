/* eslint-disable @typescript-eslint/no-explicit-any */
import Phaser from "phaser";
import type { EditorCommand } from "./EditorCommand";
import { CharacterFactory } from "@/characters/CharacterFactory";
import { v4 as uuid } from "uuid";
import { GRID_SIZE } from "@/editor/gridMath";
import type { SelectionEvent } from "@/service/InteractionService";
import { CharacterService } from "@/service/CharacterService";
import { DEFAULT_LAYER, type LayeredOccupancy } from "../layeredOccupancy";

export type PlacedCharacter = Phaser.GameObjects.Container & {
  instanceId: string;
  characterId: string;
  gx: number;
  gy: number;
  sprite: Phaser.GameObjects.Sprite;

  select: () => void;
  destroySelf: () => void;

  handleSelection: (event: SelectionEvent) => void;

  onSelectionStart: (rect: SelectionEvent["rect"]) => void;
  onSelectionUpdate: (rect: SelectionEvent["rect"]) => void;
  onSelectionEnd: (rect: SelectionEvent["rect"]) => void;
  onSelectionClear: () => void;

  moveBy?: (dGX: number, dGY: number) => void; // optional for future drag
};

export type PlaceCharacterArgs = {
  characterId: string;
  x: number;
  y: number;
  gx: number;
  gy: number;
  direction?: "left" | "right" | "top" | "bottom";
  depth?: number;
  replaced?: Phaser.GameObjects.GameObject;
};

export function attachCharacterHitDebug(char: PlacedCharacter) {
  if (!char.input || !char.input.hitArea) return;

  const g = char.scene.add.graphics();
  g.lineStyle(2, 0x00ff00, 1);

  const r = char.input.hitArea as Phaser.Geom.Rectangle;
  g.strokeRect(r.x, r.y, r.width, r.height);

  char.add(g);
  g.setDepth(9999);
  char.setData("__debugHit", g);
}

export class PlaceCharacterCommand implements EditorCommand {
  label = "Place Character";

  private scene: Phaser.Scene & {
    occupancy: LayeredOccupancy;
  };

  private args: PlaceCharacterArgs;
  private placedChar?: PlacedCharacter;

  private characterService?: CharacterService;

  constructor(
    scene: Phaser.Scene & {
      occupancy: LayeredOccupancy;
      characterService: CharacterService;
    },
    args: PlaceCharacterArgs,
  ) {
    this.scene = scene;
    this.args = args;
    this.characterService = scene.characterService;
  }

  apply(): void {
    const { gx, gy, replaced } = this.args;

    // -----------------------------
    // Remove existing character if replaced
    // -----------------------------
    if (replaced) {
      if (canDestroy(replaced)) {
        replaced.destroySelf();
      } else {
        replaced.destroy(); // safe fallback
      }
    }

    // -----------------------------
    // Spawn sprite
    // -----------------------------
    const sprite = CharacterFactory.spawn(this.scene, {
      id: this.args.characterId,
      x: 0,
      y: 0,
      direction: this.args.direction,
      depth: this.args.depth,
    });
    sprite.setOrigin(0.5, 1);

    // -----------------------------
    // Create container
    // -----------------------------
    const container = this.scene.add.container(this.args.x, this.args.y);
    container.add(sprite);

    container.setData("kind", "character");
    container.setData("gx", gx);
    container.setData("gy", gy);

    // -----------------------------
    // Interactive hit area
    // -----------------------------
    container.setSize(GRID_SIZE, GRID_SIZE);
    container.setInteractive(
      new Phaser.Geom.Rectangle(
        -GRID_SIZE / 2,
        -GRID_SIZE,
        GRID_SIZE,
        GRID_SIZE,
      ),
      Phaser.Geom.Rectangle.Contains,
    );
    container.scene.input.setDraggable(container, true);
    container.setDepth(this.args.depth ?? 100);

    // -----------------------------
    // Build PlacedCharacter
    // -----------------------------
    const placedChar: PlacedCharacter = Object.assign(container, {
      instanceId: uuid(),
      characterId: this.args.characterId,
      gx,
      gy,
      sprite,

      select: () => {
        this.characterService?.select([placedChar], true); // add to current selection
      },

      destroySelf: () => {
        this.scene.occupancy.delete(
          placedChar.gx,
          placedChar.gy,
          DEFAULT_LAYER,
        );
        container.destroy();
        this.characterService?.deselect([placedChar]);
      },

      handleSelection: (event: SelectionEvent) => {
        const { rect, phase } = event;
        const tag = `[Character ${placedChar.instanceId}]`;

        switch (phase) {
          case "start":
            console.log(`${tag} selection START`, rect);
            break;

          case "update":
            // no pending selection logic anymore
            break;

          case "end": {
            console.log(`${tag} selection END`, rect);
            if (!rect) break;

            const left = placedChar.x - GRID_SIZE / 2;
            const right = placedChar.x + GRID_SIZE / 2;
            const top = placedChar.y - GRID_SIZE;
            const bottom = placedChar.y;

            const isInside =
              right > rect.x - rect.width / 2 &&
              left < rect.x + rect.width / 2 &&
              bottom > rect.y - rect.height / 2 &&
              top < rect.y + rect.height / 2;

            placedChar.setData("isSelected", isInside);

            let selRect = placedChar.getData(
              "selectionRect",
            ) as Phaser.GameObjects.Graphics;

            if (isInside) {
              if (!selRect) {
                selRect = placedChar.scene.add.graphics();
                selRect.lineStyle(2, 0x00ffff, 1);

                const padding = 2;
                selRect.strokeRect(
                  -GRID_SIZE / 2 + padding,
                  -GRID_SIZE + padding,
                  GRID_SIZE - padding * 2,
                  GRID_SIZE - padding * 2,
                );

                selRect.setDepth(9999);
                placedChar.add(selRect);
                placedChar.setData("selectionRect", selRect);

                placedChar.scene.tweens.add({
                  targets: selRect,
                  alpha: { from: 1, to: 0.3 },
                  duration: 600,
                  yoyo: true,
                  repeat: -1,
                  ease: "Sine.easeInOut",
                });
              }

              this.characterService?.select([placedChar], true);
            } else if (selRect) {
              selRect.destroy();
              placedChar.setData("selectionRect", null);
              this.characterService?.deselect([placedChar]);
            }
            break;
          }

          case "clear": {
            console.log(`${tag} selection CLEAR`);
            const oldRect = placedChar.getData(
              "selectionRect",
            ) as Phaser.GameObjects.Graphics;
            if (oldRect) {
              oldRect.destroy();
              placedChar.setData("selectionRect", null);
            }
            placedChar.setData("isSelected", false);
            this.characterService?.deselect([placedChar]);
            break;
          }
        }
      },

      onSelectionStart: (rect: SelectionEvent["rect"]) =>
        placedChar.handleSelection({ phase: "start", rect }),

      onSelectionUpdate: (rect: SelectionEvent["rect"]) =>
        placedChar.handleSelection({ phase: "update", rect }),

      onSelectionEnd: (rect: SelectionEvent["rect"]) =>
        placedChar.handleSelection({ phase: "end", rect }),

      onSelectionClear: () =>
        placedChar.handleSelection({ phase: "clear", rect: undefined }),

      moveBy: (dGX: number, dGY: number) => {
        // optional for multi-selection drag later
        placedChar.x += dGX * GRID_SIZE;
        placedChar.y += dGY * GRID_SIZE;
        placedChar.gx += dGX;
        placedChar.gy += dGY;
      },
    });

    // -----------------------------
    // Pointer behavior
    // -----------------------------
    container.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      if (pointer.rightButtonDown()) {
        placedChar.destroySelf();
        return;
      }
      placedChar.select();
    });

    // -----------------------------
    // Register occupancy
    // -----------------------------
    this.scene.occupancy.set(gx, gy, placedChar, DEFAULT_LAYER);
    this.placedChar = placedChar;

    // Debugging hitbox if needed
    // attachCharacterHitDebug(placedChar);
  }

  revert(): void {
    if (!this.placedChar) return;

    const { gx, gy } = this.placedChar;
    this.placedChar.destroySelf();
    this.scene.occupancy.delete(gx, gy, DEFAULT_LAYER);
    this.placedChar = undefined;
  }
}

function canDestroy(
  obj: Phaser.GameObjects.GameObject,
): obj is Phaser.GameObjects.GameObject & { destroySelf: () => void } {
  return typeof (obj as any).destroySelf === "function";
}
