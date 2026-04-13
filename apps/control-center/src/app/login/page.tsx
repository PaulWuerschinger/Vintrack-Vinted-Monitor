"use client";

import { useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });
      if (result?.error) {
        setError("Invalid email or password");
      } else {
        router.push("/dashboard");
      }
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-screen overflow-hidden bg-background text-foreground">
      {/* Left panel — login form */}
      <div className="relative z-10 flex w-full flex-col border-r border-border bg-background lg:w-[540px]">
        <div className="flex items-center justify-between px-8 py-6">
          <span className="font-mono text-[11px] font-semibold uppercase tracking-[0.22em]">RESELLR</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-500">
            SNIPER BOT
          </span>
        </div>

        <div className="flex flex-1 flex-col justify-center px-8 md:px-14">
          <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500 mb-3">
            / 01 · LOGIN
          </div>
          <h1 className="text-4xl font-semibold" style={{ letterSpacing: "-0.04em" }}>
            Welcome back.
          </h1>
          <p className="mt-2 text-sm text-zinc-400">
            Sign in with your Resellr account to access the Sniper dashboard.
          </p>

          <form onSubmit={handleSubmit} className="mt-10 flex flex-col gap-5">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="email" className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="max@example.com"
                required
                autoComplete="email"
                className="h-11 border-border bg-background font-mono text-sm"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="password" className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={6}
                autoComplete="current-password"
                className="h-11 border-border bg-background font-mono text-sm"
              />
            </div>
            {error && (
              <div className="border-l-2 border-red-500 bg-red-500/5 px-3 py-2 font-mono text-[11px] uppercase tracking-wide text-red-400">
                {error}
              </div>
            )}
            <Button
              type="submit"
              size="lg"
              disabled={loading || !email || !password}
              className="mt-2 h-12 w-full gap-2 bg-primary text-primary-foreground font-semibold text-sm"
            >
              {loading ? "Signing in..." : <>Sign In <ArrowRight className="h-4 w-4" strokeWidth={2} /></>}
            </Button>
          </form>

          <div className="mt-10 flex items-center justify-between border-t border-border pt-6 font-mono text-[10px] uppercase tracking-[0.14em]">
            <span className="text-zinc-500">Use your Resellr account</span>
            <a href="https://resellr-app.com/en/signup" target="_blank" rel="noopener noreferrer" className="text-foreground transition-colors hover:text-cyan-300">
              Register →
            </a>
          </div>
        </div>

        <div className="border-t border-border px-8 py-4 font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">
          SESSION / JWT + COOKIE · SECURED
        </div>
      </div>

      {/* Right panel — branding */}
      <div className="relative hidden flex-1 overflow-hidden lg:block">
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            backgroundImage:
              "linear-gradient(to right, rgba(255,255,255,0.04) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.04) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
            animation: "grid-drift 8s linear infinite",
          }}
        />
        <div aria-hidden className="absolute inset-0 bg-gradient-to-br from-background/60 via-transparent to-background/80" />

        <div className="relative z-10 flex h-full flex-col justify-between p-12">
          <div>
            <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">
              NODE / BERLIN · DE
            </div>
            <div className="mt-1 font-mono text-[10px] uppercase tracking-[0.16em] text-zinc-400">
              <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-cyan-400" style={{ animation: "blink 1.4s ease-in-out infinite" }} />
              SNIPER / OPERATIONAL
            </div>
          </div>
          <div>
            <div
              className="font-black leading-[0.8] text-white/[0.06] select-none"
              style={{ fontSize: "clamp(120px, 18vw, 280px)", letterSpacing: "-0.075em" }}
            >
              R
            </div>
          </div>
          <div className="grid grid-cols-3 gap-px border border-border bg-border">
            {[
              { l: "MONITORS", v: "∞" },
              { l: "SPEED", v: "1.5s" },
              { l: "PROXIES", v: "25" },
            ].map((m) => (
              <div key={m.l} className="bg-background/80 p-4 backdrop-blur">
                <div className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-zinc-500">{m.l}</div>
                <div className="mt-1 text-xl font-semibold">{m.v}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <style jsx>{`
        @keyframes grid-drift {
          from { background-position: 0 0; }
          to { background-position: 48px 48px; }
        }
        @keyframes blink {
          0%, 60% { opacity: 1; }
          80%, 100% { opacity: 0.2; }
        }
      `}</style>
    </main>
  );
}
