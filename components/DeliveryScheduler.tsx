"use client";

import { useEffect, useRef } from "react";
import { useSession } from "next-auth/react";

export default function DeliveryScheduler() {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastCheckRef = useRef<string>("");
  const { data: session, status } = useSession();

  useEffect(() => {
    // Don't run if not authenticated
    if (status !== "authenticated") return;

    // Function to check schedules
    const checkSchedules = async () => {
      try {
        // Only check if tab is visible
        if (document.hidden) return;

        const response = await fetch("/api/deliveries/schedule/check");
        const data = await response.json();

        // Log only if schedules were executed
        if (data.executedCount > 0) {
          console.log(`[Delivery Scheduler] Executed ${data.executedCount} schedule(s) at ${data.currentTime} UTC`);
        }

        // Store current time to avoid duplicate checks
        lastCheckRef.current = data.currentTime || "";
      } catch (error) {
        // Silently fail - don't spam console
        console.error("[Delivery Scheduler] Check failed:", error);
      }
    };

    // Initial check after 5 seconds (give app time to load)
    const initialTimeout = setTimeout(() => {
      checkSchedules();
    }, 5000);

    // Check every minute (60000ms)
    intervalRef.current = setInterval(() => {
      checkSchedules();
    }, 60000);

    // Cleanup on unmount
    return () => {
      clearTimeout(initialTimeout);
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [status]);

  // This component doesn't render anything
  return null;
}
