// Sends email through Microsoft Graph, for a Microsoft 365 mailbox where SMTP sign-in is switched off. The server signs
// in as an app registered in the restaurant's Microsoft Entra (Azure) tenant, with the application permission
// Mail.Send granted by an administrator, and sends as one mailbox (GRAPH_SENDER):
//   GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET, GRAPH_SENDER
// The secret and the access token never appear in an error or a log; a failure is logged by its HTTP status only.
// GRAPH_LOGIN_URL and GRAPH_API_URL exist for tests, which point them at a stand-in server.

const LOGIN = () => process.env.GRAPH_LOGIN_URL ?? 'https://login.microsoftonline.com';
const API = () => process.env.GRAPH_API_URL ?? 'https://graph.microsoft.com';
const TIMEOUT_MS = 10_000;

export class GraphMailError extends Error {
  readonly status: number;
  readonly stage: 'token' | 'send' | 'settings';
  constructor(status: number, stage: 'token' | 'send' | 'settings') {
    super(`graph ${stage} failed (${status})`);
    this.status = status;
    this.stage = stage;
  }
}

let cached: { token: string; expires: number; key: string } | null = null;

export function graphConfigured() {
  return Boolean(process.env.GRAPH_TENANT_ID && process.env.GRAPH_CLIENT_ID && process.env.GRAPH_CLIENT_SECRET && process.env.GRAPH_SENDER);
}

// An app-only token, kept until a minute before it runs out.
async function token(): Promise<string> {
  const tenant = process.env.GRAPH_TENANT_ID!, client = process.env.GRAPH_CLIENT_ID!;
  const key = `${tenant}/${client}`;
  if (cached && cached.key === key && cached.expires > Date.now() + 60_000) return cached.token;
  const response = await fetch(`${LOGIN()}/${encodeURIComponent(tenant)}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: client,
      client_secret: process.env.GRAPH_CLIENT_SECRET!,
      scope: 'https://graph.microsoft.com/.default',
    }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new GraphMailError(response.status, 'token');
  const body = (await response.json()) as { access_token?: string; expires_in?: number };
  if (!body.access_token) throw new GraphMailError(502, 'token');
  cached = { token: body.access_token, expires: Date.now() + (body.expires_in ?? 3600) * 1000, key };
  return cached.token;
}

/** Sends a plain-text email from GRAPH_SENDER, shown under the given display name. Not kept in Sent Items. */
export async function sendGraphMail(input: { to: string; subject: string; text: string; fromName?: string }) {
  if (!graphConfigured()) throw new GraphMailError(503, 'settings');
  const sender = process.env.GRAPH_SENDER!;
  const send = async (bearer: string) =>
    fetch(`${API()}/v1.0/users/${encodeURIComponent(sender)}/sendMail`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          subject: input.subject,
          body: { contentType: 'Text', content: input.text },
          toRecipients: [{ emailAddress: { address: input.to } }],
          ...(input.fromName ? { from: { emailAddress: { address: sender, name: input.fromName } } } : {}),
        },
        saveToSentItems: false,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  let response = await send(await token());
  // A token can be revoked before it runs out; one fresh token is tried before giving up.
  if (response.status === 401) {
    cached = null;
    response = await send(await token());
  }
  if (response.status !== 202 && !response.ok) throw new GraphMailError(response.status, 'send');
}

/** For tests: forget the cached token. */
export function resetGraphToken() {
  cached = null;
}
