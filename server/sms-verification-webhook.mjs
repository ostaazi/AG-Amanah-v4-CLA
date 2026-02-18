import { createServer } from 'node:http';
import { URLSearchParams } from 'node:url';

const DEFAULT_PORT = 8787;
const MAX_BODY_BYTES = 32 * 1024;

const PORT = Number(process.env.PORT || DEFAULT_PORT);
const WEBHOOK_BEARER_TOKEN = String(process.env.SMS_WEBHOOK_BEARER_TOKEN || '').trim();
const SMS_PROVIDER = String(process.env.SMS_PROVIDER || 'textbelt')
  .trim()
  .toLowerCase();
const SMS_TEXTBELT_KEY = String(process.env.SMS_TEXTBELT_KEY || 'textbelt').trim();
const SMS_ANDROID_GATEWAY_URL = String(process.env.SMS_ANDROID_GATEWAY_URL || '').trim();
const SMS_ANDROID_GATEWAY_TOKEN = String(process.env.SMS_ANDROID_GATEWAY_TOKEN || '').trim();
const SMS_ANDROID_GATEWAY_PHONE_FIELD =
  String(process.env.SMS_ANDROID_GATEWAY_PHONE_FIELD || 'phone').trim() || 'phone';
const SMS_ANDROID_GATEWAY_MESSAGE_FIELD =
  String(process.env.SMS_ANDROID_GATEWAY_MESSAGE_FIELD || 'message').trim() || 'message';
const SMS_SENDER_NAME = String(process.env.SMS_SENDER_NAME || 'Amanah').trim();
const CORS_ALLOW_ORIGIN = String(process.env.SMS_WEBHOOK_CORS_ORIGIN || '*').trim() || '*';

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

const safePhone = (value) => String(value || '').trim().replace(/[^\d+]/g, '').replace(/(?!^)\+/g, '');
const isValidPhone = (value) => /^\+\d{8,15}$/.test(value);
const isValidCode = (value) => /^\d{6}$/.test(String(value || '').trim());

const buildVerificationMessage = (code, ttlSeconds) => {
  const ttl = Number(ttlSeconds);
  const minutes = Number.isFinite(ttl) && ttl > 0 ? Math.max(1, Math.round(ttl / 60)) : 10;
  return `${SMS_SENDER_NAME} verification code: ${code}. Valid for ${minutes} minutes.`;
};

const sendViaTextbelt = async (phone, message) => {
  const form = new URLSearchParams({
    phone,
    message,
    key: SMS_TEXTBELT_KEY,
  });

  const response = await fetch('https://textbelt.com/text', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: form.toString(),
  });

  const raw = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok || !payload?.success) {
    const details = String(payload?.error || payload?.message || raw || `HTTP ${response.status}`).trim();
    throw new Error(`Textbelt rejected request: ${details}`);
  }

  return {
    provider: 'textbelt',
    quotaRemaining: payload?.quotaRemaining,
    textId: payload?.textId,
  };
};

const sendViaAndroidGateway = async (phone, message) => {
  if (!SMS_ANDROID_GATEWAY_URL) {
    throw new Error('SMS_ANDROID_GATEWAY_URL is not configured.');
  }

  const requestBody = {
    [SMS_ANDROID_GATEWAY_PHONE_FIELD]: phone,
    [SMS_ANDROID_GATEWAY_MESSAGE_FIELD]: message,
  };

  const response = await fetch(SMS_ANDROID_GATEWAY_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      ...(SMS_ANDROID_GATEWAY_TOKEN ? { Authorization: `Bearer ${SMS_ANDROID_GATEWAY_TOKEN}` } : {}),
    },
    body: JSON.stringify(requestBody),
  });

  const raw = await response.text().catch(() => '');
  let payload = null;
  try {
    payload = raw ? JSON.parse(raw) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const details = String(payload?.error || payload?.message || raw || `HTTP ${response.status}`).trim();
    throw new Error(`Android SMS gateway rejected request (${response.status}). ${details}`);
  }

  if (payload && payload.success === false) {
    const details = String(payload.error || payload.message || 'unknown provider error').trim();
    throw new Error(`Android SMS gateway failed. ${details}`);
  }

  return {
    provider: 'android_gateway',
    status: response.status,
    hasPayload: Boolean(payload),
  };
};

const sendViaMock = async (phone, message) => {
  console.info(`[SMS_MOCK] -> ${phone}: ${message}`);
  return {
    provider: 'mock',
  };
};

const dispatchSms = async (phone, message) => {
  if (SMS_PROVIDER === 'mock') {
    return sendViaMock(phone, message);
  }
  if (SMS_PROVIDER === 'textbelt') {
    return sendViaTextbelt(phone, message);
  }
  if (SMS_PROVIDER === 'android_gateway') {
    return sendViaAndroidGateway(phone, message);
  }
  throw new Error(`Unsupported SMS_PROVIDER "${SMS_PROVIDER}". Supported: textbelt, android_gateway, mock.`);
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
  const expected = `Bearer ${WEBHOOK_BEARER_TOKEN}`;
  return authorization === expected;
};

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (req.method !== 'POST' || req.url !== '/sms/verification') {
    sendJson(res, 404, { ok: false, error: 'Not found.' });
    return;
  }

  if (!isAuthorized(req)) {
    sendJson(res, 401, { ok: false, error: 'Unauthorized.' });
    return;
  }

  try {
    const payload = await parseBody(req);
    const phone = safePhone(payload?.phone);
    const code = String(payload?.code || '').trim();
    const purpose = String(payload?.purpose || '').trim() || 'unknown';
    const ttlSeconds = Number(payload?.ttlSeconds || 600);

    if (!isValidPhone(phone)) {
      sendJson(res, 400, { ok: false, error: 'Invalid phone format. Use E.164 format like +974XXXXXXXX.' });
      return;
    }

    if (!isValidCode(code)) {
      sendJson(res, 400, { ok: false, error: 'Invalid verification code. Expected 6 digits.' });
      return;
    }

    const message = buildVerificationMessage(code, ttlSeconds);
    const result = await dispatchSms(phone, message);

    sendJson(res, 200, {
      ok: true,
      provider: result.provider,
      purpose,
      dispatchedAt: Date.now(),
      meta: result,
    });
  } catch (error) {
    const message = String(error?.message || 'Failed to dispatch SMS.');
    sendJson(res, 502, { ok: false, error: message });
  }
});

server.listen(PORT, () => {
  const tokenStatus = WEBHOOK_BEARER_TOKEN ? 'enabled' : 'disabled';
  const providerTarget = SMS_PROVIDER === 'android_gateway' ? ` | target=${SMS_ANDROID_GATEWAY_URL || 'unset'}` : '';
  console.info(
    `[SMS_WEBHOOK] listening on http://localhost:${PORT}/sms/verification | provider=${SMS_PROVIDER}${providerTarget} | token=${tokenStatus}`
  );
});
