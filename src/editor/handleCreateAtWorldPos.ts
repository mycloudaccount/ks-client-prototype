// editor/handleCreateAtWorldPos.ts
import type Phaser from "phaser";
// Removed ToolMode import because we don't directly use it anymore

// Make sure this path points to your actual InteractionService file
import type { InteractionService } from "../service/InteractionService";

import {
  PlaceTileCommand,
  type PlacedTileScene,
} from "@/editor/commands/PlaceTileCommand";
import {
  PlaceCharacterCommand,
  type PlaceCharacterScene,
} from "@/editor/commands/PlaceCharacterCommand";

export function handleCreateAtWorldPos(
  scene: Phaser.Scene,
  interaction: InteractionService,
  worldX: number,
  worldY: number,
) {
  const state = interaction["state"]; // internal access

  // -----------------------------
  // Tile placement
  // -----------------------------
  if (interaction.isPlacingTile && state.selectedTile) {
    const tileScene = scene as PlacedTileScene;

    // Make sure your scene actually has these properties
    if (!tileScene.occupancy || !tileScene.tileService) {
      console.warn("Tile scene missing occupancy or tileService");
      return;
    }

    interaction.executeCommand(
      new PlaceTileCommand(
        tileScene,
        tileScene.occupancy,
        tileScene.tileService,
        worldX,
        worldY,
        state.selectedTile,
      ),
    );
    return;
  }

  // -----------------------------
  // Character placement
  // -----------------------------
  if (interaction.isPlacingCharacter && state.selectedCharacter) {
    const charScene = scene as PlaceCharacterScene;

    interaction.executeCommand(
      new PlaceCharacterCommand(charScene, {
        characterId: state.selectedCharacter,
        x: worldX,
        y: worldY,
      }),
    );
  }
}
