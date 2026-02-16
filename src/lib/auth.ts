import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { magicLink } from "better-auth/plugins";
import { db } from "./db";
import * as schema from "./db/schema";
import { sendMagicLinkEmail } from "./email";

const isProduction = process.env.NODE_ENV === "production";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  trustedOrigins: process.env.BETTER_AUTH_URL
    ? [process.env.BETTER_AUTH_URL]
    : [],
  database: drizzleAdapter(db, { provider: "pg", schema }),
  emailAndPassword: {
    enabled: true,
  },
  plugins: [
    magicLink({
      sendMagicLink: async ({ email, url }) => {
        await sendMagicLinkEmail(email, url);
      },
      expiresIn: 600, // 10 minutes
    }),
  ],
  session: {
    cookieCache: {
      enabled: true,
      maxAge: 60 * 5, // 5 minutes
    },
  },
  advanced: {
    // In production behind Cloudflare Tunnel, the app receives http requests
    // internally but must set Secure cookies for the https external domain.
    useSecureCookies: isProduction,
    defaultCookieAttributes: {
      secure: isProduction,
      httpOnly: true,
      sameSite: "lax" as const,
    },
  },
});

export type Session = typeof auth.$Infer.Session;
