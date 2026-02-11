import { motion } from "framer-motion";

type Props = {
  open: boolean;
  onToggle: () => void;
};

export default function LayerPanel({ open, onToggle }: Props) {
  return (
    <motion.div
      animate={{ width: open ? 240 : 48 }}
      transition={{ type: "spring", stiffness: 260, damping: 28 }}
      className="h-full bg-neutral-800 text-white flex flex-col border-l border-neutral-700 overflow-hidden"
    >
      {/* HEADER */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-neutral-700">
        <button
          onClick={onToggle}
          className="text-neutral-400 hover:text-white"
        >
          ▶
        </button>
        <span className="text-sm font-semibold">
          {open ? "Layers" : "📚"}
        </span>
      </div>

      {/* CONTENT */}
      {open && (
        <div className="p-3 text-sm text-neutral-400">
          Layers panel (coming soon)
        </div>
      )}
    </motion.div>
  );
}
