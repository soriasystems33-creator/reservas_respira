'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Clock,
  ChevronRight,
  ChevronLeft,
  ArrowLeft,
  Check,
  CheckCircle2,
  MapPin,
  Share2,
  Heart,
  Search,
  Navigation,
  X,
  Phone,
  Calendar,
  MessageCircle,
  Loader2,
  Sparkles,
  Trash2,
  Ticket,
  Sun,
  Moon
} from 'lucide-react';

export default function BookingPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f4]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-10 h-10 border-3 border-stone-200 border-t-[#6b8a5a] rounded-full animate-spin"></div>
          <p className="text-xs font-semibold text-stone-500 tracking-wide uppercase">Cargando Respira...</p>
        </div>
      </div>
    }>
      <BookingFunnelContent />
    </Suspense>
  );
}

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MONTH_NAMES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
];

function BookingFunnelContent() {
  // 1. DATOS PRINCIPALES DE SUPABASE
  const [data, setData] = useState({ services: [], categories: [], employees: [], settings: null });
  const [loading, setLoading] = useState(true);

  // 2. ESTADOS DEL EMBUDO (Vista General vs Modal de Reserva)
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [bookingStep, setBookingStep] = useState('datetime'); // 'datetime' | 'customer' | 'success'

  // 3. SELECCIÓN DE RESERVA
  const [selectedService, setSelectedService] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null); // null = Cualquiera
  const [selectedDate, setSelectedDate] = useState(''); // YYYY-MM-DD
  const [selectedTime, setSelectedTime] = useState(''); // HH:MM
  const [selectedSlotData, setSelectedSlotData] = useState(null);

  // 4. UI, FILTROS Y BÚSQUEDA
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [isSaved, setIsSaved] = useState(false);
  const [shareToast, setShareToast] = useState(false);
  const hoursSectionRef = useRef(null);
  const servicesSectionRef = useRef(null);

  // 5. CALENDARIO AIRBNB
  const [calendarViewDate, setCalendarViewDate] = useState(() => new Date());

  // 6. DISPONIBILIDAD Y SLOTS
  const [availableSlots, setAvailableSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 7. PRÓXIMO HUECO DISPONIBLE INTELIGENTE
  const [nextAvailableSlot, setNextAvailableSlot] = useState(null);
  const [isSearchingNext, setIsSearchingNext] = useState(false);

  // 8. FORMULARIO DE CLIENTE & VOUCHER/BONO
  const [customerData, setCustomerData] = useState({ name: '', phone: '', email: '', notes: '', gdpr: false });
  const [voucherCodeInput, setVoucherCodeInput] = useState('');
  const [appliedVoucher, setAppliedVoucher] = useState(null);
  const [voucherLoading, setVoucherLoading] = useState(false);
  const [voucherError, setVoucherError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedBooking, setCompletedBooking] = useState(null);

  // 9. DETECCIÓN DE CANCELACIÓN O MODIFICACIÓN POR URL
  const searchParams = useSearchParams();
  const cancelId = searchParams.get('cancelar') || (searchParams.get('cancel') === '1' ? searchParams.get('id') : null);

  // Cargar datos iniciales desde /api/data
  useEffect(() => {
    fetch('/api/data')
      .then(res => res.json())
      .then(res => {
        if (res.success) {
          setData({
            services: res.services || [],
            categories: res.categories || [],
            employees: res.employees || [],
            settings: res.settings || null
          });
        }
        setLoading(false);
      })
      .catch(err => {
        console.error('Error fetching initial data:', err);
        setLoading(false);
      });
  }, []);

  // Conversión de horas y utilidades de tiempo
  const t2m = (t) => {
    if (!t) return 0;
    const p = t.split(':').map(Number);
    return (p[0] || 0) * 60 + (p[1] || 0);
  };

  const m2t = (m) => {
    return String(Math.floor(m / 60)).padStart(2, '0') + ':' + String(m % 60).padStart(2, '0');
  };

  const getLocalDateStr = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const formatDatePretty = (dStr) => {
    if (!dStr) return '';
    try {
      const [y, m, d] = dStr.split('-').map(Number);
      const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
      return date.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
    } catch {
      return dStr;
    }
  };

  // Horario semanal de Respira
  const weeklyScheduleList = useMemo(() => {
    return [
      { name: 'Lunes', hours: '09:00 – 20:00', isClosed: false, dayNum: 1 },
      { name: 'Martes', hours: '09:00 – 20:00', isClosed: false, dayNum: 2 },
      { name: 'Miércoles', hours: '09:00 – 20:00', isClosed: false, dayNum: 3 },
      { name: 'Jueves', hours: '09:00 – 20:00', isClosed: false, dayNum: 4 },
      { name: 'Viernes', hours: '09:00 – 20:00', isClosed: false, dayNum: 5 },
      { name: 'Sábado', hours: 'Cerrado', isClosed: true, dayNum: 6 },
      { name: 'Domingo', hours: 'Cerrado', isClosed: true, dayNum: 0 }
    ];
  }, []);

  // Estado dinámico de si está abierto hoy
  const todayStatus = useMemo(() => {
    const now = new Date();
    const day = now.getDay();
    const curMin = now.getHours() * 60 + now.getMinutes();

    if (day === 0 || day === 6) {
      return { isOpen: false, text: 'Cerrado hoy · Abre el lunes a las 09:00' };
    }

    const openMin = 9 * 60;
    const closeMin = 20 * 60;

    if (curMin < openMin) {
      return { isOpen: false, text: 'Abre hoy a las 09:00' };
    }
    if (curMin >= openMin && curMin < closeMin) {
      return { isOpen: true, text: 'Abierto hoy · Cierra a las 20:00' };
    }
    return { isOpen: false, text: 'Cerrado ahora · Abre mañana a las 09:00' };
  }, []);

  // Categorías de servicios únicas
  const categories = useMemo(() => {
    const set = new Set();
    data.services.forEach(s => {
      if (s.category && s.category.trim()) set.add(s.category.trim());
    });
    return Array.from(set);
  }, [data.services]);

  // Filtro de servicios en tiempo real
  const filteredServices = useMemo(() => {
    let list = data.services;
    if (selectedCategory !== 'all') {
      list = list.filter(s => (s.category || '').toLowerCase() === selectedCategory.toLowerCase());
    }
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase().trim();
    return list.filter(s =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.description && s.description.toLowerCase().includes(q))
    );
  }, [data.services, searchQuery, selectedCategory]);

  // Manejador para compartir
  const handleShare = async () => {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: 'Centro de estética Respira',
          text: 'Reserva cita online en el Centro de estética Respira en Artà',
          url: window.location.href,
        });
        return;
      } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setShareToast(true);
      setTimeout(() => setShareToast(false), 2500);
    }
  };

  // Cálculo de configuración de horarios por empleada (matching backend logic)
  const getDCforEmp = useCallback((dateStr, empName) => {
    const ss = data.settings;
    const sd = ss?.specialDays || {};
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

    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (ss?.weekly && ss.weekly[day] && ss.weekly[day].closed) {
      return { type: 'closed' };
    }

    const key = 'weekly_' + empName;
    const empWeeklyObj = ss ? (ss[key] || ss.weekly?.[key]) : null;
    if (empWeeklyObj && empWeeklyObj[day]) {
      const w = empWeeklyObj[day];
      if (w.closed) return { type: 'closed' };
      return { type: w.type || 'standard', start: w.start, end: w.end, start2: w.start2, end2: w.end2 };
    }

    if (ss?.weekly && ss.weekly[day]) {
      const w = ss.weekly[day];
      if (w.closed) return { type: 'closed' };
      return { type: w.type || 'standard', start: w.start, end: w.end, start2: w.start2, end2: w.end2 };
    }

    return { type: 'standard', start: '09:00', end: '20:00' };
  }, [data.settings, data.employees]);

  const isTimeInDC = (dc, startMin, dur) => {
    const endMin = startMin + dur;
    if (dc.type === 'closed') return false;
    if (dc.type === 'split') {
      const m1s = t2m(dc.start), m1e = t2m(dc.end);
      const m2s = t2m(dc.start2), m2e = t2m(dc.end2);
      return (startMin >= m1s && endMin <= m1e) || (startMin >= m2s && endMin <= m2e);
    }
    const s = t2m(dc.start || '09:00');
    const e = t2m(dc.end || '20:00');
    return startMin >= s && endMin <= e;
  };

  const getDCRange = (dc) => {
    if (dc.type === 'closed') return { s: t2m('09:00'), e: t2m('20:00') };
    if (dc.type === 'split') {
      const e = dc.end2 ? dc.end2 : dc.end;
      return { s: t2m(dc.start), e: t2m(e) };
    }
    return { s: t2m(dc.start || '09:00'), e: t2m(dc.end || '20:00') };
  };

  const getCandidatesForService = useCallback((s, employeesList) => {
    const employees = employeesList || data.employees || [];
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

    if (selectedEmployee) {
      const userFiltered = eligible.filter(e => e.name.toLowerCase() === selectedEmployee.name.toLowerCase());
      if (userFiltered.length > 0) return userFiltered;
    }

    return eligible.length > 0 ? eligible : employees;
  }, [data.employees, data.services, selectedEmployee]);

  const isDayClosed = useCallback((dateStr, svc) => {
    const ee = data.employees || [];
    const ss = data.settings;
    if (ee.length === 0) return false;

    const sd = ss?.specialDays || {};
    if (sd[dateStr]?.global?.type === 'closed') return true;

    const d = new Date(dateStr + 'T12:00:00');
    const day = d.getDay();
    if (ss?.weekly && ss.weekly[day] && ss.weekly[day].closed) return true;

    if (svc) {
      const candidates = getCandidatesForService(svc, ee);
      if (candidates.length > 0) {
        return candidates.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
      }
    }

    return ee.every(emp => getDCforEmp(dateStr, emp.name).type === 'closed');
  }, [data.employees, data.settings, getCandidatesForService, getDCforEmp]);

  // Cálculo de slots libres para una fecha determinada
  const computeSlots = useCallback((ds, dayApts, settings, employees, svc, blocks = []) => {
    if (!svc || !employees || employees.length === 0) return [];

    const candidates = getCandidatesForService(svc, employees);
    if (candidates.length === 0) return [];

    let rangeStart = null, rangeEnd = null;
    candidates.forEach(emp => {
      const dc = getDCforEmp(ds, emp.name);
      if (dc.type !== 'closed') {
        const r = getDCRange(dc);
        if (rangeStart === null || r.s < rangeStart) rangeStart = r.s;
        if (rangeEnd === null || r.e > rangeEnd) rangeEnd = r.e;
      }
    });

    if (rangeStart === null || rangeStart >= rangeEnd) return [];

    const now = new Date();
    const todayStr = getLocalDateStr(now);
    const nowMin = ds === todayStr ? now.getHours() * 60 + now.getMinutes() + 15 : 0;
    const dur = parseInt(svc.duration || 30, 10);

    const isSlotClosedForEmp = (slotStart, slotEnd, empName, dc) => {
      if (dc && dc.closedHours && Array.isArray(dc.closedHours)) {
        return dc.closedHours.some(timeStr => {
          const chMin = t2m(timeStr);
          return slotStart < (chMin + 15) && slotEnd > chMin;
        });
      }
      return false;
    };

    const isEmpBusy = (empName, start, end) => {
      const empLower = empName.toLowerCase();
      const hasApt = dayApts.some(a => {
        let matches = false;
        if (a.employee) {
          const aEmp = a.employee.toLowerCase();
          if (aEmp === 'todas' || aEmp === 'ambos' || aEmp === 'cualquiera' || aEmp === empLower) matches = true;
          else if (a.employee.split(',').map(e => e.trim().toLowerCase()).includes(empLower)) matches = true;
        }
        if (a.services && Array.isArray(a.services)) {
          if (a.services.some(s => (s.employee || '').toLowerCase() === empLower)) matches = true;
        }
        if (!matches) return false;

        let aDur = parseInt(a.duration || 15, 10);
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

    const isEmpAvailable = (empName, startMin, slotDur) => {
      const dc = getDCforEmp(ds, empName);
      if (dc.type === 'closed') return false;
      if (!isTimeInDC(dc, startMin, slotDur)) return false;
      if (isSlotClosedForEmp(startMin, startMin + slotDur, empName, dc)) return false;
      if (isEmpBusy(empName, startMin, startMin + slotDur)) return false;
      return true;
    };

    const slots = [];
    for (let t = rangeStart; t + dur <= rangeEnd; t += 15) {
      if (ds === todayStr && t <= nowMin) continue;

      const freeEmps = candidates.filter(emp => isEmpAvailable(emp.name, t, dur));
      const isFree = freeEmps.length > 0;

      if (isFree) {
        slots.push({
          time: m2t(t),
          free: true,
          emps: freeEmps,
          assign: [freeEmps[0].name],
          totalDur: dur
        });
      }
    }
    return slots;
  }, [getCandidatesForService, getDCforEmp]);

  // Carga de disponibilidad al seleccionar una fecha
  const handleDateSelect = async (dateStr) => {
    setSelectedDate(dateStr);
    setSelectedTime('');
    setSelectedSlotData(null);
    setErrorMsg('');

    if (!dateStr || !selectedService) {
      setAvailableSlots([]);
      return;
    }

    if (isDayClosed(dateStr, selectedService)) {
      setAvailableSlots([]);
      setErrorMsg('El salón se encuentra cerrado en esta fecha. Por favor, elige otro día disponible.');
      scanNextAvailable(dateStr, selectedService);
      return;
    }

    setLoadingSlots(true);
    try {
      const res = await fetch(`/api/availability?date=${dateStr}`);
      const rdata = await res.json();
      if (rdata.success) {
        const slots = computeSlots(
          dateStr,
          rdata.appointments || [],
          data.settings,
          data.employees,
          selectedService,
          rdata.blocks || []
        );
        setAvailableSlots(slots);
        if (slots.length === 0) {
          setErrorMsg('No quedan huecos libres para este día con la especialista seleccionada.');
          scanNextAvailable(dateStr, selectedService);
        }
      } else {
        setErrorMsg(rdata.error || 'Error al consultar disponibilidad');
      }
    } catch (e) {
      console.error(e);
      setErrorMsg('Error de conexión al cargar horarios.');
    } finally {
      setLoadingSlots(false);
    }
  };

  // Escaneo rápido de próximo hueco libre disponible
  const scanNextAvailable = async (baseDate, svc) => {
    if (!baseDate || !svc) return;
    setIsSearchingNext(true);
    setNextAvailableSlot(null);

    try {
      const baseObj = new Date(baseDate + 'T12:00:00');
      const startObj = new Date(baseObj);
      startObj.setDate(startObj.getDate() + 1);

      const endObj = new Date(startObj);
      endObj.setDate(endObj.getDate() + 30);

      const fromStr = getLocalDateStr(startObj);
      const toStr = getLocalDateStr(endObj);

      const res = await fetch(`/api/availability?from=${fromStr}&to=${toStr}`);
      const rdata = await res.json();

      if (rdata.success) {
        const allApts = rdata.appointments || [];
        const allBlocks = rdata.blocks || [];

        for (let i = 0; i < 30; i++) {
          const curD = new Date(startObj);
          curD.setDate(curD.getDate() + i);
          const curDStr = getLocalDateStr(curD);

          if (isDayClosed(curDStr, svc)) continue;

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

          const slots = computeSlots(curDStr, dayApts, data.settings, data.employees, svc, dayBlocks);
          if (slots.length > 0) {
            setNextAvailableSlot({
              date: curDStr,
              time: slots[0].time,
              empName: slots[0].assign?.[0] || 'Especialista',
              slot: slots[0]
            });
            break;
          }
        }
      }
    } catch (e) {
      console.error('Error scanning next available slot:', e);
    } finally {
      setIsSearchingNext(false);
    }
  };

  // Abrir embudo para un servicio
  const handleStartBooking = (service, preferredEmployee = null) => {
    setSelectedService(service);
    setSelectedEmployee(preferredEmployee);
    setSelectedDate('');
    setSelectedTime('');
    setSelectedSlotData(null);
    setAvailableSlots([]);
    setErrorMsg('');
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setBookingStep('datetime');
    setIsBookingOpen(true);

    const todayStr = getLocalDateStr(new Date());
    const [y, m] = todayStr.split('-').map(Number);
    setCalendarViewDate(new Date(y, m - 1, 1));
    scanNextAvailable(todayStr, service);
  };

  // Saltar al próximo hueco encontrado
  const goToNextAvailable = (next) => {
    if (!next) return;
    const [y, m] = next.date.split('-').map(Number);
    setCalendarViewDate(new Date(y, m - 1, 1));
    handleDateSelect(next.date);
    setTimeout(() => {
      setSelectedTime(next.time);
      setSelectedSlotData(next.slot);
      const el = document.getElementById('funnel-slots-container');
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 400);
  };

  // Validar y aplicar Voucher / Bono
  const handleApplyVoucher = async () => {
    if (!voucherCodeInput.trim() || !selectedService) return;
    setVoucherLoading(true);
    setVoucherError('');

    try {
      const res = await fetch('/api/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: voucherCodeInput.trim().toUpperCase(),
          services: [selectedService]
        })
      });
      const resData = await res.json();
      if (resData.success && resData.voucher) {
        setAppliedVoucher(resData.voucher);
        setVoucherError('');
      } else {
        setVoucherError(resData.error || 'Bono o código inválido');
        setAppliedVoucher(null);
      }
    } catch (e) {
      setVoucherError('Error al validar el bono en el servidor');
    } finally {
      setVoucherLoading(false);
    }
  };

  const handleRemoveVoucher = () => {
    setAppliedVoucher(null);
    setVoucherCodeInput('');
    setVoucherError('');
  };

  // Cálculo del precio final con descuento de bono si existe
  const finalPrice = useMemo(() => {
    if (!selectedService) return 0;
    const orig = Number(selectedService.price || 0);
    if (!appliedVoucher) return orig;

    if (appliedVoucher.type === 'gift_card' && appliedVoucher.remaining_balance != null) {
      return Math.max(0, orig - Number(appliedVoucher.remaining_balance));
    }
    // Si es bono de sesiones o cubre el servicio al 100%
    return 0;
  }, [selectedService, appliedVoucher]);

  // Enviar reserva a /api/book
  const handleConfirmBooking = async () => {
    if (!customerData.name.trim() || !customerData.phone.trim() || !customerData.email.trim()) {
      setErrorMsg('Por favor, completa tu nombre, teléfono y email.');
      return;
    }
    if (!customerData.gdpr) {
      setErrorMsg('Por favor, acepta la política de privacidad y condiciones.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');

    const empName = selectedSlotData?.assign?.[0] || selectedEmployee?.name || 'Todas';
    const dur = selectedService.duration || 30;

    const payload = {
      clientName: customerData.name.trim(),
      clientPhone: customerData.phone.trim(),
      clientEmail: customerData.email.trim(),
      notes: customerData.notes.trim(),
      services: [{
        name: selectedService.name,
        employee: empName,
        duration: dur,
        price: selectedService.price || 0
      }],
      service: selectedService.name,
      employee: empName,
      date: selectedDate,
      time: selectedTime,
      duration: dur,
      price: selectedService.price || 0,
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
        setCompletedBooking({
          ...payload,
          id: resData.appointment?.id || 'CITA-' + Date.now().toString().slice(-6),
          finalPrice: finalPrice
        });
        setBookingStep('success');
      } else {
        setErrorMsg(resData.error || 'No se pudo completar la reserva. Inténtalo de nuevo.');
      }
    } catch (e) {
      setErrorMsg('Error de conexión con el servidor de reservas.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Google Calendar Link generator
  const googleCalendarUrl = useMemo(() => {
    if (!completedBooking || !completedBooking.date || !completedBooking.time) return '#';
    try {
      const [y, m, d] = completedBooking.date.split('-').map(Number);
      const [hh, mm] = completedBooking.time.split(':').map(Number);
      const dur = completedBooking.duration || 45;
      const start = new Date(Date.UTC(y, m - 1, d, hh, mm));
      const end = new Date(start.getTime() + dur * 60000);
      const fmt = (dt) => dt.toISOString().replace(/-|:|\.\d\d\d/g, '');
      const dates = `${fmt(start)}/${fmt(end)}`;
      const title = encodeURIComponent(`Cita: ${completedBooking.service} - Respira Estética`);
      const details = encodeURIComponent(`Cita en Centro de Estética Respira.\nEspecialista: ${completedBooking.employee}\nUbicación: Carrer Ciutat, 28, 07570 Artà, Illes Balears.`);
      const location = encodeURIComponent(`Carrer Ciutat, 28, 07570 Artà, Illes Balears`);
      return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${dates}&details=${details}&location=${location}`;
    } catch {
      return '#';
    }
  }, [completedBooking]);

  // Generador de días del Calendario Airbnb
  const renderAirbnbCalendar = () => {
    const year = calendarViewDate.getFullYear();
    const month = calendarViewDate.getMonth();

    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDayOfMonth.getDay() - 1;
    if (startDayOfWeek === -1) startDayOfWeek = 6;

    const totalDays = lastDayOfMonth.getDate();
    const daysCells = [];

    for (let i = 0; i < startDayOfWeek; i++) {
      daysCells.push({ day: 0, dateStr: '', isCurrentMonth: false });
    }

    const todayStr = getLocalDateStr(new Date());
    for (let d = 1; d <= totalDays; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      daysCells.push({ day: d, dateStr, isCurrentMonth: true });
    }

    const prevMonth = () => setCalendarViewDate(new Date(year, month - 1, 1));
    const nextMonth = () => setCalendarViewDate(new Date(year, month + 1, 1));

    return (
      <div className="space-y-4 select-none">
        {/* Cabecera de mes con navegación */}
        <div className="flex items-center justify-between pb-1">
          <h4 className="text-sm font-bold text-stone-900 tracking-tight">
            {MONTH_NAMES[month]} {year}
          </h4>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            <button
              type="button"
              onClick={nextMonth}
              className="p-1.5 rounded-full hover:bg-stone-100 text-stone-600 transition-colors cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Días de la semana */}
        <div className="grid grid-cols-7 text-center text-xs font-semibold text-stone-400">
          <span>L</span>
          <span>M</span>
          <span>X</span>
          <span>J</span>
          <span>V</span>
          <span>S</span>
          <span>D</span>
        </div>

        {/* Cuadrícula de Días */}
        <div className="grid grid-cols-7 gap-y-2 place-items-center">
          {daysCells.map((cell, idx) => {
            if (!cell.isCurrentMonth) {
              return <div key={`empty-${idx}`} className="w-9 h-9" />;
            }

            const isSelected = selectedDate === cell.dateStr;
            const isToday = cell.dateStr === todayStr;
            const isPast = cell.dateStr < todayStr;
            const isClosed = isDayClosed(cell.dateStr, selectedService);
            const isDisabled = isPast || isClosed;

            return (
              <button
                key={cell.dateStr}
                type="button"
                disabled={isDisabled}
                onClick={() => handleDateSelect(cell.dateStr)}
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-semibold transition-all cursor-pointer relative ${
                  isSelected
                    ? 'bg-[#6b8a5a] text-white font-bold shadow-md scale-105 ring-2 ring-[#6b8a5a] ring-offset-1'
                    : isToday && !isDisabled
                    ? 'ring-1 ring-[#6b8a5a] font-bold text-[#6b8a5a] bg-[#f3f7ee]'
                    : !isDisabled
                    ? 'text-stone-800 hover:bg-[#f3f7ee] hover:text-[#6b8a5a]'
                    : ''
                } ${
                  isClosed && !isSelected
                    ? 'text-stone-300 line-through decoration-stone-300 cursor-not-allowed opacity-60'
                    : ''
                } ${
                  isPast ? 'text-stone-300 opacity-40 cursor-not-allowed' : ''
                }`}
              >
                <span>{cell.day}</span>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  // Agrupación de turnos en Mañana y Tarde
  const morningSlots = useMemo(() => {
    return availableSlots.filter(s => {
      const min = t2m(s.time);
      return min < 14 * 60;
    });
  }, [availableSlots]);

  const afternoonSlots = useMemo(() => {
    return availableSlots.filter(s => {
      const min = t2m(s.time);
      return min >= 14 * 60;
    });
  }, [availableSlots]);

  // Si está en modo cancelación directa vía URL
  if (cancelId) {
    return (
      <div className="min-h-screen bg-[#faf7f4] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-md w-full border border-stone-200 text-center space-y-4 shadow-xl">
          <div className="w-14 h-14 rounded-full bg-rose-50 text-rose-600 mx-auto flex items-center justify-center">
            <Trash2 size={24} />
          </div>
          <h2 className="text-xl font-bold text-stone-900">Gestión de Cancelación</h2>
          <p className="text-xs text-stone-500">¿Deseas gestionar o anular tu cita en Respira?</p>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              href={`/cancelar?id=${cancelId}`}
              className="py-3 px-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl text-xs font-bold transition-all shadow-md"
            >
              Ir a la pantalla de cancelación
            </Link>
            <Link
              href="/"
              className="py-2.5 px-4 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-2xl text-xs font-semibold transition-all"
            >
              Volver al inicio
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#faf7f4] pb-28 md:pb-16 text-stone-900 font-sans selection:bg-[#6b8a5a] selection:text-white">
      
      {/* 1. HERO COVER SECTION */}
      <div className="relative h-64 sm:h-72 md:h-80 w-full overflow-hidden bg-stone-900">
        <img
          src="https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?auto=format&fit=crop&w=1200&q=80"
          alt="Centro de estética Respira"
          className="w-full h-full object-cover object-center opacity-85"
        />
        {/* Ambient Vignette Gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-stone-950 via-stone-950/40 to-transparent" />

        {/* Top Floating Action Bar */}
        <div className="absolute top-4 left-4 right-4 sm:left-6 sm:right-6 flex items-center justify-between z-20">
          <div className="flex items-center gap-2">
            <span className="px-3 py-1.5 rounded-full bg-stone-900/60 backdrop-blur-md text-white text-xs font-semibold border border-white/10 shadow-md">
              🌿 Respira Artà
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="w-10 h-10 rounded-full bg-stone-900/60 backdrop-blur-md text-white flex items-center justify-center border border-white/10 hover:bg-stone-900/80 transition-all shadow-md cursor-pointer"
              title="Compartir enlace de reservas"
            >
              <Share2 size={17} />
            </button>
            <button
              type="button"
              onClick={() => setIsSaved(!isSaved)}
              className="w-10 h-10 rounded-full bg-stone-900/60 backdrop-blur-md text-white flex items-center justify-center border border-white/10 hover:bg-stone-900/80 transition-all shadow-md cursor-pointer"
              title="Guardar favorito"
            >
              <Heart size={17} className={isSaved ? "fill-rose-500 text-rose-500" : ""} />
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CONTAINER */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 relative z-10 -mt-6 sm:-mt-10 space-y-6">

        {/* Share Toast */}
        {shareToast && (
          <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 bg-stone-900 text-white text-xs font-semibold px-4 py-2 rounded-full shadow-2xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
            <Check size={14} className="text-[#7fa85f]" />
            <span>Enlace copiado al portapapeles</span>
          </div>
        )}

        {/* BUSINESS IDENTITY CARD */}
        <section className="bg-white rounded-3xl p-5 sm:p-7 border border-stone-200/90 shadow-xl space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5 min-w-0">
              <h1 className="text-2xl sm:text-3xl font-sans font-bold text-stone-900 tracking-tight">
                Centro de estética Respira
              </h1>

              {/* Metadata row */}
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-stone-500 font-normal">
                <span>Carrer Ciutat, 28, Artà, Illes Balears</span>
                <span>·</span>
                <span className="text-[#6b8a5a] font-semibold">Salón de Belleza y Bienestar</span>
              </div>

              {/* Live Status Badge */}
              <div className="pt-0.5">
                {todayStatus.isOpen ? (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60">
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>{todayStatus.text}</span>
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-stone-600 bg-stone-100 px-2.5 py-0.5 rounded-full border border-stone-200">
                    <span className="w-2 h-2 rounded-full bg-stone-400"></span>
                    <span>{todayStatus.text}</span>
                  </span>
                )}
              </div>
            </div>

            {/* Official Logo */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl overflow-hidden border border-stone-200 shadow-md shrink-0 bg-white p-1">
              <img
                src="/logo-icono.png"
                alt="Logo Centro Respira"
                className="w-full h-full object-contain"
              />
            </div>
          </div>

          {/* Pill Chips Row (Factual & Authentic) */}
          <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-stone-100">
            <span className="inline-flex items-center gap-1.5 bg-[#f3f7ee] text-[#6b8a5a] text-xs font-semibold px-3 py-1.5 rounded-full border border-[#7fa85f]/20">
              <MapPin size={13} />
              <span>Artà, Illes Balears</span>
            </span>

            <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-800 text-xs font-semibold px-3 py-1.5 rounded-full">
              <Clock size={13} className="text-[#6b8a5a]" />
              <span>Cita Previa Online</span>
            </span>

            <span className="inline-flex items-center gap-1.5 bg-stone-100 text-stone-800 text-xs font-semibold px-3 py-1.5 rounded-full">
              <MessageCircle size={13} className="text-[#6b8a5a]" />
              <span>WhatsApp: 688 69 22 95</span>
            </span>
          </div>

          {/* Description Capsule */}
          <div className="bg-[#faf7f4] border border-stone-200/80 rounded-2xl p-4 text-xs sm:text-sm text-stone-600 leading-relaxed font-normal">
            Centro de estética y bienestar en Artà. Consulta la lista de tratamientos y reserva tu cita online en tiempo real.
          </div>

          {/* 4 Quick Actions (Call, GPS, WhatsApp, Hours) */}
          <div className="grid grid-cols-4 gap-2 pt-1">
            <a
              href="tel:+34688692295"
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-stone-50 hover:bg-[#f3f7ee] border border-stone-200/80 transition-all text-stone-800 group"
            >
              <Phone size={18} className="text-[#6b8a5a] mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Llamar</span>
            </a>

            <a
              href="https://www.google.com/maps/search/?api=1&query=Centro+de+est%C3%A9tica+Respira+Carrer+Ciutat+28+07570+Arta"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-stone-50 hover:bg-[#f3f7ee] border border-stone-200/80 transition-all text-stone-800 group"
            >
              <Navigation size={18} className="text-[#6b8a5a] mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Cómo llegar</span>
            </a>

            <a
              href="https://wa.me/34688692295?text=Hola,%20quisiera%20consultar%20sobre%20una%20cita%20en%20Respira"
              target="_blank"
              rel="noopener noreferrer"
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-stone-50 hover:bg-[#f3f7ee] border border-stone-200/80 transition-all text-stone-800 group"
            >
              <MessageCircle size={18} className="text-[#6b8a5a]" />
              <span className="text-[11px] font-semibold">WhatsApp</span>
            </a>

            <button
              type="button"
              onClick={() => {
                if (hoursSectionRef.current) {
                  hoursSectionRef.current.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="flex flex-col items-center justify-center p-3 rounded-2xl bg-stone-50 hover:bg-[#f3f7ee] border border-stone-200/80 transition-all text-stone-800 group cursor-pointer"
            >
              <Clock size={18} className="text-[#6b8a5a] mb-1 group-hover:scale-110 transition-transform" />
              <span className="text-[11px] font-semibold">Horarios</span>
            </button>
          </div>
        </section>

        {/* 3. SERVICIOS & TRATAMIENTOS SECTION */}
        <section ref={servicesSectionRef} className="space-y-4 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-sans font-bold text-stone-900 tracking-tight">
                Servicios y Tratamientos
              </h2>
              <p className="text-xs text-stone-500 font-normal">
                Selecciona tu cita para consultar huecos libres en tiempo real.
              </p>
            </div>

            {/* Buscador */}
            <div className="relative w-full sm:w-64">
              <Search size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar tratamientos..."
                className="w-full pl-9 pr-3.5 py-2 bg-white border border-stone-200 rounded-2xl text-xs text-stone-900 placeholder:text-stone-400 outline-none focus:border-[#6b8a5a] transition-colors shadow-2xs"
              />
            </div>
          </div>

          {/* Categorías Pills */}
          {categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                  selectedCategory === 'all'
                    ? 'bg-[#6b8a5a] text-white shadow-xs'
                    : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
                }`}
              >
                Todos ({data.services.length})
              </button>
              {categories.map(cat => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition-all cursor-pointer shrink-0 ${
                    selectedCategory === cat
                      ? 'bg-[#6b8a5a] text-white shadow-xs'
                      : 'bg-white border border-stone-200 text-stone-600 hover:text-stone-900'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Lista de Servicios */}
          <div className="space-y-3">
            {filteredServices.length > 0 ? (
              filteredServices.map(service => (
                <div
                  key={service.id}
                  className="bg-white rounded-2xl border border-stone-200/90 p-4 sm:p-5 shadow-xs hover:border-[#6b8a5a]/50 transition-all flex items-start justify-between gap-4 group"
                >
                  <div className="space-y-1 min-w-0">
                    <h3 className="font-bold text-sm sm:text-base text-stone-900 leading-tight">
                      {service.name}
                    </h3>
                    {service.description && (
                      <p className="text-xs text-stone-500 font-normal leading-relaxed line-clamp-2">
                        {service.description}
                      </p>
                    )}
                    <div className="flex items-center gap-2 text-xs font-semibold text-stone-500 pt-1">
                      <Clock size={13} className="text-[#6b8a5a]" />
                      <span>{service.duration || 30} min</span>
                      {service.category && (
                        <>
                          <span>·</span>
                          <span className="text-stone-400 font-normal">{service.category}</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <span className="text-base sm:text-lg font-bold font-sans text-stone-900">
                      {Number(service.price || 0).toFixed(2)} €
                    </span>
                    <button
                      type="button"
                      onClick={() => handleStartBooking(service)}
                      className="py-2 px-4 bg-[#6b8a5a] hover:bg-[#5a774b] text-white rounded-xl text-xs font-semibold transition-all shadow-xs cursor-pointer active:scale-98"
                    >
                      Reservar
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="bg-white rounded-2xl border border-stone-200 p-8 text-center space-y-2">
                <p className="text-sm font-semibold text-stone-800">No se encontraron tratamientos</p>
                <p className="text-xs text-stone-500">Prueba con otro término de búsqueda o categoría.</p>
              </div>
            )}
          </div>
        </section>

        {/* 4. EQUIPO DE ESPECIALISTAS */}
        {data.employees.length > 0 && (
          <section className="space-y-4 pt-2">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-sans font-bold text-stone-900 tracking-tight">
                  Equipo de Especialistas
                </h2>
                <p className="text-xs text-stone-500 font-normal">
                  Especialistas del centro Respira en Artà.
                </p>
              </div>
              <span className="text-xs font-semibold text-stone-400">
                {data.employees.length} especialistas
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.employees.map(emp => (
                <div
                  key={emp.id}
                  className="bg-white rounded-2xl border border-stone-200/90 p-4 hover:border-[#6b8a5a]/50 transition-all flex sm:flex-col items-center justify-between sm:justify-center text-left sm:text-center gap-3 shadow-2xs"
                >
                  <div className="flex sm:flex-col items-center gap-3 min-w-0">
                    <div className="w-14 h-14 rounded-full overflow-hidden bg-[#f3f7ee] border-2 border-[#7fa85f]/30 flex items-center justify-center font-bold text-[#6b8a5a] shrink-0 text-base shadow-xs">
                      {emp.photo_url ? (
                        <img src={emp.photo_url} alt={emp.name} className="w-full h-full object-cover" />
                      ) : (
                        <span>{emp.name.substring(0, 2).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <h4 className="font-bold text-sm text-stone-900 truncate">{emp.name}</h4>
                      <p className="text-xs text-stone-500 truncate">
                        {emp.specialty || 'Especialista'}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      if (data.services.length > 0) {
                        handleStartBooking(data.services[0], emp);
                      }
                    }}
                    className="py-1.5 px-3 bg-[#f3f7ee] hover:bg-[#e4eedb] text-[#6b8a5a] text-xs font-semibold rounded-xl transition-all cursor-pointer shrink-0"
                  >
                    Elegir
                  </button>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* 5. UBICACIÓN & HORARIOS */}
        <section ref={hoursSectionRef} className="space-y-4 pt-2">
          <h2 className="text-xl font-sans font-bold text-stone-900 tracking-tight">
            Ubicación y Horario
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Mapa Preview */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-5 space-y-3 shadow-xs">
              <div className="flex items-start gap-2.5">
                <MapPin size={18} className="text-[#6b8a5a] shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-stone-900">Dirección del Salón</h3>
                  <p className="text-xs text-stone-500 leading-relaxed mt-0.5">
                    Carrer Ciutat, 28, 07570 Artà, Illes Balears
                  </p>
                </div>
              </div>

              <div className="h-36 rounded-2xl bg-[#f3f7ee] border border-stone-200 relative overflow-hidden flex items-center justify-center">
                <div className="text-center space-y-1">
                  <div className="w-10 h-10 rounded-full bg-[#6b8a5a] text-white flex items-center justify-center mx-auto shadow-md">
                    <Navigation size={18} />
                  </div>
                  <span className="text-xs font-bold text-stone-800 block">Abrir con GPS</span>
                </div>
                <a
                  href="https://www.google.com/maps/search/?api=1&query=Centro+de+est%C3%A9tica+Respira+Carrer+Ciutat+28+07570+Arta"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="absolute inset-0"
                />
              </div>

              <a
                href="https://www.google.com/maps/search/?api=1&query=Centro+de+est%C3%A9tica+Respira+Carrer+Ciutat+28+07570+Arta"
                target="_blank"
                rel="noopener noreferrer"
                className="w-full block text-center py-2.5 bg-stone-100 hover:bg-stone-200 text-stone-900 font-semibold rounded-xl text-xs transition-colors"
              >
                Ver ubicación en Google Maps
              </a>
            </div>

            {/* Horario Semanal */}
            <div className="bg-white rounded-3xl border border-stone-200/90 p-5 space-y-3 shadow-xs">
              <div className="flex items-center gap-2">
                <Clock size={18} className="text-[#6b8a5a]" />
                <h3 className="font-bold text-sm text-stone-900">Horario Semanal</h3>
              </div>

              <div className="space-y-2 pt-1 text-xs">
                {weeklyScheduleList.map(item => {
                  const isToday = item.dayNum === new Date().getDay();
                  return (
                    <div
                      key={item.name}
                      className={`flex items-center justify-between py-1.5 px-3 rounded-xl transition-colors ${
                        isToday ? 'bg-[#f3f7ee] font-bold text-[#6b8a5a] border border-[#7fa85f]/30' : 'text-stone-600'
                      }`}
                    >
                      <span>{item.name} {isToday && '(Hoy)'}</span>
                      <span className={item.isClosed ? 'text-stone-400 font-medium' : 'text-stone-900 font-semibold'}>
                        {item.hours}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

      </main>

      {/* 6. MODAL / DRAWER DE RESERVA (Airbnb Style Reference) */}
      {isBookingOpen && selectedService && (
        <div className="fixed inset-0 z-50 bg-stone-950/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-t-3xl sm:rounded-3xl max-w-lg w-full max-h-[92vh] sm:max-h-[88vh] overflow-y-auto shadow-2xl border border-stone-200 flex flex-col justify-between">

            {/* Top Bar */}
            <div className="p-4 sm:p-5 border-b border-stone-200 flex items-center justify-between sticky top-0 bg-white/95 backdrop-blur-md z-10">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setIsBookingOpen(false)}
                  className="p-1.5 rounded-full text-stone-400 hover:text-stone-900 hover:bg-stone-100 transition-colors cursor-pointer"
                >
                  <X size={18} />
                </button>
                <div className="min-w-0">
                  <h3 className="font-bold text-sm text-stone-900 truncate">
                    {bookingStep === 'success' ? 'Reserva Confirmada' : selectedService.name}
                  </h3>
                  <p className="text-[11px] text-stone-500 font-normal">
                    {selectedService.duration || 30} min · {Number(selectedService.price || 0).toFixed(2)} €
                  </p>
                </div>
              </div>

              {selectedDate && bookingStep === 'datetime' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedDate('');
                    setSelectedTime('');
                    setAvailableSlots([]);
                  }}
                  className="text-xs font-semibold text-[#6b8a5a] hover:underline cursor-pointer"
                >
                  Cambiar fecha
                </button>
              )}
            </div>

            {/* Error Banner */}
            {errorMsg && (
              <div className="mx-5 mt-4 p-3 bg-rose-50 border border-rose-200 rounded-2xl text-rose-800 text-xs font-semibold flex items-center gap-2">
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Content Body */}
            <div className="p-5 sm:p-6 space-y-6 flex-1">

              {/* PASO 1: DATETIME & CALENDARIO AIRBNB */}
              {bookingStep === 'datetime' && (
                <div className="space-y-6 animate-in fade-in">

                  {/* Selector de Profesional */}
                  {data.employees.length > 1 && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-stone-700 uppercase tracking-wider">
                        Especialista preferida
                      </label>
                      <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedEmployee(null);
                            if (selectedDate) handleDateSelect(selectedDate);
                          }}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                            !selectedEmployee
                              ? 'bg-[#6b8a5a] text-white shadow-xs'
                              : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                          }`}
                        >
                          Cualquiera disponible
                        </button>
                        {data.employees.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setSelectedEmployee(emp);
                              if (selectedDate) handleDateSelect(selectedDate);
                            }}
                            className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all shrink-0 cursor-pointer ${
                              selectedEmployee?.name === emp.name
                                ? 'bg-[#6b8a5a] text-white shadow-xs'
                                : 'bg-stone-100 text-stone-700 hover:bg-stone-200'
                            }`}
                          >
                            {emp.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Banner de Próximo Hueco Disponible */}
                  {nextAvailableSlot && !loadingSlots && (
                    <div className="p-3.5 rounded-2xl bg-stone-900 text-white flex items-center justify-between gap-3 text-xs shadow-md">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center shrink-0">
                          <Sparkles size={16} className="text-[#7fa85f]" />
                        </div>
                        <div className="min-w-0">
                          <p className="text-[10px] uppercase font-bold text-stone-300">Próximo hueco libre</p>
                          <p className="font-semibold text-white truncate">
                            <span className="capitalize">{formatDatePretty(nextAvailableSlot.date)}</span> a las <span className="font-bold text-[#7fa85f]">{nextAvailableSlot.time}</span>
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => goToNextAvailable(nextAvailableSlot)}
                        className="shrink-0 px-3 py-1.5 rounded-xl font-bold text-xs bg-[#6b8a5a] text-white hover:bg-[#5a774b] transition-all active:scale-95 cursor-pointer shadow-xs"
                      >
                        {selectedDate === nextAvailableSlot.date ? 'Ver hora' : 'Ir a fecha'}
                      </button>
                    </div>
                  )}

                  {/* Calendario Airbnb */}
                  {renderAirbnbCalendar()}

                  {/* Horas disponibles */}
                  {selectedDate && (
                    <div id="funnel-slots-container" className="space-y-4 pt-3 border-t border-stone-100">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-stone-900 uppercase tracking-wider">
                          Horas disponibles para el {selectedDate.split('-').reverse().join('/')}
                        </h4>
                        {loadingSlots && <Loader2 size={14} className="animate-spin text-[#6b8a5a]" />}
                      </div>

                      {availableSlots.length > 0 ? (
                        <div className="space-y-4">
                          {morningSlots.length > 0 && (
                            <div className="space-y-2">
                              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Sun size={13} className="text-amber-500" />
                                <span>Turno de Mañana</span>
                              </span>
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                {morningSlots.map(slot => (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    onClick={() => {
                                      setSelectedTime(slot.time);
                                      setSelectedSlotData(slot);
                                    }}
                                    className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                      selectedTime === slot.time
                                        ? 'bg-[#6b8a5a] text-white font-bold shadow-xs scale-102 ring-2 ring-[#6b8a5a]'
                                        : 'bg-stone-100 hover:bg-[#f3f7ee] hover:text-[#6b8a5a] text-stone-800'
                                    }`}
                                  >
                                    {slot.time}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          {afternoonSlots.length > 0 && (
                            <div className="space-y-2 pt-1">
                              <span className="text-[11px] font-bold text-stone-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Moon size={13} className="text-indigo-500" />
                                <span>Turno de Tarde</span>
                              </span>
                              <div className="grid grid-cols-4 sm:grid-cols-5 gap-2">
                                {afternoonSlots.map(slot => (
                                  <button
                                    key={slot.time}
                                    type="button"
                                    onClick={() => {
                                      setSelectedTime(slot.time);
                                      setSelectedSlotData(slot);
                                    }}
                                    className={`py-2 px-1 rounded-xl text-xs font-semibold transition-all cursor-pointer ${
                                      selectedTime === slot.time
                                        ? 'bg-[#6b8a5a] text-white font-bold shadow-xs scale-102 ring-2 ring-[#6b8a5a]'
                                        : 'bg-stone-100 hover:bg-[#f3f7ee] hover:text-[#6b8a5a] text-stone-800'
                                    }`}
                                  >
                                    {slot.time}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      ) : !loadingSlots ? (
                        <div className="space-y-3 py-2">
                          {isSearchingNext ? (
                            <div className="flex items-center justify-center gap-2 py-4 text-xs text-stone-500">
                              <Loader2 size={16} className="animate-spin text-[#6b8a5a]" />
                              <span>Buscando próximo hueco disponible...</span>
                            </div>
                          ) : nextAvailableSlot ? (
                            <div className="p-4 rounded-2xl bg-[#faf7f4] border border-stone-200 shadow-xs space-y-3 text-left">
                              <div className="flex items-start gap-3">
                                <div className="w-9 h-9 rounded-xl bg-[#6b8a5a] text-white flex items-center justify-center shrink-0 mt-0.5">
                                  <Calendar size={18} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-[#f3f7ee] text-[#6b8a5a] mb-1">
                                    Próximo hueco disponible
                                  </span>
                                  <p className="text-sm font-bold text-stone-900 capitalize">
                                    {formatDatePretty(nextAvailableSlot.date)} a las {nextAvailableSlot.time}
                                  </p>
                                  <p className="text-xs text-stone-500 mt-0.5">
                                    Sin huecos para {selectedDate.split('-').reverse().join('/')} · Próximo disponible encontrado
                                  </p>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => goToNextAvailable(nextAvailableSlot)}
                                className="w-full py-2.5 px-4 rounded-xl font-bold text-xs uppercase tracking-wider bg-[#6b8a5a] hover:bg-[#5a774b] text-white transition-all shadow-xs active:scale-98 cursor-pointer flex items-center justify-center gap-2"
                              >
                                <Sparkles size={14} />
                                <span>Reservar este hueco ({formatDatePretty(nextAvailableSlot.date)} {nextAvailableSlot.time})</span>
                                <ChevronRight size={14} />
                              </button>
                            </div>
                          ) : (
                            <p className="text-xs text-stone-400 italic">No quedan turnos disponibles para esta selección.</p>
                          )}
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              )}

              {/* PASO 2: DATOS DEL CLIENTE Y CANJE DE BONO/CHEQUE REGALO */}
              {bookingStep === 'customer' && (
                <div className="space-y-4 animate-in fade-in">
                  
                  {/* Resumen de cita */}
                  <div className="bg-[#f3f7ee] border border-[#7fa85f]/30 rounded-2xl p-4 text-xs space-y-1">
                    <p className="font-bold text-[#6b8a5a] text-sm">{selectedService.name}</p>
                    <p className="text-stone-700">
                      Cita el <strong>{formatDatePretty(selectedDate)}</strong> a las <strong>{selectedTime}</strong>
                      {selectedSlotData?.assign?.[0] ? ` con ${selectedSlotData.assign[0]}` : ''}.
                    </p>
                    <p className="text-stone-500 text-[11px]">
                      Duración aproximada: {selectedService.duration || 30} min.
                    </p>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Nombre completo <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={customerData.name}
                        onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                        placeholder="Ej. Maria Belen"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs text-stone-900 outline-none focus:border-[#6b8a5a] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Teléfono Móvil (WhatsApp) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="tel"
                        required
                        value={customerData.phone}
                        onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                        placeholder="Ej. 612 345 678"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs text-stone-900 outline-none focus:border-[#6b8a5a] transition-colors"
                      />
                      <span className="text-[10px] text-stone-400 block mt-0.5">
                        Recibirás la confirmación y recordatorio automático por WhatsApp.
                      </span>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Email de confirmación <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="email"
                        required
                        value={customerData.email}
                        onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                        placeholder="ejemplo@correo.com"
                        className="w-full px-3.5 py-2.5 bg-white border border-stone-200 rounded-2xl text-xs text-stone-900 outline-none focus:border-[#6b8a5a] transition-colors"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-stone-700 mb-1">
                        Notas o preferencias (Opcional)
                      </label>
                      <textarea
                        rows={2}
                        value={customerData.notes}
                        onChange={(e) => setCustomerData({ ...customerData, notes: e.target.value })}
                        placeholder="Algún detalle sobre tu piel, alergias o preferencia..."
                        className="w-full px-3.5 py-2 bg-white border border-stone-200 rounded-2xl text-xs text-stone-900 outline-none focus:border-[#6b8a5a] transition-colors resize-none"
                      />
                    </div>

                    {/* VOUCHER / CHEQUE REGALO / BONO INPUT */}
                    <div className="pt-2 border-t border-stone-100 space-y-2">
                      <label className="block text-xs font-bold text-stone-800 uppercase tracking-wider flex items-center gap-1.5">
                        <Ticket size={14} className="text-[#6b8a5a]" />
                        <span>¿Tienes un Cheque Regalo o Bono?</span>
                      </label>

                      {appliedVoucher ? (
                        <div className="p-3 rounded-2xl bg-[#f3f7ee] border border-[#7fa85f]/40 flex items-center justify-between gap-3 text-xs">
                          <div className="min-w-0">
                            <span className="font-bold text-[#6b8a5a] block uppercase">{appliedVoucher.code}</span>
                            <span className="text-stone-600 text-[11px]">
                              {appliedVoucher.type === 'gift_card' 
                                ? `Saldo disponible: ${appliedVoucher.remaining_balance} €` 
                                : 'Bono de tratamiento validado con éxito'}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={handleRemoveVoucher}
                            className="text-xs text-rose-600 font-semibold hover:underline cursor-pointer shrink-0"
                          >
                            Quitar
                          </button>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={voucherCodeInput}
                            onChange={(e) => setVoucherCodeInput(e.target.value.toUpperCase())}
                            placeholder="Ej. REGALO-2026"
                            className="flex-1 px-3.5 py-2 bg-white border border-stone-200 rounded-xl text-xs uppercase tracking-wider text-stone-900 outline-none focus:border-[#6b8a5a]"
                          />
                          <button
                            type="button"
                            onClick={handleApplyVoucher}
                            disabled={voucherLoading || !voucherCodeInput.trim()}
                            className="py-2 px-3.5 bg-stone-900 hover:bg-black text-white text-xs font-semibold rounded-xl transition-all disabled:opacity-40 cursor-pointer flex items-center gap-1.5"
                          >
                            {voucherLoading && <Loader2 size={12} className="animate-spin" />}
                            <span>Aplicar</span>
                          </button>
                        </div>
                      )}

                      {voucherError && (
                        <p className="text-[11px] text-rose-600 font-semibold">{voucherError}</p>
                      )}
                    </div>

                    {/* GDPR Consent */}
                    <div className="pt-2">
                      <label className="flex items-start gap-2.5 text-xs text-stone-600 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={customerData.gdpr}
                          onChange={(e) => setCustomerData({ ...customerData, gdpr: e.target.checked })}
                          className="mt-0.5 rounded border-stone-300 text-[#6b8a5a] focus:ring-[#6b8a5a]"
                        />
                        <span>
                          Acepto el tratamiento de mis datos para la gestión y recordatorio de mi cita en Respira.
                        </span>
                      </label>
                    </div>

                  </div>
                </div>
              )}

              {/* PASO 3: CONFIRMACIÓN EXITOSA */}
              {bookingStep === 'success' && (
                <div className="text-center py-6 space-y-4 animate-in fade-in">
                  <div className="w-16 h-16 bg-[#6b8a5a] text-white rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <CheckCircle2 size={36} />
                  </div>

                  <div className="space-y-1">
                    <h3 className="text-xl font-bold text-stone-900">
                      ¡Cita Confirmada con Éxito!
                    </h3>
                    <p className="text-xs text-stone-500">
                      Hemos reservado tu momento de bienestar en Respira.
                    </p>
                  </div>

                  {completedBooking && (
                    <div className="p-4 bg-[#f3f7ee] border border-[#7fa85f]/30 rounded-2xl text-xs text-stone-800 space-y-2 text-left max-w-sm mx-auto">
                      <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                        <span className="text-stone-500">Tratamiento:</span>
                        <span className="font-bold">{completedBooking.service}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                        <span className="text-stone-500">Fecha y Hora:</span>
                        <span className="font-bold">{formatDatePretty(completedBooking.date)} a las {completedBooking.time}</span>
                      </div>
                      <div className="flex justify-between border-b border-stone-200/60 pb-1.5">
                        <span className="text-stone-500">Especialista:</span>
                        <span className="font-bold">{completedBooking.employee}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-stone-500">Total:</span>
                        <span className="font-bold text-[#6b8a5a]">
                          {completedBooking.finalPrice === 0 ? '0.00 € (Abonado con Cheque/Bono)' : `${Number(completedBooking.finalPrice || 0).toFixed(2)} €`}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="pt-2 flex flex-col sm:flex-row gap-2 justify-center">
                    {googleCalendarUrl !== '#' && (
                      <a
                        href={googleCalendarUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="py-2.5 px-4 bg-stone-900 hover:bg-black text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                      >
                        <Calendar size={14} />
                        <span>Añadir a Google Calendar</span>
                      </a>
                    )}

                    <a
                      href={`https://wa.me/34688692295?text=Hola,%20acabo%20de%20reservar%20cita%20para%20${encodeURIComponent(completedBooking?.service || 'tratamiento')}%20el%20${completedBooking?.date}%20a%20las%20${completedBooking?.time}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-2.5 px-4 bg-[#6b8a5a] hover:bg-[#5a774b] text-white rounded-xl text-xs font-semibold transition-all flex items-center justify-center gap-1.5"
                    >
                      <MessageCircle size={14} />
                      <span>WhatsApp de Respira</span>
                    </a>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={() => setIsBookingOpen(false)}
                      className="text-xs text-stone-500 hover:text-stone-900 font-semibold underline cursor-pointer"
                    >
                      Cerrar y volver al salón
                    </button>
                  </div>
                </div>
              )}

            </div>

            {/* Sticky Bottom Actions Bar (Airbnb Style) */}
            {bookingStep !== 'success' && (
              <div className="p-4 sm:p-5 border-t border-stone-200 bg-white/95 backdrop-blur-md flex items-center justify-between gap-4 sticky bottom-0">
                <div>
                  <span className="text-[11px] text-stone-400 block font-normal">
                    {appliedVoucher ? 'Total tras aplicar bono' : 'Total a abonar en el salón'}
                  </span>
                  <span className="text-lg font-bold font-sans text-stone-900">
                    {finalPrice === 0 ? '0.00 € (Cubierto)' : `${Number(finalPrice).toFixed(2)} €`}
                  </span>
                </div>

                {bookingStep === 'datetime' ? (
                  <button
                    type="button"
                    disabled={!selectedDate || !selectedTime}
                    onClick={() => setBookingStep('customer')}
                    className="py-3 px-6 bg-[#6b8a5a] hover:bg-[#5a774b] text-white font-semibold rounded-2xl text-xs sm:text-sm transition-all shadow-md disabled:opacity-40 cursor-pointer active:scale-98"
                  >
                    Continuar a tus datos
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setBookingStep('datetime')}
                      className="py-3 px-3.5 bg-stone-100 hover:bg-stone-200 text-stone-800 font-semibold rounded-2xl text-xs transition-colors cursor-pointer"
                    >
                      Atrás
                    </button>
                    <button
                      type="button"
                      disabled={isSubmitting || !customerData.name.trim() || !customerData.phone.trim() || !customerData.email.trim() || !customerData.gdpr}
                      onClick={handleConfirmBooking}
                      className="py-3 px-6 bg-[#6b8a5a] hover:bg-[#5a774b] text-white font-semibold rounded-2xl text-xs sm:text-sm transition-all shadow-md disabled:opacity-40 cursor-pointer flex items-center gap-2"
                    >
                      {isSubmitting && <Loader2 size={14} className="animate-spin" />}
                      <span>Confirmar Cita</span>
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      )}

    </div>
  );
}
