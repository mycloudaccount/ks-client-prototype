import { Hand, Move, ZoomIn } from "lucide-react";
import { ToolMode } from "../editor/types";
import { useInteraction } from "@/context/InteractionContext";
import { motion } from "framer-motion";
import { type JSX, useEffect, useState } from "react";

export default function CanvasTools() {
  const interaction = useInteraction();

  // Local state for UI to reflect current tool
  const [activeTool, setActiveTool] = useState<ToolMode | null>(null);

  // Subscribe to interaction updates
  useEffect(() => {
    const unsubscribe = interaction.subscribe((state) => {
      setActiveTool(state.baseTool); // <-- use whatever property your service provides
    });
    return unsubscribe;
  }, [interaction]);

  const handleClick = (mode: ToolMode) => {
    interaction.setBaseTool(mode); // update the service
  };

  const tools: { mode: ToolMode; icon: JSX.Element }[] = [
    { mode: ToolMode.MOVE, icon: <Move className="h-4 w-4" /> },
    { mode: ToolMode.PAN, icon: <Hand className="h-4 w-4" /> },
    { mode: ToolMode.ZOOM, icon: <ZoomIn className="h-4 w-4" /> },
  ];

  return (
    <div className="absolute top-3 right-3 z-50 flex flex-col gap-2">
      {tools.map((tool) => {
        const isActive = activeTool === tool.mode;

        return (
          <motion.button
            key={tool.mode}
            onClick={() => handleClick(tool.mode)}
            initial={false}
            animate={{
              backgroundColor: isActive ? "#f97316" : "#1f2937",
              color: isActive ? "#000000" : "#f9fafb",
              boxShadow: isActive
                ? "0 4px 10px rgba(0,0,0,0.3)"
                : "0 0 0 rgba(0,0,0,0)",
            }}
            whileHover={{
              scale: 1.1,
              boxShadow: "0 6px 12px rgba(0,0,0,0.25)",
              backgroundColor: isActive ? "#fdba74" : "#374151",
            }}
            whileTap={{ scale: 0.9 }}
            transition={{ type: "spring", stiffness: 200, damping: 25 }}
            className="h-9 w-9 rounded-md flex items-center justify-center focus:outline-2"
          >
            {tool.icon}
          </motion.button>
        );
      })}
    </div>
  );
}
