import { admin, initAdmin } from "./lib/firebase-admin.js";
import { getGoogleRedirectUri, signOAuthState } from "./lib/oauth-state.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: "Missing idToken" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const userId = decoded.uid;

    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      return res.status(500).json({ error: "Server missing GOOGLE_CLIENT_ID" });
    }

    const redirectUri = getGoogleRedirectUri();
    const state = signOAuthState(userId);
    const scope = encodeURIComponent(
      [
        "https://www.googleapis.com/auth/gmail.send",
        "openid",
        "email",
        "https://www.googleapis.com/auth/userinfo.email",
      ].join(" "),
    );
    const url =
      "https://accounts.google.com/o/oauth2/v2/auth" +
      `?client_id=${encodeURIComponent(clientId)}` +
      `&redirect_uri=${encodeURIComponent(redirectUri)}` +
      "&response_type=code" +
      `&scope=${scope}` +
      "&access_type=offline" +
      "&prompt=consent" +
      `&state=${encodeURIComponent(state)}`;

    return res.status(200).json({ url });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
