import type { Session } from "@supabase/supabase-js";
import { createContext, ReactNode, useContext } from "react";
import { useSession } from "./hooks";

type SessionContextValue = {
  session: Session | null;
  loading: boolean;
};

const SessionContext = createContext<SessionContextValue | undefined>(undefined);

export function SessionProvider({ children }: { children: ReactNode }) {
  const value = useSession();
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useAuth(): SessionContextValue {
  const context = useContext(SessionContext);
  if (!context) {
    throw new Error("useAuth must be used within a SessionProvider");
  }
  return context;
}
