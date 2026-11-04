import { getSupabaseAdmin } from './supabase.js';

/**
 * Normaliza un voucher para que exponga siempre todas sus propiedades tanto en camelCase como en snake_case
 */
function normalizeVoucher(raw) {
  if (!raw) return null;
  const isBono = (raw.type === 'bono') ||
    (raw.total_sessions !== undefined && Number(raw.total_sessions) > 0) ||
    (raw.totalSessions !== undefined && Number(raw.totalSessions) > 0);

  const total = isBono ? Number(raw.total_sessions ?? raw.totalSessions ?? 1) : 1;
  const rawRem = raw.remaining_sessions !== undefined ? raw.remaining_sessions : raw.remainingSessions;
  const rem = isBono ? ((rawRem !== undefined && rawRem !== null) ? Number(rawRem) : (raw.used ? 0 : total)) : (raw.used ? 0 : 1);

  return {
    ...raw,
    type: isBono ? 'bono' : (raw.type || 'cheque'),
    total_sessions: total,
    totalSessions: total,
    remaining_sessions: rem,
    remainingSessions: rem,
    client_name: raw.client_name || raw.clientName || '',
    clientName: raw.client_name || raw.clientName || '',
    client_phone: raw.client_phone || raw.clientPhone || '',
    clientPhone: raw.client_phone || raw.clientPhone || '',
    service_name: raw.service_name || raw.serviceName || '',
    serviceName: raw.service_name || raw.serviceName || '',
    expires_at: raw.expires_at || raw.expiresAt || null,
    expiresAt: raw.expires_at || raw.expiresAt || null,
    used: !!raw.used && rem <= 0
  };
}

/**
 * Busca un bono o cheque regalo por su código (ej: BONO-XXXXXX o CHEQUE-XXXXXX)
 * Soporta tanto la tabla public.vouchers como el almacenamiento fallback en settings (id=vouchers).
 */
export async function findVoucherByCode(code) {
  if (!code) return null;
  const normCode = code.trim().toUpperCase();
  const supabase = getSupabaseAdmin();

  // 1. Intentar en la tabla nativa vouchers
  try {
    const { data, error } = await supabase
      .from('vouchers')
      .select('*')
      .eq('code', normCode)
      .maybeSingle();

    if (!error && data) {
      return { source: 'table', voucher: normalizeVoucher(data) };
    }
  } catch (e) {
    // Silencioso: pasar al fallback
  }

  // 2. Fallback a settings (id = vouchers)
  try {
    const { data: setRow } = await supabase
      .from('settings')
      .select('*')
      .eq('id', 'vouchers')
      .maybeSingle();

    const list = setRow?.special_days?.list || setRow?.specialDays?.list || [];
    const found = list.find(v => (v.code || '').trim().toUpperCase() === normCode);
    if (found) {
      return { source: 'settings', voucher: normalizeVoucher(found), allVouchers: list };
    }
  } catch (e) {
    console.error('Error consultando vouchers fallback:', e);
  }

  return null;
}

/**
 * Valida las reglas de negocio diferenciando:
 * - BONO DE SESIONES: Pack de tratamientos con saldo de sesiones restantes.
 * - CHEQUE REGALO: Valor en € o tratamiento cubierto 100%.
 */
export function validateVoucherRules(rawVoucher, selectedServices = []) {
  if (!rawVoucher) {
    return { valid: false, error: 'Código no encontrado. Revisa si lo has escrito bien.' };
  }

  const voucher = normalizeVoucher(rawVoucher);
  const isBono = voucher.type === 'bono';

  // 1. Validar si está agotado
  if (isBono) {
    if (voucher.remaining_sessions <= 0 || voucher.used) {
      return { valid: false, error: 'Este Bono ya ha agotado todas sus sesiones disponibles.' };
    }
  } else {
    if (voucher.used) {
      return { valid: false, error: 'Este Cheque Regalo ya ha sido canjeado previamente.' };
    }
  }

  // 2. Validar fecha de caducidad
  if (voucher.expires_at) {
    const expDateStr = voucher.expires_at;
    const expDate = new Date(expDateStr + 'T23:59:59');
    if (!isNaN(expDate.getTime()) && expDate < new Date()) {
      return { valid: false, error: `Este ${isBono ? 'Bono' : 'Cheque'} ha caducado el ${expDateStr.split('-').reverse().join('/')}.` };
    }
  }

  // 3. Validar restricción de servicio
  const cleanStr = (str) => (str || '').normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();
  const reqSvc = cleanStr(voucher.service_name);

  if (isBono) {
    // Un Bono de Sesiones SOLO puede aplicarse al servicio del bono
    if (!reqSvc || reqSvc === 'cualquiera') {
      return {
        valid: false,
        error: 'Este Bono no tiene un servicio asignado válido.'
      };
    }
    const matches = selectedServices && selectedServices.length > 0 && selectedServices.some(s => {
      const sName = cleanStr(typeof s === 'string' ? s : (s.name || ''));
      return sName === reqSvc || sName.includes(reqSvc) || reqSvc.includes(sName);
    });
    if (!matches) {
      return { 
        valid: false, 
        error: `Este Bono es válido únicamente para el tratamiento: "${voucher.service_name}".` 
      };
    }
  } else {
    // Cheque Regalo: si tiene tratamiento asignado, solo aplica a ese
    if (reqSvc && reqSvc !== 'cualquiera' && selectedServices && selectedServices.length > 0) {
      const matches = selectedServices.some(s => {
        const sName = cleanStr(typeof s === 'string' ? s : (s.name || ''));
        return sName === reqSvc || sName.includes(reqSvc) || reqSvc.includes(sName);
      });
      if (!matches) {
        return { 
          valid: false, 
          error: `Este Cheque es válido únicamente para el tratamiento: "${voucher.service_name}".` 
        };
      }
    }
  }

  return { valid: true };
}

/**
 * Registra el uso del bono/cheque en la cita:
 * - Si es Bono de sesiones: Descuenta 1 sesión restante. Si llega a 0, lo marca como agotado (used: true).
 * - Si es Cheque regalo: Lo marca como canjeado (used: true).
 */
export async function markVoucherUsed(voucherInfo, appointmentId) {
  const { source, voucher: rawVoucher, allVouchers } = voucherInfo;
  const voucher = normalizeVoucher(rawVoucher);
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const isBono = voucher.type === 'bono';
  let newRem = 0;
  let isFinished = true;

  if (isBono) {
    const currentRem = Number(voucher.remaining_sessions);
    newRem = Math.max(0, currentRem - 1);
    isFinished = newRem <= 0;
  }

  const updateFields = isBono ? {
    remaining_sessions: newRem,
    remainingSessions: newRem,
    total_sessions: voucher.total_sessions,
    totalSessions: voucher.total_sessions,
    used: isFinished,
    used_at: isFinished ? now : (voucher.used_at || null),
    usedAt: isFinished ? now : (voucher.used_at || null),
    last_session_used_at: now,
    lastSessionUsedAt: now,
    used_in_appointment_id: appointmentId,
    usedInAppointmentId: appointmentId
  } : {
    used: true,
    used_at: now,
    usedAt: now,
    used_in_appointment_id: appointmentId,
    usedInAppointmentId: appointmentId
  };

  if (source === 'table') {
    await supabase.from('vouchers').update(updateFields).eq('id', voucher.id);
  } else if (source === 'settings') {
    const list = allVouchers || [];
    const idx = list.findIndex(v => v.id === voucher.id || (v.code && v.code.toUpperCase() === (voucher.code || '').toUpperCase()));
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...updateFields
      };
      await supabase.from('settings').upsert({
        id: 'vouchers',
        special_days: { list }
      });
    }
  }
}

/**
 * Revierte el uso de un bono o cheque cuando una cita se cancela:
 * - Bono de sesiones: Suma 1 a remaining_sessions (hasta el total) y reactiva used: false.
 * - Cheque regalo: Marca used: false y limpia used_at.
 */
export async function revertVoucherUsage(appointment) {
  if (!appointment) return false;
  const aptId = appointment.id;
  const notes = appointment.notes || '';
  const supabase = getSupabaseAdmin();

  // 1. Extraer código del bono/cheque desde las notas
  let codeMatch = notes.match(/\[(?:Bono|Cheque)\s+([A-Z0-9\-_]+)/i);
  let vCode = codeMatch ? codeMatch[1].trim() : null;

  if (!vCode) {
    const genericMatch = notes.match(/\b(BONO-[A-Z0-9\-_]+|CHEQUE-[A-Z0-9\-_]+)\b/i);
    if (genericMatch) vCode = genericMatch[1].trim();
  }

  // 2. Buscar el voucher por código
  let voucherInfo = null;
  if (vCode) {
    voucherInfo = await findVoucherByCode(vCode);
  }

  // 3. Si no se encontró por código, intentar buscar por used_in_appointment_id
  if (!voucherInfo && aptId) {
    try {
      const { data: setRow } = await supabase.from('settings').select('*').eq('id', 'vouchers').maybeSingle();
      const list = setRow?.special_days?.list || setRow?.specialDays?.list || [];
      const found = list.find(v => v.used_in_appointment_id === aptId || v.usedInAppointmentId === aptId);
      if (found) {
        voucherInfo = { source: 'settings', voucher: normalizeVoucher(found), allVouchers: list };
      }
    } catch (e) {
      console.error('Error buscando voucher por appointmentId:', e);
    }
  }

  if (!voucherInfo || !voucherInfo.voucher) {
    return false;
  }

  const { source, voucher, allVouchers } = voucherInfo;
  const isBono = voucher.type === 'bono';
  const tot = Number(voucher.total_sessions || 1);
  const currentRem = Number(voucher.remaining_sessions || 0);

  const updateFields = isBono ? {
    remaining_sessions: Math.min(tot, currentRem + 1),
    remainingSessions: Math.min(tot, currentRem + 1),
    total_sessions: tot,
    totalSessions: tot,
    used: false,
    used_at: null,
    usedAt: null,
    last_session_reverted_at: new Date().toISOString(),
    lastSessionRevertedAt: new Date().toISOString()
  } : {
    used: false,
    used_at: null,
    usedAt: null,
    used_in_appointment_id: null,
    usedInAppointmentId: null
  };

  if (source === 'table') {
    await supabase.from('vouchers').update(updateFields).eq('id', voucher.id);
  } else if (source === 'settings') {
    const list = allVouchers || [];
    const idx = list.findIndex(v => v.id === voucher.id || (v.code && v.code.toUpperCase() === (voucher.code || '').toUpperCase()));
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...updateFields
      };
      await supabase.from('settings').upsert({
        id: 'vouchers',
        special_days: { list }
      });
    }
  }

  console.log(`[revertVoucherUsage] Reverted voucher ${voucher.code} for appointment ${aptId}. New remaining: ${updateFields.remaining_sessions ?? 'reactivated'}`);
  return true;
}


/**
 * Busca todos los bonos o cheques de un cliente según su número de teléfono
 */
export async function findVouchersByClientPhone(phone) {
  if (!phone) return [];
  const clean = String(phone).replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.]/g, '').replace(/^\+?34/, '').slice(-9);
  if (!clean || clean.length < 6) return [];

  const supabase = getSupabaseAdmin();
  const results = [];

  // 1. Buscar en la tabla public.vouchers
  try {
    const { data, error } = await supabase.from('vouchers').select('*');
    if (!error && Array.isArray(data)) {
      data.forEach(item => {
        const itemPhone = (item.client_phone || item.clientPhone || '').replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.]/g, '').replace(/^\+?34/, '').slice(-9);
        if (itemPhone && (itemPhone === clean || itemPhone.includes(clean) || clean.includes(itemPhone))) {
          results.push(normalizeVoucher(item));
        }
      });
    }
  } catch (e) {
    console.error('Error buscando vouchers por teléfono en tabla:', e);
  }

  // 2. Buscar en settings (id = vouchers) por fallback
  try {
    const { data: setRow } = await supabase.from('settings').select('*').eq('id', 'vouchers').maybeSingle();
    const list = setRow?.special_days?.list || setRow?.specialDays?.list || [];
    list.forEach(item => {
      const itemPhone = (item.client_phone || item.clientPhone || '').replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.]/g, '').replace(/^\+?34/, '').slice(-9);
      if (itemPhone && (itemPhone === clean || itemPhone.includes(clean) || clean.includes(itemPhone))) {
        if (!results.some(r => (r.code && r.code.toUpperCase() === (item.code || '').toUpperCase()) || (r.id && r.id === item.id))) {
          results.push(normalizeVoucher(item));
        }
      }
    });
  } catch (e) {
    console.error('Error buscando vouchers por teléfono en settings fallback:', e);
  }

  // Ordenar: primero los activos, y más recientes arriba
  results.sort((a, b) => {
    const aActive = !a.used && (!a.expires_at || a.expires_at >= new Date().toISOString().split('T')[0]);
    const bActive = !b.used && (!b.expires_at || b.expires_at >= new Date().toISOString().split('T')[0]);
    if (aActive && !bActive) return -1;
    if (!aActive && bActive) return 1;
    return (b.created_at || b.createdAt || '').localeCompare(a.created_at || a.createdAt || '');
  });

  return results;
}
