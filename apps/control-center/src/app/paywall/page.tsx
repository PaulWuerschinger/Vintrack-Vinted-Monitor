import { Button } from "@/components/ui/button";
import { ArrowRight, Zap } from "lucide-react";

export default function PaywallPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-6 py-24">
      <div className="max-w-md text-center space-y-6">
        <div className="mx-auto flex h-16 w-16 items-center justify-center border border-border bg-card">
          <Zap className="h-8 w-8 text-cyan-400" />
        </div>
        <div>
          <h1 className="text-3xl font-semibold" style={{ letterSpacing: "-0.04em" }}>
            Premium Required
          </h1>
          <p className="mt-3 text-sm text-zinc-400 leading-relaxed">
            The Sniper Bot is available exclusively for Resellr Premium subscribers. Upgrade your plan to access real-time monitors, live feed, and instant sniping.
          </p>
        </div>
        <a href="https://resellr-app.com/en/pricing" target="_blank" rel="noopener noreferrer">
          <Button size="lg" className="h-12 gap-2 w-full font-semibold">
            Upgrade to Premium <ArrowRight className="h-4 w-4" />
          </Button>
        </a>
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">
          Already subscribed? Log out and log back in.
        </p>
      </div>
    </div>
  );
}
