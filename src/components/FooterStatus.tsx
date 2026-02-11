import { useEffect, useState } from "react";
import { useAppContext } from "../context/AppContext";
import { useInteraction } from "@/context/InteractionContext";
import type { InteractionState } from "@/service/InteractionService";

export default function FooterStatus() {
  const {
    state: { gridStatus },
  } = useAppContext();

  const interaction = useInteraction();
  const [interactionState, setInteractionState] =
    useState<InteractionState | null>(null);

  // Subscribe to InteractionService
  useEffect(() => {
    return interaction.subscribe(setInteractionState);
  }, [interaction]);

  const effectiveTool =
    interactionState?.transientTool ?? interactionState?.baseTool;

  return (
    <div className="h-8 px-3 flex items-center gap-4 bg-neutral-900 text-neutral-300 text-xs font-mono border-t border-neutral-700">
      {/* Grid info */}
      <span>
        Center: ({gridStatus.center.gx}, {gridStatus.center.gy})
      </span>
      <span>
        Cursor: ({gridStatus.cursor.gx}, {gridStatus.cursor.gy})
      </span>
      <span>Zoom: {gridStatus.zoom.toFixed(2)}x</span>

      <span className="mx-2 text-neutral-600">|</span>

      {/* Interaction info */}
      <span>
        Tool: <span className="text-white">{effectiveTool}</span>
      </span>

      {interactionState?.transientTool && (
        <span className="text-yellow-400">(transient)</span>
      )}

      <span>
        Tile:{" "}
        <span className="text-blue-300">{interactionState?.selectedTile}</span>
      </span>

      {interactionState?.source && (
        <span className="text-neutral-500">via {interactionState.source}</span>
      )}
    </div>
  );
}
