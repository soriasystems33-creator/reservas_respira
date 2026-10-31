import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id') || '';

    if (!id) {
      return NextResponse.json({ 
        success: false, 
        error: 'Para proteger tu privacidad, el acceso a tus citas requiere el enlace seguro enviado por WhatsApp o correo electrónico.' 
      }, { status: 400 });
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
      appointments: filtered 
    });
  } catch (error) {
    console.error('Error in mis-citas API:', error);
    return NextResponse.json({ success: false, error: 'Error del servidor' }, { status: 500 });
  }
}
