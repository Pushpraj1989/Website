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
  /** Microsoft's own reason, a short code such as AADSTS7000215 or ErrorAccessDenied. It never holds a secret. */
  readonly reason: string;
  constructor(status: number, stage: 'token' | 'send' | 'settings', reason = '') {
    super(`graph ${stage} failed (${status}${reason ? ` ${reason}` : ''})`);
    this.status = status;
    this.stage = stage;
    this.reason = reason;
  }
}

// The reason code from Microsoft's error reply: AADSTS numbers from sign-in, error.code from Graph. Only letters,
// digits and dots are kept, so nothing else from the reply can reach a log.
async function reasonOf(response: Response): Promise<string> {
  try {
    const body = (await response.json()) as { error?: string | { code?: string }; error_codes?: number[] };
    const code = body.error_codes?.length ? `AADSTS${body.error_codes[0]}` : typeof body.error === 'string' ? body.error : body.error?.code ?? '';
    return String(code).replace(/[^A-Za-z0-9_.]/g, '').slice(0, 60);
  } catch {
    return '';
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
  if (!response.ok) throw new GraphMailError(response.status, 'token', await reasonOf(response));
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
  if (response.status !== 202 && !response.ok) throw new GraphMailError(response.status, 'send', await reasonOf(response));
}

/** What a Graph failure means, in words for whoever looks after the server. */
export function explainGraphError(e: GraphMailError): string {
  const r = e.reason;
  if (e.stage === 'settings') return 'One of GRAPH_TENANT_ID, GRAPH_CLIENT_ID, GRAPH_CLIENT_SECRET or GRAPH_SENDER is empty.';
  if (e.stage === 'token') {
    if (/AADSTS7000215|invalid_client/.test(r)) return "GRAPH_CLIENT_SECRET is not right. Use the secret's Value (shown once when it is made), not its Secret ID.";
    if (/AADSTS7000222/.test(r)) return 'The client secret has expired. Make a new one under Certificates & secrets and put its Value in GRAPH_CLIENT_SECRET.';
    if (/AADSTS700016|unauthorized_client/.test(r)) return 'GRAPH_CLIENT_ID was not found in this tenant. Copy the Application (client) ID from the app\u2019s Overview page.';
    if (/AADSTS90002|AADSTS900023|invalid_tenant/.test(r)) return 'GRAPH_TENANT_ID is not right. Copy the Directory (tenant) ID from the app\u2019s Overview page.';
    return `Microsoft refused to sign the app in (${e.status} ${r}). Check the three IDs and the secret.`;
  }
  if (e.status === 403 || /AccessDenied|Authorization_RequestDenied/.test(r)) {
    return 'The app may not send mail: under API permissions, add Microsoft Graph > Application permissions > Mail.Send and press Grant admin consent. If your Exchange administrator limited the app to certain mailboxes, GRAPH_SENDER must be one of them.';
  }
  if (e.status === 404 || /ResourceNotFound|ErrorInvalidUser|MailboxNotEnabledForRESTAPI|MailboxNotFound/.test(r)) {
    return 'GRAPH_SENDER is not a Microsoft 365 mailbox in this tenant. It must be a licensed Exchange Online mailbox (not a personal outlook.com address), written exactly as its email address.';
  }
  return `Microsoft refused the email (${e.status} ${r}).`;
}

/** For tests: forget the cached token. */
export function resetGraphToken() {
  cached = null;
}
