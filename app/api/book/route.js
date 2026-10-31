import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

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

const t2m = (t) => { const p = (t || '0:00').split(':').map(Number); return p[0] * 60 + (p[1] || 0); };

function empNamesInApt(a) {
  const names = new Set();
  if (a.employee) {
    a.employee.split(',').forEach(n => { const t = n.trim(); if (t) names.add(t.toLowerCase()); });
  }
  if (a.services && Array.isArray(a.services)) {
    a.services.forEach(s => { const t = (s.employee || '').trim(); if (t) names.add(t.toLowerCase()); });
  }
  return names;
}

const GENERIC = new Set(['todas', 'cualquiera', 'ambos', 'automático', 'automatico']);

function isGeneric(name) {
  return !name || GENERIC.has(name.toLowerCase());
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { clientName, clientPhone, clientEmail, notes, date, time } = body;

    if (!clientName || !clientPhone || !date || !time) {
      return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
    }

    const cleanPhone = (v) => (v || '')
      .replace(/[\u200E\u200F\u200B\u200C\u200D\u202A-\u202E\uFEFF]/g, '')
      .replace(/^\+34/,'')
      .replace(/[\s\-\(\)\.]/g,'')
      .replace(/^34(?=\d{9})/,'');
    const sanitizedPhone = cleanPhone(clientPhone);

    let services = body.services;
    let service = body.service;
    let duration = body.duration || 30;
    let price = body.price || 0;

    if (!services || !Array.isArray(services) || services.length === 0) {
      if (!service) {
        return NextResponse.json({ success: false, error: 'Falta servicio' }, { status: 400 });
      }
      services = [{ name: service, employee: body.employee || '', duration, price }];
    }

    const supabase = getSupabaseAdmin();

    // Validar que el día no esté cerrado
    const { data: rawSettings } = await supabase.from('settings').select('*').limit(1).maybeSingle();
    const settingsData = {
      ...(rawSettings || {}),
      specialDays: rawSettings?.special_days || rawSettings?.specialDays || {},
      weekly: rawSettings?.weekly || {}
    };
    if (settingsData.weekly && typeof settingsData.weekly === 'object') {
      for (const k in settingsData.weekly) {
        if (k.startsWith('weekly_') || k.startsWith('weekly__')) {
          const normKey = 'weekly_' + k.replace(/^weekly_+/, '');
          settingsData[normKey] = settingsData.weekly[k];
        }
      }
    }

    if (rawSettings) {
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dObj.getDay();
      const special = settingsData.specialDays?.[date];
      if (special?.global?.type === 'closed') {
        return NextResponse.json({ success: false, error: 'El establecimiento está cerrado en la fecha seleccionada.' }, { status: 400 });
      }
      if (!special?.global && settingsData.weekly?.[dayOfWeek]?.closed) {
        return NextResponse.json({ success: false, error: 'El establecimiento está cerrado los domingos / días festivos.' }, { status: 400 });
      }

      // Validar horario de apertura y cierre según el horario configurado para el día
      const gWeekly = settingsData.weekly?.[dayOfWeek];
      const salonDayType = special?.global?.type || gWeekly?.type || 'complete';
      const salonStart = special?.global?.start || gWeekly?.start || settingsData.start || '10:00';
      const salonEnd = special?.global?.end || (gWeekly?.type === 'split' ? gWeekly?.end2 : gWeekly?.end) || settingsData.end || (dayOfWeek === 6 ? '14:00' : '20:00');
      const reqTimeMin = t2m(time);

      if (salonDayType === 'split') {
        const sEnd1Min = t2m(special?.global?.end || gWeekly?.end || '14:00');
        const sStart2Min = t2m(special?.global?.start2 || gWeekly?.start2 || '16:00');
        const inMorning = (reqTimeMin >= t2m(salonStart) && reqTimeMin < sEnd1Min);
        const inAfternoon = (reqTimeMin >= sStart2Min && reqTimeMin < t2m(salonEnd));
        if (!inMorning && !inAfternoon) {
          return NextResponse.json({ success: false, error: 'La hora seleccionada está fuera del horario de atención del salón.' }, { status: 400 });
        }
      } else {
        if (reqTimeMin < t2m(salonStart) || reqTimeMin >= t2m(salonEnd)) {
          return NextResponse.json({ success: false, error: 'La hora seleccionada está fuera del horario de atención del salón.' }, { status: 400 });
        }
      }
    }

    const { data: employeesData } = await supabase.from('employees').select('*');
    const realEmps = (employeesData || []).map(e => e.name).filter(Boolean);
    const firstEmp = realEmps.length > 0 ? realEmps[0] : '';

    const [aptsRes, blocksRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('date', date),
      supabase.from('blocks').select('*')
    ]);
    const existingApts = aptsRes.data || [];
    const allBlocks = blocksRes.data || [];

    const reqDateObj = new Date(date + 'T12:00:00');
    const reqWeekday = reqDateObj.getDay();

    const activeBlocks = allBlocks.filter(b => {
      if (b.recurrenceEnd && b.recurrenceEnd < date) return false;
      if (b.recurrence === 'none') return b.date === date;
      if (b.recurrence === 'daily') return true;
      if (b.recurrence === 'weekly' || b.recurrence === 'biweekly') return b.weekday === reqWeekday;
      return false;
    });

    const isEmpFreeAt = (empName, start, end) => {
      const empLower = empName.toLowerCase();
      const empObj = (employeesData || []).find(e => e.name.toLowerCase() === empLower);
      const empId = empObj ? empObj.id : null;
      const sd = settingsData?.specialDays?.[date] || {};
      const empOverride = (empId && sd[empId]) || sd[empName];
      if (empOverride && empOverride.type === 'closed') return false;

      // Verificar horario semanal de la empleada
      const dObj = new Date(date + 'T12:00:00');
      const dayOfWeek = dObj.getDay();
      const gWeekly = settingsData.weekly?.[dayOfWeek];
      const salonStart = gWeekly?.start || settingsData.start || '10:00';
      const salonEnd = (gWeekly?.type === 'split' ? gWeekly?.end2 : gWeekly?.end) || settingsData.end || (dayOfWeek === 6 ? '14:00' : '20:00');
      
      const empWeekly = settingsData['weekly_' + empName] || settingsData.weekly?.['weekly_' + empName];
      if (empWeekly && empWeekly[dayOfWeek]) {
        const ew = empWeekly[dayOfWeek];
        if (ew.closed) return false;
        if (ew.type === 'split') {
          const s1 = t2m(ew.start) > t2m(salonStart) ? t2m(ew.start) : t2m(salonStart);
          const e1 = t2m(ew.end) < t2m(salonEnd) ? t2m(ew.end) : t2m(salonEnd);
          const s2 = t2m(ew.start2) > t2m(salonStart) ? t2m(ew.start2) : t2m(salonStart);
          const e2 = t2m(ew.end2) < t2m(salonEnd) ? t2m(ew.end2) : t2m(salonEnd);
          const inS1 = (start >= s1 && end <= e1);
          const inS2 = (start >= s2 && end <= e2);
          if (!inS1 && !inS2) return false;
        } else {
          const s = t2m(ew.start) > t2m(salonStart) ? t2m(ew.start) : t2m(salonStart);
          const e = t2m(ew.end) < t2m(salonEnd) ? t2m(ew.end) : t2m(salonEnd);
          if (start < s || end > e) return false;
        }
      }

      const conflictApt = (existingApts || []).some(a => {
        if (!a || a.status === 'cancelled') return false;
        const aEmpNames = empNamesInApt(a);
        const aS = t2m(a.time);
        const aE = aS + (a.duration || 15);
        if (start >= aE || end <= aS) return false;
        return aEmpNames.has(empLower) || [...aEmpNames].some(n => isGeneric(n));
      });
      if (conflictApt) return false;

      const conflictBlock = activeBlocks.some(b => {
        if (b.employee && b.employee !== 'all' && b.employee.toLowerCase() !== empLower) return false;
        const bS = t2m(b.startTime);
        const bE = t2m(b.endTime);
        return start < bE && end > bS;
      });
      if (conflictBlock) return false;

      return true;
    };

    const tStart = t2m(time);

    const { data: dbServices } = await supabase.from('services').select('*');
    const allDbServices = dbServices || [];

    services.forEach(s => {
      const dbSvc = allDbServices.find(ds => ds.name.toLowerCase() === (s.name || '').toLowerCase());
      const catalogEmpStr = dbSvc ? (dbSvc.employee || '').trim() : '';
      const reqEmpStr = (s.employee || '').trim();

      let candidates = realEmps;
      const targetStr = (reqEmpStr && !isGeneric(reqEmpStr)) ? reqEmpStr : catalogEmpStr;
      if (targetStr && !isGeneric(targetStr)) {
        if (targetStr.includes(',')) {
          const allowed = targetStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
          candidates = realEmps.filter(e => allowed.includes(e.toLowerCase()));
        } else {
          candidates = realEmps.filter(e => e.toLowerCase() === targetStr.toLowerCase());
        }
      }

      if (candidates.length === 0) candidates = realEmps;

      const freeCandidate = candidates.find(c => isEmpFreeAt(c, tStart, tStart + (s.duration || 15)));
      s.employee = freeCandidate || candidates[0] || firstEmp;
    });

    const uniqueEmps = [...new Set(services.map(s => s.employee).filter(Boolean))];
    const employee = uniqueEmps.join(', ');

    if (uniqueEmps.length > 1) {
      const durByEmp = {};
      services.forEach(s => {
        const e = s.employee || '';
        durByEmp[e] = (durByEmp[e] || 0) + (s.duration || 0);
      });
      duration = Math.max(...Object.values(durByEmp));
    } else {
      duration = services.reduce((sum, s) => sum + (s.duration || 0), 0);
    }

    price = services.reduce((sum, s) => sum + (s.price || 0), 0);

    const tEnd = tStart + duration;

    // Verificar colisiones con citas existentes
    for (const a of (existingApts || [])) {
      if (!a || a.status === 'cancelled') continue;

      const aEmpNames = empNamesInApt(a);
      const aS = t2m(a.time);
      const aE = aS + (a.duration || 15);

      if (tStart >= aE || tEnd <= aS) continue;

      const aHasGeneric = [...aEmpNames].some(n => isGeneric(n));
      const clash = aHasGeneric || uniqueEmps.some(en => aEmpNames.has(en.toLowerCase()));

      if (clash) {
        return NextResponse.json({
          success: false,
          error: `Ya existe una cita en ese horario para ${employee}. Por favor, elige otra hora.`
        }, { status: 409 });
      }
    }

    // Verificar colisiones con bloqueos
    for (const b of activeBlocks) {
      if (b.employee && b.employee !== 'all' && !uniqueEmps.some(en => en.toLowerCase() === b.employee.toLowerCase())) continue;
      const bS = t2m(b.startTime);
      const bE = t2m(b.endTime);
      if (tStart < bE && tEnd > bS) {
        return NextResponse.json({
          success: false,
          error: `Ese horario está bloqueado en la agenda (${b.reason || 'No disponible'}). Por favor, elige otra hora.`
        }, { status: 409 });
      }
    }

    const data = {
      clientName,
      clientPhone: sanitizedPhone,
      clientEmail: clientEmail || '',
      notes: notes || '',
      services,
      service: services.map(s => s.name).join(' + '),
      employee,
      date,
      time,
      duration,
      price,
      status: 'confirmed',
      isPaid: false,
      source: 'cliente',
      type: 'web'
    };

    const { data: newApt, error: insertError } = await supabase.from('appointments')
      .insert(data)
      .select()
      .single();

    if (insertError) throw insertError;

    // Notify n8n webhook about the new booking
    await notifyWebhook('new', {
      appointment: newApt,
      ...newApt,
      clientEmail: newApt.clientEmail || newApt.client_email || clientEmail,
      client_email: newApt.client_email || newApt.clientEmail || clientEmail,
      clientName: newApt.clientName || newApt.client_name || clientName,
      client_name: newApt.client_name || newApt.clientName || clientName,
      clientPhone: newApt.clientPhone || newApt.client_phone || sanitizedPhone,
      client_phone: newApt.client_phone || newApt.clientPhone || sanitizedPhone,
      source: 'web_booking'
    });


    return NextResponse.json({ success: true, id: newApt.id });
  } catch (error) {
    console.error('Error in booking API:', error);
    return NextResponse.json({ success: false, error: error.message || JSON.stringify(error) }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Falta el ID de la reserva' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('appointments').select('*').eq('id', id).single();

    if (error || !data) {
      return NextResponse.json({ error: 'Reserva no encontrada' }, { status: 404 });
    }

    const now = new Date();
    const aptDateTime = new Date(`${data.date}T${data.time}:00`);
    const threeHoursInMs = 3 * 60 * 60 * 1000;

    if (aptDateTime.getTime() - now.getTime() < threeHoursInMs) {
      return NextResponse.json({ 
        error: 'Las cancelaciones online deben hacerse con al menos 3 horas de antelación. Por favor, llame al estudio.' 
      }, { status: 400 });
    }

    const { error: updateError } = await supabase.from('appointments').update({
      status: 'cancelled'
    }).eq('id', id);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, message: 'Reserva cancelada' });
  } catch (error) {
    console.error('Error cancelling reservation:', error);
    return NextResponse.json({ error: 'Error al cancelar la reserva' }, { status: 500 });
  }
}
