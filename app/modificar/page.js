'use client';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { CalendarSync, ChevronLeft, ChevronRight, Clock, Check, AlertTriangle } from 'lucide-react';
import Link from 'next/link';

function ModifyContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [apt, setApt] = useState(null);
  const [status, setStatus] = useState('loading');
  const [errorMsg, setErrorMsg] = useState('');

  const [data, setData] = useState({ services: [], categories: [], employees: [], settings: null });
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const t2m = (t) => {
    if (!t) return 0;
    const p = t.split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };

  const m2t = (m) => String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');

  const getDCforEmp = useCallback((dateStr, empName) => {
    const ss = data.settings;
    const sd = ss?.specialDays || {};
    // 1) Override MANUAL de la empleada (por ID o por Nombre)
    const emp = (data.employees || []).find(e => e.name.toLowerCase() === empName.toLowerCase());
    const empId = emp ? emp.id : null;
    const empOverride = (sd[dateStr] && empId && sd[dateStr][empId]) || (sd[dateStr] && sd[dateStr][empName]);
    if (empOverride && !empOverride._auto) return empOverride;
    
    // 2) Estado del día especial global (si está configurado, sobrescribe horarios semanales o generales)
    if (sd[dateStr]?.global) {
      if (sd[dateStr].global.type === 'closed') return { type: 'closed' };
      if (sd[dateStr].global.type === 'custom') {
        return {
          type: 'standard',
          start: sd[dateStr].global.start,
          end: sd[dateStr].global.end,
          closedHours: sd[dateStr].global.closedHours || []
        };
      }
    }
    
    let globalClosed = false, globalStart = null, globalEnd = null;
    if (sd[dateStr]?.global) {
      if (sd[dateStr].global.type === 'closed') globalClosed = true;
      else if (sd[dateStr].global.type === 'custom') { globalStart = sd[dateStr].global.start; globalEnd = sd[dateStr].global.end; }
    }
    
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    // 2.5) Si el día de la semana está cerrado globalmente en el horario semanal general, se cierra para todos
    if (ss?.weekly && ss.weekly[day] && ss.weekly[day].closed) {
      return { type: 'closed' };
    }
    // 3) Horario semanal individual
    let hasWeekly = false, weeklyClosed = false, weeklyStart = null, weeklyEnd = null, weeklyType = null, weeklyStart2 = null, weeklyEnd2 = null;
    const key = 'weekly_' + empName;
    if (ss && ss[key] && ss[key][day]) {
      hasWeekly = true;
      const w = ss[key][day];
      if (w.closed) weeklyClosed = true;
      else {
        weeklyType = w.type || 'standard';
        weeklyStart = w.start; weeklyEnd = w.end;
        if (weeklyType === 'split') { weeklyStart2 = w.start2; weeklyEnd2 = w.end2; }
      }
    }
    // 4) Global "Cerrado" → cierra a TODOS
    if (globalClosed) return { type: 'closed' };
    // 5) Empleada con horario semanal → intersectar con global custom / global weekly
    if (hasWeekly) {
      if (weeklyClosed) return { type: 'closed' };
      const gWeekly = ss?.weekly?.[day];
      const salonStart = globalStart || gWeekly?.start || ss?.start || "10:00";
      const salonEnd = globalEnd || (gWeekly?.type === 'split' ? gWeekly?.end2 : gWeekly?.end) || ss?.end || (day === 6 ? "14:00" : "20:00");
      if (weeklyType === 'split') {
        let s1 = weeklyStart, e1 = weeklyEnd, s2 = weeklyStart2, e2 = weeklyEnd2;
        if (globalStart) {
          s1 = t2m(weeklyStart) > t2m(globalStart) ? weeklyStart : globalStart;
          e1 = t2m(weeklyEnd) < t2m(globalEnd) ? weeklyEnd : globalEnd;
          s2 = t2m(weeklyStart2) > t2m(globalStart) ? weeklyStart2 : globalStart;
          e2 = t2m(weeklyEnd2) < t2m(globalEnd) ? weeklyEnd2 : globalEnd;
        } else if (gWeekly && gWeekly.type === 'split') {
          s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
          e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
          s2 = t2m(weeklyStart2) > t2m(gWeekly.start2) ? weeklyStart2 : gWeekly.start2;
          e2 = t2m(weeklyEnd2) < t2m(gWeekly.end2) ? weeklyEnd2 : gWeekly.end2;
        } else if (gWeekly) {
          s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
          e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
          s2 = t2m(weeklyStart2) > t2m(gWeekly.start) ? weeklyStart2 : gWeekly.start;
          e2 = t2m(weeklyEnd2) < t2m(gWeekly.end2) ? weeklyEnd2 : gWeekly.end;
        }
        return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
      }
      if (gWeekly && gWeekly.type === 'split' && !globalStart) {
        const s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
        const e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
        const s2 = t2m(weeklyStart) > t2m(gWeekly.start2) ? weeklyStart : gWeekly.start2;
        const e2 = t2m(weeklyEnd) < t2m(gWeekly.end2) ? weeklyEnd : gWeekly.end;
        if (t2m(s2) < t2m(e2)) {
          return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
        } else {
          return { type: 'standard', start: s1, end: e1 };
        }
      }
      const start = t2m(weeklyStart) > t2m(salonStart) ? weeklyStart : salonStart;
      const end = t2m(weeklyEnd) < t2m(salonEnd) ? weeklyEnd : salonEnd;
      return { type: 'standard', start, end };
    }
    // 6) Global custom (empleada sin weekly)
    if (globalStart) return { type: 'standard', start: globalStart, end: globalEnd };
    // 7) Horario semanal global
    if (ss?.weekly) {
      const w2 = ss.weekly[day];
      if (w2) {
        if (w2.closed) return { type: 'closed' };
        if (w2.type === 'split') return { type: 'split', start: w2.start, end: w2.end, start2: w2.start2, end2: w2.end2 };
        return { type: 'standard', start: w2.start, end: w2.end };
      }
    }
    // 8) Por defecto
    return { type: 'standard', start: ss?.start || "10:00", end: ss?.end || (day === 6 ? "14:00" : "20:00") };
  }, [data.settings]);

  const isTimeInDC = (dc, startMin, dur) => {
    const endMin = startMin + dur;
    if (dc.type === 'closed') return false;
    if (dc.type === 'split') {
      const m1s = t2m(dc.start), m1e = t2m(dc.end);
      const m2s = t2m(dc.start2), m2e = t2m(dc.end2);
      return (startMin >= m1s && endMin <= m1e) || (startMin >= m2s && endMin <= m2e);
    }
    const s = t2m(dc.start || data.settings?.start || '10:00');
    const e = t2m(dc.end || data.settings?.end || '20:00');
    return startMin >= s && endMin <= e;
  };

  const getDCRange = (dc) => {
    if (dc.type === 'closed') return { s: t2m('10:00'), e: t2m('20:00') };
    if (dc.type === 'split') {
      const e = dc.end2 ? dc.end2 : dc.end;
      return { s: t2m(dc.start), e: t2m(e) };
    }
    return { s: t2m(dc.start || data.settings?.start || '10:00'), e: t2m(dc.end || data.settings?.end || '20:00') };
  };

  const isDayClosed = useCallback((dateStr) => {
    const ee = data.employees || [];
    const ss = data.settings;
    if (ee.length === 0) {
      const sd = ss?.specialDays || {};
      if (sd[dateStr] && sd[dateStr].global) return sd[dateStr].global.type === 'closed';
      if (ss?.weekly) {
        const d = new Date(dateStr + 'T12:00:00');
        const w = ss.weekly[d.getDay()];
        if (w && w.closed) return true;
      }
      return false;
    }

    const sd = ss?.specialDays || {};
    if (sd[dateStr]?.global?.type === 'closed') return true;
    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (ss?.weekly && ss.weekly[day] && ss.weekly[day].closed) return true;

    if (apt) {
      const empRestriction = (apt.employee || '').trim();
      const lowered = empRestriction.toLowerCase();
      let candidates = ee;
      if (empRestriction && lowered !== 'todas' && lowered !== 'ambos' && lowered !== 'cualquiera' && lowered !== 'automático' && lowered !== 'automatico') {
        if (empRestriction.includes(',')) {
          const names = empRestriction.split(',').map(n => n.trim().toLowerCase());
          candidates = ee.filter(e => names.includes(e.name.toLowerCase()));
        } else {
          candidates = ee.filter(e => e.name.toLowerCase() === empRestriction.toLowerCase());
        }
      }
      if (candidates.length > 0) {
        return candidates.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
      }
    }

    return ee.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
  }, [data.employees, data.settings, getDCforEmp, apt]);

  useEffect(() => {
    if (!id) {
      setTimeout(() => setStatus('error'), 0);
      setTimeout(() => setErrorMsg('Enlace de modificación incorrecto (Falta ID de la cita).'), 0);
      setTimeout(() => setLoading(false), 0);
      return;
    }

    Promise.all([
      fetch('/api/data').then(r => r.json()),
      fetch(`/api/reserva?id=${id}`).then(r => r.json())
    ]).then(([dataRes, aptRes]) => {
      if (dataRes.success) {
        setData({ services: dataRes.services, categories: dataRes.categories, employees: dataRes.employees, settings: dataRes.settings });
      }
      if (aptRes.success) {
        if (aptRes.status === 'cancelled') {
          setStatus('cancelled');
        } else {
          setApt(aptRes);
          if (aptRes.date) {
            const [ay, amo] = aptRes.date.split('-').map(Number);
            if (ay && amo) {
              setCalViewDate(new Date(ay, amo - 1, 1));
            }
          }
          setStatus('ready');
        }
      } else {
        setTimeout(() => setStatus('error'), 0);
        setErrorMsg('Reserva no encontrada en el sistema.');
      }
      setTimeout(() => setLoading(false), 0);
    }).catch(e => {
      setTimeout(() => setStatus('error'), 0);
      setErrorMsg('Error de conexión. Inténtalo de nuevo.');
      setTimeout(() => setLoading(false), 0);
    });
  }, [id]);

  const fetchSlotsForDate = async (ds) => {
    if (!apt) return;
    setLoadingSlots(true);
    setAvailableSlots([]);
    setSelTime(null);
    try {
      const res = await fetch(`/api/availability?date=${ds}`);
      const rdata = await res.json();
      if (rdata.success) {
        calculateSlots(ds, rdata.appointments || [], rdata.blocks || []);
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingSlots(false);
  };

  const calculateSlots = (ds, dayApts, blocks = []) => {
    if (!apt) return;
    const dur = parseInt(apt.duration || 15, 10);
    const empRestriction = apt.employee || 'Todas';
    let candidates = [...data.employees];
    if (empRestriction !== 'Todas' && empRestriction !== 'Ambos' && empRestriction !== 'Cualquiera') {
      const allowed = empRestriction.split(',').map(v => v.trim());
      candidates = candidates.filter(e => allowed.includes(e.name));
    }
    let rangeStart = null, rangeEnd = null;
    if (candidates.length > 0) {
      candidates.forEach(emp => {
        const dc = getDCforEmp(ds, emp.name);
        if (dc.type !== 'closed') {
          const r = getDCRange(dc);
          if (rangeStart === null || r.s < rangeStart) rangeStart = r.s;
          if (rangeEnd === null || r.e > rangeEnd) rangeEnd = r.e;
        }
      });
    }
    if (rangeStart === null) {
      const d = new Date(ds + 'T12:00:00');
      const gday = d.getDay();
      if (data.settings?.weekly && data.settings.weekly[gday] && !data.settings.weekly[gday].closed) {
        const wdc = data.settings.weekly[gday];
        const r = getDCRange(wdc.type === 'split' ? { type: 'split', start: wdc.start, end: wdc.end, start2: wdc.start2, end2: wdc.end2 } : { type: 'standard', start: wdc.start, end: wdc.end });
        rangeStart = r.s;
        rangeEnd = r.e;
      } else {
        setAvailableSlots([]);
        return;
      }
    }
    if (rangeStart === null || rangeStart >= rangeEnd) {
      setAvailableSlots([]);
      return;
    }
    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowMin = ds === todayStr ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const slots = [];

    const aptHasEmp = (a, empName) => {
      if (!a.employee) return true;
      const aEmp = a.employee.toLowerCase();
      const enLower = empName.toLowerCase();
      if (aEmp === enLower) return true;
      if (a.employee.split(',').map(e => e.trim().toLowerCase()).includes(enLower)) return true;
      if (a.services && a.services.some(s => (s.employee || '').toLowerCase() === enLower)) return true;
      return false;
    };

    const isEmpBusy = (empName, start, end) => {
      const empLower = empName.toLowerCase();
      const hasApt = dayApts.some(a => {
        if (a.id === id || a._id === id) return false;
        if (!aptHasEmp(a, empName)) return false;
        let aDur = parseInt(a.duration || 15, 10);
        if (a.services && Array.isArray(a.services) && a.services.length > 0) {
          const empServices = a.services.filter(s => (s.employee || '').toLowerCase() === empLower);
          if (empServices.length > 0) {
            aDur = empServices.reduce((sum, s) => sum + parseInt(s.duration || 0, 10), 0);
          }
        }
        const aS = t2m(a.time), aE = aS + aDur;
        return start < aE && end > aS;
      });
      if (hasApt) return true;

      const hasBlock = blocks.some(b => {
        if (b.employee !== empName) return false;
        const bS = t2m(b.startTime);
        const bE = t2m(b.endTime);
        return start < bE && end > bS;
      });
      return hasBlock;
    };

    for (let t = rangeStart; t + dur <= rangeEnd; t += 15) {
      if (ds === todayStr && t <= nowMin) continue;
      let slotFree = false;
      if (candidates.length === 0) {
        slotFree = true;
      } else {
        for (const emp of candidates) {
          const dc = getDCforEmp(ds, emp.name);
          if (dc.type === 'closed') continue;
          if (!isTimeInDC(dc, t, dur)) continue;
          if (!isEmpBusy(emp.name, t, t + dur)) {
            slotFree = true;
            break;
          }
        }
      }
      slots.push({ time: m2t(t), free: slotFree });
    }
    setAvailableSlots(slots);
  };

  const selectDate = (ds) => {
    setSelDate(ds);
    fetchSlotsForDate(ds);
  };

  const handleSubmit = async () => {
    if (!selDate || !selTime) return;
    setSubmitting(true);
    try {
      const res = await fetch('/api/modify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          oldId: id,
          newDate: selDate,
          newTime: selTime
        })
      });
      const resData = await res.json();
      if (resData.success) {
        setStatus('success');
      } else {
        alert('Error: ' + (resData.error || 'No se pudo modificar la cita.'));
      }
    } catch (e) {
      alert('Error de conexión.');
    }
    setSubmitting(false);
  };

  const y = calViewDate.getFullYear();
  const mo = calViewDate.getMonth();
  const firstDay = new Date(y, mo, 1);
  const off = (firstDay.getDay() + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const todayStr = getLocalDateStr(new Date());
  const maxDateObj = new Date();
  maxDateObj.setMonth(new Date().getMonth() + 2);
  const maxDateStr = getLocalDateStr(maxDateObj);
  const isNextMonthDisabled = y > maxDateObj.getFullYear() || (y === maxDateObj.getFullYear() && mo >= maxDateObj.getMonth());
  const msNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ['L','M','X','J','V','S','D'];

  return (
    <div className="flex flex-col items-center justify-center p-4 min-h-screen" style={{background:'var(--cream)'}}>
      <div className="max-w-md w-full relative mt-6">
        <div className="text-center mb-6">
          <h1 className="text-4xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Estetica Respira</h1>
          <p className="text-sm font-medium text-[#a8876b]">Centro de transformación y belleza</p>
        </div>

        <div className="card overflow-hidden bg-white rounded-[24px] shadow-[0_4px_24px_rgba(46,40,38,.07)] border border-[#e0d8d5]">

          {status === 'loading' && (
            <div className="p-10 text-center">
              <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#a8876b]"></div>
              <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Buscando tu cita...</p>
            </div>
          )}

          {status === 'cancelled' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#c0464f]">Esta cita ya fue cancelada y no puede modificarse.</p>
              <div className="space-y-2 mt-4">
                <Link href={`/mis-citas${id ? `?id=${id}` : ''}`} className="block bg-[#a8876b] text-white px-6 py-3 rounded-2xl font-bold text-sm text-center shadow-sm">
                  Ver todas mis citas
                </Link>
                <Link href="/" className="block border border-[#e0d8d5] text-[#7a6b67] bg-white px-6 py-3 rounded-2xl font-bold text-sm text-center">
                  Hacer una nueva reserva
                </Link>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="p-10 text-center space-y-4">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto bg-[#fdf0f1] text-[#c0464f]">
                <AlertTriangle className="w-6 h-6" />
              </div>
              <p className="font-bold text-[#c0464f]">{errorMsg}</p>
              <div className="space-y-2 mt-4">
                <Link href={`/mis-citas${id ? `?id=${id}` : ''}`} className="block bg-[#a8876b] text-white px-6 py-3 rounded-2xl font-bold text-sm text-center shadow-sm">
                  Ver mis citas
                </Link>
                <Link href="/" className="block border border-[#e0d8d5] text-[#7a6b67] bg-white px-6 py-3 rounded-2xl font-bold text-sm text-center">
                  Ir a la página principal
                </Link>
              </div>
            </div>
          )}

          {status === 'ready' && apt && (
            <div className="p-6">
              <div className="text-center mb-5">
                <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-3" style={{background:'var(--blue)'}}>
                  <CalendarSync className="w-7 h-7 text-white" />
                </div>
                <h2 className="text-xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Modificar Cita</h2>
                <p className="text-xs font-medium text-[#7a6b67]">Elige una nueva fecha y hora</p>
              </div>

              <div className="rounded-2xl p-4 text-left space-y-2 mb-5 border bg-[#faf7f4] border-[#e0d8d5]">
                <p className="text-[9px] font-bold uppercase tracking-widest text-[#a8876b] mb-2">Cita actual</p>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Servicio</span>
                  <span className="font-bold text-right max-w-[60%] text-[#2e2826]">{apt.service}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Fecha y hora</span>
                  <span className="font-bold text-[#a8876b]">{apt.date?.split('-').reverse().join('/')} · {apt.time}h</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Cliente</span>
                  <span className="font-bold text-[#2e2826]">{apt.clientName}</span>
                </div>
              </div>

              <div className="mb-4">
                <h3 className="text-sm font-bold uppercase tracking-wider mb-3 text-[#2e2826]">Nueva fecha</h3>
                <div className="flex items-center justify-between mb-3">
                  <button onClick={() => setCalViewDate(new Date(y, mo - 1, 1))} className="p-2 rounded-xl border bg-white border-[#e0d8d5] hover:bg-slate-50">
                    <ChevronLeft className="w-4 h-4 text-[#7a6b67]" />
                  </button>
                  <span className="font-bold text-sm capitalize text-[#2e2826]">{msNames[mo]} {y}</span>
                  <button disabled={isNextMonthDisabled} onClick={() => setCalViewDate(new Date(y, mo + 1, 1))} className={`p-2 rounded-xl border ${isNextMonthDisabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'} border-[#e0d8d5]`}>
                    <ChevronRight className="w-4 h-4 text-[#7a6b67]" />
                  </button>
                </div>
                <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase mb-2 text-[#7a6b67]">
                  {dayNames.map(d => <div key={d}>{d}</div>)}
                </div>
                <div className="grid grid-cols-7 gap-1 mb-3">
                  {Array.from({ length: off }).map((_, i) => <div key={`e-${i}`}></div>)}
                  {Array.from({ length: dim }).map((_, i) => {
                    const day = i + 1;
                    const ds = `${y}-${String(mo + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                    const isPast = ds < todayStr;
                    const isTooFar = ds > maxDateStr;
                    const closed = !isPast && isDayClosed(ds);
                    const isSel = selDate === ds;
                    const isToday = ds === todayStr;
                    const disabled = isPast || isTooFar || closed;
                    let cls = 'day-btn';
                    if (isPast || isTooFar) cls += ' day-past';
                    else if (closed) cls += ' day-closed';
                    else if (isSel) cls += ' day-selected';
                    else if (isToday) cls += ' day-today';
                    return (
                      <button key={day} disabled={disabled} onClick={() => selectDate(ds)} className={cls}>
                        {day}
                      </button>
                    );
                  })}
                </div>

                {selDate && (
                  <div className="mt-3 pt-3 border-t border-[#e0d8d5]">
                    <div className="flex items-center gap-2 mb-2">
                      <Clock className="w-4 h-4 text-[#a8876b]" />
                      <h3 className="font-bold text-sm uppercase text-[#2e2826]">Nueva hora</h3>
                      <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-lg bg-[#f3ece4] text-[#a8876b]">
                        {selDate.split('-').reverse().join('/')}
                      </span>
                    </div>
                    {loadingSlots ? (
                      <div className="flex justify-center py-4"><div className="spinner !border-[#e0d8d5] !border-t-[#a8876b]"></div></div>
                    ) : (
                      <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                        {availableSlots.length === 0 ? (
                          <p className="col-span-full text-center py-4 text-slate-400 font-medium text-sm">Sin horas disponibles este día</p>
                        ) : (
                          availableSlots.map(slot => (
                            <button key={slot.time} disabled={!slot.free}
                              onClick={() => setSelTime(slot.time)}
                              className={`time-slot ${slot.free ? (selTime === slot.time ? 'selected' : '') : 'occupied'}`}>
                              {slot.time}
                            </button>
                          ))
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              <div className="space-y-3 pt-3">
                <button onClick={handleSubmit} disabled={!selDate || !selTime || submitting}
                  className="w-full py-4 rounded-2xl font-bold text-sm text-white shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  style={{background: 'var(--blue-deep)'}}>
                  {submitting ? <div className="spinner !border-white/30 !border-t-white"></div> : <CalendarSync className="w-5 h-5" />}
                  {submitting ? 'Modificando...' : 'Confirmar cambio de fecha'}
                </button>
                <Link href={`/cancelar?id=${id}`} className="block text-center text-xs font-bold underline text-[#7a6b67] hover:text-[#c0464f] transition-colors">
                  Prefiero cancelar la cita
                </Link>
              </div>
            </div>
          )}

          {status === 'success' && (
            <div className="p-10 text-center space-y-5">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-sm" style={{background:'linear-gradient(135deg,var(--blue),var(--blue-deep))'}}>
                <Check className="w-8 h-8 text-white" />
              </div>
              <div className="font-semibold text-2xl italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                ¡Cita modificada!
              </div>
              <p className="text-sm font-medium text-[#7a6b67]">Recibirás un correo de confirmación con los nuevos detalles.</p>
              <Link href="/" className="block mt-4 bg-[#a8876b] text-white px-6 py-3 rounded-2xl font-bold text-sm text-center">
                Volver al inicio
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

export default function ModifyPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-screen" style={{background:'var(--cream)'}}>
        <div className="w-10 h-10 border-4 rounded-full animate-spin border-[#e0d8d5] border-t-[#a8876b]"></div>
      </div>
    }>
      <ModifyContent />
    </Suspense>
  );
}
