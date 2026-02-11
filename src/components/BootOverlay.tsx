import { motion, AnimatePresence } from "framer-motion";
import ksSplash from "@/assets/ks_splash.png";

type BootState = "loading" | "fading" | "ready";

interface BootOverlayProps {
  bootState: BootState;
  fadeDurationMs: number;
}

export default function BootOverlay({
  bootState,
  fadeDurationMs,
}: BootOverlayProps) {
  return (
    <AnimatePresence>
      {bootState !== "ready" && (
        <motion.div
          key="boot-overlay"
          initial={{ opacity: 1, backdropFilter: "blur(16px)" }}
          animate={{
            opacity: bootState === "fading" ? 0 : 1,
            backdropFilter: bootState === "fading" ? "blur(0px)" : "blur(16px)",
          }}
          exit={{ opacity: 0 }}
          transition={{
            duration: fadeDurationMs / 1000,
            ease: "easeOut",
          }}
          className="absolute inset-0 z-50 flex items-center justify-center
                     bg-neutral-900/85 text-neutral-200"
        >
          <div className="flex flex-col items-center gap-12 select-none">
            {/* Splash + Title wrapper */}
            <div className="relative w-[320px] md:w-[420px]">
              {/* Splash image */}
              <motion.img
                src={ksSplash}
                alt="Kingdom Stack"
                initial={{ opacity: 0, y: -20, scale: 1.25 }} // scale up initially
                animate={{ opacity: 1, y: 0, scale: 1.5 }} // scale to final size
                transition={{ duration: 0.6, ease: "easeOut" }}
                className="w-full drop-shadow-xl relative z-0"
                draggable={false}
              />

              {/* Title overlapping the image */}
              <motion.div
                className="
                  absolute left-1/2
                  font-blocky tracking-widest uppercase text-[40px]
                  bg-gradient-to-b from-yellow-300 via-orange-400 to-orange-700
                  bg-clip-text text-transparent whitespace-nowrap
                  [-webkit-text-stroke:4px_#300A00]
                  drop-shadow-[3px_4px_0_rgba(48,17,0,0.4)]
                  pointer-events-none
                  z-10
                "
                initial={{
                  opacity: 0,
                  scaleY: 0.85,
                  scaleX: 1.05,
                  x: "-50%",
                  y: -130, // lift it higher over the image
                }}
                animate={{
                  opacity: 1,
                  scaleY: [0.85, 1.05, 1],
                  scaleX: [1.05, 0.98, 1],
                  y: -70, // final position slightly lower for subtle motion
                  x: "-50%",
                }}
                transition={{ duration: 0.7, ease: "backInOut", delay: 0.35 }}
              >
                Kingdom Stack
              </motion.div>

              <motion.div
                className="
                  absolute left-1/2
                  font-blocky tracking-widest uppercase text-[20px]
                  bg-lime-300
                  bg-clip-text text-transparent whitespace-nowrap
                  [-webkit-text-stroke:2px_#300A00]
                  drop-shadow-[3px_4px_0_rgba(0,0,0,0.4)]
                  pointer-events-none
                  z-10
                "
                initial={{
                  opacity: 0,
                  scaleY: 0.85,
                  scaleX: 1.05,
                  x: "-50%",
                  y: -130, // lift it higher over the image
                }}
                animate={{
                  opacity: 1,
                  scaleY: [0.85, 1.05, 1],
                  scaleX: [1.05, 0.98, 1],
                  y: -10, // final position slightly lower for subtle motion
                  x: "-50%",
                }}
                transition={{ duration: 0.7, ease: "backInOut", delay: 0.7 }}
              >
                GAME ENGINE
              </motion.div>
            </div>

            {/* LOADING BAR */}
            <div className="w-64 h-3 overflow-hidden rounded-sm bg-neutral-800">
              <motion.div
                className="h-full w-1/3 rounded-sm bg-neutral-300"
                animate={{ x: ["-60%", "260%"] }}
                transition={{
                  duration: 2.8,
                  repeat: Infinity,
                  repeatType: "reverse",
                  ease: "linear",
                }}
              />
            </div>

            {/* LABEL */}
            <span className="text-xs tracking-widest uppercase text-neutral-400">
              Loading Editor
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
