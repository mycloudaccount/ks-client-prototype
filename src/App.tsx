import { useEffect, useState } from "react";

import LayerPanel from "./components/LayerPanel";
import PhaserCanvas from "./components/PhaserCanvas";
import FooterStatus from "./components/FooterStatus";
import TopMenu from "./components/TopMenu";
import PalettePanel from "./components/PalettePanel";

import { InteractionService } from "@/service/InteractionService";
import type { CommandState } from "@/service/InteractionService";
import { ToolMode } from "@/editor/types";
import { getTileRegistry } from "@/tiles/tileLoader";
import { loadGameAssets } from "@/service/AssetLoaderService";
import BootOverlay from "./components/BootOverlay";

type BootState = "loading" | "fading" | "ready";

// 🎛️ TIMING CONTROLS
const MIN_LOADING_MS = 5000;
const HOLD_AFTER_LOAD_MS = 600;
const FADE_DURATION_MS = 2200;

export default function App() {
  // ---------------------------
  // INTERACTION SERVICE (singleton)
  // ---------------------------
  const [interaction] = useState(() => new InteractionService());

  const [leftOpen, setLeftOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  const [bootState, setBootState] = useState<BootState>("loading");

  const [commandState, setCommandState] = useState<CommandState>({
    canUndo: false,
    canRedo: false,
    undoLabel: undefined,
    redoLabel: undefined,
  });

  const [controls, setControls] = useState<{
    recenter?: () => void;
    zoomIn?: () => void;
    zoomOut?: () => void;
    resetView?: () => void;
    save?: () => void;
    saveAs?: () => void;
    open?: () => void;
  }>({});

  // ---------------------------
  // Command subscription
  // ---------------------------
  useEffect(() => {
    return interaction.subscribeCommands(setCommandState);
  }, [interaction]);

  // ---------------------------
  // GAME ASSET BOOTSTRAP
  // ---------------------------
  useEffect(() => {
    let cancelled = false;

    (async () => {
      const bootStart = performance.now();

      await loadGameAssets();
      if (cancelled) return;

      const registry = getTileRegistry();
      const firstTile = Object.values(registry)[0]?.id;
      if (!firstTile) {
        throw new Error("No tiles defined in tile registry");
      }

      // ✅ modern, supported initialization
      interaction.setSelectedTile(firstTile);
      interaction.setBaseTool(ToolMode.CREATE);

      const elapsed = performance.now() - bootStart;
      const minRemaining = Math.max(0, MIN_LOADING_MS - elapsed);

      setTimeout(() => {
        if (cancelled) return;

        setTimeout(() => {
          if (cancelled) return;

          setBootState("fading");

          setTimeout(() => {
            if (!cancelled) setBootState("ready");
          }, FADE_DURATION_MS);
        }, HOLD_AFTER_LOAD_MS);
      }, minRemaining);
    })();

    return () => {
      cancelled = true;
    };
  }, [interaction]);

  // ---------------------------
  // ROOT
  // ---------------------------
  return (
    <div className="h-screen w-screen relative overflow-hidden bg-neutral-900">
      {/* =========================
        MAIN APP CONTENT
        (MOUNT ONLY AFTER LOAD)
       ========================= */}
      {(bootState === "fading" || bootState === "ready") && (
        <div
          className={`h-full w-full flex flex-col transition-opacity duration-500 ${
            bootState === "ready" ? "opacity-100" : "opacity-0"
          }`}
        >
          {/* TOP MENU */}
          <TopMenu
            onResetView={() => controls.resetView?.()}
            onRecenterGrid={() => controls.recenter?.()}
            onZoomIn={() => controls.zoomIn?.()}
            onZoomOut={() => controls.zoomOut?.()}
            onUndo={() => interaction.undo()}
            onRedo={() => interaction.redo()}
            canUndo={commandState.canUndo}
            canRedo={commandState.canRedo}
            onSave={() => controls.save?.()}
            onSaveAs={() => controls.saveAs?.()}
            onOpen={() => controls.open?.()}
          />

          {/* MAIN CONTENT */}
          <div className="flex flex-1 overflow-hidden">
            <PalettePanel
              open={leftOpen}
              onToggle={() => setLeftOpen((v) => !v)}
            />

            <div className="flex-1 min-w-0 min-h-0 relative overflow-hidden">
              {/* ❗ interaction is provided via context, not props */}
              <PhaserCanvas onSceneReady={setControls} />
            </div>

            <LayerPanel
              open={rightOpen}
              onToggle={() => setRightOpen((v) => !v)}
            />
          </div>

          <FooterStatus />
        </div>
      )}

      {/* =========================
        BOOT / LOADING OVERLAY
       ========================= */}
      <BootOverlay bootState={bootState} fadeDurationMs={FADE_DURATION_MS} />
    </div>
  );
}
