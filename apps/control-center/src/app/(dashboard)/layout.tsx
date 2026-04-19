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

async function checkPremiumDirect(userId: string, email?: string): Promise<boolean> {
  const pool = getResellrPool();
  try {
    const byId = await pool.query(
      `SELECT id FROM "Subscription" WHERE user_id = $1 AND UPPER(status) IN ('ACTIVE', 'TRIALING') AND current_period_end > NOW() LIMIT 1`,
      [userId]
    );
    if (byId.rows.length > 0) {
      console.log(`[paywall-check] premium by id userId=${userId}`);
      return true;
    }
  } catch (err) {
    console.error(`[paywall-check] DB error by id ${userId}:`, err);
  }
  if (email) {
    try {
      const byEmail = await pool.query(
        `SELECT s.id FROM "Subscription" s JOIN users u ON s.user_id = u.id WHERE LOWER(u.email) = LOWER($1) AND UPPER(s.status) IN ('ACTIVE', 'TRIALING') AND s.current_period_end > NOW() LIMIT 1`,
        [email]
      );
      if (byEmail.rows.length > 0) {
        console.log(`[paywall-check] premium by email ${email}`);
        return true;
      }
    } catch (err) {
      console.error(`[paywall-check] DB error by email ${email}:`, err);
    }
  }
  console.log(`[paywall-check] NOT premium userId=${userId} email=${email}`);
  return false;
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/login");
  }

  // Resolve email from session or DB lookup
  const sessionEmail = session.user.email ?? undefined;
  const email = sessionEmail ?? (await db.user.findUnique({
    where: { id: session.user.id },
    select: { email: true },
  }))?.email ?? undefined;

  const isPremium = await checkPremiumDirect(session.user.id, email ?? undefined);
  if (!isPremium) {
    redirect("/paywall");
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
