import crypto from "crypto";

export function signOAuthState(uid: string) {
  const secret = process.env.GMAIL_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing env var: GMAIL_OAUTH_STATE_SECRET");
  const payload = JSON.stringify({ uid, exp: Date.now() + 15 * 60 * 1000 });
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  return `${Buffer.from(payload, "utf8").toString("base64url")}.${sig}`;
}

export function verifyOAuthState(state: string): string {
  const secret = process.env.GMAIL_OAUTH_STATE_SECRET;
  if (!secret) throw new Error("Missing env var: GMAIL_OAUTH_STATE_SECRET");
  const dot = state.indexOf(".");
  if (dot <= 0) throw new Error("Invalid state");
  const b64 = state.slice(0, dot);
  const sig = state.slice(dot + 1);
  const payload = Buffer.from(b64, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (sig !== expected) throw new Error("Invalid state signature");
  const { uid, exp } = JSON.parse(payload) as { uid: string; exp: number };
  if (Date.now() > exp) throw new Error("State expired");
  return uid;
}

/** Must match an Authorized redirect URI in Google Cloud (scheme, host, path — exact).
 * Never use preview VERCEL_URL: each preview has a new hostname Google does not know. */
export function getGoogleRedirectUri() {
  const explicit = process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim();
  if (explicit) return explicit;

  const base = process.env.APP_PUBLIC_URL?.trim().replace(/\/$/, "");
  if (base) return `${base}/api/gmail-oauth-callback`;

  // Production deploy only: VERCEL_URL is the stable production *.vercel.app (or assigned prod URL).
  if (process.env.VERCEL_ENV === "production" && process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/api/gmail-oauth-callback`;
  }

  if (!process.env.VERCEL) {
    return "http://localhost:3000/api/gmail-oauth-callback";
  }

  throw new Error(
    "Set APP_PUBLIC_URL in Vercel (all environments) to https://solopreneur-os-2026-seven.vercel.app or set GOOGLE_OAUTH_REDIRECT_URI to the full callback URL. Preview deployments cannot infer a valid redirect; it must match Google Cloud exactly."
  );
}

export function getAppPublicUrl() {
  return (
    process.env.APP_PUBLIC_URL ||
    process.env.VITE_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "http://localhost:5173")
  );
}
