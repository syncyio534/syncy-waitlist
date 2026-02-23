import crypto from 'node:crypto';

const MIN_FORM_MS = 3000;
const MAX_REQUESTS_PER_HOUR = 20;
const MAX_PHONE_LEN = 32;

function sendJson(res, status, payload) {
  res.status(status).json(payload);
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || '';
  return value || '';
}

function getClientIp(req) {
  const forwarded = getHeader(req, 'x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return getHeader(req, 'x-real-ip') || 'unknown';
}

function hashIp(ip, salt) {
  return crypto.createHash('sha256').update(`${salt}:${ip}`).digest('hex');
}

function isValidEmail(email) {
  const trimmed = String(email || '').trim().toLowerCase();
  if (!trimmed || trimmed.length > 320) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
}

function normalizePhone(phone) {
  const normalized = String(phone || '').trim();
  if (!normalized) return null;
  return normalized.slice(0, MAX_PHONE_LEN);
}

async function verifyTurnstile(token, ip, secret) {
  if (!secret) return true;
  if (!token) return false;

  const body = new URLSearchParams({
    secret,
    response: token,
    remoteip: ip
  });

  const result = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body
  });

  if (!result.ok) return false;
  const payload = await result.json();
  return Boolean(payload.success);
}

async function supabaseRequest(path, { method = 'GET', body, serviceRoleKey, projectUrl, headers = {} }) {
  const url = `${projectUrl}/rest/v1/${path}`;

  return fetch(url, {
    method,
    headers: {
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`,
      'Content-Type': 'application/json',
      ...headers
    },
    body: body ? JSON.stringify(body) : undefined
  });
}

async function fetchRowCount(projectUrl, serviceRoleKey, tableName) {
  const res = await supabaseRequest(`${tableName}?select=id`, {
    method: 'HEAD',
    projectUrl,
    serviceRoleKey,
    headers: {
      Prefer: 'count=exact'
    }
  });

  if (!res.ok) return undefined;

  const contentRange = res.headers.get('content-range') || '';
  const parts = contentRange.split('/');
  if (parts.length !== 2) return undefined;

  const count = Number(parts[1]);
  return Number.isFinite(count) ? count : undefined;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return sendJson(res, 405, { error: 'Method not allowed' });
  }

  const projectUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const turnstileSecret = process.env.TURNSTILE_SECRET_KEY || '';

  if (!projectUrl || !serviceRoleKey) {
    return sendJson(res, 500, { error: 'Server not configured' });
  }

  let payload;
  try {
    payload = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body || {};
  } catch (_err) {
    return sendJson(res, 400, { error: 'Invalid JSON body' });
  }

  const email = String(payload.email || '').trim().toLowerCase();
  const phone = normalizePhone(payload.phone);
  const consent = Boolean(payload.consent);
  const website = String(payload.website || '');
  const startedAt = Number(payload.startedAt || 0);
  const turnstileToken = String(payload.turnstileToken || '');

  if (!isValidEmail(email)) {
    return sendJson(res, 400, { error: 'Please enter a valid email.' });
  }

  if (!consent) {
    return sendJson(res, 400, { error: 'Consent is required.' });
  }

  if (website.trim() !== '') {
    return sendJson(res, 400, { error: 'Spam detected.' });
  }

  if (!startedAt || Date.now() - startedAt < MIN_FORM_MS) {
    return sendJson(res, 400, { error: 'Please take a moment to complete the form.' });
  }

  const ip = getClientIp(req);
  const ipHash = hashIp(ip, process.env.RATE_LIMIT_SALT || 'syncy-waitlist');

  const turnstileOk = await verifyTurnstile(turnstileToken, ip, turnstileSecret);
  if (!turnstileOk) {
    return sendJson(res, 400, { error: 'Spam check failed. Please try again.' });
  }

  try {
    const since = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const rateRes = await supabaseRequest(
      `waitlist_submissions?select=id&ip_hash=eq.${ipHash}&created_at=gte.${since}`,
      { method: 'GET', projectUrl, serviceRoleKey }
    );

    if (!rateRes.ok) {
      return sendJson(res, 500, { error: 'Could not verify rate limit' });
    }

    const recent = await rateRes.json();
    if (Array.isArray(recent) && recent.length >= MAX_REQUESTS_PER_HOUR) {
      return sendJson(res, 429, { error: 'Too many attempts. Please try again later.' });
    }

    const insertRes = await supabaseRequest('waitlist_submissions', {
      method: 'POST',
      body: {
        email,
        phone,
        consent,
        ip_hash: ipHash,
        user_agent: getHeader(req, 'user-agent') || null,
        source: 'waitlist-web'
      },
      projectUrl,
      serviceRoleKey,
      headers: {
        Prefer: 'return=minimal'
      }
    });

    if (!insertRes.ok) {
      const errText = await insertRes.text();
      if (errText.includes('waitlist_submissions_email_key') || errText.includes('waitlist_email_unique_ci')) {
        return sendJson(res, 409, { error: 'This email is already on the waitlist.' });
      }
      return sendJson(res, 500, { error: 'Unable to save your entry right now.' });
    }

    const base = Number(process.env.WAITLIST_BASELINE || 1247);
    const dbCount = await fetchRowCount(projectUrl, serviceRoleKey, 'waitlist_submissions');
    const waitlistCount = dbCount == null ? undefined : base + dbCount;

    return sendJson(res, 200, { success: true, waitlistCount });
  } catch (_err) {
    return sendJson(res, 500, { error: 'Server error. Please try again.' });
  }
}
