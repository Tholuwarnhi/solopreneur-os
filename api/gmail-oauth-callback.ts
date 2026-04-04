import { google } from "googleapis";
import { admin, initAdmin } from "./lib/firebase-admin.js";
import { getAppPublicUrl, getGoogleRedirectUri, verifyOAuthState } from "./lib/oauth-state.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "GET") return res.status(405).send("Method not allowed");

  const appUrl = getAppPublicUrl();
  const redirectFail = () => res.redirect(`${appUrl}/settings?tab=integrations&gmail=error`);

  const { code, state, error, error_description } = req.query || {};
  if (error) {
    console.error("Google OAuth error:", error, error_description);
    return redirectFail();
  }
  if (!code || !state || typeof code !== "string" || typeof state !== "string") {
    return redirectFail();
  }

  try {
    initAdmin();

    const userId = verifyOAuthState(state);

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error("Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET");
    }

    const redirectUri = getGoogleRedirectUri();

    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokens = (await tokenRes.json()) as {
      access_token?: string;
      refresh_token?: string;
      id_token?: string;
      error?: string;
      error_description?: string;
    };

    if (!tokenRes.ok) {
      throw new Error(tokens.error_description || tokens.error || "Token exchange failed");
    }

    const db = admin.firestore();
    const credRef = db.collection("gmailCredentials").doc(userId);
    const existing = await credRef.get();
    const existingRefresh = existing.exists ? (existing.data() as any)?.refreshToken : null;

    const refreshToken = tokens.refresh_token || existingRefresh;
    if (!refreshToken) {
      throw new Error(
        "Google did not return a refresh token. Disconnect Gmail in Google Account settings and try again, or revoke app access and reconnect.",
      );
    }

    let email = "";
    if (tokens.id_token) {
      try {
        const b64 = tokens.id_token.split(".")[1];
        email = (JSON.parse(Buffer.from(b64, "base64url").toString("utf8")) as { email?: string }).email || "";
      } catch {
        email = "";
      }
    }
    if (!email) {
      const oauth2Client = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
      oauth2Client.setCredentials({
        access_token: tokens.access_token,
        refresh_token: refreshToken,
      });
      const oauth2 = google.oauth2({ version: "v2", auth: oauth2Client });
      const me = await oauth2.userinfo.get();
      email = me.data.email || "";
    }

    await credRef.set(
      {
        refreshToken,
        email,
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    await db.collection("users").doc(userId).set(
      {
        gmailConnected: true,
        gmailEmail: email,
        gmailConnectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return res.redirect(`${appUrl}/settings?tab=integrations&gmail=connected`);
  } catch (err: any) {
    console.error(err);
    return redirectFail();
  }
}
