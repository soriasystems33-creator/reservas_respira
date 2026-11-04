import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { checkLink, signLink, verifyClient, normPhone } from '@/lib/linkToken';
import { findVoucherByCode, findVouchersByClientPhone } from '@/lib/vouchers';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const c = searchParams.get('c') || '';
    const code = (searchParams.get('code') || searchParams.get('voucher') || searchParams.get('bono') || '').trim().toUpperCase();

    // 1. Acceso por código de bono / cheque (?code=BONO-XXXXXX)
    if (code) {
      const vInfo = await findVoucherByCode(code);
      if (!vInfo || !vInfo.voucher) {
        return NextResponse.json({ success: false, error: 'El código de bono o cheque no existe o es incorrecto.' }, { status: 404 });
      }
      const v = vInfo.voucher;
      const phone = normPhone(v.client_phone || v.clientPhone);
      const sb = getSupabaseAdmin();
      const { data: all } = await sb.from('appointments').select('*');
      const mine = (all || []).filter(a => phone && normPhone(a.clientPhone || a.client_phone) === phone)
        .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));

      let matchedVouchers = [];
      if (phone) {
        matchedVouchers = await findVouchersByClientPhone(phone);
      }
      if (!matchedVouchers.some(item => (item.code && item.code.toUpperCase() === v.code.toUpperCase()) || item.id === v.id)) {
        matchedVouchers.unshift(v);
      }

      return NextResponse.json({
        success: true,
        clientName: v.client_name || v.clientName || 'Cliente',
        vouchers: matchedVouchers,
        appointments: mine.map(a => ({ id: a.id, date: a.date, time: a.time, duration: a.duration, service: a.service, services: a.services, employee: a.employee, price: a.price, status: a.status, token: signLink(a.id) }))
      });
    }

    // 2. Enlace personal de la clienta: ?c=<código>&tc=<firma>
    if (c) {
      const phone = verifyClient(c, searchParams.get('tc'));
      if (!phone) {
        return NextResponse.json({ success: false, error: 'El enlace no es válido. Usa el enlace que te enviamos por WhatsApp o email.' }, { status: 403 });
      }
      const sb = getSupabaseAdmin();
      const { data: all, error: e1 } = await sb.from('appointments').select('*');
      if (e1) return NextResponse.json({ success: false, error: 'Error al consultar la base de datos' }, { status: 500 });
      const mine = (all || []).filter(a => normPhone(a.clientPhone || a.client_phone) === phone)
        .sort((a, b) => `${b.date || ''} ${b.time || ''}`.localeCompare(`${a.date || ''} ${a.time || ''}`));

      const matchedVouchers = await findVouchersByClientPhone(phone);

      return NextResponse.json({
        success: true,
        clientName: (mine[0] && (mine[0].clientName || mine[0].client_name)) || 'Cliente',
        vouchers: matchedVouchers,
        appointments: mine.map(a => ({ id: a.id, date: a.date, time: a.time, duration: a.duration, service: a.service, services: a.services, employee: a.employee, price: a.price, status: a.status, token: signLink(a.id) }))
      });
    }

    // 3. Enlace privado de cita individual: ?id=...&t=...
    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Para proteger tu privacidad, el acceso a tus citas requiere el enlace seguro enviado por WhatsApp o correo electrónico.' 
      }, { status: 400 });
    }

    if (checkLink(id, searchParams.get('t'))) {
      return NextResponse.json({ success: false, error: 'El enlace no es válido. Usa el enlace que te enviamos por WhatsApp o email.' }, { status: 403 });
    }

    const supabase = getSupabaseAdmin();
    const { data: allAppointments, error } = await supabase.from('appointments').select('*');

    if (error) {
      console.error('Error fetching mis-citas:', error);
      return NextResponse.json({ success: false, error: 'Error al consultar la base de datos' }, { status: 500 });
    }

    const baseApt = (allAppointments || []).find(a => String(a.id) === String(id) || String(a._id) === String(id));
    if (!baseApt) {
      return NextResponse.json({ 
        success: false, 
        error: 'El enlace de reserva ha caducado o no es válido.' 
      }, { status: 404 });
    }

    const clientPhone = normPhone(baseApt.clientPhone || baseApt.client_phone);
    const clientEmail = (baseApt.clientEmail || baseApt.client_email || '').trim().toLowerCase();

    const filtered = (allAppointments || []).filter(a => {
      if (String(a.id) === String(id) || String(a._id) === String(id)) return true;

      const aptPhone = normPhone(a.clientPhone || a.client_phone);
      const aptEmail = (a.clientEmail || a.client_email || '').trim().toLowerCase();

      if (clientPhone && clientPhone.length >= 6 && aptPhone && (aptPhone.includes(clientPhone) || clientPhone.includes(aptPhone))) {
        return true;
      }
      if (clientEmail && clientEmail.includes('@') && aptEmail && aptEmail === clientEmail) {
        return true;
      }
      return false;
    });

    filtered.sort((a, b) => {
      const dtA = `${a.date || ''} ${a.time || ''}`;
      const dtB = `${b.date || ''} ${b.time || ''}`;
      return dtB.localeCompare(dtA);
    });

    const matchedVouchers = clientPhone ? await findVouchersByClientPhone(clientPhone) : [];

    return NextResponse.json({ 
      success: true, 
      clientName: baseApt.clientName || baseApt.client_name || 'Cliente',
      vouchers: matchedVouchers,
      appointments: filtered.map(a => ({ ...a, token: signLink(a.id) }))
    });
  } catch (error) {
    console.error('Error in mis-citas API:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
