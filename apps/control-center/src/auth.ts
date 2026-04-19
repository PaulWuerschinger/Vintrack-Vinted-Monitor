import NextAuth from "next-auth"
import Credentials from "next-auth/providers/credentials"
import { db } from "@/lib/db"
import { Pool } from "pg"

let resellrPool: Pool | null = null;
function getResellrPool() {
  if (!resellrPool) {
    resellrPool = new Pool({ connectionString: process.env.RESELLR_DATABASE_URL, max: 2 });
  }
  return resellrPool;
}

async function checkPremium(userId: string, email?: string): Promise<boolean> {
  const pool = getResellrPool();
  try {
    const byId = await pool.query(
      `SELECT id FROM "Subscription" WHERE user_id = $1 AND UPPER(status) IN ('ACTIVE', 'TRIALING') AND current_period_end > NOW() LIMIT 1`,
      [userId]
    );
    if (byId.rows.length > 0) return true;
  } catch (err) {
    console.error("[premium-check] DB error by id:", err);
  }
  // Fallback: check by email (handles cases where Vintrack user id != Resellr user id)
  if (email) {
    try {
      const byEmail = await pool.query(
        `SELECT s.id FROM "Subscription" s JOIN users u ON s.user_id = u.id WHERE LOWER(u.email) = LOWER($1) AND UPPER(s.status) IN ('ACTIVE', 'TRIALING') AND s.current_period_end > NOW() LIMIT 1`,
        [email]
      );
      return byEmail.rows.length > 0;
    } catch (err) {
      console.error("[premium-check] DB error by email:", err);
    }
  }
  return false;
}

async function syncVintedTokens(userId: string, jwt: string) {
  try {
    const resellrApiUrl = process.env.RESELLR_API_URL;
    if (!resellrApiUrl) return;

    // Use Resellr backend API to get decrypted token instead of raw SQL
    const statusRes = await fetch(`${resellrApiUrl}/api/vinted/connect/status`, {
      headers: { Authorization: `Bearer ${jwt}` },
    });

    if (!statusRes.ok) return;
    const statusData = await statusRes.json();
    if (!statusData.connected) return;

    // Token sync to Go service is handled by the Resellr backend
    // when the user connects via POST /api/vinted/connect/token.
  } catch (e) {
    console.error("[auth] failed to sync Vinted tokens:", e);
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },
  providers: [
    Credentials({
      name: "Resellr",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        try {
          const res = await fetch(`${process.env.RESELLR_API_URL}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              email: credentials.email,
              password: credentials.password,
            }),
          });

          if (!res.ok) return null;

          const data = await res.json();
          if (!data.user) return null;

          const isPremium = await checkPremium(data.user.id, data.user.email);
          const role = isPremium ? "premium" : "free";

          const vintrackUser = await db.$transaction(async (tx) => {
            // Check if user exists by email (legacy Vintrack users may have different IDs)
            const existingByEmail = await tx.user.findUnique({
              where: { email: data.user.email },
            });

            if (existingByEmail) {
              // Update existing user but keep their ID (PK mutation would break FK constraints)
              return tx.user.update({
                where: { id: existingByEmail.id },
                data: {
                  name: data.user.name,
                  role,
                },
              });
            }

            return tx.user.upsert({
              where: { id: data.user.id },
              update: {
                email: data.user.email,
                name: data.user.name,
                role,
              },
              create: {
                id: data.user.id,
                email: data.user.email,
                name: data.user.name,
                role,
              },
            });
          });

          // Auto-sync Vinted tokens from Resellr (pass JWT for decrypted token access)
          if (data.token) {
            syncVintedTokens(vintrackUser.id, data.token).catch(() => {});
          }

          return {
            id: vintrackUser.id,
            email: vintrackUser.email,
            name: vintrackUser.name,
          };
        } catch {
          return null;
        }
      },
    }),
  ],
  pages: {
    signIn: "/login",
    signOut: "/logout",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId = user.id;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user && token.userId) {
        session.user.id = token.userId as string;
        const dbUser = await db.user.findUnique({
          where: { id: token.userId as string },
          select: { role: true },
        });
        session.user.role = dbUser?.role ?? "free";
      }
      // Normalise date fields — PrismaAdapter may return Date objects
      // but NextAuth internals call .toISOString() which fails on strings/numbers.
      const s = session as unknown as Record<string, unknown>;
      for (const key of ["expires", "expiresAt"]) {
        const val = s[key];
        if (val instanceof Date) {
          s[key] = val.toISOString();
        } else if (val && typeof val !== "string") {
          s[key] = new Date(val as number).toISOString();
        }
      }
      return session;
    },
  },
})
