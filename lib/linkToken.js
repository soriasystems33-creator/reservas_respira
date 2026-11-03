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
