import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const WEBHOOK_URL = process.env.N8N_WEBHOOK_URL || ''; // vacío = sin webhook

async function notifyWebhook(event, data) {
  if (!WEBHOOK_URL) return;
  try {
    await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, ...data, timestamp: new Date().toISOString() })
    });
  } catch (e) {
    console.error('Webhook error:', e);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('appointments').select('*').eq('id', id).single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: data.id,
        service: data.service,
        date: data.date,
        time: data.time,
        clientName: data.clientName,
        status: data.status
      }
    });
  } catch (error) {
    console.error('Error fetching appointment:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return NextResponse.json({ success: false, error: 'Missing ID parameter' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('appointments').select('*').eq('id', id).single();

    if (error || !data) {
      return NextResponse.json({ success: false, error: 'Appointment not found' }, { status: 404 });
    }

    if (data.status === 'cancelled') {
      return NextResponse.json({ success: true, message: 'Already cancelled' });
    }

    const { error: updateError } = await supabase.from('appointments').update({
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'client_link'
    }).eq('id', id);

    if (updateError) throw updateError;

    // Notify n8n webhook about the cancellation
    await notifyWebhook('cancellation', {
      event: 'cancellation',
      appointment: data,
      ...data,
      clientEmail: data.clientEmail || data.client_email,
      client_email: data.client_email || data.clientEmail,
      clientName: data.clientName || data.client_name,
      client_name: data.client_name || data.clientName,
      cancelledBy: 'client_link'
    });


    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error cancelling appointment:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
