import { DashboardShell } from "@/components/layout/dashboard-shell";
import { AccountProvider } from "@/components/account-provider";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { Pool } from "pg";

let resellrPool: Pool | null = null;
function getResellrPool() {
  if (!resellrPool) {
    resellrPool = new Pool({ connectionString: process.env.RESELLR_DATABASE_URL, max: 2 });
  }
  return resellrPool;
}

async function checkPremiumDirect(userId: string): Promise<boolean> {
  try {
    const pool = getResellrPool();
    const result = await pool.query(
      `SELECT id FROM "Subscription" WHERE user_id = $1 AND UPPER(status) IN ('ACTIVE', 'TRIALING') AND current_period_end > NOW() LIMIT 1`,
      [userId]
    );
    return result.rows.length > 0;
  } catch {
    return false;
  }
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Check premium directly against Resellr DB (not cached role)
  const isPremium = await checkPremiumDirect(session.user.id);

  if (!isPremium) {
    // Also check by email in case IDs don't match
    const dbUser = await db.user.findUnique({
      where: { id: session.user.id },
      select: { email: true },
    });
    if (dbUser?.email) {
      const pool = getResellrPool();
      const byEmail = await pool.query(
        `SELECT s.id FROM "Subscription" s JOIN users u ON s.user_id = u.id WHERE LOWER(u.email) = LOWER($1) AND UPPER(s.status) IN ('ACTIVE', 'TRIALING') AND s.current_period_end > NOW() LIMIT 1`,
        [dbUser.email]
      ).catch(() => ({ rows: [] }));
      if (byEmail.rows.length === 0) {
        redirect("/paywall");
      }
    } else {
      redirect("/paywall");
    }
  }

  const user = { ...session.user, role: "premium" };

  return (
    <AccountProvider>
      <DashboardShell user={user}>
        {children}
      </DashboardShell>
    </AccountProvider>
  );
}
