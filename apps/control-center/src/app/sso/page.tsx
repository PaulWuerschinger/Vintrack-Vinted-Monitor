/**
 * SSO landing — receives ?token=JWT from Resellr, signs in via NextAuth, redirects to dashboard.
 */
"use client";

import { Suspense, useEffect, useState } from "react";
import { signIn } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, AlertCircle } from "lucide-react";

function SsoInner() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setError("Kein Token übergeben. Bitte öffne Sniping über das Resellr Dashboard.");
      return;
    }
    (async () => {
      const result = await signIn("sso-token", { token, redirect: false });
      if (result?.ok) router.replace("/");
      else setError("Token ungültig oder abgelaufen. Bitte versuche es erneut über das Resellr Dashboard.");
    })();
  }, [token, router]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <AlertCircle className="h-10 w-10 text-red-500" />
        <h1 className="text-xl font-semibold">SSO fehlgeschlagen</h1>
        <p className="max-w-md text-sm text-zinc-400">{error}</p>
        <a href="https://resellr-app.com/dashboard" className="rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground hover:opacity-90">
          Zum Resellr Dashboard
        </a>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 text-sm text-zinc-400">
      <Loader2 className="h-6 w-6 animate-spin" />
      <p>Melde dich an...</p>
    </div>
  );
}

export default function SsoPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-zinc-400">Lade...</div>}>
      <SsoInner />
    </Suspense>
  );
}
