import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ── Load .env automatically ─────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '..', '.env');
  const envContent = readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx < 1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const val = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found, rely on process.env */ }

const DEFAULT_PORT = 8788;
const MAX_BODY_BYTES = 64 * 1024;

const PORT = Number(process.env.EMAIL_WEBHOOK_PORT || DEFAULT_PORT);
const WEBHOOK_BEARER_TOKEN = String(process.env.EMAIL_WEBHOOK_BEARER_TOKEN || '').trim();
const CORS_ALLOW_ORIGIN = String(process.env.EMAIL_WEBHOOK_CORS_ORIGIN || '*').trim() || '*';

// Email provider config
const EMAIL_PROVIDER = String(process.env.EMAIL_PROVIDER || 'resend').trim().toLowerCase();
const RESEND_API_KEY = String(process.env.RESEND_API_KEY || '').trim();
const SENDGRID_API_KEY = String(process.env.SENDGRID_API_KEY || '').trim();
const BREVO_API_KEY = String(process.env.BREVO_API_KEY || '').trim();
const EMAIL_FROM_ADDRESS = String(
  process.env.EMAIL_FROM_ADDRESS || 'Amanah <noreply@amanah-protect.com>'
).trim();

// ── Helpers ──────────────────────────────────────────────────────────────────

const sendJson = (res, statusCode, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': CORS_ALLOW_ORIGIN,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  });
  res.end(body);
};

const parseBody = async (req) =>
  new Promise((resolve, reject) => {
    let received = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      received += chunk.length;
      if (received > MAX_BODY_BYTES) {
        reject(new Error('Payload too large.'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      try {
        const raw = Buffer.concat(chunks).toString('utf8');
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        reject(new Error('Invalid JSON payload.'));
      }
    });
    req.on('error', (error) => reject(error));
  });

const isAuthorized = (req) => {
  if (!WEBHOOK_BEARER_TOKEN) return true;
  const authorization = String(req.headers.authorization || '');
  return authorization === `Bearer ${WEBHOOK_BEARER_TOKEN}`;
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

// ── HTML Email Template ─────────────────────────────────────────────────────

const buildInvitationHtml = ({ inviterName, appUrl }) => {
  const safeInviter = String(inviterName || 'أحد الوالدين').replace(/[<>&"']/g, '');
  const safeUrl = String(appUrl || '#').replace(/[<>"']/g, '');

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>دعوة أمانة</title>
</head>
<body style="margin:0;padding:0;background-color:#fdf2f4;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color:#fdf2f4;padding:40px 20px;">
<tr><td align="center">
<table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 8px 32px rgba(138,21,56,0.10);">

<!-- Header -->
<tr>
<td style="background:linear-gradient(135deg,#B83A60,#8A1538,#3A0715);padding:44px 32px;text-align:center;">
  <img src="https://amanah.qsmartlabs.com/android-chrome-192.png" alt="أمانة" width="72" height="72" style="display:block;margin:0 auto 16px;border-radius:18px;box-shadow:0 4px 20px rgba(122,77,10,0.3);" />
  <h1 style="margin:0;color:#ffffff;font-size:30px;font-weight:800;letter-spacing:1px;">أمانة</h1>
  <p style="margin:10px 0 0;color:rgba(255,255,255,0.80);font-size:14px;letter-spacing:0.5px;">حماية ذكية لعائلتك</p>
</td>
</tr>

<!-- Body -->
<tr>
<td style="padding:40px 32px;">
  <h2 style="margin:0 0 16px;color:#1e293b;font-size:22px;font-weight:700;">أهلاً وسهلاً</h2>
  <p style="margin:0 0 24px;color:#475569;font-size:16px;line-height:1.8;">
    لقد دعاكِ <strong style="color:#8A1538;">${safeInviter}</strong> للانضمام إلى تطبيق
    <strong>أمانة</strong> لمتابعة سلامة أطفالكم الرقمية معاً.
  </p>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:linear-gradient(135deg,#fdf2f4,#fff5f7);border-radius:16px;border:1px solid #f5d0d8;margin-bottom:28px;">
  <tr><td style="padding:24px;">
    <p style="margin:0 0 14px;font-size:15px;color:#8A1538;font-weight:700;">ما يمكنكِ فعله:</p>
    <table role="presentation" cellspacing="0" cellpadding="0">
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6;">🔍 متابعة نشاط الأطفال في الوقت الفعلي</td></tr>
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6;">🔔 استقبال تنبيهات فورية عند اكتشاف محتوى ضار</td></tr>
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6;">📊 مراجعة التقارير والإحصائيات اليومية</td></tr>
      <tr><td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6;">👨‍👩‍👧‍👦 المشاركة في الإشراف مع ${safeInviter}</td></tr>
    </table>
  </td></tr>
  </table>

  <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
  <tr><td align="center" style="padding:8px 0 28px;">
    <a href="${safeUrl}" target="_blank"
       style="display:inline-block;background:linear-gradient(135deg,#B83A60,#8A1538);color:#ffffff;font-size:17px;font-weight:700;text-decoration:none;padding:16px 52px;border-radius:14px;box-shadow:0 6px 20px rgba(138,21,56,0.35);letter-spacing:0.5px;">
      انضمي الآن
    </a>
  </td></tr>
  </table>

  <p style="margin:0 0 8px;color:#94a3b8;font-size:13px;text-align:center;">
    أو انسخي الرابط التالي وافتحيه في المتصفح:
  </p>
  <p style="margin:0 0 24px;text-align:center;">
    <a href="${safeUrl}" style="color:#8A1538;font-size:13px;word-break:break-all;">${safeUrl}</a>
  </p>

  <hr style="border:none;border-top:1px solid #f5d0d8;margin:24px 0;" />

  <p style="margin:0;color:#94a3b8;font-size:12px;text-align:center;line-height:1.6;">
    إذا لم تكوني تتوقعين هذه الدعوة، يمكنكِ تجاهل هذا البريد بأمان.<br/>
    <span style="color:#8A1538;">أمانة</span> – حماية ذكية لعائلتك
  </p>
</td>
</tr>

</table>
</td></tr>
</table>
</body>
</html>`;
};

const buildPlainText = ({ inviterName, appUrl }) => {
  const inviter = inviterName || 'أحد الوالدين';
  return [
    `أهلاً وسهلاً!`,
    ``,
    `لقد دعاكِ ${inviter} للانضمام إلى تطبيق أمانة للرقابة الأبوية.`,
    ``,
    `للانضمام، افتحي الرابط التالي:`,
    appUrl || '#',
    ``,
    `تطبيق أمانة – حماية ذكية لعائلتك`,
  ].join('\n');
};

// ── Email Providers ─────────────────────────────────────────────────────────

const sendViaResend = async (to, subject, html, text) => {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured.');

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${RESEND_API_KEY}`,
    },
    body: JSON.stringify({
      from: EMAIL_FROM_ADDRESS,
      to: [to],
      subject,
      html,
      text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.message || payload?.error || `HTTP ${response.status}`;
    throw new Error(`Resend API error: ${detail}`);
  }

  return { provider: 'resend', id: payload?.id };
};

const sendViaSendGrid = async (to, subject, html, text) => {
  if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is not configured.');

  // Parse "Name <email>" format
  const fromMatch = EMAIL_FROM_ADDRESS.match(/^(.+?)\s*<(.+?)>$/);
  const fromObj = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: EMAIL_FROM_ADDRESS };

  const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SENDGRID_API_KEY}`,
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: fromObj,
      subject,
      content: [
        { type: 'text/plain', value: text },
        { type: 'text/html', value: html },
      ],
    }),
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => '');
    throw new Error(`SendGrid API error (${response.status}): ${raw}`);
  }

  return { provider: 'sendgrid', status: response.status };
};

const sendViaBrevo = async (to, subject, html, text) => {
  if (!BREVO_API_KEY) throw new Error('BREVO_API_KEY is not configured.');

  const fromMatch = EMAIL_FROM_ADDRESS.match(/^(.+?)\s*<(.+?)>$/);
  const sender = fromMatch
    ? { name: fromMatch[1].trim(), email: fromMatch[2].trim() }
    : { email: EMAIL_FROM_ADDRESS };

  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': BREVO_API_KEY,
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: html,
      textContent: text,
    }),
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    const detail = payload?.message || `HTTP ${response.status}`;
    throw new Error(`Brevo API error: ${detail}`);
  }

  return { provider: 'brevo', messageId: payload?.messageId };
};

const sendViaMock = async (to, subject, _html, text) => {
  console.info(`\n[EMAIL_MOCK] ─────────────────────────────────`);
  console.info(`  To:      ${to}`);
  console.info(`  Subject: ${subject}`);
  console.info(`  Body:\n${text}`);
  console.info(`──────────────────────────────────────────────\n`);
  return { provider: 'mock' };
};

const dispatchEmail = async (to, subject, html, text) => {
  if (EMAIL_PROVIDER === 'mock') return sendViaMock(to, subject, html, text);
  if (EMAIL_PROVIDER === 'resend') return sendViaResend(to, subject, html, text);
  if (EMAIL_PROVIDER === 'sendgrid') return sendViaSendGrid(to, subject, html, text);
  if (EMAIL_PROVIDER === 'brevo') return sendViaBrevo(to, subject, html, text);
  throw new Error(
    `Unsupported EMAIL_PROVIDER "${EMAIL_PROVIDER}". Supported: resend, sendgrid, brevo, mock.`
  );
};

// ── HTTP Server ─────────────────────────────────────────────────────────────

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/email/invite') {
    sendJson(res, 404, { ok: false, error: 'Not found.' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const payload = await parseBody(req);
    const email = String(payload?.email || '').trim().toLowerCase();
    const inviterName = String(payload?.inviterName || '').trim();
    const appUrl = String(payload?.appUrl || '').trim();

    if (!isValidEmail(email)) {
      sendJson(res, 400, { ok: false, error: 'Invalid email address.' });
      return;
    }

    const subject = `دعوة للانضمام إلى تطبيق أمانة`;
    const html = buildInvitationHtml({ inviterName, appUrl });
    const text = buildPlainText({ inviterName, appUrl });

    const result = await dispatchEmail(email, subject, html, text);

    console.info(`[EMAIL] invitation sent to ${email} via ${result.provider}`);

    sendJson(res, 200, {
      ok: true,
      provider: result.provider,
      dispatchedAt: Date.now(),
      meta: result,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to send invitation email.');
    console.error(`[EMAIL] error: ${message}`);
    sendJson(res, 502, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  const tokenStatus = WEBHOOK_BEARER_TOKEN ? 'enabled' : 'disabled';
  console.info(
    `[EMAIL_WEBHOOK] listening on http://localhost:${PORT}/email/invite | provider=${EMAIL_PROVIDER} | token=${tokenStatus}`
  );
});
