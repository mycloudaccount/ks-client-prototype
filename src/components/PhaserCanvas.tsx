import { useEffect, useRef } from "react";
import Phaser from "phaser";
import GameEditor from "../editor/GameEditor";
import { useAppContext } from "../context/AppContext";
import CanvasTools from "./CanvasTools";
import { useInteraction } from "@/context/InteractionContext";
import { saveGrid } from "../editor/saveGrid";
import { saveGridAs } from "@/editor/saveGridAs";
import { openGrid } from "../editor/openGrid";

const BASE_WIDTH = 2048;
const BASE_HEIGHT = 2048;
const ASPECT = BASE_WIDTH / BASE_HEIGHT;

type PhaserSceneAPI = {
  recenter: () => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetView: () => void;
  save: () => void;
  saveAs: () => void;
  open: () => void;
};

type PhaserCanvasProps = {
  onSceneReady?: (api: PhaserSceneAPI) => void;
};

export default function PhaserCanvas({ onSceneReady }: PhaserCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<GameEditor | null>(null);

  const interaction = useInteraction();
  const { updateGridStatus } = useAppContext();

  // -------------------------
  // Create Phaser ONCE
  // -------------------------
  useEffect(() => {
    if (!hostRef.current || gameRef.current) return;

    (async () => {
      const game = new Phaser.Game({
        type: Phaser.CANVAS,
        width: BASE_WIDTH,
        height: BASE_HEIGHT,
        parent: hostRef.current,
        scale: { mode: Phaser.Scale.NONE },
        render: {
          pixelArt: true,
          antialias: false,
          roundPixels: true,
        },
        backgroundColor: "#1e1e1e",
        scene: GameEditor,
      });

      gameRef.current = game;

      game.events.once("ready", () => {
        const scene = game.scene.getAt(0) as GameEditor;
        sceneRef.current = scene;

        scene.attachInteractionService(interaction);
        scene.recenter(true);
        scene.setGridStatusCallback(updateGridStatus);

        onSceneReady?.({
          recenter: () => scene.recenter(false),
          zoomIn: () => scene.zoomBy(0.2),
          zoomOut: () => scene.zoomBy(-0.2),
          resetView: () => scene.resetView(),
          save: () => saveGrid(scene),
          saveAs: () => saveGridAs(scene),
          open: () => openGrid(scene),
        });
      });
    })();

    return () => {
      gameRef.current?.destroy(true);
      gameRef.current = null;
      sceneRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // -------------------------
  // Resize handling
  // -------------------------
  useEffect(() => {
    if (!hostRef.current || !gameRef.current) return;

    const observer = new ResizeObserver((entries) => {
      const { width, height } = entries[0].contentRect;
      if (width < 10 || height < 10) return;

      let w = width;
      let h = Math.round(width / ASPECT);

      if (h > height) {
        h = height;
        w = Math.round(height * ASPECT);
      }

      gameRef.current!.scale.resize(Math.floor(w), Math.floor(h));
    });

    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="w-full h-full flex items-center justify-center bg-[#151515] overflow-hidden">
      <div ref={hostRef} />
      <CanvasTools />
    </div>
  );
}
