import crypto from 'crypto';

// Firma HMAC para los enlaces de "Mis citas", cancelar y modificar.
// Clave: LINK_SECRET si existe; si no, se deriva del SUPABASE_SERVICE_ROLE_KEY (secreto ya existente en el servidor).
function getKey() {
  const base = process.env.LINK_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || '';
  if (!base) throw new Error('Missing LINK_SECRET / SUPABASE_SERVICE_ROLE_KEY');
  return crypto.createHash('sha256').update('respira-link-v1|' + base).digest();
}

export function signLink(id) {
  return crypto.createHmac('sha256', getKey()).update(String(id)).digest('base64url').slice(0, 24);
}

export function verifyLink(id, token) {
  if (!id || !token) return false;
  const a = Buffer.from(signLink(id));
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Devuelve null si el enlace es válido, o un motivo si no lo es.
// - Con token (?t=): debe ser correcto.
// - Sin token: se acepta solo mientras REQUIRE_LINK_TOKEN no sea "1" (enlaces antiguos ya enviados).
export function checkLink(id, token) {
  if (token) return verifyLink(id, token) ? null : 'invalid_token';
  if (process.env.REQUIRE_LINK_TOKEN === '1') return 'missing_token';
  return null;
}

// ── Enlace personal de la clienta (todas sus citas) ──
export function normPhone(p) {
  return String(p || '').replace(/[^\d]/g, '').replace(/^34(?=\d{9}$)/, '').slice(-9);
}
export function clientCode(phone) {
  return Buffer.from(normPhone(phone)).toString('base64url');
}
export function clientPhoneFromCode(code) {
  try { return normPhone(Buffer.from(String(code || ''), 'base64url').toString()); } catch (e) { return ''; }
}
export function signClient(phone) {
  return signLink('client:' + normPhone(phone));
}
export function verifyClient(code, token) {
  const phone = clientPhoneFromCode(code);
  if (phone.length < 9 || !token) return null;
  const a = Buffer.from(signClient(phone));
  const b = Buffer.from(String(token));
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? phone : null;
}
export function clientLink(phone, base = 'https://reservas-respira.vercel.app') {
  const p = normPhone(phone);
  if (p.length < 9) return '';
  return `${base}/mis-citas?c=${clientCode(p)}&tc=${signClient(p)}`;
}
