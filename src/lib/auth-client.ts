import { createAuthClient } from "better-auth/react";
import { magicLinkClient } from "better-auth/client/plugins";

/**
 * Determine the Better Auth base URL for client-side requests.
 *
 * Priority:
 * 1. NEXT_PUBLIC_BETTER_AUTH_URL env var (build-time, explicit override)
 * 2. Browser window.location.origin (works for any domain automatically)
 * 3. Fallback to localhost for SSR / build contexts where window is unavailable
 */
function getBaseURL(): string {
  if (process.env.NEXT_PUBLIC_BETTER_AUTH_URL) {
    return process.env.NEXT_PUBLIC_BETTER_AUTH_URL;
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "http://localhost:3001";
}

export const authClient = createAuthClient({
  baseURL: getBaseURL(),
  plugins: [magicLinkClient()],
});

export const {
  signIn,
  signUp,
  signOut,
  useSession,
} = authClient;
