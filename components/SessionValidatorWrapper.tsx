"use client";

import { useSessionValidator } from "@/hooks/useSessionValidator";
import { usePathname } from "next/navigation";

export function SessionValidatorWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  
  // Don't validate on login page
  const shouldValidate = pathname !== "/login";
  
  // Check every 5 seconds (5000ms)
  useSessionValidator(shouldValidate ? 5000 : 0);

  return <>{children}</>;
}
