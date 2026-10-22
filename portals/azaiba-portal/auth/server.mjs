// GitHub OAuth proxy for the Decap CMS at /admin/.
//
// Decap cannot hold a GitHub client secret in the browser, so this small service does the
// code exchange. It uses only Node built-ins (Node 18+) and no third-party packages.
//
// Access rule: the token belongs to the GitHub user who signs in. GitHub only lets a user commit
// to the repo if that user has write access. So the editors are exactly the repo collaborators you
// invite; nobody else can save content, even with the login page.
//
// Environment:
//   GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET  from a GitHub OAuth App (keep the secret out of the repo)
//   PUBLIC_URL      this service's public address, e.g. https://auth.example.com
//   SITE_ORIGIN     the CMS site origin only, e.g. https://portal.example.com
//   PORT            optional, default 8787
import http from "node:http";
import crypto from "node:crypto";

const { GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PUBLIC_URL, SITE_ORIGIN, PORT = 8787 } = process.env;
for (const [name, value] of Object.entries({ GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, PUBLIC_URL, SITE_ORIGIN })) {
  if (!value) throw new Error(`Missing ${name}`);
}

const STATE_COOKIE = "cms_oauth_state";
const SCOPE = "repo";

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "no-referrer",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'",
    ...headers,
  });
  res.end(body);
}

function cookieValue(req, name) {
  const found = (req.headers.cookie || "").split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return found ? found.slice(name.length + 1) : "";
}

function safeEqual(a, b) {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && crypto.timingSafeEqual(x, y);
}

async function handleAuth(req, res) {
  const state = crypto.randomBytes(32).toString("hex");
  const url = new URL("https://github.com/login/oauth/authorize");
  url.searchParams.set("client_id", GITHUB_CLIENT_ID);
  url.searchParams.set("redirect_uri", `${PUBLIC_URL}/callback`);
  url.searchParams.set("scope", SCOPE);
  url.searchParams.set("state", state);
  res.writeHead(302, {
    Location: url.toString(),
    "Set-Cookie": `${STATE_COOKIE}=${state}; Max-Age=600; Path=/; HttpOnly; Secure; SameSite=Lax`,
    "Cache-Control": "no-store",
  });
  res.end();
}

async function handleCallback(req, res, url) {
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expected = cookieValue(req, STATE_COOKIE);
  if (!code || !state || !expected || !safeEqual(state, expected)) {
    return send(res, 403, "<p>Sign-in expired. Close this window and try again.</p>");
  }

  const exchange = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: GITHUB_CLIENT_ID, client_secret: GITHUB_CLIENT_SECRET, code, redirect_uri: `${PUBLIC_URL}/callback` }),
  });
  const payload = await exchange.json().catch(() => ({}));
  if (!payload.access_token) {
    return send(res, 401, "<p>GitHub did not accept the sign-in. Try again.</p>", {
      "Set-Cookie": `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
    });
  }

  // Hand the token to the CMS window. The script runs only where its hash is listed in the CSP,
  // and posts only to SITE_ORIGIN. Decap checks the sender origin and the message prefix.
  const script = `
(function () {
  var target = ${JSON.stringify(SITE_ORIGIN)};
  var token = ${JSON.stringify(payload.access_token)};
  var sent = false;
  window.addEventListener("message", function (e) {
    if (sent || e.origin !== target || e.data !== "authorizing:github") return;
    sent = true;
    window.opener.postMessage("authorization:github:success:" + JSON.stringify({ token: token, provider: "github" }), target);
    setTimeout(function () { window.close(); }, 300);
  }, false);
  window.opener && window.opener.postMessage("authorizing:github", target);
})();`;
  const hash = crypto.createHash("sha256").update(script).digest("base64");
  const html = `<!doctype html><meta charset="utf-8"><title>Signed in</title><p>Signed in. You can close this window.</p><script>${script}</script>`;
  return send(res, 200, html, {
    "Content-Security-Policy": `default-src 'none'; script-src 'sha256-${hash}'`,
    "Cross-Origin-Opener-Policy": "unsafe-none",
    "Set-Cookie": `${STATE_COOKIE}=; Max-Age=0; Path=/; HttpOnly; Secure; SameSite=Lax`,
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, PUBLIC_URL);
    if (req.method === "GET" && url.pathname === "/auth") return await handleAuth(req, res);
    if (req.method === "GET" && url.pathname === "/callback") return await handleCallback(req, res, url);
    return send(res, 404, "<p>Not found</p>");
  } catch (err) {
    console.error("auth error", err.message);
    return send(res, 500, "<p>Sign-in failed. Try again later.</p>");
  }
});

server.listen(PORT, () => console.log(`CMS auth proxy on :${PORT} for ${SITE_ORIGIN}`));
