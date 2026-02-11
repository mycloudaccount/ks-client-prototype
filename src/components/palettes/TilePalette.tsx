import clsx from "clsx";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useInteraction } from "@/context/InteractionContext";
import { ToolMode } from "@/editor/types";
import { getAllTiles } from "@/tiles/tileLoader";
import type { TileId } from "@/tiles/tileTypes";

export default function TilePalette() {
  const interaction = useInteraction();
  const tiles = getAllTiles();

  // ✅ allow "no selection"
  const [selectedTile, setSelectedTile] = useState<TileId | undefined>(
    tiles[0]?.id,
  );

  useEffect(() => {
    return interaction.subscribe((state) => {
      setSelectedTile(state.selectedTile);
    });
  }, [interaction]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -12 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="flex flex-col gap-3"
    >
      {/* TITLE */}
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        Tiles
      </div>

      {/* GRID */}
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((tile) => {
          const imgSrc = `/assets/tiles/${tile.images.front}`;
          const isSelected = selectedTile === tile.id;

          return (
            <motion.button
              key={tile.id}
              onClick={() => {
                interaction.setSelectedTile(tile.id);
                interaction.setBaseTool(ToolMode.CREATE);
              }}
              title={tile.id}
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={clsx(
                "rounded border-2 flex items-center justify-center overflow-hidden",
                "hover:shadow-lg transition-shadow",
                isSelected ? "ring-2 ring-yellow-400" : "border-neutral-50",
              )}
              style={{
                background: isSelected
                  ? "radial-gradient(circle at center, #FFD700 0%, #FFB700 100%)"
                  : "radial-gradient(circle at center, #1F2937 0%, #374151 100%)",
              }}
            >
              <img
                src={imgSrc}
                alt={tile.id}
                className="w-full h-full object-contain pointer-events-none"
              />
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
