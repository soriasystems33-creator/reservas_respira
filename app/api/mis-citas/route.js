import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';
import { checkLink, signLink, verifyClient, normPhone } from '@/lib/linkToken';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';
    const c = searchParams.get('c') || '';

    // Enlace personal de la clienta: ?c=<código>&tc=<firma>
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
      return NextResponse.json({
        success: true,
        clientName: (mine[0] && (mine[0].clientName || mine[0].client_name)) || 'Cliente',
        appointments: mine.map(a => ({ id: a.id, date: a.date, time: a.time, duration: a.duration, service: a.service, services: a.services, employee: a.employee, price: a.price, status: a.status, token: signLink(a.id) }))
      });
    }

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

    const clientPhone = (baseApt.clientPhone || baseApt.client_phone || '').replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.]/g, '').replace(/^\+?34/, '').slice(-9);
    const clientEmail = (baseApt.clientEmail || baseApt.client_email || '').trim().toLowerCase();

    const filtered = (allAppointments || []).filter(a => {
      if (String(a.id) === String(id) || String(a._id) === String(id)) return true;

      const aptPhone = (a.clientPhone || a.client_phone || '').replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF\s\-\(\)\.]/g, '').replace(/^\+?34/, '').slice(-9);
      const aptEmail = (a.clientEmail || a.client_email || '').trim().toLowerCase();

      if (clientPhone && clientPhone.length >= 6 && aptPhone && aptPhone.includes(clientPhone)) {
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

    return NextResponse.json({ 
      success: true, 
      clientName: baseApt.clientName || baseApt.client_name || 'Cliente',
      appointments: filtered.map(a => ({ ...a, token: signLink(a.id) }))
    });
  } catch (error) {
    console.error('Error in mis-citas API:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
