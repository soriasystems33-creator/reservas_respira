export const t2m = (t) => {
  if (!t) return 0;
  const p = String(t).split(':').map(Number);
  return (p[0] || 0) * 60 + (p[1] || 0);
};

export const m2t = (m) => {
  return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
};

const GENERIC_NAMES = new Set(['todas', 'cualquiera', 'ambos', 'automático', 'automatico', 'all', 'global', 'todos', 'salon', 'centro', '']);

export function isGenericEmployee(name) {
  return !name || GENERIC_NAMES.has(String(name).trim().toLowerCase());
}

export function empNamesInApt(a) {
  const names = new Set();
  if (a.employee) {
    a.employee.split(',').forEach(n => {
      const t = n.trim();
      if (t) names.add(t.toLowerCase());
    });
  }
  if (a.services && Array.isArray(a.services)) {
    a.services.forEach(s => {
      const t = (s.employee || '').trim();
      if (t) names.add(t.toLowerCase());
    });
  }
  return names;
}

/**
 * Validates that a proposed booking or modification date and time slot:
 * 1. Is not globally closed (in settings.special_days or full-day center block)
 * 2. Is not on a closed weekly day (settings.weekly[dayOfWeek].closed)
 * 3. Does not overlap with center closed hours (closedHours in special_days or center block)
 * 4. Falls within salon opening hours
 * 5. Has at least one valid candidate employee available (not absent, not blocked, within their shift, not double-booked)
 */
export async function validateBookingSlot({
  supabase,
  date,
  time,
  duration = 15,
  services = [],
  excludeAptId = null
}) {
  if (!date || !time) {
    return { valid: false, error: 'Fecha y hora requeridas.' };
  }

  // 1. Fetch live settings (row id = 'main')
  const { data: rawSettings } = await supabase
    .from('settings')
    .select('*')
    .eq('id', 'main')
    .maybeSingle();

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

  const reqDateObj = new Date(date + 'T12:00:00');
  const dayOfWeek = reqDateObj.getDay();
  const startMin = t2m(time);
  const durMin = parseInt(duration || 15, 10);
  const endMin = startMin + durMin;

  const special = settingsData.specialDays?.[date] || {};

  // 2. Check Global Full-Day Closure
  const isGlobalClosed = !!(
    special.closed === true ||
    special.type === 'closed' ||
    special.global?.closed === true ||
    special.global?.type === 'closed'
  );

  if (isGlobalClosed) {
    const reason = special.reason || special.global?.reason || 'Día cerrado por vacaciones o festivo';
    return {
      valid: false,
      error: `El establecimiento está cerrado el ${date} (${reason}).`
    };
  }

  // 3. Check Weekly Day Off (e.g. Sunday)
  if (settingsData.weekly?.[dayOfWeek]?.closed) {
    return {
      valid: false,
      error: 'El establecimiento no abre en este día de la semana.'
    };
  }

  // 4. Fetch blocks for this date
  const { data: allBlocksRaw } = await supabase.from('blocks').select('*');
  const allBlocks = allBlocksRaw || [];

  const activeBlocks = allBlocks.filter(b => {
    const recEnd = b.recurrenceEnd || b.recurrence_end;
    const stDate = b.startDate || b.start_date;
    if (recEnd && recEnd < date) return false;
    if (stDate && stDate > date) return false;
    if (b.recurrence && b.recurrence !== 'none' && b.date && b.date > date) return false;
    if (!b.recurrence || b.recurrence === 'none') return b.date === date;
    if (b.recurrence === 'daily') return true;
    if (b.recurrence === 'weekly' || b.recurrence === 'biweekly') return b.weekday === dayOfWeek;
    return false;
  }).map(b => ({
    ...b,
    startTime: b.startTime || b.start_time || '00:00',
    endTime: b.endTime || b.end_time || '23:59',
    fullDay: !!(b.fullDay || b.full_day || (b.startTime === '00:00' && b.endTime === '23:59'))
  }));

  // Check if center has a full day block in blocks table
  const globalFullBlock = activeBlocks.find(b => {
    const bEmp = (b.employee || '').toLowerCase();
    return (isGenericEmployee(bEmp) || bEmp === 'global') && b.fullDay;
  });
  if (globalFullBlock) {
    return {
      valid: false,
      error: `El centro se encuentra cerrado el ${date} (${globalFullBlock.reason || 'Cierre'}).`
    };
  }

  // 5. Check Global Closed Hours (Tramos Cerrados)
  const chList = [
    ...(special.closedHours || []),
    ...(special.global?.closedHours || [])
  ];

  activeBlocks.forEach(b => {
    const bEmp = (b.employee || '').toLowerCase();
    if (isGenericEmployee(bEmp) || bEmp === 'global') {
      if (!b.fullDay) {
        chList.push({ start: b.startTime, end: b.endTime, reason: b.reason });
      }
    }
  });

  for (const ch of chList) {
    let sMin = 0, eMin = 1440;
    if (typeof ch === 'object' && ch !== null) {
      sMin = t2m(ch.start || ch.startTime || '00:00');
      eMin = t2m(ch.end || ch.endTime || '23:59');
    } else if (typeof ch === 'string') {
      sMin = t2m(ch);
      eMin = sMin + 15;
    }
    if (startMin < eMin && endMin > sMin) {
      return {
        valid: false,
        error: `La hora seleccionada coincide con un tramo cerrado en el centro (${ch.reason || 'No disponible'}).`
      };
    }
  }

  // 6. Check General Salon Business Hours
  const gWeekly = settingsData.weekly?.[dayOfWeek];
  const salonDayType = special.global?.type || gWeekly?.type || 'complete';
  const salonStart = special.global?.start || gWeekly?.start || settingsData.start || '09:00';
  const salonEnd = special.global?.end || (gWeekly?.type === 'split' ? gWeekly?.end2 : gWeekly?.end) || settingsData.end || (dayOfWeek === 6 ? '14:00' : '20:00');

  if (salonDayType === 'split') {
    const sEnd1Min = t2m(special.global?.end || gWeekly?.end || '14:00');
    const sStart2Min = t2m(special.global?.start2 || gWeekly?.start2 || '16:00');
    const inMorning = (startMin >= t2m(salonStart) && endMin <= sEnd1Min);
    const inAfternoon = (startMin >= sStart2Min && endMin <= t2m(salonEnd));
    if (!inMorning && !inAfternoon) {
      return {
        valid: false,
        error: 'La hora seleccionada está fuera del horario de atención del salón.'
      };
    }
  } else {
    if (startMin < t2m(salonStart) || endMin > t2m(salonEnd)) {
      return {
        valid: false,
        error: 'La hora seleccionada está fuera del horario de atención del salón.'
      };
    }
  }

  // 7. Check Candidates & Double-Booking
  const { data: employeesData } = await supabase.from('employees').select('*');
  const allEmployees = employeesData || [];

  let aptQuery = supabase.from('appointments').select('*').eq('date', date);
  const { data: existingAptsRaw } = await aptQuery;
  const existingApts = (existingAptsRaw || []).filter(a => a.status !== 'cancelled' && a.id !== excludeAptId);

  // Helper: check if a specific employee is available for [startMin, endMin]
  const isEmpAvailable = (emp) => {
    const empNameLower = emp.name.toLowerCase();

    // A) Special day employee override
    let empOverride = null;
    if (special[emp.id]) empOverride = special[emp.id];
    else if (special[emp.name]) empOverride = special[emp.name];
    else {
      const found = Object.entries(special).find(([k]) => k.toLowerCase() === empNameLower);
      if (found) empOverride = found[1];
    }

    if (empOverride && (empOverride.closed === true || empOverride.type === 'closed')) {
      return false; // Absent
    }

    // B) Employee blocks in blocks table
    const hasEmpBlock = activeBlocks.some(b => {
      const bEmp = (b.employee || '').toLowerCase();
      if (bEmp !== empNameLower && !isGenericEmployee(bEmp) && bEmp !== 'global') return false;
      if (b.fullDay) return true;
      const bS = t2m(b.startTime);
      const bE = t2m(b.endTime);
      return startMin < bE && endMin > bS;
    });
    if (hasEmpBlock) return false;

    // C) Employee weekly schedule
    const empWeekly = settingsData['weekly_' + emp.name] || settingsData.weekly?.['weekly_' + emp.name];
    if (empWeekly && empWeekly[dayOfWeek]) {
      const ew = empWeekly[dayOfWeek];
      if (ew.closed) return false;

      const sLimit = t2m(salonStart);
      const eLimit = t2m(salonEnd);

      if (ew.type === 'split') {
        const s1 = Math.max(t2m(ew.start || '09:00'), sLimit);
        const e1 = Math.min(t2m(ew.end || '14:00'), eLimit);
        const s2 = Math.max(t2m(ew.start2 || '16:00'), sLimit);
        const e2 = Math.min(t2m(ew.end2 || '20:00'), eLimit);
        const inS1 = (startMin >= s1 && endMin <= e1);
        const inS2 = (startMin >= s2 && endMin <= e2);
        if (!inS1 && !inS2) return false;
      } else {
        const s = Math.max(t2m(ew.start || '09:00'), sLimit);
        const e = Math.min(t2m(ew.end || '20:00'), eLimit);
        if (startMin < s || endMin > e) return false;
      }
    }

    // D) Conflicting appointment
    const conflictApt = existingApts.some(a => {
      const aEmpNames = empNamesInApt(a);
      const aS = t2m(a.time);
      const aE = aS + (a.duration || 15);
      if (startMin >= aE || endMin <= aS) return false;
      return aEmpNames.has(empNameLower) || [...aEmpNames].some(n => isGenericEmployee(n));
    });
    if (conflictApt) return false;

    return true;
  };

  // Find candidate employees for the requested services
  const { data: dbServicesRaw } = await supabase.from('services').select('*');
  const dbServices = dbServicesRaw || [];

  for (const s of services) {
    const dbSvc = dbServices.find(ds => ds.name.toLowerCase() === (s.name || '').toLowerCase());
    const reqEmp = (s.employee || '').trim();
    const catalogEmp = (dbSvc?.employee || '').trim();
    const effectiveEmp = (!isGenericEmployee(reqEmp)) ? reqEmp : catalogEmp;
    const lowered = effectiveEmp.toLowerCase();

    let candidates = allEmployees;
    if (effectiveEmp && !isGenericEmployee(lowered)) {
      if (effectiveEmp.includes(',')) {
        const allowed = effectiveEmp.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        candidates = allEmployees.filter(e => allowed.includes(e.name.toLowerCase()));
      } else {
        candidates = allEmployees.filter(e => e.name.toLowerCase() === lowered);
      }
    }

    const availableCandidates = candidates.filter(isEmpAvailable);
    if (availableCandidates.length === 0) {
      return {
        valid: false,
        error: `No hay especialistas disponibles para ${s.name || 'el servicio'} en ese horario.`
      };
    }
  }

  return { valid: true };
}
