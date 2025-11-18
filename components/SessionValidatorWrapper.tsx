"use client";

import { useSessionValidator } from "@/hooks/useSessionValidator";

export function SessionValidatorWrapper({ children }: { children: React.ReactNode }) {
  // Check every 5 seconds (5000ms)
  // The hook itself will only run when user is authenticated
  useSessionValidator(5000);

  return <>{children}</>;
}
