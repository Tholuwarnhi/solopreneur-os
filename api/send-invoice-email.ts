import { admin, initAdmin } from "./lib/firebase-admin.js";
import { getGoogleRedirectUri } from "./lib/oauth-state.js";
import { sendViaGmailApi } from "./lib/gmail-send.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();

    const { idToken, to, subject, body, invoiceDocId } = req.body || {};
    if (!idToken || !to || !subject || !body || !invoiceDocId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    const userId = decoded.uid;

    const db = admin.firestore();
    const credSnap = await db.collection("gmailCredentials").doc(userId).get();
    if (!credSnap.exists) {
      return res.status(400).json({
        error: "Gmail is not connected. Open Settings → Integrations and connect your Google account.",
      });
    }
    const cred = credSnap.data() as { refreshToken?: string };
    if (!cred?.refreshToken) {
      return res.status(400).json({ error: "Gmail credentials are incomplete. Reconnect Gmail in Settings." });
    }

    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      return res.status(500).json({ error: "Server missing Google OAuth configuration." });
    }

    let providerMessageId: string | null = null;
    try {
      const data = await sendViaGmailApi({
        clientId,
        clientSecret,
        redirectUri: getGoogleRedirectUri(),
        refreshToken: cred.refreshToken,
        to,
        subject,
        body,
      });
      providerMessageId = data?.id || null;
    } catch (e: any) {
      const providerError = e?.message || e;
      await db.collection("invoiceDeliveries").add({
        userId,
        invoiceDocId,
        to,
        subject,
        body,
        provider: "gmail",
        providerMessageId: null,
        status: "error",
        error: String(providerError),
        createdAt: new Date().toISOString(),
      });
      return res.status(400).json({ ok: false, error: String(providerError) });
    }

    await db.collection("invoiceDeliveries").add({
      userId,
      invoiceDocId,
      to,
      subject,
      body,
      provider: "gmail",
      providerMessageId,
      status: "sent",
      error: null,
      createdAt: new Date().toISOString(),
    });

    return res.status(200).json({ ok: true, result: { provider: "gmail", id: providerMessageId } });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
