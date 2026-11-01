import { NextResponse } from 'next/server';
import { findVoucherByCode, validateVoucherRules } from '@/lib/vouchers';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const servicesParam = searchParams.get('services');

    if (!code) {
      return NextResponse.json({ success: false, error: 'Introduce el código del bono' }, { status: 400 });
    }

    const voucherInfo = await findVoucherByCode(code);
    if (!voucherInfo) {
      return NextResponse.json({ success: false, error: 'Bono no encontrado. Revisa si lo has escrito bien.' }, { status: 404 });
    }

    let selectedServices = [];
    if (servicesParam) {
      try {
        selectedServices = JSON.parse(servicesParam);
      } catch (e) {
        selectedServices = servicesParam.split(',').map(s => ({ name: s.trim() }));
      }
    }

    const { valid, error } = validateVoucherRules(voucherInfo.voucher, selectedServices);
    if (!valid) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    const v = voucherInfo.voucher;
    return NextResponse.json({
      success: true,
      voucher: {
        id: v.id,
        code: v.code,
        amount: parseFloat(v.amount) || 0,
        clientName: v.client_name || v.clientName || '',
        serviceName: v.service_name || v.serviceName || '',
        expiresAt: v.expires_at || v.expiresAt || null
      }
    });
  } catch (err) {
    console.error('Error validating voucher:', err);
    return NextResponse.json({ success: false, error: 'Error interno al validar el bono' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { code, services } = body;

    if (!code) {
      return NextResponse.json({ success: false, error: 'Introduce el código del bono' }, { status: 400 });
    }

    const voucherInfo = await findVoucherByCode(code);
    if (!voucherInfo) {
      return NextResponse.json({ success: false, error: 'Bono no encontrado. Revisa si lo has escrito bien.' }, { status: 404 });
    }

    const { valid, error } = validateVoucherRules(voucherInfo.voucher, services || []);
    if (!valid) {
      return NextResponse.json({ success: false, error }, { status: 400 });
    }

    const v = voucherInfo.voucher;
    return NextResponse.json({
      success: true,
      voucher: {
        id: v.id,
        code: v.code,
        amount: parseFloat(v.amount) || 0,
        clientName: v.client_name || v.clientName || '',
        serviceName: v.service_name || v.serviceName || '',
        expiresAt: v.expires_at || v.expiresAt || null
      }
    });
  } catch (err) {
    console.error('Error validating voucher (POST):', err);
    return NextResponse.json({ success: false, error: 'Error interno al validar el bono' }, { status: 500 });
  }
}
