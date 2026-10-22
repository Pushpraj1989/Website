// Links go in the URL fragment (#...), so the token is never sent to the web server or its logs.
export function linkFor(kind, token, base) {
  const page = kind === "invite" ? "accept" : "reset";
  return `${base}/admin/#/${page}?token=${encodeURIComponent(token)}`;
}

export function mailLinkText(kind, token, base) {
  const lead = kind === "invite"
    ? "You have been invited to manage the content of the site. Open this link to choose your name and password. It works once and expires in 72 hours:"
    : "Someone asked to reset the password on your account. Open this link to choose a new password. It works once and expires in 30 minutes. If you did not ask, ignore this email:";
  return `${lead}\n\n${linkFor(kind, token, base)}\n`;
}
