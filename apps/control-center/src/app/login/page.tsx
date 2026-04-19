/**
 * Login is now done exclusively via Resellr SSO.
 * Users cannot log in directly here — they must come via a signed token
 * from resellr-app.com → sniping.resellr-app.com/sso?token=...
 */
import Link from "next/link";
import { ArrowRight, Lock } from "lucide-react";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-zinc-800">
        <Lock className="h-6 w-6 text-zinc-400" strokeWidth={1.5} />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Nur via Resellr</h1>
        <p className="max-w-md text-sm text-zinc-400">
          Der Sniping Bot ist Teil von Resellr. Melde dich in deinem Resellr Dashboard an
          und öffne Sniping über den Sidebar-Link.
        </p>
      </div>
      <Link
        href="https://resellr-app.com/dashboard"
        className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Zum Resellr Dashboard
        <ArrowRight className="h-4 w-4" strokeWidth={1.5} />
      </Link>
      <p className="text-xs text-zinc-500">
        Du hast kein Konto?{" "}
        <a href="https://resellr-app.com/signup" className="underline">
          Jetzt registrieren
        </a>
      </p>
    </div>
  );
}
