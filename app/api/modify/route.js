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
  console.log('[modify] START', { 
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    nodeEnv: process.env.NODE_ENV
  });
  try {
    console.log('[modify] 1. Parsing body');
    const body = await request.json();
    const { oldId, newDate, newTime } = body;
    console.log('[modify] 2. Body parsed', { oldId, newDate, newTime });

    if (!oldId || !newDate || !newTime) {
      return NextResponse.json({ success: false, error: 'Faltan datos obligatorios' }, { status: 400 });
    }

    console.log('[modify] 3. Getting supabase admin');
    const supabase = getSupabaseAdmin();
    
    console.log('[modify] 4. Fetching old appointment');
    const { data: oldData, error: oldError } = await supabase.from('appointments').select('*').eq('id', oldId).single();
    console.log('[modify] 4b. Old appointment result', { hasData: !!oldData, error: oldError?.message });

    if (oldError || !oldData) {
      return NextResponse.json({ success: false, error: 'Reserva original no encontrada' }, { status: 404 });
    }

    if (oldData.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'La cita original ya está cancelada' }, { status: 400 });
    }

    // Validar que el nuevo día no esté cerrado
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
      const dObj = new Date(newDate + 'T12:00:00');
      const dayOfWeek = dObj.getDay();
      const special = settingsData.specialDays?.[newDate];
      if (special?.global?.type === 'closed') {
        return NextResponse.json({ success: false, error: 'El establecimiento está cerrado en la fecha seleccionada.' }, { status: 400 });
      }
      if (!special?.global && settingsData.weekly?.[dayOfWeek]?.closed) {
        return NextResponse.json({ success: false, error: 'El establecimiento está cerrado los domingos / días no laborables.' }, { status: 400 });
      }

      // Validar horario de apertura y cierre según el horario configurado para el día
      const gWeekly = settingsData.weekly?.[dayOfWeek];
      const salonDayType = special?.global?.type || gWeekly?.type || 'complete';
      const salonStart = special?.global?.start || gWeekly?.start || settingsData.start || '10:00';
      const salonEnd = special?.global?.end || (gWeekly?.type === 'split' ? gWeekly?.end2 : gWeekly?.end) || settingsData.end || (dayOfWeek === 6 ? '14:00' : '20:00');
      const reqTimeMin = t2m(newTime);

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

    console.log('[modify] 5. Fetching employees');
    const { data: employeesData } = await supabase.from('employees').select('*');
    const realEmps = (employeesData || []).map(e => e.name).filter(Boolean);
    const firstEmp = realEmps.length > 0 ? realEmps[0] : '';

    const dur = oldData.duration || 15;
    const tStart = t2m(newTime);
    const tEnd = tStart + dur;

    console.log('[modify] 6. Checking conflicts');
    const [aptsRes, blocksRes] = await Promise.all([
      supabase.from('appointments').select('*').eq('date', newDate).eq('status', 'confirmed'),
      supabase.from('blocks').select('*')
    ]);
    const existingApts = aptsRes.data || [];
    const allBlocks = blocksRes.data || [];

    const reqDateObj = new Date(newDate + 'T12:00:00');
    const reqWeekday = reqDateObj.getDay();

    const activeBlocks = allBlocks.filter(b => {
      if (b.recurrenceEnd && b.recurrenceEnd < newDate) return false;
      if (b.recurrence === 'none') return b.date === newDate;
      if (b.recurrence === 'daily') return true;
      if (b.recurrence === 'weekly' || b.recurrence === 'biweekly') return b.weekday === reqWeekday;
      return false;
    });

    const isEmpFreeAt = (empName, start, end) => {
      const empLower = empName.toLowerCase();
      const empObj = (employeesData || []).find(e => e.name.toLowerCase() === empLower);
      const empId = empObj ? empObj.id : null;
      const sd = settingsData?.specialDays?.[newDate] || {};
      const empOverride = (empId && sd[empId]) || sd[empName];
      if (empOverride && empOverride.type === 'closed') return false;

      // Verificar horario semanal de la empleada
      const dObj = new Date(newDate + 'T12:00:00');
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
        if (!a || a.id === oldId || a.status === 'cancelled') return false;
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

    const { data: dbServices } = await supabase.from('services').select('*');
    const allDbServices = dbServices || [];

    const dbSvc = allDbServices.find(ds => ds.name.toLowerCase() === (oldData.service || '').toLowerCase());
    const catalogEmpStr = dbSvc ? (dbSvc.employee || '').trim() : '';
    let employee = oldData.employee || '';
    let candidates = realEmps;
    const targetStr = (employee && !isGeneric(employee)) ? employee : catalogEmpStr;
    if (targetStr && !isGeneric(targetStr)) {
      if (targetStr.includes(',')) {
        const allowed = targetStr.split(',').map(e => e.trim().toLowerCase()).filter(Boolean);
        candidates = realEmps.filter(e => allowed.includes(e.toLowerCase()));
      } else {
        candidates = realEmps.filter(e => e.toLowerCase() === targetStr.toLowerCase());
      }
    }
    if (candidates.length === 0) candidates = realEmps;
    const freeCandidate = candidates.find(c => isEmpFreeAt(c, tStart, tEnd));
    employee = freeCandidate || candidates[0] || firstEmp;

    const oldServices = (oldData.services || [{ name: oldData.service, employee, duration: dur, price: oldData.price || 0 }]).map(s => ({
      ...s,
      employee: employee
    }));
    const uniqueEmps = [employee];

    for (const a of (existingApts || [])) {
      if (a.id === oldId) continue;
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

    console.log('[modify] 7. Creating new appointment');
    const newData = {
      clientName: oldData.clientName,
      clientPhone: oldData.clientPhone,
      clientEmail: oldData.clientEmail || '',
      notes: oldData.notes || '',
      services: oldServices,
      service: oldData.service,
      employee,
      duration: dur,
      price: oldData.price || 0,
      date: newDate,
      time: newTime,
      status: 'confirmed',
      isPaid: false,
      source: 'cliente',
      type: 'web',
      modifiedFrom: oldId
    };

    console.log('[modify] 8. Inserting new appointment');
    const { data: newApt, error: insertError } = await supabase.from('appointments')
      .insert(newData)
      .select()
      .single();
    console.log('[modify] 8b. Insert result', { hasData: !!newApt, error: insertError?.message });

    if (insertError) throw insertError;

    console.log('[modify] 9. Updating old appointment');
    const { error: updateError } = await supabase.from('appointments').update({
      status: 'cancelled',
      modifiedTo: newApt.id,
      cancelledAt: new Date().toISOString(),
      cancelledBy: 'modification'
    }).eq('id', oldId);
    console.log('[modify] 9b. Update result', { error: updateError?.message });

    if (updateError) throw updateError;

    console.log('[modify] 10. Notifying webhook');
    await notifyWebhook('modification', {
      event: 'modification',
      appointment: newApt,
      newAppointment: newApt,
      oldAppointment: oldData,
      clientName: newApt.clientName || newApt.client_name || oldData.clientName,
      client_name: newApt.client_name || newApt.clientName || oldData.clientName,
      modifiedBy: 'client_link'
    });


    console.log('[modify] 11. Success');
    return NextResponse.json({ success: true, newId: newApt.id });
  } catch (error) {
    console.error('[modify] ERROR', { message: error.message, code: error.code, stack: error.stack });
    return NextResponse.json({ success: false, error: 'Error interno del servidor' }, { status: 500 });
  }
}
