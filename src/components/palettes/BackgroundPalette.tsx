import { motion } from "framer-motion";

export default function BackgroundPalette() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      transition={{ duration: 0.15, ease: "easeOut" }}
      className="flex flex-col gap-3"
    >
      {/* HEADER */}
      <div className="text-xs uppercase tracking-wide text-neutral-400">
        Backgrounds
      </div>

      {/* PLACEHOLDER LIST */}
      <div className="flex flex-col gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <button
            key={i}
            className="
              h-10 rounded-md
              bg-neutral-700 hover:bg-neutral-600
              border border-neutral-600
              transition-colors
              flex items-center px-3
              text-neutral-300 text-xs
            "
          >
            Background Layer {i + 1}
          </button>
        ))}
      </div>

      {/* FOOTER / INFO */}
      <div className="text-[11px] text-neutral-500 leading-tight">
        Skyboxes, gradients, and parallax layers.
      </div>
    </motion.div>
  );
}
