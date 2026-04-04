import { admin, initAdmin } from "./lib/firebase-admin.js";

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  try {
    initAdmin();
    const { idToken } = req.body || {};
    if (!idToken) return res.status(400).json({ error: "Missing idToken" });

    const decoded = await admin.auth().verifyIdToken(idToken);
    const userId = decoded.uid;

    const db = admin.firestore();
    await db.collection("gmailCredentials").doc(userId).delete();
    await db.collection("users").doc(userId).set(
      {
        gmailConnected: false,
        gmailEmail: null,
        gmailDisconnectedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      { merge: true },
    );

    return res.status(200).json({ ok: true });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ error: err?.message || "Server error" });
  }
}
