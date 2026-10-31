// Sends one test email the way sign-in codes are sent (OTP_DELIVERY graph or smtp) and says plainly what happened.
// Run on the server through deploy/test-email.sh, which reads the settings file:
//   bash /srv/food-app/repo/food-app/deploy/test-email.sh you@example.com
// It prints Microsoft's or the mail server's reason code when sending fails, never a password, secret or token.
import nodemailer from 'nodemailer';
import { GraphMailError, explainGraphError, sendGraphMail } from '../lib/graph-mail.ts';

const to = process.argv[2] ?? '';
if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(to)) {
  console.error('Give the address to send the test to, for example: test-email.sh you@example.com');
  process.exit(2);
}
const mode = process.env.OTP_DELIVERY ?? '';
const subject = 'Test email from your ordering system';
const text = 'This is a test. If it reached you, customers can get their sign-in codes.';

try {
  if (mode === 'graph') {
    await sendGraphMail({ to, subject, text });
    console.log(`Sent through Microsoft Graph from ${process.env.GRAPH_SENDER} to ${to}. Check the inbox and the spam folder.`);
  } else if (mode === 'smtp') {
    const port = Number(process.env.SMTP_PORT ?? 465);
    const transport = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
    await transport.sendMail({ from: process.env.SMTP_FROM, to, subject, text });
    console.log(`Sent through ${process.env.SMTP_HOST} from ${process.env.SMTP_FROM} to ${to}. Check the inbox and the spam folder.`);
  } else {
    console.log('OTP_DELIVERY is not "graph" or "smtp", so no email can be sent. Set it in /etc/food-app.env.');
    process.exit(1);
  }
} catch (error) {
  if (error instanceof GraphMailError) {
    console.log(`Not sent (${error.stage} ${error.status}${error.reason ? ` ${error.reason}` : ''}).`);
    console.log(explainGraphError(error));
  } else {
    const e = error as { code?: string; responseCode?: number; name?: string };
    console.log(`Not sent (${e.code ?? e.name ?? 'error'}${e.responseCode ? ` ${e.responseCode}` : ''}).`);
    if (e.code === 'EAUTH') console.log('The mail server refused the user name or password (SMTP_USER, SMTP_PASS).');
    else if (e.name === 'TimeoutError' || e.code === 'ETIMEDOUT' || e.code === 'ECONNREFUSED' || e.code === 'ENOTFOUND') console.log('The server could not reach the mail service. Check the host name, and that outgoing connections are allowed.');
  }
  process.exit(1);
}
