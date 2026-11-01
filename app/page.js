'use client';
import React, { useState, useEffect, useCallback, useRef, Suspense } from 'react';
import { CalendarPlus, ChevronLeft, ChevronRight, Clock, ClipboardCheck, ArrowLeft, ArrowRight, Check, PlusCircle, AlertCircle, Trash2, Sparkles, Info, CalendarX, Ticket } from 'lucide-react';
import { useSearchParams } from 'next/navigation';

export default function BookingPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#faf7f4]"><div className="spinner border-[#e0d8d5] border-t-[#a8876b]"></div></div>}>
      <BookingContent />
    </Suspense>
  );
}

function BookingContent() {
  const [selSlotData, setSelSlotData] = useState(null);

  const getTotalDur = function(svcs) {
    if (!svcs || svcs.length === 0) return 0;
    if (selSlotData && selSlotData.totalDur) return selSlotData.totalDur;
    return svcs.reduce(function(sum, s) { return sum + parseInt(s.duration || 0, 10); }, 0);
  };
  const [data, setData] = useState({ services: [], categories: [], employees: [], settings: null });
  const settingsRef = useRef(data.settings);
  const employeesRef = useRef(data.employees);
  const [loading, setLoading] = useState(true);
  const [showLocation, setShowLocation] = useState(true);
  
  const [step, setStep] = useState(0); // 0 = intro, 1 = service, 2 = datetime, 3 = info, 4 = success
  const [activeCat, setActiveCat] = useState('all');
  
  const [selServices, setSelServices] = useState([]);
  const [showSvcConfirm, setShowSvcConfirm] = useState(false);
  const [calViewDate, setCalViewDate] = useState(new Date());
  const [selDate, setSelDate] = useState(null);
  const [selTime, setSelTime] = useState(null);
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');

  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim()) return;
    setVoucherLoading(true);
    setVoucherError('');
    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: voucherCodeInput.trim().toUpperCase(),
          services: selServices
        })
      });
      const resData = await res.json();
      if (resData.success && resData.voucher) {
        setAppliedVoucher(resData.voucher);
        setVoucherError('');
      } else {
        setVoucherError(resData.error || 'Bono inválido');
        setAppliedVoucher(null);
      }
    } catch (e) {
      setVoucherError('Error de conexión al validar el bono');
    }
    setVoucherLoading(false);
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherError('');
  };
  
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [availableEmpsForSelSlot, setAvailableEmpsForSelSlot] = useState([]);
  const [slotAssign, setSlotAssign] = useState(null);
  const [nextAvailable, setNextAvailable] = useState(null);
  const [singleNextAvailable, setSingleNextAvailable] = useState(null);
  const [isSearchingNext, setIsSearchingNext] = useState(false);
  
  const [formName, setFormName] = useState('');
  const [formPhone, setFormPhone] = useState('');
  const [formEmail, setFormEmail] = useState('');
  const [formNotes, setFormNotes] = useState('');
  const [formEmp, setFormEmp] = useState('Cualquiera');
  const [formGdpr, setFormGdpr] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Estados para modo edición/cancelación
  const searchParams = useSearchParams();
  const [editId, setEditId] = useState(null);
  const [isCancelMode, setIsCancelMode] = useState(false);
  const [existingReserva, setExistingReserva] = useState(null);
  const [bookingResult, setBookingResult] = useState(null); // { success: string, error: string }

  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData({
            services: res.services,
            categories: res.categories,
            employees: res.employees,
            settings: res.settings
          });
          data.settings = res.settings;
          data.employees = res.employees;
        }
        setLoading(false);
      })
      .catch(e => {
        console.error(e);
        setLoading(false);
      });

    // Detectar modo edición/cancelación
    const id = searchParams.get('id');
    const cancel = searchParams.get('cancel');
    if (id) {
      setTimeout(() => setEditId(id), 0);
      if (cancel === '1') setTimeout(() => setIsCancelMode(true), 0);
      
      // Cargar datos de la reserva
      fetch(`/api/reserva?id=${id}`)
        .then(res => res.json())
        .then(res => {
          if (res.success) {
            setExistingReserva(res);
            // Si no es cancelación, podríamos pre-cargar el formulario aquí para edición
          }
        });
    }
  }, [searchParams]);

  useEffect(() => {
    // Reset date/time selection when services change outside step 2 (datetime selection) to prevent stale availability caching
    if (step < 2) {
      setTimeout(() => setSelDate(null), 0);
      setTimeout(() => setSelTime(null), 0);
      setTimeout(() => setAvailableSlots([]), 0);
      setTimeout(() => setNextAvailable(null), 0);
      setTimeout(() => setSingleNextAvailable(null), 0);
    }
  }, [selServices, step]);


  const msNames = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  const dayNames = ['L','M','X','J','V','S','D'];

  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const maxDateObj = new Date();
  maxDateObj.setMonth(new Date().getMonth() + 2);
  const maxDateStr = getLocalDateStr(maxDateObj);

  const formatFriendlyDateLong = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const fullDays = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
    const dayName = fullDays[d.getDay()];
    const mName = msNames[d.getMonth()];
    const num = d.getDate();
    return `${dayName}, ${num} de ${mName}`;
  };

  const formatFriendlyDateShort = (dateStr) => {
    if (!dateStr) return '';
    const d = new Date(dateStr + 'T12:00:00');
    const shortDays = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
    const dayName = shortDays[d.getDay()];
    const mName = msNames[d.getMonth()];
    const num = d.getDate();
    return `${dayName} ${num} ${mName.slice(0, 3)}`;
  };
  
  const t2m = (t) => {
    if (!t) return 0;
    const p = t.split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };
  
  const m2t = (m) => {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  const getDCforEmp = useCallback((dateStr, empName) => {
    const ss = data.settings;
    const sd = ss?.specialDays || {};
    // 1) Override MANUAL de la empleada (por ID o por Nombre)
    const emp = (data.employees || []).find(e => e.name.toLowerCase() === empName.toLowerCase());
    const empId = emp ? emp.id : null;
    let empOverride = null;
    if (sd[dateStr]) {
      if (empId && sd[dateStr][empId]) {
        empOverride = sd[dateStr][empId];
      } else {
        const foundKey = Object.keys(sd[dateStr]).find(k => k.toLowerCase() === empName.toLowerCase());
        if (foundKey) empOverride = sd[dateStr][foundKey];
      }
    }
    if (empOverride && !empOverride._auto) return empOverride;
    
    // 2) Estado del día especial global (si está configurado, sobrescribe horarios semanales o generales)
    if (sd[dateStr]?.global) {
      if (sd[dateStr].global.type === 'closed') return { type: 'closed' };
      if (sd[dateStr].global.type === 'split') {
        return {
          type: 'split',
          start: sd[dateStr].global.start,
          end: sd[dateStr].global.end,
          start2: sd[dateStr].global.start2,
          end2: sd[dateStr].global.end2
        };
      }
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
      else if (sd[dateStr].global.type === 'split') { globalStart = sd[dateStr].global.start; globalEnd = sd[dateStr].global.end2 || sd[dateStr].global.end; }
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
    const empWeeklyObj = ss ? (ss[key] || ss.weekly?.[key]) : null;
    if (empWeeklyObj && empWeeklyObj[day]) {
      hasWeekly = true;
      const w = empWeeklyObj[day];
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
          s2 = t2m(weeklyStart2) > t2m(gWeekly.start2) ? weeklyStart2 : gWeekly.start;
          e2 = t2m(weeklyEnd2) < t2m(gWeekly.end2) ? weeklyEnd2 : gWeekly.end;
        }
        return { type: 'split', start: s1, end: e1, start2: s2, end2: e2 };
      }
      if (gWeekly && gWeekly.type === 'split' && !globalStart) {
        const s1 = t2m(weeklyStart) > t2m(gWeekly.start) ? weeklyStart : gWeekly.start;
        const e1 = t2m(weeklyEnd) < t2m(gWeekly.end) ? weeklyEnd : gWeekly.end;
        const s2 = t2m(weeklyStart) > t2m(gWeekly.start2) ? weeklyStart : gWeekly.start2;
        const e2 = t2m(weeklyEnd) < t2m(gWeekly.end2) ? weeklyEnd : gWeekly.end2;
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
  }, []);

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

  const getCandidatesForService = useCallback((s, customEmps) => {
    const employees = customEmps || data.employees || data.employees || [];
    if (!s) return employees;

    const dbSvc = (data.services || []).find(ds => (s.id && ds.id === s.id) || ds.name === s.name) || s;
    const catalogEmpStr = (dbSvc.employee || '').trim();
    const lowered = catalogEmpStr.toLowerCase();

    let eligible = employees;
    if (catalogEmpStr && lowered !== 'todas' && lowered !== 'ambos' && lowered !== 'cualquiera') {
      if (catalogEmpStr.includes(',')) {
        const allowed = catalogEmpStr.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);
        eligible = employees.filter(e => allowed.includes(e.name.toLowerCase()));
      } else {
        eligible = employees.filter(e => e.name.toLowerCase() === lowered);
      }
    }

    const chosenSpec = s.selectedSpecialist || (s.employee && !catalogEmpStr.toLowerCase().includes(s.employee.toLowerCase()) && s.employee !== 'Todas' && s.employee !== 'Ambos' && s.employee !== 'Cualquiera' ? s.employee : '');
    if (chosenSpec && chosenSpec.trim() !== '') {
      const userPref = chosenSpec.trim().toLowerCase();
      const userFiltered = eligible.filter(e => e.name.toLowerCase() === userPref);
      if (userFiltered.length > 0) return userFiltered;
    }

    return eligible.length > 0 ? eligible : employees;
  }, [data.employees, data.services]);

  const isDayClosed = useCallback((dateStr, overrideServices) => {
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

    const checkSvcs = overrideServices || selServices;
    // Si hay servicios seleccionados, comprobar si para ALGUNO de ellos todas las empleadas aptas están cerradas
    if (checkSvcs.length > 0) {
      const cannotPerformAnyService = checkSvcs.some(s => {
        const candidates = getCandidatesForService(s, ee);
        if (candidates.length === 0) return false;
        return candidates.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
      });
      if (cannotPerformAnyService) return true;
    }

    return ee.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
  }, [getDCforEmp, selServices, getCandidatesForService]);

  const fetchSlotsForDate = async (ds, overrideServices, autoSelectSlot = null) => {
    setLoadingSlots(true);
    setTimeout(() => setAvailableSlots([]), 0);
    setTimeout(() => setSelTime(null), 0);
    try {
      const [aptRes, dataRes] = await Promise.all([
        fetch(`/api/availability?date=${ds}`),
        fetch('/api/data')
      ]);
      const rdata = await aptRes.json();
      const freshData = await dataRes.json();
      let freshSettings = data.settings;
      let freshEmployees = data.employees;
      if (freshData.success) {
        freshSettings = freshData.settings;
        freshEmployees = freshData.employees;


        setData({
          services: freshData.services,
          categories: freshData.categories,
          employees: freshData.employees,
          settings: freshData.settings
        });
      }
      if (rdata.success) {
        const slots = calculateSlots(ds, rdata.appointments || [], freshSettings, freshEmployees, overrideServices, rdata.blocks || []);
        const activeSvcs = overrideServices || selServices;
        const freeSlots = (slots || []).filter(s => s.free);
        if (freeSlots.length === 0) {
          scanNextAvailable(ds, activeSvcs);
        } else {
          setTimeout(() => setNextAvailable(null), 0);
          setTimeout(() => setSingleNextAvailable(null), 0);
        }
        if (autoSelectSlot && slots) {
          const matchingSlot = slots.find(s => s.time === autoSelectSlot.time && s.free);
          if (matchingSlot) {
            handleTimeSelect(matchingSlot);
          }
        }
      }
    } catch (e) {
      console.error(e);
    }
    setLoadingSlots(false);
  };


  const computeSlotsForDate = (ds, dayApts = [], freshSettings, freshEmployees, overrideServices, blocks = []) => {
    const settings = freshSettings || data.settings || data.settings;
    const employees = freshEmployees || data.employees || data.employees;
    let activeServices = overrideServices || selServices;
    if (!activeServices || activeServices.length === 0) return [];
    if (!employees || employees.length === 0) return [];

    const allCandidateEmps = [];
    activeServices.forEach(s => {
      getCandidatesForService(s, employees).forEach(emp => {
        if (!allCandidateEmps.some(e => e.name === emp.name)) {
          allCandidateEmps.push(emp);
        }
      });
    });

    let rangeStart = null, rangeEnd = null;
    allCandidateEmps.forEach(emp => {
      const dc = getDCforEmp(ds, emp.name);
      if (dc.type !== 'closed') {
        const r = getDCRange(dc);
        if (rangeStart === null || r.s < rangeStart) rangeStart = r.s;
        if (rangeEnd === null || r.e > rangeEnd) rangeEnd = r.e;
      }
    });

    if (rangeStart === null) {
      const d2 = new Date(ds + 'T12:00:00');
      const gday = d2.getDay();
      if (settings?.weekly && settings.weekly[gday] && !settings.weekly[gday].closed) {
        const wdc = settings.weekly[gday];
        const r = getDCRange(wdc.type === 'split' ? { type: 'split', start: wdc.start, end: wdc.end, start2: wdc.start2, end2: wdc.end2 } : { type: 'standard', start: wdc.start, end: wdc.end });
        rangeStart = r.s;
        rangeEnd = r.e;
      } else {
        return [];
      }
    }
    if (rangeStart === null || rangeStart >= rangeEnd) { return []; }
    
    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowMin = ds === todayStr ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const closedHours = settings?.specialDays?.[ds]?.closedHours || [];
    
    const isSlotClosedForEmp = (slotStart, slotEnd, empName, dc) => {
      const hasDbClosed = closedHours.some(ch => {
        const chFrom = t2m(ch.from), chTo = t2m(ch.to);
        if (slotStart < chTo && slotEnd >= chFrom) {
          if (ch.entity === 'global' || ch.entity.toLowerCase() === empName.toLowerCase()) return true;
        }
        return false;
      });
      if (hasDbClosed) return true;

      if (dc && dc.closedHours && Array.isArray(dc.closedHours)) {
        const hasCustomClosed = dc.closedHours.some(timeStr => {
          const chMin = t2m(timeStr);
          return slotStart < (chMin + 15) && slotEnd > chMin;
        });
        if (hasCustomClosed) return true;
      }

      return false;
    };

    const aptHasEmp = (a, en) => {
      if (!a.employee) return false;
      const aEmp = a.employee.toLowerCase();
      if (aEmp === 'todas' || aEmp === 'ambos' || aEmp === 'cualquiera') return true;
      const enLower = en.toLowerCase();
      if (aEmp === enLower) return true;
      if (a.employee.split(',').map(e => e.trim().toLowerCase()).includes(enLower)) return true;
      if (a.services && a.services.some(s => (s.employee || '').toLowerCase() === enLower)) return true;
      return false;
    };

    const isEmpBusy = (empName, start, end) => {
      const empLower = empName.toLowerCase();
      const hasApt = dayApts.some(a => {
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
        const bEmp = (b.employee || '').toLowerCase();
        if (bEmp && bEmp !== 'all' && bEmp !== 'todas' && bEmp !== empLower) return false;
        const bStart = b.startTime || b.start_time;
        const bEnd = b.endTime || b.end_time;
        const bS = t2m(bStart);
        const bE = t2m(bEnd);
        return start < bE && end > bS;
      });
      if (hasBlock) return true;

      return false;
    };

    const isEmpAvailableForService = (empName, startMin, dur) => {
      const dc = getDCforEmp(ds, empName);
      if (dc.type === 'closed') return false;
      if (!isTimeInDC(dc, startMin, dur)) return false;
      if (isSlotClosedForEmp(startMin, startMin + dur, empName, dc)) return false;
      if (isEmpBusy(empName, startMin, startMin + dur)) return false;
      return true;
    };

    const slots = [];
    const minDur = Math.min(...activeServices.map(s => parseInt(s.duration || 15, 10)));
    const totalDur = activeServices.reduce((sum, s) => sum + parseInt(s.duration || 15, 10), 0);

    for (let t = rangeStart; t + minDur <= rangeEnd; t += 15) {
      if (ds === todayStr && t <= nowMin) continue;

      if (activeServices.length === 1) {
        const s = activeServices[0];
        const dur = parseInt(s.duration || 15, 10);
        if (t + dur > rangeEnd) continue;

        const candidates = getCandidatesForService(s, employees);
        const freeEmps = candidates.filter(emp => isEmpAvailableForService(emp.name, t, dur));
        const slotFree = freeEmps.length > 0;
        const assign = slotFree ? [freeEmps[0].name] : null;

        slots.push({
          time: m2t(t),
          free: slotFree,
          emps: freeEmps,
          assign: assign,
          mode: 'single',
          totalDur: dur
        });
      } else {
        // Combo de varios servicios
        // 1. Intentar asignación secuencial con una única especialista
        let seqFree = false;
        let seqEmpName = null;
        if (t + totalDur <= rangeEnd) {
          const allEligible = employees.filter(emp => 
            activeServices.every(s => getCandidatesForService(s, employees).some(ce => ce.name === emp.name))
          );
          for (const emp of allEligible) {
            if (isEmpAvailableForService(emp.name, t, totalDur)) {
              seqFree = true;
              seqEmpName = emp.name;
              break;
            }
          }
        }

        if (seqFree && seqEmpName) {
          const svcAssign = activeServices.map(() => seqEmpName);
          const empObj = employees.find(e => e.name === seqEmpName);
          slots.push({
            time: m2t(t),
            free: true,
            emps: empObj ? [empObj] : [],
            assign: svcAssign,
            mode: 'sequential',
            totalDur: totalDur
          });
        } else {
          // 2. Intentar asignación simultánea con distintas especialistas libres
          const maxDur = Math.max(...activeServices.map(s => parseInt(s.duration || 15, 10)));
          let simFree = false;
          let simAssign = [];
          let simEmps = [];

          if (t + maxDur <= rangeEnd) {
            const assigned = [];
            let canSim = true;
            for (let i = 0; i < activeServices.length; i++) {
              const s = activeServices[i];
              const sDur = parseInt(s.duration || 15, 10);
              const candidates = getCandidatesForService(s, employees);
              const availableEmp = candidates.find(emp => 
                !assigned.includes(emp.name) && isEmpAvailableForService(emp.name, t, sDur)
              );
              if (availableEmp) {
                assigned.push(availableEmp.name);
                simEmps.push(availableEmp);
                simAssign.push(availableEmp.name);
              } else {
                canSim = false;
                break;
              }
            }
            if (canSim && simAssign.length === activeServices.length) {
              simFree = true;
            }
          }

          if (simFree) {
            slots.push({
              time: m2t(t),
              free: true,
              emps: simEmps,
              assign: simAssign,
              mode: 'simultaneous',
              totalDur: maxDur
            });
          } else {
            slots.push({
              time: m2t(t),
              free: false,
              emps: [],
              assign: null,
              totalDur: totalDur
            });
          }
        }
      }
    }

    return slots;
  };

  const calculateSlots = (ds, dayApts, freshSettings, freshEmployees, overrideServices, blocks = []) => {
    const slots = computeSlotsForDate(ds, dayApts, freshSettings, freshEmployees, overrideServices, blocks);
    setAvailableSlots(slots);
    return slots;
  };

  const scanNextAvailable = async (baseDate, targetServices) => {
    if (!baseDate || !targetServices || targetServices.length === 0) return;
    setIsSearchingNext(true);
    setTimeout(() => setNextAvailable(null), 0);
    setTimeout(() => setSingleNextAvailable(null), 0);

    try {
      const todayStr = getLocalDateStr(new Date());
      const isBaseToday = baseDate === todayStr;
      const baseObj = new Date(baseDate + 'T12:00:00');
      const startObj = new Date(baseObj);
      if (!isBaseToday) {
        startObj.setDate(startObj.getDate() + 1);
      }

      const endObj = new Date(startObj);
      endObj.setDate(endObj.getDate() + 35);

      const fromStr = getLocalDateStr(startObj);
      const toStr = getLocalDateStr(endObj);

      const res = await fetch(`/api/availability?from=${fromStr}&to=${toStr}`);
      const rdata = await res.json();

      if (!rdata.success) {
        setIsSearchingNext(false);
        return;
      }

      const allApts = rdata.appointments || [];
      const allBlocks = rdata.blocks || [];
      const settings = data.settings || data.settings;
      const employees = data.employees || data.employees;

      let foundNext = null;
      let foundSingle = null;

      for (let i = 0; i < 35; i++) {
        const curD = new Date(startObj);
        curD.setDate(curD.getDate() + i);
        const curDStr = getLocalDateStr(curD);
        if (curDStr > maxDateStr) break;

        if (isDayClosed(curDStr, targetServices)) continue;

        const dayApts = allApts.filter(a => a.date === curDStr);
        const curWeekday = curD.getDay();
        const dayBlocks = allBlocks.filter(b => {
          const bRecEnd = b.recurrenceEnd || b.recurrence_end;
          const bStartD = b.startDate || b.start_date;
          const bDate = b.date;
          const bRec = b.recurrence;
          if (bRecEnd && bRecEnd < curDStr) return false;
          if (bStartD && bStartD > curDStr) return false;
          if (bRec !== 'none' && bDate && bDate > curDStr) return false;
          if (!bRec || bRec === 'none') return bDate === curDStr;
          if (bRec === 'daily') return true;
          if (bRec === 'weekly' || bRec === 'biweekly') return b.weekday === curWeekday;
          return false;
        });

        // 1. Check full target services combo
        if (!foundNext) {
          const curSlots = computeSlotsForDate(curDStr, dayApts, settings, employees, targetServices, dayBlocks);
          const firstFree = curSlots.find(s => s.free);
          if (firstFree) {
            foundNext = {
              date: curDStr,
              slot: firstFree,
              time: firstFree.time,
              empName: firstFree.assign?.[0] || firstFree.emps?.[0]?.name || 'Especialista',
              totalDur: firstFree.totalDur
            };
          }
        }

        // 2. If multiple services, check if single service (first service) is available earlier
        if (targetServices.length > 1 && !foundSingle) {
          const singleSlots = computeSlotsForDate(curDStr, dayApts, settings, employees, [targetServices[0]], dayBlocks);
          const firstSingleFree = singleSlots.find(s => s.free);
          if (firstSingleFree) {
            foundSingle = {
              date: curDStr,
              slot: firstSingleFree,
              time: firstSingleFree.time,
              empName: firstSingleFree.assign?.[0] || firstSingleFree.emps?.[0]?.name || 'Especialista',
              totalDur: firstSingleFree.totalDur
            };
          }
        }

        if (foundNext && (targetServices.length === 1 || foundSingle)) {
          break;
        }
      }

      setNextAvailable(foundNext);
      if (foundSingle && foundNext && foundSingle.date < foundNext.date) {
        setSingleNextAvailable(foundSingle);
      } else {
        setTimeout(() => setSingleNextAvailable(null), 0);
      }
    } catch (err) {
      console.error('Error scanning next available:', err);
    }
    setIsSearchingNext(false);
  };

  const selectDate = (ds) => {
    setSelDate(ds);
    setSelSlotData(null);
    fetchSlotsForDate(ds, selServices);
  };

  const handleTimeSelect = (slot) => {
    if (!slot.free) return;
    setSelTime(slot.time);
    setAvailableEmpsForSelSlot(slot.emps || []);
    setSlotAssign(slot.assign || null);
    setSelSlotData(slot);
    // Reset the employee selection to 'Cualquiera' to avoid stale selection
    setFormEmp('Cualquiera');
  };

  const goToNextAvailable = (next) => {
    if (!next) return;
    const targetDate = next.date;
    const dObj = new Date(targetDate + 'T12:00:00');
    setCalViewDate(new Date(dObj.getFullYear(), dObj.getMonth(), 1));
    setSelDate(targetDate);
    setSelSlotData(null);
    fetchSlotsForDate(targetDate, selServices, next.slot);

    setTimeout(() => {
      const el = document.getElementById('slots-section');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }, 250);
  };

  const handleConfirmClick = (e) => {
    e.preventDefault();
    if (!formName || !formPhone || !formEmail || !formGdpr) {
      setErrorMsg('Rellena todos los campos obligatorios y acepta la política.');
      return;
    }
    setErrorMsg('');
    setShowConfirmModal(true);
  };

  const submitBooking = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!formName || !formPhone || !formEmail || !formGdpr) {
      setErrorMsg('Rellena todos los campos obligatorios y acepta la política.');
      return;
    }
    setErrorMsg('');
    setSubmitting(true);
    
    const servicesPayload = selServices.map(s => ({ name: s.name, employee: s.employee || '', duration: s.duration || 30, price: s.price || 0 }));
    // Asignar empleada automática si está vacía o si tiene varios nombres (comma-separated)
    var slotEmps = availableEmpsForSelSlot || [];
    servicesPayload.forEach(function(s, idx) {
      const needsResolve = !s.employee || s.employee === 'Todas' || s.employee === 'Ambos' || s.employee === 'Cualquiera' || s.employee.includes(',');
      if (needsResolve && slotEmps.length > 0) {
        if (slotAssign && slotAssign[idx]) s.employee = slotAssign[idx];
        else s.employee = slotEmps[0].name;
      }
    });
    const allEmps = [...new Set(servicesPayload.map(s => s.employee).filter(Boolean))];
    const payload = {
      clientName: formName,
      clientPhone: formPhone,
      clientEmail: formEmail,
      notes: formNotes,
      services: servicesPayload,
      service: servicesPayload.map(s => s.name).join(' + '),
      employee: allEmps.join(', ') || 'Todas',
      date: selDate,
      time: selTime,
      duration: getTotalDur(servicesPayload),
      price: servicesPayload.reduce((sum, s) => sum + (s.price || 0), 0),
      voucherCode: appliedVoucher ? appliedVoucher.code : null
    };
    
    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const resData = await res.json();
      
      if (resData.success) {
        setShowConfirmModal(false);
        setStep(4);
      } else {
        setShowConfirmModal(false);
        setErrorMsg('Error: ' + resData.error);
      }
    } catch (err) {
      setShowConfirmModal(false);
      setErrorMsg('Error de conexión.');
    }
    setSubmitting(false);
  };

  const cancelReservation = async () => {
    setSubmitting(true);
    setBookingResult(null);
    try {
      const res = await fetch(`/api/book?id=${editId}`, {
        method: 'DELETE'
      });
      const resData = await res.json();
      if (resData.success) {
        setBookingResult({ success: 'Tu cita ha sido cancelada correctamente. ¡Esperamos verte en otra ocasión!' });
      } else {
        setBookingResult({ error: resData.error || 'No se ha podido cancelar la cita.' });
      }
    } catch (e) {
      setBookingResult({ error: 'Error de conexión al intentar cancelar.' });
    }
    setSubmitting(false);
  };

  const resetBooking = () => {
    setStep(0);
    setSelServices([]);
    setShowSvcConfirm(false);
    setTimeout(() => setSelDate(null), 0);
    setTimeout(() => setSelTime(null), 0);
    setFormName('');
    setFormPhone('');
    setFormEmail('');
    setFormNotes('');
    setFormGdpr(false);
  };

  // Render variables
  const filteredServices = activeCat === 'all' 
    ? data.services 
    : data.services.filter(s => s.category === activeCat);

  // Calendar setup
  const y = calViewDate.getFullYear();
  const mo = calViewDate.getMonth();
  const firstDay = new Date(y, mo, 1);
  const off = (firstDay.getDay() + 6) % 7;
  const dim = new Date(y, mo + 1, 0).getDate();
  const todayStr = getLocalDateStr(new Date());
  
  // 2 month limit
  const isNextMonthDisabled = y > maxDateObj.getFullYear() || (y === maxDateObj.getFullYear() && mo >= maxDateObj.getMonth());

  return (
    <>
      {showLocation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{background:'rgba(46,40,38,.85)', backdropFilter:'blur(4px)'}}>
          <div className="bg-white rounded-3xl w-full max-w-sm shadow-2xl overflow-hidden animate-[fadeIn_0.3s_ease]" style={{border:'1px solid var(--brown-light)'}}>
            <div className="p-6 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{background:'var(--blue)'}}>
                <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"/><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"/></svg>
              </div>
              <h2 className="text-xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Estetica Respira</h2>
              <p className="text-sm font-bold text-[#a8876b] mb-3">Centro de transformación y belleza</p>
              <p className="text-sm font-semibold text-[#2e2826] mb-1">📍 C/ Santa Margalida 7</p>
              <p className="text-xs font-medium text-[#7a6b67]">Artà, Illes Balears</p>
              <div className="rounded-2xl overflow-hidden mb-4 shadow-sm border border-[#e0d8d5] h-40">
                <iframe
                  title="Ubicación Estetica Respira"
                  src="https://maps.google.com/maps?q=C%2F%20Santa%20Margalida%207%2C%20Art%C3%A0%2C%20Illes%20Balears&output=embed"
                  width="100%" height="100%" style={{border:0}} allowFullScreen loading="lazy" referrerPolicy="no-referrer-when-downgrade"
                />
              </div>
              <a
                href="https://www.google.com/maps/search/?api=1&query=C%2F+Santa+Margalida+7+Arta+Illes+Balears"
                target="_blank"
                rel="noopener noreferrer"
                className="block text-xs font-bold text-[#a8876b] mb-4 underline underline-offset-2"
              >
                Abrir en Google Maps →
              </a>
              <button
                onClick={() => setShowLocation(false)}
                className="w-full py-4 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all"
                style={{background:'var(--blue-deep)'}}
              >
                Entendido, quiero reservar
              </button>
            </div>
          </div>
        </div>
      )}
      <header className="sticky top-0 z-50 border-b shadow-sm" style={{background:'rgba(250,247,244,.95)', backdropFilter:'blur(20px)', borderColor:'var(--brown-light)'}}>
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[#f3ece4] overflow-hidden" onClick={() => window.location.href='/'} style={{cursor:'pointer'}}>
              <img src="/logo-icono.png" alt="Estetica Respira" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-base tracking-tight leading-none font-semibold italic text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Estetica Respira</h1>
              <p className="text-[9px] font-bold uppercase tracking-widest text-[#a8876b]">Reserva tu cita online</p>
            </div>
          </div>

          <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 border border-[#e0d8d5] shadow-sm">
            <div className="relative">
              <div className="w-2 h-2 rounded-full bg-green-500"></div>
              <div className="absolute inset-0 w-2 h-2 rounded-full bg-green-500 animate-ping opacity-75"></div>
            </div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-[#a8876b]">En línea</span>
          </div>

        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-8 pb-32">
        {isCancelMode && (
          <div className="animate-[fadeIn_0.5s_ease]">
            {bookingResult ? (
              <div className="card p-10 text-center">
                <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ${bookingResult.success ? 'bg-green-100' : 'bg-red-100'}`}>
                  {bookingResult.success ? <Check className="w-10 h-10 text-green-600" /> : <AlertCircle className="w-10 h-10 text-red-600" />}
                </div>
                <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>
                  {bookingResult.success ? 'Cancelación Realizada' : 'No se pudo cancelar'}
                </h2>
                <p className="font-medium mb-8 text-[#7a6b67]">{bookingResult.success || bookingResult.error}</p>
                <button onClick={() => window.location.href = '/'} className="btn-primary w-full justify-center">
                  Ir a la página principal
                </button>
              </div>
            ) : existingReserva ? (
              <div className="card p-8 text-center border-red-100 bg-gradient-to-b from-white to-[#fffcfc]">
                <div className="w-16 h-16 rounded-2xl bg-red-50 flex items-center justify-center mx-auto mb-6 text-red-500">
                  <Trash2 className="w-8 h-8" />
                </div>
                <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¿Anular tu cita?</h2>
                <p className="text-sm text-[#7a6b67] mb-8">Si confirmas, tu reserva será eliminada y el hueco quedará libre para otra clienta.</p>

                <div className="rounded-2xl p-6 text-left space-y-3 mb-8 border bg-white border-red-50 shadow-sm">
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Tratamiento</span>
                    <span className="font-bold text-[#2e2826]">{existingReserva.service}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Fecha</span>
                    <span className="font-bold text-[#a8876b]">{existingReserva.date?.split('-').reverse().join('/')}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="font-medium text-[#7a6b67]">Hora</span>
                    <span className="font-bold text-[#a8876b]">{existingReserva.time}h</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <button 
                    onClick={cancelReservation}
                    disabled={submitting}
                    className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-2xl shadow-lg transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {submitting ? <div className="spinner !border-white/30 !border-t-white"></div> : <Trash2 className="w-5 h-5" />}
                    Confirmar Anulación
                  </button>
                  <button 
                    onClick={() => window.location.href = '/'}
                    className="w-full bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-4 rounded-2xl transition-all"
                  >
                    Mantener Cita
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-slate-400">
                <div className="spinner mb-4 border-[#e0d8d5] border-t-[#a8876b]"></div>
                <p className="text-sm font-medium">Buscando tu reserva...</p>
              </div>
            )}
          </div>
        )}

        {!isCancelMode && step === 0 && (
          <div className="min-h-[80vh] flex flex-col items-center justify-center text-center py-12 animate-[fadeIn_0.5s_ease]">
            <div className="mb-8">
              <div className="w-28 h-28 rounded-3xl mx-auto shadow-xl mb-6 overflow-hidden" style={{boxShadow:'0 16px 48px rgba(91,143,160,.2)'}}>
                <img src="/logo-icono.png" alt="Estetica Respira" className="w-full h-full object-cover" />
              </div>
            </div>
            <h1 className="text-5xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Estetica Respira</h1>
            <p className="text-base font-medium mb-2 text-[#a8876b]">Centro de transformación y belleza</p>
            <p className="text-sm font-medium mb-10 max-w-xs text-[#7a6b67]">Centro de transformación y belleza en Artà. Belleza, calma y equilibrio.</p>
            <button onClick={() => setStep(1)} className="btn-primary text-base px-10 py-4 rounded-2xl shadow-xl active:scale-95" style={{boxShadow:'0 12px 32px rgba(91,143,160,.3)'}}>
              <CalendarPlus className="w-5 h-5" /> Reservar cita
            </button>
            <p className="text-xs font-medium mt-6 text-[#e0d8d5]">Reserva online · Sin esperas · 100% gratis</p>
          </div>
        )}

        {!isCancelMode && step > 0 && step < 4 && (
          <div className="flex items-start mb-8 px-4 animate-[fadeIn_0.3s_ease]">
            {[1, 2, 3].map(num => (
              <React.Fragment key={num}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`step-dot ${step === num ? 'active' : step > num ? 'done' : 'pending'}`}>{num}</div>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-[#7a6b67]">
                    {num === 1 ? 'Servicio' : num === 2 ? 'Fecha/Hora' : 'Datos'}
                  </span>
                </div>
                {num < 3 && <div className={`step-line ${step > num ? 'done' : 'pending'}`}></div>}
              </React.Fragment>
            ))}
          </div>
        )}

        {step === 1 && (
          <div className="step active">
            <div className="card p-6">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¿Qué tratamiento deseas?</h2>
              <p className="text-sm font-medium mb-5 text-[#7a6b67]">Selecciona los servicios que deseas (puedes elegir varios)</p>

              {selServices.length > 0 && (
                <div className="mb-4 p-3 rounded-xl border" style={{borderColor:'var(--blue)',background:'linear-gradient(135deg,var(--cream),white)'}}>
                  <p className="text-[10px] font-bold uppercase mb-2" style={{color:'var(--blue-deep)'}}>Servicios seleccionados</p>
                  <div className="flex flex-wrap gap-2">
                    {selServices.map((s, i) => (
                      <span key={s.id || i} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold bg-white border shadow-sm" style={{borderColor:'var(--blue-mid)',color:'var(--brown)'}}>
                        {s.name}
                        <button onClick={() => setSelServices(selServices.filter(sv => sv.id !== s.id))} className="text-red-400 hover:text-red-600 ml-0.5">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12"/></svg>
                        </button>
                      </span>
                    ))}
                    <span className="text-[10px] font-bold self-center ml-1" style={{color:'var(--blue-deep)'}}>
                      {getTotalDur(selServices)} min · {selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€
                    </span>
                  </div>
                </div>
              )}
              
              <div className="flex flex-wrap gap-2 mb-5">
                <button className={`cat-pill ${activeCat === 'all' ? 'active' : ''}`} onClick={() => setActiveCat('all')}>Todos</button>
                {data.categories.map(c => (
                  <button key={c.id} className={`cat-pill ${activeCat === c.name ? 'active' : ''}`} onClick={() => setActiveCat(c.name)}>
                    {c.name}
                  </button>
                ))}
              </div>

              <div className="space-y-3">
                {filteredServices.length === 0 ? (
                  <p className="text-center py-8 text-slate-400 text-sm">No hay servicios disponibles</p>
                ) : (
                  filteredServices.map(s => {
                    const isSel = selServices.some(sv => sv.id === s.id);
                    return (
                      <div key={s.id} className={`service-card ${isSel ? 'selected' : ''}`} onClick={() => {
                        if (isSel) setSelServices(selServices.filter(sv => sv.id !== s.id));
                        else setSelServices([...selServices, s]);
                      }}>
                        <div style={{flex:1}}>
                          <h4 className="font-bold text-sm text-[#2e2826]">{s.name}</h4>
                          {s.desc && <p className="text-xs mt-0.5 text-[#7a6b67]">{s.desc}</p>}
                          <div className="flex gap-3 mt-2">
                            <span className="text-[11px] font-semibold text-[#7a6b67]">⏱ {s.duration} min</span>
                          </div>
                        </div>
                        <div style={{textAlign:'right', flexShrink:0}}>
                          <span className="text-lg font-bold text-[#a8876b]">{s.price}€</span>
                          {isSel && <div className="text-[11px] font-bold mt-1 text-[#a8876b]">✓ Elegido</div>}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="step active">
            <div className="card p-6 mb-4">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Elige fecha y hora</h2>
              <p className="text-sm font-medium mb-3 sm:mb-4 text-[#7a6b67]">Elige día y hora disponible</p>
              
              {!selDate && nextAvailable && (
                <div className="mb-4 p-3 sm:p-3.5 rounded-2xl border bg-gradient-to-r from-white via-[#f3ece4] to-white flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 shadow-xs" style={{ borderColor: 'var(--blue-mid)' }}>
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-[#a8876b] shrink-0" />
                    <span className="text-xs text-[#2e2826]">
                      Próxima cita libre más cercana: <strong>{formatFriendlyDateShort(nextAvailable.date)} a las {nextAvailable.time}h</strong> ({nextAvailable.empName})
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => goToNextAvailable(nextAvailable)}
                    className="text-xs font-bold text-[#a8876b] hover:underline flex items-center gap-1 self-end sm:self-auto cursor-pointer"
                  >
                    <span>Ir directo a esta cita</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              
              <div className="flex items-center justify-between mb-4">
                <button onClick={() => setCalViewDate(new Date(y, mo - 1, 1))} className="p-2 rounded-xl border bg-white transition-colors border-[#e0d8d5] hover:bg-slate-50">
                  <ChevronLeft className="w-5 h-5 text-[#7a6b67]" />
                </button>
                <span className="font-bold text-sm capitalize text-[#2e2826]">{msNames[mo]} {y}</span>
                <button disabled={isNextMonthDisabled} onClick={() => setCalViewDate(new Date(y, mo + 1, 1))} className={`p-2 rounded-xl border transition-colors border-[#e0d8d5] ${isNextMonthDisabled ? 'bg-gray-100 opacity-50 cursor-not-allowed' : 'bg-white hover:bg-slate-50'}`}>
                  <ChevronRight className="w-5 h-5 text-[#7a6b67]" />
                </button>
              </div>

              <div className="grid grid-cols-7 text-center text-[10px] font-bold uppercase mb-2 tracking-widest text-[#7a6b67]">
                {dayNames.map(d => <div key={d}>{d}</div>)}
              </div>
              
              <div className="grid grid-cols-7 gap-1 mb-2">
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
                <div id="slots-section" className="mt-4 pt-4 border-t border-[#e0d8d5]">
                  <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-4 h-4 text-[#a8876b]" />
                    <h3 className="font-bold text-sm uppercase" style={{color:'var(--blue-deep)'}}>Selecciona hora</h3>
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-lg capitalize bg-[#f3ece4] text-[#a8876b]">
                      {selDate.split('-').reverse().join('/')}
                    </span>
                  </div>
                  
                  {loadingSlots ? (
                    <div className="flex justify-center py-4"><div className="spinner border-[#e0d8d5] border-t-[#a8876b]"></div></div>
                  ) : (
                    <>
                      {availableSlots.filter(s => s.free).length === 0 ? (
                        <div className="py-2">
                          <div className="text-center py-3 px-4 bg-[#fbf9f5] rounded-xl border border-dashed border-[#e0d8d5] mb-3">
                            <p className="text-[#7a6b67] font-semibold text-sm">No hay huecos libres para el {selDate.split('-').reverse().join('/')}</p>
                            <p className="text-[11px] mt-0.5 text-slate-400">
                              {selServices.some(s => s.selectedSpecialist) ? 'Prueba seleccionando "Automático" o revisa la siguiente fecha disponible a continuación' : 'Todos los horarios de este día están ocupados'}
                            </p>
                          </div>

                          {/* Banner / Tarjeta de Próxima Cita Disponible */}
                          {isSearchingNext ? (
                            <div className="p-4 rounded-2xl border bg-gradient-to-r from-white to-[#f3ece4] flex items-center justify-center gap-3 text-xs text-[#a8876b] font-semibold animate-pulse shadow-xs" style={{ borderColor: 'var(--blue-mid)' }}>
                              <div className="w-4 h-4 border-2 border-[#e0d8d5] border-t-[#a8876b] rounded-full animate-spin" />
                              <span>Buscando el próximo hueco disponible...</span>
                            </div>
                          ) : nextAvailable ? (
                            <div className="p-4 sm:p-5 rounded-2xl border-2 shadow-sm text-left transition-all" style={{ background: 'linear-gradient(135deg, #ffffff 0%, #f3ece4 100%)', borderColor: 'var(--blue-mid)' }}>
                              <div className="flex items-center justify-between gap-2 mb-2">
                                <div className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-[#a8876b]">
                                  <Sparkles className="w-4 h-4 text-[#d99ba1]" />
                                  <span>Próxima cita disponible</span>
                                </div>
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                                  Hueco libre
                                </span>
                              </div>

                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-1 pt-2 border-t border-[#e0d8d5]/80">
                                <div>
                                  <p className="text-sm sm:text-base font-extrabold text-[#2e2826] capitalize">
                                    {formatFriendlyDateLong(nextAvailable.date)}
                                  </p>
                                  <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs text-[#7a6b67]">
                                    <span className="font-extrabold text-[#a8876b] bg-white px-2.5 py-1 rounded-lg border border-[#e0d8d5] shadow-xs">
                                      🕒 {nextAvailable.time} h
                                    </span>
                                    <span>•</span>
                                    <span>Con <strong>{nextAvailable.empName}</strong></span>
                                    <span>•</span>
                                    <span>{nextAvailable.totalDur} min</span>
                                  </div>
                                </div>

                                <button
                                  type="button"
                                  onClick={() => goToNextAvailable(nextAvailable)}
                                  className="w-full sm:w-auto px-4 py-3 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md hover:opacity-95 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shrink-0 cursor-pointer"
                                  style={{ background: 'var(--blue-deep)' }}
                                >
                                  <span>Reservar este hueco</span>
                                  <ArrowRight className="w-4 h-4" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-xs text-center text-slate-400 py-2">
                              No se encontraron huecos disponibles en las próximas semanas para esta selección.
                            </p>
                          )}

                          {/* Consejo Inteligente para Citas Múltiples (Combo) */}
                          {selServices.length > 1 && (
                            <div className="mt-3.5 p-3.5 rounded-xl text-xs bg-amber-50/90 border border-amber-200 text-amber-900 leading-relaxed shadow-xs">
                              <div className="flex items-start gap-2.5">
                                <Info className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <p className="font-bold text-amber-950">
                                    💡 Consejo para citas de varios servicios ({selServices.reduce((sum, s) => sum + parseInt(s.duration || 0, 10), 0)} min):
                                  </p>
                                  <p className="text-[11px] text-amber-800">
                                    Has seleccionado {selServices.length} servicios consecutivos, por lo que el sistema busca un bloque continuo amplio con la misma especialista.
                                  </p>
                                  {singleNextAvailable && (!nextAvailable || singleNextAvailable.date < nextAvailable.date) && (
                                    <div className="mt-2 p-2.5 bg-emerald-50 rounded-lg border border-emerald-200 text-emerald-900 text-[11px]">
                                      ✨ <strong>¿Necesitas cita antes?</strong> Para tu primer servicio (<strong>{selServices[0].name}</strong>) hay disponibilidad más pronto: el <strong>{formatFriendlyDateLong(singleNextAvailable.date)} a las {singleNextAvailable.time}h</strong> con {singleNextAvailable.empName}. Puedes reservar cada servicio por separado si prefieres acudir antes.
                                    </div>
                                  )}
                                  {(!singleNextAvailable || (nextAvailable && singleNextAvailable.date >= nextAvailable.date)) && (
                                    <p className="text-[11px] text-amber-800 mt-1">
                                      Si necesitas una fecha más cercana, también puedes reservar los servicios en citas separadas en distintos días u horarios.
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
                          {availableSlots.map(slot => (
                            <button 
                              key={slot.time} 
                              disabled={!slot.free}
                              onClick={() => handleTimeSelect(slot)}
                              className={`time-slot ${slot.free ? (selTime === slot.time ? 'selected' : '') : 'occupied'}`}
                            >
                              {slot.time}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {selServices.length > 0 && (
                    <div className="mt-4 p-3 rounded-xl border" style={{borderColor:'var(--blue)',background:'linear-gradient(135deg,var(--cream),white)'}}>
                      <p className="text-[10px] font-bold uppercase mb-2" style={{color:'var(--blue-deep)'}}>Especialistas disponibles</p>
                      {selServices.map((s, i) => {
                        const origSvc = data.services.find(ds => ds.name === s.name) || s;
                        const eligibleEmps = getCandidatesForService(origSvc);
                        const isMultiple = eligibleEmps.length > 1;
                        return (
                          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0 text-xs" style={{borderColor:'var(--brown-light)'}}>
                            <span style={{color:'var(--brown)'}}>{s.name}</span>
                            {isMultiple ? (
                              <select value={s.selectedSpecialist || ''} onChange={function(ev){
                                var val = ev.target.value;
                                var updated = selServices.map(function(sv, idx){ return idx === i ? {...sv, selectedSpecialist: val} : sv; });
                                setSelServices(updated);
                                if (selDate) { setTimeout(() => setSelTime(null), 0); fetchSlotsForDate(selDate, updated); }
                              }} className="p-1.5 border rounded-lg text-[10px] font-bold outline-none" style={{background:'white',borderColor:'var(--blue-mid)',color:'var(--blue-deep)'}}>
                                <option value="">Automático</option>
                                {eligibleEmps.map(function(emp){ return <option key={emp.id} value={emp.name}>{emp.name}</option>; })}
                              </select>
                            ) : (
                              <span className="font-bold" style={{color:'var(--blue-deep)'}}>{eligibleEmps[0] ? eligibleEmps[0].name : (s.selectedSpecialist || s.employee || 'Especialista')}</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {selServices.length > 1 && (function(){
                    const sumDur = selServices.reduce((sum, s) => sum + parseInt(s.duration || 0, 10), 0);
                    if (selSlotData && selSlotData.assign) {
                      const uniqueAssign = [...new Set(selSlotData.assign.filter(Boolean))];
                      if (uniqueAssign.length <= 1) {
                        const empName = uniqueAssign[0] || 'tu especialista';
                        const endMin = t2m(selTime) + (selSlotData.totalDur || sumDur);
                        return (
                          <div className="mt-4 p-3.5 rounded-xl text-xs leading-relaxed border shadow-sm" style={{background:'#f0fdf4',borderColor:'#86efac',color:'#166534'}}>
                            <div className="flex items-center gap-2 font-bold mb-1 text-sm">
                              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Cita consecutiva con {empName} ({selSlotData.totalDur || sumDur} min)</span>
                            </div>
                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                              Los {selServices.length} servicios se realizarán seguidos uno tras otro por <strong>{empName}</strong>, de <strong>{selTime}h</strong> a <strong>{m2t(endMin)}h</strong> ({selSlotData.totalDur || sumDur} min seguidos).
                            </p>
                          </div>
                        );
                      } else {
                        return (
                          <div className="mt-4 p-3.5 rounded-xl text-xs leading-relaxed border shadow-sm" style={{background:'#f0fdf4',borderColor:'#86efac',color:'#166534'}}>
                            <div className="flex items-center gap-2 font-bold mb-1 text-sm">
                              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Servicios simultáneos en paralelo ({selSlotData.totalDur} min)</span>
                            </div>
                            <p className="text-[11px] text-emerald-800 leading-relaxed">
                              Tus servicios se realizarán al mismo tiempo por distintas profesionales (<strong>{uniqueAssign.join(', ')}</strong>) a partir de las <strong>{selTime}h</strong>.
                            </p>
                          </div>
                        );
                      }
                    }

                    return (
                      <div className="mt-4 p-3.5 rounded-xl text-xs leading-relaxed border shadow-sm" style={{background:'#fffbeb',borderColor:'#fde68a',color:'#92400e'}}>
                        <div className="flex items-center gap-2 font-bold mb-1">
                          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>Servicios combinados ({sumDur} min de atención total)</span>
                        </div>
                        <p className="text-[11px] text-amber-800 leading-relaxed">
                          Tus servicios se realizarán de forma consecutiva por una misma especialista ({sumDur} min seguidos). Si hay varias profesionales disponibles a la misma hora, el sistema también te ofrecerá la opción en paralelo.
                        </p>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
            <button className="btn-back" onClick={() => setStep(1)}>
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
        )}

        {step === 3 && (
          <div className="step active">
            <div className="card p-5 mb-4 bg-gradient-to-br from-[#fbf2f3] to-[#f3ece4] border-[#d99ba1]">
              <p className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2 text-[#a8876b]">
                <ClipboardCheck className="w-4 h-4" /> Resumen de tu cita
              </p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between items-start">
                  <span className="font-medium text-[#7a6b67] shrink-0 mr-2">Servicios</span>
                  <div className="text-right space-y-1">
                    {selServices.map((s, idx) => (
                      <div key={idx} className="text-xs font-bold" style={{color:'var(--brown)'}}>
                        {s.name} <span className="text-[10px] text-[#a8876b] font-normal">({slotAssign?.[idx] || s.employee || 'Especialista'})</span>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#7a6b67]">Fecha y horario</span>
                  <span className="font-bold text-xs" style={{color:'var(--blue-deep)'}}>{selDate?.split('-').reverse().join('/')} · {selTime}h - {m2t(t2m(selTime) + (selSlotData?.totalDur || getTotalDur(selServices)))}h</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="font-medium text-[#7a6b67]">Duración total</span>
                  <span className="font-bold" style={{color:'var(--blue-deep)'}}>{selSlotData?.totalDur || getTotalDur(selServices)} min</span>
                </div>
                <div className="pt-2 border-t space-y-1.5" style={{borderColor:'var(--blue)'}}>
                  <div className="flex justify-between items-center">
                    <span className="font-medium text-[#7a6b67]">Precio servicios</span>
                    <span className="font-bold text-xs" style={{color:'var(--brown)'}}>{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</span>
                  </div>
                  {appliedVoucher && (
                    <div className="flex justify-between items-center text-xs text-emerald-700 font-bold">
                      <span>Bono ({appliedVoucher.code})</span>
                      <span>-{Math.min(selServices.reduce((sum, s) => sum + (s.price || 0), 0), appliedVoucher.amount).toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-1 border-t border-dashed border-[#e0d8d5]">
                    <span className="font-bold text-[#2e2826]">Total a pagar</span>
                    <span className="font-black text-base" style={{color:'var(--blue-deep)'}}>
                      {Math.max(0, selServices.reduce((sum, s) => sum + (s.price || 0), 0) - (appliedVoucher ? Math.min(selServices.reduce((sum, s) => sum + (s.price || 0), 0), appliedVoucher.amount) : 0)).toFixed(2)}€
                      {appliedVoucher && (selServices.reduce((sum, s) => sum + (s.price || 0), 0) <= appliedVoucher.amount) && (
                        <span className="block text-[10px] font-bold text-emerald-700">Cubierto por bono</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Módulo de Bono o Cheque Regalo */}
            <div className="card p-4 sm:p-5 mb-4 bg-white border border-[#e0d8d5] shadow-sm">
              <div className="flex items-center gap-2 mb-2.5">
                <Ticket className="w-4 h-4 text-[#a8876b]" />
                <h4 className="text-xs font-black uppercase tracking-wider text-[#2e2826]">¿Tienes un bono o cheque regalo?</h4>
              </div>
              {!appliedVoucher ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={voucherCodeInput}
                      onChange={e => setVoucherCodeInput(e.target.value.toUpperCase())}
                      placeholder="Código (ej. BONO-AB12CD)"
                      className="input-field flex-1 font-mono text-xs uppercase tracking-wider"
                    />
                    <button
                      type="button"
                      onClick={handleApplyVoucher}
                      disabled={voucherLoading || !voucherCodeInput.trim()}
                      className="btn-primary px-4 py-2.5 text-xs font-bold uppercase tracking-wider shrink-0 disabled:opacity-50"
                      style={{background:'var(--blue-deep)'}}
                    >
                      {voucherLoading ? 'Validando...' : 'Aplicar'}
                    </button>
                  </div>
                  {voucherError && (
                    <p className="text-xs font-semibold text-red-600 bg-red-50 p-2.5 rounded-xl border border-red-200">
                      ⚠️ {voucherError}
                    </p>
                  )}
                </div>
              ) : (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-black text-emerald-900 font-mono tracking-wider">{appliedVoucher.code}</span>
                      <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-emerald-200 text-emerald-900">Aplicado</span>
                    </div>
                    <p className="text-[11px] text-emerald-700 font-medium">
                      Descuento de {appliedVoucher.amount.toFixed(2)}€ aplicado a esta reserva
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleRemoveVoucher}
                    className="text-xs font-bold text-red-600 hover:text-red-800 underline px-2 py-1"
                  >
                    Quitar
                  </button>
                </div>
              )}
            </div>

            <form onSubmit={handleConfirmClick} className="card p-6 mb-4">
              <h2 className="text-2xl font-semibold italic mb-1 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>Tus datos</h2>
              <p className="text-sm font-medium mb-5 text-[#7a6b67]">Necesitamos tus datos para confirmar la cita</p>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Nombre completo *</label>
                  <input type="text" required value={formName} onChange={e=>setFormName(e.target.value)} className="input-field" placeholder="Tu nombre y apellidos" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Teléfono *</label>
                  <input type="tel" required value={formPhone} onChange={e=>setFormPhone(e.target.value)} className="input-field" placeholder="600 000 000" />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Email *</label>
                  <input type="email" required value={formEmail} onChange={e=>setFormEmail(e.target.value)} className="input-field" placeholder="tu@email.com" />
                  <p className="text-[10px] font-medium mt-1.5 leading-relaxed" style={{color:'var(--brown-mid)'}}>Necesario para enviarte el <strong>recordatorio</strong> de tu cita, cualquier <strong>modificación</strong> o el enlace para <strong>cancelar</strong> si lo necesitas. Sin email no podremos avisarte.</p>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider mb-2 text-[#7a6b67]">Notas o comentarios (opcional)</label>
                  <textarea value={formNotes} onChange={e=>setFormNotes(e.target.value)} className="input-field resize-none" style={{height:'80px'}} placeholder="Alergias, peticiones especiales..."></textarea>
                </div>
                <div className="border border-[#e0d8d5] rounded-2xl overflow-hidden bg-white">
                  <div onClick={()=>setShowTerms(!showTerms)} className="flex items-center justify-between p-4 cursor-pointer text-xs font-bold text-[#7a6b67] hover:text-[#2e2826] uppercase tracking-widest select-none">
                    <span>Condiciones de Cita y Protección de Datos</span>
                    <svg className={'w-4 h-4 transition-transform '+(showTerms?'rotate-180':'')} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/></svg>
                  </div>
                  {showTerms && (
                    <div className="px-4 pb-4 space-y-4 text-xs text-[#7a6b67] leading-relaxed max-h-52 overflow-y-auto border-t border-[#e0d8d5] pt-4">
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">1. Condiciones de la Cita</h4><p>La cita se confirma una vez recibida y procesada por el sistema. Estetica Respira se reserva el derecho de modificar o cancelar la cita en caso de incidencias técnicas o de agenda, informando al cliente por los medios facilitados. En caso de no presentarse sin aviso previo con al menos 3 horas de antelación, el estudio podrá requerir una confirmación previa para futuras reservas.</p></div>
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">2. Responsabilidad del Cliente</h4><p>El cliente se compromete a facilitar datos veraces y actualizados. La información sobre alergias, sensibilidades cutáneas o condiciones médicas se facilita voluntariamente; el estudio hará lo posible por atenderlas pero no puede garantizar la ausencia total de reacciones en tratamientos de belleza.</p></div>
                      <div><h4 className="font-bold text-[#2e2826] text-xs uppercase tracking-widest mb-2">3. Protección de Datos (RGPD)</h4><p><strong>Responsable:</strong> Estetica Respira · C/ Santa Margalida 7, Artà (Illes Balears).</p><p><strong>Finalidad:</strong> Gestionar citas, enviar recordatorios, comunicar cambios o cancelaciones, enviar encuesta post-visita por email, y mantener histórico de visitas.</p><p><strong>Base legítima:</strong> Ejecución de un contrato (la cita) y consentimiento explícito.</p><p><strong>Destinatarios:</strong> No se cederán a terceros salvo obligación legal. Servicios cloud (Vercel, Google Cloud) acogidos al Privacy Framework UE-EEUU.</p><p><strong>Plazo:</strong> Durante la relación comercial y hasta 5 años después.</p><p><strong>Derechos:</strong> Acceso, rectificación, supresión, limitación, portabilidad y oposición escribiendo a <strong>reservas.esteticarespira@gmail.com</strong>. Reclamación ante la AEPD.</p><p><strong>Comunicaciones:</strong> Al facilitar email y teléfono, el cliente consiente recibir comunicaciones de su cita y un email post-visita de valoración, sin publicidad comercial.</p></div>
                    </div>
                  )}
                  <div className="flex items-start gap-3 p-4 border-t border-[#e0d8d5] bg-[#faf7f4]">
                    <input type="checkbox" id="terms-check" required checked={formGdpr} onChange={e=>setFormGdpr(e.target.checked)} className="mt-1 w-5 h-5 rounded cursor-pointer shrink-0" style={{accentColor:'var(--blue-deep)'}} />
                    <label htmlFor="terms-check" className="text-xs font-medium cursor-pointer leading-relaxed text-[#7a6b67]">
                      He leído y acepto las <strong className="text-[#2e2826]">condiciones de cita</strong> y la <strong className="text-[#2e2826]">política de privacidad</strong> según el RGPD.
                    </label>
                  </div>
                </div>
              </div>

              {errorMsg && (
                <div className="mt-4 text-sm font-semibold px-4 py-3 rounded-2xl border bg-[#fdf0f1] border-[#f3c6cb] text-[#c0464f]">
                  {errorMsg}
                </div>
              )}

              <div className="mt-8">
                <button type="submit" disabled={submitting} className="btn-primary w-full justify-center text-base py-4 rounded-2xl shadow-2xl" style={{boxShadow:'0 8px 32px rgba(196,126,133,0.35)'}}>
                  {submitting ? <div className="spinner"></div> : <Check className="w-5 h-5" />}
                  <span>{submitting ? 'Reservando...' : 'Confirmar Cita'}</span>
                </button>
              </div>
            </form>
            <button className="btn-back" onClick={() => setStep(2)}>
              <ArrowLeft className="w-4 h-4" /> Atrás
            </button>
          </div>
        )}

        {step === 4 && (
          <div className="step active">
            <div className="card p-10 text-center">
              <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 bg-gradient-to-br from-[#d99ba1] to-[#a8876b]" style={{boxShadow:'0 12px 32px rgba(91,143,160,.3)'}}>
                <Check className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-semibold italic mb-2 text-[#2e2826]" style={{fontFamily:"'Cormorant Garamond',serif"}}>¡Cita confirmada!</h2>
              <p className="font-medium mb-6 text-[#7a6b67]">Te esperamos en Estetica Respira. Hasta pronto 🌸</p>

              <div className="rounded-2xl p-5 text-left space-y-3 mb-8 border bg-[#faf7f4] border-[#e0d8d5]">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Servicios</span>
                  <span className="font-bold text-right max-w-[65%]" style={{color:'var(--brown)'}}>{selServices.map(s => s.name).join(' + ')}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Duración total</span>
                  <span className="font-bold" style={{color:'var(--blue-deep)'}}>{getTotalDur(selServices)} min</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-[#7a6b67]">Fecha y hora</span>
                  <span className="font-bold" style={{color:'var(--blue-deep)'}}>{selDate?.split('-').reverse().join('/')} · {selTime}h</span>
                </div>
                {appliedVoucher && (
                  <div className="flex justify-between text-xs pt-2 border-t border-dashed border-[#e0d8d5] text-emerald-800 font-bold">
                    <span>Bono / Cheque aplicado</span>
                    <span className="font-mono">{appliedVoucher.code} (-{Math.min(selServices.reduce((sum, s) => sum + (s.price || 0), 0), appliedVoucher.amount).toFixed(2)}€)</span>
                  </div>
                )}
              </div>

              <p className="text-xs font-medium mb-6 text-[#7a6b67]">Para cancelar o modificar tu cita, utiliza el enlace que llegará a tu correo electrónico.</p>
              <button onClick={resetBooking} className="btn-primary w-full justify-center">
                <PlusCircle className="w-4 h-4" /> Hacer otra reserva
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Flotante para paso 1 y 2 */}
      {step > 0 && step < 3 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 p-3 pb-5 pointer-events-none" style={{background:'linear-gradient(to top,rgba(250,247,244,1) 70%,rgba(250,247,244,0))'}}>
          <div className="max-w-2xl mx-auto pointer-events-auto">
            {step === 1 && selServices.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-medium truncate mr-3 text-[#7a6b67]">{selServices.map(s => s.name).join(' + ')} · {getTotalDur(selServices)} min</p>
                <p className="text-sm font-bold whitespace-nowrap text-[#a8876b]">{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</p>
              </div>
            )}
            {step === 2 && selServices.length > 0 && (
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs font-medium truncate mr-3 text-[#7a6b67]">{selServices.map(s => s.name).join(' + ')} · {getTotalDur(selServices)} min</p>
                <p className="text-sm font-bold whitespace-nowrap text-[#a8876b]">{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</p>
              </div>
            )}
            {step === 1 && showSvcConfirm && (
              <div className="flex gap-2">
                <button onClick={function(){setShowSvcConfirm(false)}} className="flex-1 py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-[0.98] transition-all bg-white border-2" style={{borderColor:'var(--blue-deep)',color:'var(--blue-deep)'}}>+ Añadir más</button>
                <button onClick={function(){setShowSvcConfirm(false);setStep(2)}} className="flex-1 py-4 rounded-2xl font-bold text-sm text-white shadow-lg active:scale-[0.98] transition-all" style={{background:'var(--blue-deep)'}}>Elegir fecha</button>
              </div>
            )}
            {(!showSvcConfirm || step === 2) && (
            <button 
              onClick={function(){if(step===1){setShowSvcConfirm(true)}else{setStep(3)}}}
              disabled={step === 1 ? selServices.length === 0 : !(selDate && selTime)}
              className="btn-primary w-full justify-center text-base py-4 rounded-2xl shadow-2xl" 
              style={{boxShadow:'0 8px 32px rgba(196,126,133,0.35)'}}
            >
              <ArrowRight className="w-5 h-5" />
              <span>{step === 1 ? 'Continuar' : (selDate && selTime ? 'Reservar' : 'Elige hora')}</span>
            </button>
            )}
          </div>
        </div>
      )}

      {/* Modal de confirmación de reserva */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md max-h-[90vh] flex flex-col bg-[#faf7f4] rounded-3xl overflow-hidden border border-[#e0d8d5] shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="bg-gradient-to-br from-[#fbf2f3] to-[#f3ece4] border-b border-[#d99ba1] p-4 text-center shrink-0">
              <div className="flex items-center justify-center gap-2 mb-0.5">
                <AlertCircle className="w-5 h-5 text-[#a8876b]" />
                <h3 className="text-lg font-bold text-[#2e2826] italic" style={{fontFamily:"'Cormorant Garamond',serif"}}>Confirmación de tu reserva</h3>
              </div>
              <p className="text-[11px] text-[#7a6b67] font-medium">Revisa tus servicios y el local antes de confirmar</p>
            </div>

            {/* Banner de Ubicación Destacado */}
            <div className="bg-gradient-to-r from-[#2e2826] to-[#423b38] text-white py-2 px-4 text-center shadow-inner shrink-0">
              <div className="flex items-center justify-center gap-1.5">
                <span className="text-[10px] uppercase tracking-widest font-black text-[#c9a96e]">📍 LOCAL DE RESERVA:</span>
                <span className="text-xs font-extrabold uppercase tracking-wider text-white">ESTETICA RESPIRA (ARTÀ)</span>
              </div>
              <a href="https://www.google.com/maps/search/?api=1&query=C%2F+Santa+Margalida+7+Arta+Illes+Balears" target="_blank" rel="noopener noreferrer" className="text-[11px] font-medium text-amber-200 hover:underline block leading-tight mt-0.5">
                C/ Santa Margalida 7 · Artà, Illes Balears
              </a>
            </div>
            
            {/* Body con scroll independiente si hay varios servicios */}
            <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-3">
              <div className="bg-white rounded-2xl border border-[#e0d8d5] p-4 space-y-3 shadow-sm">
                <div>
                  <h4 className="text-[10px] font-black uppercase tracking-wider text-[#7a6b67] mb-1.5">Servicios contratados:</h4>
                  <ul className="space-y-2">
                    {selServices.map((s, idx) => (
                      <li key={idx} className="flex justify-between items-start text-xs border-b border-dashed border-[#faf7f4] pb-1.5 last:border-0 last:pb-0">
                        <div className="pr-3">
                          <span className="font-bold text-[#2e2826] block">• {s.name}</span>
                          <span className="text-[10px] text-[#a8876b] font-semibold block ml-2">
                            con {slotAssign?.[idx] || s.employee || 'Especialista asignada'}
                          </span>
                        </div>
                        <span className="font-semibold text-[#7a6b67] shrink-0">{s.price || 0}€ ({s.duration || 30} min)</span>
                      </li>
                    ))}
                  </ul>
                </div>
                
                <div className="pt-2.5 border-t border-[#e0d8d5] space-y-1.5 text-xs">
                  <div className="flex justify-between">
                    <span className="font-medium text-[#7a6b67]">Fecha y horario:</span>
                    <span className="font-bold text-[#2e2826]">{selDate?.split('-').reverse().join('/')} de {selTime}h a {m2t(t2m(selTime) + (selSlotData?.totalDur || getTotalDur(selServices)))}h</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="font-medium text-[#7a6b67]">Duración total:</span>
                    <span className="font-bold text-[#a8876b]">{selSlotData?.totalDur || getTotalDur(selServices)} min</span>
                  </div>
                  <div className="flex justify-between text-xs pt-1 border-t border-dashed border-[#e0d8d5]">
                    <span className="font-medium text-[#7a6b67]">Precio servicios:</span>
                    <span className="font-bold text-[#2e2826]">{selServices.reduce((sum, s) => sum + (s.price || 0), 0)}€</span>
                  </div>
                  {appliedVoucher && (
                    <div className="flex justify-between text-xs text-emerald-700 font-bold">
                      <span>Bono ({appliedVoucher.code}):</span>
                      <span>-{Math.min(selServices.reduce((sum, s) => sum + (s.price || 0), 0), appliedVoucher.amount).toFixed(2)}€</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm font-black pt-1 border-t border-[#e0d8d5]">
                    <span className="text-[#2e2826]">Total a pagar:</span>
                    <span className="text-[#a8876b] text-base">
                      {Math.max(0, selServices.reduce((sum, s) => sum + (s.price || 0), 0) - (appliedVoucher ? Math.min(selServices.reduce((sum, s) => sum + (s.price || 0), 0), appliedVoucher.amount) : 0)).toFixed(2)}€
                      {appliedVoucher && (selServices.reduce((sum, s) => sum + (s.price || 0), 0) <= appliedVoucher.amount) && (
                        <span className="block text-[10px] text-emerald-700 font-bold">Totalmente pagado</span>
                      )}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            
            {/* Footer Siempre Visible */}
            <div className="bg-[#faf7f4] border-t border-[#e0d8d5] p-3.5 sm:p-4 flex gap-3 shrink-0">
              <button 
                type="button"
                onClick={() => setShowConfirmModal(false)}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-[#7a6b67] border border-[#e0d8d5] bg-white hover:bg-neutral-50 transition-colors"
              >
                Modificar
              </button>
              <button 
                type="button"
                onClick={() => {
                  submitBooking();
                }}
                disabled={submitting}
                className="flex-1 py-3 px-4 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-md transition-all active:scale-[0.98] flex items-center justify-center gap-1.5"
                style={{background:'var(--blue-deep)'}}
              >
                {submitting ? 'Confirmando...' : 'Confirmar Reserva'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}



