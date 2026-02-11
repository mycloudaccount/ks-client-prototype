import { createContext, useContext } from "react";
import type { AppState, GridStatus } from "./appState";
import type { AppAction } from "./appReducer";

export interface AppContextValue {
  state: AppState;
  dispatch: React.Dispatch<AppAction>;

  // ⭐ Strategy A additions
  gridStatus: GridStatus;
  updateGridStatus: (status: GridStatus) => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useAppContext(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) {
    throw new Error("useAppContext must be used inside AppProvider");
  }
  return ctx;
}
