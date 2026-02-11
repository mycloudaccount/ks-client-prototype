import clsx from "clsx";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";

import { useInteraction } from "@/context/InteractionContext";
import { ToolMode } from "@/editor/types";

import { getCharacterRegistry } from "@/characters/characterRegistry";
import { CharacterFactory } from "@/characters/CharacterFactory";
import type { FacingDirection } from "@/characters/CharacterFactory";

export default function CharacterPalette() {
  const interaction = useInteraction();

  const characters = Array.from(getCharacterRegistry().values());

  const [selectedCharacter, setSelectedCharacter] = useState<string | null>(
    characters[0]?.id ?? null,
  );

  useEffect(() => {
    return interaction.subscribe((state) => {
      setSelectedCharacter(state.selectedCharacter ?? null);
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
        Characters
      </div>

      {/* GRID */}
      <div className="grid grid-cols-3 gap-2">
        {characters.map((character) => {
          const direction: FacingDirection = "left";
          const headshotPath = CharacterFactory.getHeadshotPath(
            character,
            direction,
          );
          const imgSrc = headshotPath
            ? `/assets/characters/${character.id}/${headshotPath}`
            : null;

          const isSelected = selectedCharacter === character.id;

          return (
            <motion.button
              key={character.id}
              onClick={() => {
                interaction.setSelectedCharacter(character.id);
                interaction.setBaseTool(ToolMode.CREATE);
              }}
              title={character.config.CHAR_NAME}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className={clsx(
                "aspect-square rounded border-2 flex items-center justify-center",
                "hover:shadow-lg transition-shadow",
                isSelected ? "ring-2 ring-yellow-400" : "border-neutral-50",
              )}
              style={{
                backgroundImage: isSelected
                  ? "radial-gradient(circle at center, #FFD700 0%, #FFB700 100%)"
                  : "radial-gradient(circle at center, #B0E0FF 0%, #3A5F9F 100%)",
              }}
            >
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={character.config.CHAR_NAME}
                  className="w-full h-full object-contain pointer-events-none rounded"
                />
              ) : (
                <div className="text-xs text-neutral-800 italic">
                  No headshot
                </div>
              )}
            </motion.button>
          );
        })}
      </div>
    </motion.div>
  );
}
