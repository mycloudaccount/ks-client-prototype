import { useReducer, useCallback } from "react";
import { AppContext } from "./AppContext";
import { appReducer } from "./appReducer";
import { initialAppState } from "./appState";
import type { GridStatus } from "./appState";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialAppState);

  // ⭐ Strategy A: single entry point for Phaser → React
  const updateGridStatus = useCallback((status: GridStatus) => {
    dispatch({
      type: "GRID_STATUS_UPDATED",
      payload: status,
    });
  }, []);

  return (
    <AppContext.Provider
      value={{
        state,
        dispatch,

        // exposed convenience values
        gridStatus: state.gridStatus,
        updateGridStatus,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
