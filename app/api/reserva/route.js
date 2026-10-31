import { getSupabaseAdmin } from '@/lib/supabase';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('appointments').select('*').eq('id', id).maybeSingle();

    if (error) {
      console.error('Database error in reserva API:', error);
      return NextResponse.json({ success: false, error: 'Error al consultar la base de datos' }, { status: 500 });
    }
    if (!data) {
      return NextResponse.json({ success: false, error: 'Reserva no encontrada en el sistema.' }, { status: 404 });
    }

    return NextResponse.json({ success: true, ...data, id: data.id });
  } catch (error) {
    console.error('Error fetching reservation:', error);
    return NextResponse.json({ success: false, error: 'Error al obtener la reserva' }, { status: 500 });
  }
}
