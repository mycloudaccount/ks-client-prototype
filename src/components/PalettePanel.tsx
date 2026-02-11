import { motion, AnimatePresence } from "framer-motion";
import clsx from "clsx";
import { useState } from "react";

import { FaPaintRoller } from "react-icons/fa6";
import { FaChevronLeft, FaChevronRight } from "react-icons/fa";
import { InspectionPanel, User, Sprout, Image } from "lucide-react";

import TilePalette from "./palettes/TilePalette";
import CharacterPalette from "./palettes/CharacterPalette";
import EnvironmentPalette from "./palettes/EnvironmentPalette";
import BackgroundPalette from "./palettes/BackgroundPalette";

/* ============================================================
   PALETTE TABS
============================================================ */

const PaletteTab = {
  TILES: "tiles",
  CHARACTERS: "characters",
  ENVIRONMENT: "environment",
  BACKGROUNDS: "backgrounds",
} as const;

type PaletteTab = (typeof PaletteTab)[keyof typeof PaletteTab];

const PALETTE_TABS = [
  {
    id: PaletteTab.TILES,
    icon: <InspectionPanel className="h-6 w-6" />,
    title: "Tiles",
  },
  {
    id: PaletteTab.CHARACTERS,
    icon: <User className="h-6 w-6" />,
    title: "Characters",
  },
  {
    id: PaletteTab.ENVIRONMENT,
    icon: <Sprout className="h-6 w-6" />,
    title: "Environment",
  },
  {
    id: PaletteTab.BACKGROUNDS,
    icon: <Image className="h-6 w-6" />,
    title: "Backgrounds",
  },
];

type Props = {
  open: boolean;
  onToggle: () => void;
};

export default function PalettePanel({ open, onToggle }: Props) {
  const [activeTab, setActiveTab] = useState<PaletteTab>(PaletteTab.TILES);

  return (
    <motion.div
      animate={{ width: open ? 220 : 38 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="relative h-full bg-neutral-800 text-white flex flex-col border-r border-neutral-700 overflow-hidden"
    >
      {/* HEADER */}
      <div className="relative overflow-hidden border-b border-neutral-700">
        <motion.div
          initial={false}
          animate={{ paddingLeft: 12, paddingRight: 12, height: 44 }}
          className="flex items-center gap-3"
        >
          <div className="flex items-center justify-center w-8 h-8">
            <motion.div
              initial={false}
              animate={{
                scale: open ? [0.9, 1] : 0.9,
                rotate: open ? [-10, 0] : -10,
              }}
              transition={{ type: "spring", stiffness: 450, damping: 5 }}
            >
              <FaPaintRoller className="text-[20px] ml-[-4px] text-orange-400 drop-shadow-[0_0_6px_rgba(251,146,60,0.6)]" />
            </motion.div>
          </div>

          <motion.span
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: open ? 1 : 0, x: open ? 0 : -12 }}
            transition={{
              x: { duration: 0.25, ease: "easeOut" },
              opacity: open
                ? { duration: 1.5, ease: "easeOut" }
                : { duration: 0.15, ease: "easeIn" },
            }}
            className="text-[18px] font-semibold font-pixel pixel-text pixel-glow whitespace-nowrap"
          >
            Game Palette
          </motion.span>
        </motion.div>

        <motion.div
          initial={false}
          animate={{ scaleX: open ? 1 : 0, opacity: open ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="absolute bottom-0 left-0 h-[2px] w-full origin-center
            bg-gradient-to-r from-orange-400 via-yellow-300 to-orange-400"
        />
      </div>

      {/* TAB BAR */}
      {open && (
        <div className="flex items-center gap-[6px] px-3 py-2 border-b border-neutral-700">
          {PALETTE_TABS.map((tab) => {
            const isActive = activeTab === tab.id;

            return (
              <motion.button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                title={tab.title}
                initial={false}
                animate={{
                  backgroundColor: isActive ? "#f97316" : "#1f2937",
                  color: isActive ? "#000000" : "#f9fafb",
                  borderColor: isActive ? "#fdba74" : "#4b5563",
                  boxShadow: isActive
                    ? "0 2px 6px rgba(0,0,0,0.35)"
                    : "0 0 0 rgba(0,0,0,0)",
                }}
                whileHover={{
                  scale: 1.08,
                  backgroundColor: isActive ? "#fdba74" : "#374151",
                  borderColor: "#9ca3af",
                }}
                whileTap={{ scale: 0.92 }}
                transition={{ type: "spring", stiffness: 220, damping: 20 }}
                className="h-8 w-8 rounded-md flex items-center justify-center border border-neutral-600"
              >
                {tab.icon}
              </motion.button>
            );
          })}
        </div>
      )}

      {/* TOGGLE HANDLE */}
      <button
        onClick={onToggle}
        className={clsx(
          "absolute right-0 bottom-6",
          "w-7 h-10 flex items-center justify-center",
          "bg-neutral-700 hover:bg-neutral-600",
          "rounded-l-md transition-colors z-10",
        )}
      >
        {open ? <FaChevronLeft /> : <FaChevronRight />}
      </button>

      {/* CONTENT */}
      {open && (
        <div className="p-3 flex-1 overflow-auto">
          <AnimatePresence mode="wait">
            {activeTab === PaletteTab.TILES && <TilePalette key="tiles" />}
            {activeTab === PaletteTab.CHARACTERS && (
              <CharacterPalette key="characters" />
            )}
            {activeTab === PaletteTab.ENVIRONMENT && (
              <EnvironmentPalette key="environment" />
            )}
            {activeTab === PaletteTab.BACKGROUNDS && (
              <BackgroundPalette key="backgrounds" />
            )}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
