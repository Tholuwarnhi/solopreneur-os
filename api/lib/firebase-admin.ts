import admin from "firebase-admin";

export function initAdmin() {
  if (admin.apps.length) return;
  const raw =
    process.env.FIREBASE_SERVICE_ACCOUNT_B64
      ? Buffer.from(process.env.FIREBASE_SERVICE_ACCOUNT_B64, "base64").toString("utf8")
      : process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("Missing FIREBASE_SERVICE_ACCOUNT or FIREBASE_SERVICE_ACCOUNT_B64");
  const serviceAccount = JSON.parse(raw);
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

export { admin };
