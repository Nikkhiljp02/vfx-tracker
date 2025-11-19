"use client";

import { signIn } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type AuthHealthState = "healthy" | "degraded" | "down" | "unknown";

const HEALTH_META: Record<AuthHealthState, { dot: string; text: string; label: string }> = {
  healthy: {
    dot: "bg-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.7)]",
    text: "text-emerald-300",
    label: "Auth service: Online",
  },
  degraded: {
    dot: "bg-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.6)]",
    text: "text-amber-300",
    label: "Auth service: Slow",
  },
  down: {
    dot: "bg-rose-500 shadow-[0_0_12px_rgba(244,63,94,0.6)]",
    text: "text-rose-300",
    label: "Auth service: Offline",
  },
  unknown: {
    dot: "bg-zinc-500",
    text: "text-zinc-400",
    label: "Checking auth service…",
  },
};

export default function LoginEnhanced() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [authHealth, setAuthHealth] = useState<AuthHealthState>("unknown");
  const [pingMs, setPingMs] = useState<number | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);

    try {
      const result = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("Invalid username or password");
        setIsLoading(false);
        // Trigger shake animation
        setShake(true);
        setTimeout(() => setShake(false), 500);
      } else if (result?.ok) {
        console.log("Login successful, redirecting immediately...");
        
        // Track login in background
        fetch("/api/auth/session")
          .then(res => res.json())
          .then(sessionData => {
            if (sessionData?.user) {
              fetch("/api/auth/track-login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  userId: sessionData.user.id,
                  username: sessionData.user.username,
                }),
              }).catch(err => console.error("Background track-login error:", err));
            }
          })
          .catch(err => console.error("Background session fetch error:", err));
        
        router.push("/");
      }
    } catch (error: any) {
      console.error("SignIn error:", error);
      setError("Invalid username or password");
      setIsLoading(false);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  useEffect(() => {
    let cancelled = false;

    const pingAuth = async () => {
      const start = performance.now();
      try {
        const res = await fetch("/api/auth/providers", { cache: "no-store" });
        const elapsed = Math.round(performance.now() - start);

        if (!res.ok) throw new Error("Auth health check failed");
        if (cancelled) return;

        const status: AuthHealthState = elapsed < 400 ? "healthy" : elapsed < 1200 ? "degraded" : "down";
        setAuthHealth(status);
        setPingMs(elapsed);
      } catch (err) {
        if (!cancelled) {
          setAuthHealth("down");
          setPingMs(null);
        }
      }
    };

    pingAuth();
    const interval = setInterval(pingAuth, 15000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statusMeta = HEALTH_META[authHealth];

  return (
    <div className="min-h-screen bg-gradient-to-br from-zinc-950 via-black to-black flex items-center justify-center p-4 overflow-hidden relative">
      {/* Static purple gradient base at corner */}
      <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gradient-to-tl from-purple-600/30 via-purple-600/10 to-transparent blur-3xl"></div>
      
      {/* Animated purple gradient layer */}
      <div className="absolute bottom-0 right-0 w-[700px] h-[700px] bg-gradient-to-tl from-purple-600/20 via-purple-600/8 to-transparent blur-3xl animate-float"></div>
      
      {/* Subtle stars/dots background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute top-10 left-20 w-1 h-1 bg-white/20 rounded-full"></div>
        <div className="absolute top-32 right-40 w-1 h-1 bg-white/15 rounded-full"></div>
        <div className="absolute bottom-40 left-60 w-1 h-1 bg-white/10 rounded-full"></div>
        <div className="absolute top-1/3 right-1/4 w-1 h-1 bg-white/20 rounded-full"></div>
        <div className="absolute bottom-1/4 right-1/3 w-1 h-1 bg-white/15 rounded-full"></div>
      </div>

      {/* Mountain silhouette (subtle) */}
      <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-zinc-900/50 to-transparent"></div>

      <div className="relative w-full max-w-md z-10">
        {/* VFX Tracker Logo/Title */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-zinc-800/50 backdrop-blur-sm border border-zinc-700/50 rounded-xl mb-4">
            <svg
              className="w-10 h-10 text-zinc-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z"
              />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">VFX Tracker</h1>
          <p className="text-zinc-500 text-sm">Production Management System</p>
        </div>

        {/* Login Card - Clean Dark Design */}
        <div 
          className={`relative transition-all duration-300 group ${
            shake ? 'animate-shake' : ''
          } ${error ? 'ring-1 ring-red-500/50' : ''}`}
        >
          {/* Outer golden border accent */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-[6px] rounded-[28px] border border-amber-400/30 opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"
          ></div>
          {/* Main Card */}
          <div className="bg-zinc-900/40 backdrop-blur-sm rounded-2xl border border-zinc-700/50 p-8 relative overflow-hidden group focus-within:border-amber-500/50 focus-within:shadow-[0_0_30px_rgba(245,158,11,0.15)] transition-all duration-500">
            {/* Golden glow effect on focus */}
            <div className="absolute inset-0 rounded-2xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500 pointer-events-none">
              <div className="absolute inset-0 rounded-2xl shadow-[inset_0_0_20px_rgba(245,158,11,0.1)]"></div>
            </div>
            
            <h2 className="text-3xl font-bold text-white mb-8 text-center">
              Login
            </h2>

            {error && (
              <div className="mb-6 p-3 bg-red-500/5 border border-red-500/30 rounded-lg">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {/* Username Field */}
              <div className="relative">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                  <input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3.5 bg-transparent border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                    placeholder="username"
                    required
                    autoFocus
                  />
                </div>
              </div>

              {/* Password Field */}
              <div className="relative">
                <div className="relative">
                  <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
                    <svg
                      className="h-5 w-5 text-zinc-500"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      />
                    </svg>
                  </div>
                  <input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3.5 bg-transparent border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-zinc-600 transition-colors"
                    placeholder="Password"
                    required
                  />
                </div>
              </div>

              {/* Remember me */}
              <div className="flex items-center text-sm">
                <label className="flex items-center text-zinc-400 cursor-pointer">
                  <input type="checkbox" className="mr-2 w-4 h-4 bg-transparent border border-zinc-700 rounded" />
                  Remember me
                </label>
              </div>

              {/* Login Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 px-4 bg-white text-black font-semibold rounded-lg hover:bg-zinc-200 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-200"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center">
                    <svg
                      className="animate-spin h-5 w-5 text-black mr-2"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      ></circle>
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      ></path>
                    </svg>
                    Signing in...
                  </span>
                ) : (
                  "Log in"
                )}
              </button>
            </form>

            {/* Auth health indicator */}
            <div className="mt-8 flex items-center justify-center gap-3 text-xs text-zinc-500">
              <span
                className={`h-2.5 w-2.5 rounded-full ${statusMeta.dot} ${authHealth !== "down" ? "animate-pulse" : ""}`}
              ></span>
              <div className="flex flex-col leading-tight">
                <span className={`font-medium ${statusMeta.text}`}>{statusMeta.label}</span>
                <span className="text-zinc-500">
                  Ping {pingMs !== null ? `${pingMs}ms` : "—"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="mt-6 text-center">
          <p className="text-xs text-zinc-600">
            © 2025 VFX Tracker. All rights reserved.
          </p>
        </div>
      </div>

      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-10px); }
          75% { transform: translateX(10px); }
        }

        .animate-shake {
          animation: shake 0.3s ease-in-out;
        }

        @keyframes float {
          0%, 100% {
            transform: translate(0, 0) scale(1);
          }
          50% {
            transform: translate(-180px, -180px) scale(1.15);
          }
        }

        .animate-float {
          animation: float 15s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
