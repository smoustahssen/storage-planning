import type { FastifyInstance } from "fastify";
import { db } from "../db/client.js";
import { sql } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";

const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID!;
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET!;
const APP_URL = process.env.APP_URL ?? "http://localhost:3001";

export async function authRoutes(app: FastifyInstance) {
  // Step 1 — redirect browser to GitHub with a CSRF state cookie
  app.get("/auth/github", { preHandler: [] }, async (_req, reply) => {
    const state = uuidv4();
    const params = new URLSearchParams({
      client_id: GITHUB_CLIENT_ID,
      scope: "user:email",
      state,
      redirect_uri: `${APP_URL}/auth/callback`,
    });
    reply.setCookie("gh_state", state, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      maxAge: 300, // 5 minutes — just long enough to finish the OAuth dance
    });
    return reply.redirect(`https://github.com/login/oauth/authorize?${params}`);
  });

  // Step 2 — GitHub redirects back here with ?code=&state=
  app.get<{ Querystring: { code?: string; state?: string; error?: string } }>(
    "/auth/callback",
    { preHandler: [] },
    async (req, reply) => {
      const { code, state, error } = req.query;

      if (error) {
        return reply.redirect("/?auth_error=github_denied");
      }

      // CSRF check
      const savedState = req.cookies?.gh_state;
      reply.clearCookie("gh_state", { path: "/" });
      if (!state || state !== savedState) {
        return reply.status(400).send({ error: "Invalid OAuth state" });
      }

      if (!code) {
        return reply.status(400).send({ error: "Missing OAuth code" });
      }

      // Exchange code for GitHub access token
      let githubToken: string;
      try {
        const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
          method: "POST",
          headers: { Accept: "application/json", "Content-Type": "application/json" },
          body: JSON.stringify({
            client_id: GITHUB_CLIENT_ID,
            client_secret: GITHUB_CLIENT_SECRET,
            code,
            redirect_uri: `${APP_URL}/auth/callback`,
          }),
        });
        const tokenData = (await tokenRes.json()) as { access_token?: string; error?: string };
        if (!tokenData.access_token) {
          return reply.redirect("/?auth_error=token_exchange_failed");
        }
        githubToken = tokenData.access_token;
      } catch {
        return reply.redirect("/?auth_error=token_exchange_failed");
      }

      // Fetch the user's verified emails from GitHub
      let robloxEmail: string | undefined;
      try {
        const emailRes = await fetch("https://api.github.com/user/emails", {
          headers: {
            Authorization: `Bearer ${githubToken}`,
            Accept: "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
          },
        });
        const emails = (await emailRes.json()) as Array<{
          email: string;
          verified: boolean;
          primary: boolean;
        }>;
        robloxEmail = emails.find((e) => e.verified && e.email.endsWith("@roblox.com"))?.email;
      } catch {
        return reply.redirect("/?auth_error=email_fetch_failed");
      }

      if (!robloxEmail) {
        return reply.redirect("/?auth_error=no_roblox_email");
      }

      // Look up person in the DB
      const person = db.get<{ ros_id: string }>(
        sql.raw(`SELECT ros_id FROM person WHERE email = '${robloxEmail}' AND active = 1`),
      );
      if (!person) {
        return reply.redirect("/?auth_error=not_in_directory");
      }

      // Create a session (8-hour TTL set by DB default)
      const token = uuidv4();
      db.run(sql.raw(`
        INSERT INTO session(token, ros_id)
        VALUES ('${token}', '${person.ros_id}')
      `));

      reply.setCookie("session", token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        maxAge: 8 * 60 * 60, // 8 hours in seconds
      });

      return reply.redirect("/");
    },
  );

  // Sign out — delete session and clear cookie
  app.post("/auth/logout", { preHandler: [] }, async (req, reply) => {
    const token = req.cookies?.session;
    if (token) {
      db.run(sql.raw(`DELETE FROM session WHERE token = '${token}'`));
    }
    reply.clearCookie("session", { path: "/" });
    return { ok: true };
  });
}
