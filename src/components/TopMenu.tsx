import { useState, useEffect } from "react";
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarTrigger,
  MenubarShortcut,
} from "@/components/ui/menubar";

import clsx from "clsx";

// 👇 SVG import (as URL)
import ksIcon from "@/assets/ks_splash.png";
import { motion } from "framer-motion";

type Props = {
  onResetView: () => void;
  onRecenterGrid: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;

  onUndo: () => void;
  onRedo: () => void;

  canUndo?: boolean;
  canRedo?: boolean;
  onSaveAs: () => void;
  onSave: () => void;
  onOpen: () => void;
};

export default function TopMenu({
  onResetView,
  onRecenterGrid,
  onZoomIn,
  onZoomOut,
  onUndo,
  onRedo,
  canUndo = true,
  canRedo = true,
  onOpen,
  onSaveAs,
}: Props) {
  const [titleKey, setTitleKey] = useState(0); // triggers title animation

  const isMac = navigator.platform.toUpperCase().includes("MAC");
  const undoShortcut = isMac ? "⌘Z" : "Ctrl+Z";
  const redoShortcut = isMac ? "⌘⇧Z" : "Ctrl+Y";

  /** Base pixel font + glow */
  const menuFont = clsx(
    "font-pixel pixel-text pixel-glow font-extrabold",
    "text-white text-[16px] tracking-wide",
    "transition-all duration-200",
    "hover:text-white",
    "hover:drop-shadow-[0_0_12px_rgba(255,255,255,0.95)]",
    "hover:animate-pulse",
  );

  /** Dropdown item highlight override */
  const menuItemClass = clsx(
    menuFont,
    "rounded-sm",
    "data-[highlighted]:bg-white/25",
    "data-[highlighted]:text-white",
    "data-[highlighted]:drop-shadow-[0_0_12px_rgba(255,255,255,0.9)]",
  );

  /** Dropdown background + animation */
  const menuContentClass = clsx(
    "bg-blue-600",
    "border border-blue-700",
    "shadow-lg shadow-blue-900/40",
    "rounded-md",
    "origin-top",
    "transition-all duration-150 ease-out",
    "data-[state=open]:opacity-100 data-[state=open]:scale-100 data-[state=open]:translate-y-0",
    "data-[state=closed]:opacity-0 data-[state=closed]:scale-95 data-[state=closed]:-translate-y-1",
  );

  // Trigger title animation **after initial load**
  useEffect(() => {
    requestAnimationFrame(() => setTitleKey((prev) => prev + 1));
  }, []);

  // Wrap original onOpen to trigger animation on "Open…"
  const handleOpen = () => {
    setTitleKey((prev) => prev + 1);
    onOpen();
  };

  return (
    <div className="h-10 flex items-center px-2 border-b border-border bg-gradient-to-r from-white via-blue-400 to-blue-600">
      {/* FAR LEFT: App Icon + Title */}
      <div className="flex items-center gap-2 mr-4">
        <img
          src={ksIcon}
          alt="Kingdom Stack"
          className="h-12 w-12 mt-1 drop-shadow-[0_0_10px_rgba(255,255,255,0.6)]"
        />

        <motion.div
          key={titleKey}
          className="
            font-blocky
            tracking-widest
            uppercase
            text-[24px]
            mb-1
            bg-gradient-to-b
            from-yellow-200
            via-orange-400
            to-orange-700
            bg-clip-text
            text-transparent

            [-webkit-text-stroke:1px_#555555]

            drop-shadow-[3px_3px_0_rgba(132,204,22,0.6)]

            will-change-transform
          "
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: [50, -10, 0], scale: [0.95, 1.05, 1] }}
          transition={{ duration: 0.9, ease: "easeOut", delay: 0.2 }}
        >
          Kingdom Stack
        </motion.div>
      </div>

      {/* SPACER */}
      <div className="flex-1" />

      {/* FAR RIGHT: Menu */}
      <Menubar className="border-none bg-transparent h-8">
        {/* FILE */}
        <MenubarMenu>
          <MenubarTrigger className={menuFont}>FILE</MenubarTrigger>
          <MenubarContent className={menuContentClass}>
            <MenubarItem className={menuItemClass}>New</MenubarItem>
            <MenubarItem onClick={handleOpen} className={menuItemClass}>
              Open…
            </MenubarItem>
            <MenubarItem onClick={onSaveAs} className={menuItemClass}>
              Save As…
            </MenubarItem>
            <MenubarSeparator className="bg-blue-300/40" />
            <MenubarItem className={menuItemClass}>Export</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* EDIT */}
        <MenubarMenu>
          <MenubarTrigger className={menuFont}>EDIT</MenubarTrigger>
          <MenubarContent className={menuContentClass}>
            <MenubarItem
              disabled={!canUndo}
              onClick={onUndo}
              className={menuItemClass}
            >
              Undo
              <MenubarShortcut className="font-mono text-[11px] opacity-80">
                {undoShortcut}
              </MenubarShortcut>
            </MenubarItem>

            <MenubarItem
              disabled={!canRedo}
              onClick={onRedo}
              className={menuItemClass}
            >
              Redo
              <MenubarShortcut className="font-mono text-[11px] opacity-80">
                {redoShortcut}
              </MenubarShortcut>
            </MenubarItem>

            <MenubarSeparator className="bg-blue-300/40" />
            <MenubarItem className={menuItemClass}>Preferences</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* VIEW */}
        <MenubarMenu>
          <MenubarTrigger className={menuFont}>VIEW</MenubarTrigger>
          <MenubarContent className={menuContentClass}>
            <MenubarItem onClick={onResetView} className={menuItemClass}>
              Reset View
            </MenubarItem>
            <MenubarItem onClick={onRecenterGrid} className={menuItemClass}>
              Recenter Grid
            </MenubarItem>
            <MenubarSeparator className="bg-blue-300/40" />
            <MenubarItem onClick={onZoomIn} className={menuItemClass}>
              Zoom In
            </MenubarItem>
            <MenubarItem onClick={onZoomOut} className={menuItemClass}>
              Zoom Out
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* GRID */}
        <MenubarMenu>
          <MenubarTrigger className={menuFont}>GRID</MenubarTrigger>
          <MenubarContent className={menuContentClass}>
            <MenubarItem className={menuItemClass}>Toggle Axes</MenubarItem>
            <MenubarItem className={menuItemClass}>Toggle Units</MenubarItem>
          </MenubarContent>
        </MenubarMenu>

        {/* HELP */}
        <MenubarMenu>
          <MenubarTrigger className={menuFont}>HELP</MenubarTrigger>
          <MenubarContent className={menuContentClass}>
            <MenubarItem className={menuItemClass}>Documentation</MenubarItem>
            <MenubarItem className={menuItemClass}>About</MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>
    </div>
  );
}
