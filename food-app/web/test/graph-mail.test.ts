// Email through Microsoft Graph, against a stand-in for Microsoft's sign-in and Graph servers on this machine.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer, type Server } from 'node:http';
import { GraphMailError, explainGraphError, resetGraphToken, sendGraphMail } from '../lib/graph-mail.ts';

type Call = { path: string; auth?: string; body: string };
const calls: Call[] = [];
let tokensIssued = 0;
let sendStatus = 202;
let rejectToken: string | null = null;
let tokenReply: { status: number; body: unknown } | null = null;
let sendReply: unknown = null;
let server: Server;

before(async () => {
  server = createServer((req, res) => {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      calls.push({ path: req.url ?? '', auth: req.headers.authorization, body });
      if (req.url?.endsWith('/oauth2/v2.0/token') && tokenReply) {
        res.writeHead(tokenReply.status, { 'content-type': 'application/json' }).end(JSON.stringify(tokenReply.body));
      } else if (req.url?.endsWith('/oauth2/v2.0/token')) {
        tokensIssued += 1;
        res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify({ access_token: `tok-${tokensIssued}`, expires_in: 3600 }));
      } else if (req.url?.includes('/sendMail')) {
        if (rejectToken && req.headers.authorization === `Bearer ${rejectToken}`) res.writeHead(401).end();
        else if (sendReply) res.writeHead(sendStatus, { 'content-type': 'application/json' }).end(JSON.stringify(sendReply));
        else res.writeHead(sendStatus).end();
      } else res.writeHead(404).end();
    });
  });
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const { port } = server.address() as { port: number };
  Object.assign(process.env, {
    GRAPH_LOGIN_URL: `http://127.0.0.1:${port}`, GRAPH_API_URL: `http://127.0.0.1:${port}`,
    GRAPH_TENANT_ID: 'tenant-1', GRAPH_CLIENT_ID: 'client-1', GRAPH_CLIENT_SECRET: 'very-secret-value', GRAPH_SENDER: 'orders@example.com',
  });
});
after(() => server.close());

test('signs in as the app, then sends from the restaurant mailbox under its name, not kept in Sent Items', async () => {
  resetGraphToken();
  calls.length = 0;
  await sendGraphMail({ to: 'layla@example.com', subject: '123456 is your Kitchen code', text: '123456 is your Kitchen code.', fromName: 'Kitchen' });
  const [login, send] = calls;
  assert.equal(login.path, '/tenant-1/oauth2/v2.0/token');
  const form = new URLSearchParams(login.body);
  assert.deepEqual([form.get('grant_type'), form.get('client_id'), form.get('client_secret'), form.get('scope')], ['client_credentials', 'client-1', 'very-secret-value', 'https://graph.microsoft.com/.default']);
  assert.equal(send.path, '/v1.0/users/orders%40example.com/sendMail');
  assert.equal(send.auth, 'Bearer tok-1');
  const mail = JSON.parse(send.body);
  assert.equal(mail.saveToSentItems, false);
  assert.equal(mail.message.subject, '123456 is your Kitchen code');
  assert.deepEqual(mail.message.toRecipients, [{ emailAddress: { address: 'layla@example.com' } }]);
  assert.deepEqual(mail.message.from, { emailAddress: { address: 'orders@example.com', name: 'Kitchen' } });
  assert.equal(mail.message.body.contentType, 'Text');
});

test('the token is reused for the next code, and a revoked token is replaced once', async () => {
  calls.length = 0;
  await sendGraphMail({ to: 'a@example.com', subject: 's', text: 't' });
  assert.equal(calls.filter((c) => c.path.endsWith('/token')).length, 0, 'no second sign-in while the token is valid');
  rejectToken = 'tok-1';
  calls.length = 0;
  await sendGraphMail({ to: 'a@example.com', subject: 's', text: 't' });
  assert.deepEqual(calls.map((c) => c.path.endsWith('/token') ? 'token' : c.auth), ['Bearer tok-1', 'token', 'Bearer tok-2']);
  rejectToken = null;
});

test('a refused send and missing settings are errors that name the step, never the secret', async () => {
  sendStatus = 403;
  await assert.rejects(sendGraphMail({ to: 'a@example.com', subject: 's', text: 't' }), (e: unknown) => {
    assert.ok(e instanceof GraphMailError);
    assert.equal(e.stage, 'send');
    assert.equal(e.status, 403);
    assert.ok(!String(e.message).includes('very-secret-value'));
    return true;
  });
  sendStatus = 202;
  const saved = process.env.GRAPH_SENDER;
  delete process.env.GRAPH_SENDER;
  await assert.rejects(sendGraphMail({ to: 'a@example.com', subject: 's', text: 't' }), (e: unknown) => e instanceof GraphMailError && e.stage === 'settings');
  process.env.GRAPH_SENDER = saved;
});

test("Microsoft's reason is kept and explained: a wrong secret, a missing permission, a sender with no mailbox", async () => {
  const fail = async () => {
    try { await sendGraphMail({ to: 'a@example.com', subject: 's', text: 't' }); } catch (e) { return e as GraphMailError; }
    throw new Error('expected a failure');
  };
  resetGraphToken();
  tokenReply = { status: 401, body: { error: 'invalid_client', error_description: 'AADSTS7000215: Invalid client secret provided. Trace ID: x', error_codes: [7000215] } };
  let e = await fail();
  assert.equal(e.reason, 'AADSTS7000215');
  assert.match(explainGraphError(e), /GRAPH_CLIENT_SECRET is not right/);
  assert.ok(!e.message.includes('very-secret-value'));
  tokenReply = null;
  resetGraphToken();
  sendStatus = 403; sendReply = { error: { code: 'ErrorAccessDenied', message: 'Access is denied.' } };
  e = await fail();
  assert.equal(e.reason, 'ErrorAccessDenied');
  assert.match(explainGraphError(e), /Mail\.Send/);
  sendStatus = 404; sendReply = { error: { code: 'MailboxNotEnabledForRESTAPI', message: 'x' } };
  e = await fail();
  assert.match(explainGraphError(e), /GRAPH_SENDER is not a Microsoft 365 mailbox/);
  sendStatus = 202; sendReply = null;
});
