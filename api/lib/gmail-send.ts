import { google } from "googleapis";

export function buildGmailRawMessage(to: string, subject: string, body: string) {
  const lines = [
    `To: ${to}`,
    `Subject: ${subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    body,
  ];
  const raw = lines.join("\r\n");
  return Buffer.from(raw, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

export async function sendViaGmailApi(opts: {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  refreshToken: string;
  to: string;
  subject: string;
  body: string;
}) {
  const oauth2Client = new google.auth.OAuth2(opts.clientId, opts.clientSecret, opts.redirectUri);
  oauth2Client.setCredentials({ refresh_token: opts.refreshToken });
  const gmail = google.gmail({ version: "v1", auth: oauth2Client });
  const raw = buildGmailRawMessage(opts.to, opts.subject, opts.body);
  const sent = await gmail.users.messages.send({
    userId: "me",
    requestBody: { raw },
  });
  return sent.data;
}
