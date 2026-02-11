/* eslint-disable react-refresh/only-export-components */

import { createContext, useContext, useState } from "react";
import { InteractionService } from "../service/InteractionService";

const InteractionContext = createContext<InteractionService | null>(null);

export function InteractionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [service] = useState(() => new InteractionService());

  return (
    <InteractionContext.Provider value={service}>
      {children}
    </InteractionContext.Provider>
  );
}

export function useInteraction() {
  const ctx = useContext(InteractionContext);
  if (!ctx) throw new Error("Missing InteractionProvider");
  return ctx;
}
