import type { AppState, GridStatus } from "./appState";
import type { TileType } from "../editor/tileTypes";

export type AppAction =
  | {
      type: "GRID_STATUS_UPDATED";
      payload: GridStatus;
    }
  | {
      type: "SET_SELECTED_TILE";
      tile: TileType;
    };

export function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case "GRID_STATUS_UPDATED":
      return {
        ...state,
        gridStatus: action.payload,
      };

    case "SET_SELECTED_TILE":
      return {
        ...state,
        selectedTile: action.tile,
      };

    default:
      return state;
  }
}
