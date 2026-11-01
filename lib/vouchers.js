import { getSupabaseAdmin } from './supabase';

/**
 * Busca un bono por su código (ej: BONO-XXXXXX)
 * Soporta de manera transparente tanto la tabla nativa public.vouchers como el almacenamiento fallback en settings.
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
 * Valida las reglas de negocio de un bono:
 * - Que exista
 * - Que no haya sido canjeado (used !== true)
 * - Que no esté caducado
 * - Que el servicio (si tiene restricción) coincida
 */
export function validateVoucherRules(voucher, selectedServices = []) {
  if (!voucher) {
    return { valid: false, error: 'Código de bono no encontrado. Revisa si lo has escrito bien.' };
  }

  if (voucher.used) {
    return { valid: false, error: 'Este bono o cheque regalo ya ha sido canjeado previamente.' };
  }

  if (voucher.expires_at || voucher.expiresAt) {
    const expDateStr = voucher.expires_at || voucher.expiresAt;
    const expDate = new Date(expDateStr + 'T23:59:59');
    if (!isNaN(expDate.getTime()) && expDate < new Date()) {
      return { valid: false, error: `Este bono ha caducado el ${expDateStr.split('-').reverse().join('/')}.` };
    }
  }

  const reqSvc = (voucher.service_name || voucher.serviceName || '').trim().toLowerCase();
  if (reqSvc && reqSvc !== 'cualquiera' && selectedServices && selectedServices.length > 0) {
    const matches = selectedServices.some(s => {
      const sName = (typeof s === 'string' ? s : (s.name || '')).toLowerCase();
      return sName === reqSvc || sName.includes(reqSvc) || reqSvc.includes(sName);
    });
    if (!matches) {
      return { 
        valid: false, 
        error: `Este bono es válido únicamente para el servicio: "${voucher.service_name || voucher.serviceName}".` 
      };
    }
  }

  return { valid: true };
}

/**
 * Marca el bono como utilizado
 */
export async function markVoucherUsed(voucherInfo, appointmentId) {
  const { source, voucher, allVouchers } = voucherInfo;
  const supabase = getSupabaseAdmin();
  const now = new Date().toISOString();

  if (source === 'table') {
    await supabase.from('vouchers').update({
      used: true,
      used_at: now,
      used_in_appointment_id: appointmentId
    }).eq('id', voucher.id);
  } else if (source === 'settings') {
    const list = allVouchers || [];
    const idx = list.findIndex(v => v.id === voucher.id || (v.code && v.code.toUpperCase() === (voucher.code || '').toUpperCase()));
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        used: true,
        used_at: now,
        usedAt: now,
        used_in_appointment_id: appointmentId
      };
      await supabase.from('settings').upsert({
        id: 'vouchers',
        special_days: { list }
      });
    }
  }
}
