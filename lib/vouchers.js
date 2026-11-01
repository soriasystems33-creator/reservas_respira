import { getSupabaseAdmin } from './supabase';

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
      return { source: 'table', voucher: data };
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
      return { source: 'settings', voucher: found, allVouchers: list };
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
export function validateVoucherRules(voucher, selectedServices = []) {
  if (!voucher) {
    return { valid: false, error: 'Código no encontrado. Revisa si lo has escrito bien.' };
  }

  const isBono = (voucher.type === 'bono') || (voucher.total_sessions !== undefined && Number(voucher.total_sessions) > 0);

  // 1. Validar si está agotado
  if (isBono) {
    const total = Number(voucher.total_sessions || 1);
    const rem = voucher.remaining_sessions !== undefined ? Number(voucher.remaining_sessions) : (voucher.used ? 0 : total);
    if (rem <= 0 || voucher.used) {
      return { valid: false, error: 'Este Bono ya ha agotado todas sus sesiones disponibles.' };
    }
  } else {
    if (voucher.used) {
      return { valid: false, error: 'Este Cheque Regalo ya ha sido canjeado previamente.' };
    }
  }

  // 2. Validar fecha de caducidad
  if (voucher.expires_at || voucher.expiresAt) {
    const expDateStr = voucher.expires_at || voucher.expiresAt;
    const expDate = new Date(expDateStr + 'T23:59:59');
    if (!isNaN(expDate.getTime()) && expDate < new Date()) {
      return { valid: false, error: `Este ${isBono ? 'Bono' : 'Cheque'} ha caducado el ${expDateStr.split('-').reverse().join('/')}.` };
    }
  }

  // 3. Validar restricción de servicio
  const reqSvc = (voucher.service_name || voucher.serviceName || '').trim().toLowerCase();
  if (reqSvc && reqSvc !== 'cualquiera' && selectedServices && selectedServices.length > 0) {
    const matches = selectedServices.some(s => {
      const sName = (typeof s === 'string' ? s : (s.name || '')).toLowerCase();
      return sName === reqSvc || sName.includes(reqSvc) || reqSvc.includes(sName);
    });
    if (!matches) {
      return { 
        valid: false, 
        error: `Este ${isBono ? 'Bono' : 'Cheque'} es válido únicamente para el tratamiento: "${voucher.service_name || voucher.serviceName}".` 
      };
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
  const { source, voucher, allVouchers } = voucherInfo;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  const isBono = (voucher.type === 'bono') || (voucher.total_sessions !== undefined && Number(voucher.total_sessions) > 0);
  let newRem = 0;
  let isFinished = true;

  if (isBono) {
    const currentRem = voucher.remaining_sessions !== undefined ? Number(voucher.remaining_sessions) : Number(voucher.total_sessions || 1);
    newRem = Math.max(0, currentRem - 1);
    isFinished = newRem <= 0;
  }

  const updateFields = isBono ? {
    remaining_sessions: newRem,
    used: isFinished,
    used_at: isFinished ? now : (voucher.used_at || null),
    usedAt: isFinished ? now : (voucher.usedAt || null),
    last_session_used_at: now,
    used_in_appointment_id: appointmentId
  } : {
    used: true,
    used_at: now,
    usedAt: now,
    used_in_appointment_id: appointmentId
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
