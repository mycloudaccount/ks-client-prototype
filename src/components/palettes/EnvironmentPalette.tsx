import { motion } from "framer-motion";

export default function EnvironmentPalette() {
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
        Environment
      </div>

      {/* PLACEHOLDER GRID */}
      <div className="grid grid-cols-3 gap-2">
        {Array.from({ length: 9 }).map((_, i) => (
          <button
            key={i}
            className="
              h-14 rounded-md
              bg-neutral-700 hover:bg-neutral-600
              border border-neutral-600
              transition-colors
              flex items-center justify-center
              text-neutral-400 text-xs
            "
          >
            Prop
          </button>
        ))}
      </div>

      {/* FOOTER / INFO */}
      <div className="text-[11px] text-neutral-500 leading-tight">
        World props, decorations, and interactive objects.
      </div>
    </motion.div>
  );
}
