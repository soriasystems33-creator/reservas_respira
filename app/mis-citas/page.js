'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  Calendar, Clock, User, AlertCircle, ArrowLeft, PlusCircle, 
  CheckCircle2, Lock, Ticket, Gift, Sparkles, Copy, Check, ArrowRight 
} from 'lucide-react';

function MisCitasContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id') || '';
  const tParam = searchParams.get('t') || '';
  const cParam = searchParams.get('c') || '';
  const tcParam = searchParams.get('tc') || '';
  const codeParam = searchParams.get('code') || searchParams.get('voucher') || searchParams.get('bono') || '';
  const hasAuthQuery = Boolean(idParam || cParam || codeParam);

  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [vouchers, setVouchers] = useState([]);
  const [copiedCode, setCopiedCode] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!hasAuthQuery) {
      setTimeout(() => setLoading(false), 0);
      return;
    }

    const fetchDatos = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        let url = '';
        if (codeParam) {
          url = `/api/mis-citas?code=${encodeURIComponent(codeParam)}`;
        } else if (cParam) {
          url = `/api/mis-citas?c=${encodeURIComponent(cParam)}&tc=${encodeURIComponent(tcParam)}`;
        } else {
          url = `/api/mis-citas?id=${encodeURIComponent(idParam)}${tParam ? `&t=${encodeURIComponent(tParam)}` : ''}`;
        }

        const res = await fetch(url);
        const data = await res.json();
        if (data.success) {
          setAppointments(data.appointments || []);
          setVouchers(data.vouchers || []);
          setClientName(data.clientName || '');
        } else {
          setErrorMsg(data.error || 'No se pudieron cargar tus citas ni bonos.');
          setAppointments([]);
          setVouchers([]);
        }
      } catch (e) {
        console.error(e);
        setErrorMsg('Error de conexión. Inténtalo de nuevo.');
        setAppointments([]);
        setVouchers([]);
      }
      setTimeout(() => setLoading(false), 0);
    };

    fetchDatos();
  }, [idParam, tParam, cParam, tcParam, codeParam, hasAuthQuery]);

  const handleCopyCode = (code) => {
    if (!code) return;
    navigator.clipboard?.writeText(code).then(() => {
      setCopiedCode(code);
      setTimeout(() => setCopiedCode(null), 2000);
    }).catch(() => {
      prompt('Código:', code);
    });
  };

  const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Madrid' }).format(new Date());

  const upcomingApts = appointments.filter(a => {
    if (a.status === 'cancelled') return false;
    return a.date >= todayStr;
  });

  const pastOrCancelledApts = appointments.filter(a => {
    return a.status === 'cancelled' || a.date < todayStr;
  });

  return (
    <div className="min-h-screen bg-[#faf7f4] py-8 px-4 sm:px-6">
      <div className="max-w-xl mx-auto">
        {/* Header */}
        <div className="text-center mb-6">
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6b8a5a] uppercase tracking-wider mb-2 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Estética Respira
          </Link>
          <h1 className="text-3xl sm:text-4xl font-semibold italic text-[#2e2826]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Mis Citas y Bonos
          </h1>
          {clientName && (
            <p className="text-xs font-semibold text-[#7a6b67] mt-1">
              Hola, <span className="text-[#6b8a5a] font-bold">{clientName}</span> 👋
            </p>
          )}
        </div>

        {/* Sin enlace seguro */}
        {!hasAuthQuery && !loading && (
          <div className="card p-8 bg-white rounded-3xl border border-[#e0d8d5] text-center shadow-sm space-y-4">
            <div className="w-14 h-14 bg-[#faf7f4] rounded-full flex items-center justify-center mx-auto text-[#6b8a5a]">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2e2826]">Acceso Seguro a tus Citas y Bonos</h2>
              <p className="text-xs text-[#7a6b67] mt-2 leading-relaxed">
                Por motivos de privacidad y protección de datos, el acceso a tu espacio personal se realiza a través del enlace privado que te enviamos por <strong>WhatsApp</strong> o <strong>correo electrónico</strong> al confirmar tu cita o bono.
              </p>
            </div>
            <div className="pt-2">
              <Link
                href="/"
                className="inline-block w-full py-3.5 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider text-white shadow-md transition-all active:scale-[0.98]"
                style={{ background: 'var(--blue-deep)' }}
              >
                Reservar una Cita
              </Link>
            </div>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="p-12 text-center">
            <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#6b8a5a]"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Cargando tus citas y bonos...</p>
          </div>
        )}

        {/* Error State */}
        {hasAuthQuery && errorMsg && !loading && (
          <div className="p-8 bg-[#fff5f5] rounded-3xl border border-[#fecaca] text-center space-y-3 shadow-sm mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="font-bold text-xs text-red-600 leading-relaxed">{errorMsg}</p>
            <Link href="/" className="inline-block text-xs font-bold text-[#6b8a5a] uppercase hover:underline">
              Ir a la página principal
            </Link>
          </div>
        )}

        {/* Contenido autenticado */}
        {hasAuthQuery && !loading && !errorMsg && (
          <div className="space-y-6">

            {/* SECCIÓN 1: BONOS Y CHEQUES REGALO */}
            {vouchers.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-xs font-black uppercase tracking-wider text-[#7a6b67] flex items-center gap-1.5">
                    <Ticket className="w-4 h-4 text-[#6b8a5a]" />
                    Tus Bonos y Cheques ({vouchers.length})
                  </h2>
                </div>

                <div className="space-y-3">
                  {vouchers.map((v, vIdx) => {
                    const isBono = (v.type === 'bono') || (v.total_sessions !== undefined && Number(v.total_sessions) > 0);
                    const totSessions = Number(v.total_sessions || v.totalSessions || 1);
                    const remSessions = v.remaining_sessions !== undefined 
                      ? Number(v.remaining_sessions) 
                      : (v.used ? 0 : totSessions);
                    const isUsed = isBono ? (remSessions <= 0 || !!v.used) : !!v.used;
                    const expStr = v.expires_at || v.expiresAt || '';
                    const isExpired = !isUsed && !!expStr && expStr < todayStr;
                    const isActive = !isUsed && !isExpired;

                    const usedCount = Math.max(0, totSessions - remSessions);
                    const pctRemaining = totSessions > 0 ? Math.round((remSessions / totSessions) * 100) : 0;

                    return (
                      <div 
                        key={v.id || v.code || vIdx} 
                        className={`bg-white rounded-3xl p-5 border shadow-sm transition-all space-y-4 ${
                          isActive 
                            ? 'border-[#c6d7be] ring-1 ring-[#e4ede0]' 
                            : 'border-[#e0d8d5] opacity-75'
                        }`}
                      >
                        {/* Cabecera Tarjeta */}
                        <div className="flex items-start justify-between gap-2 border-b border-[#f0ebe6] pb-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                              isBono ? 'bg-[#edf4eb] text-[#4a6b3d]' : 'bg-[#fef3c7] text-[#92400e]'
                            }`}>
                              {isBono ? <Sparkles className="w-4 h-4" /> : <Gift className="w-4 h-4" />}
                            </div>
                            <div>
                              <span className="text-[10px] font-black uppercase tracking-wider text-[#7a6b67]">
                                {isBono ? 'Bono de Sesiones' : 'Cheque Regalo'}
                              </span>
                              <h3 className="font-bold text-base text-[#2e2826] leading-tight">
                                {v.service_name || v.serviceName || (isBono ? 'Tratamiento personalizado' : `${(parseFloat(v.amount) || 0).toFixed(2)}€ de saldo`)}
                              </h3>
                            </div>
                          </div>

                          {/* Badge Estado */}
                          <div className="shrink-0">
                            {isActive ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e8f5e9] text-[#2e7d32]">
                                <CheckCircle2 className="w-3 h-3" /> Activo
                              </span>
                            ) : isExpired ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#fef2f2] text-[#dc2626]">
                                Caducado
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#f5f5f4] text-[#78716c]">
                                {isBono ? 'Agotado' : 'Canjeado'}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Detalle de Sesiones (Para Bono) */}
                        {isBono && (
                          <div className="bg-[#faf7f4] rounded-2xl p-3.5 space-y-2">
                            <div className="flex justify-between items-baseline text-xs">
                              <span className="font-bold text-[#423b38]">Sesiones restantes</span>
                              <span className="text-sm font-black text-[#4a6b3d] font-mono">
                                {remSessions} <span className="text-xs font-semibold text-[#7a6b67]">de {totSessions} disponibles</span>
                              </span>
                            </div>

                            {/* Barra de Progreso Visual */}
                            <div className="w-full bg-[#e8e2dc] rounded-full h-2.5 overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all duration-500" 
                                style={{ 
                                  width: `${pctRemaining}%`, 
                                  background: remSessions > 1 ? '#6b8a5a' : (remSessions === 1 ? '#d97706' : '#a8a29e') 
                                }}
                              />
                            </div>

                            {/* Indicador de sesiones canjeadas */}
                            <div className="flex items-center justify-between text-[11px] text-[#7a6b67] pt-0.5">
                              <span>Canjeadas: {usedCount}</span>
                              <span>Disponibles: {remSessions}</span>
                            </div>
                          </div>
                        )}

                        {/* Detalle de Cheque Regalo */}
                        {!isBono && (
                          <div className="bg-[#faf7f4] rounded-2xl p-3.5 flex justify-between items-center text-xs">
                            <span className="font-bold text-[#423b38]">Valor del regalo</span>
                            <span className="text-base font-black text-[#92400e] font-mono">
                              {(parseFloat(v.amount) || 0).toFixed(2)} €
                            </span>
                          </div>
                        )}

                        {/* Código y Caducidad */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#7a6b67]">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] uppercase font-bold text-[#a8a29e]">Código:</span>
                            <button
                              onClick={() => handleCopyCode(v.code)}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-xl bg-stone-100 hover:bg-stone-200 text-[#2e2826] font-mono font-bold text-xs transition-colors"
                              title="Copiar código"
                            >
                              {v.code}
                              {copiedCode === v.code ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="w-3.5 h-3.5 text-stone-400" />
                              )}
                            </button>
                          </div>

                          <div className="text-[11px] font-medium text-[#7a6b67]">
                            {expStr ? (
                              <span>Válido hasta: <strong className="text-[#2e2826]">{expStr.split('-').reverse().join('/')}</strong></span>
                            ) : (
                              <span className="text-emerald-700 font-semibold">Sin caducidad</span>
                            )}
                          </div>
                        </div>

                        {/* Botón para Reservar con el Bono */}
                        {isActive && (
                          <div className="pt-2">
                            <Link
                              href={`/?voucher=${encodeURIComponent(v.code)}`}
                              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs text-center uppercase tracking-wider text-white shadow-sm flex items-center justify-center gap-2 transition-transform active:scale-[0.99]"
                              style={{ background: 'var(--blue-deep)' }}
                            >
                              <span>Reservar Cita con este {isBono ? 'Bono' : 'Cheque'}</span>
                              <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* SECCIÓN 2: PRÓXIMAS CITAS */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#7a6b67] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#6b8a5a]" />
                  Próximas Citas ({upcomingApts.length})
                </h2>
                <Link href="/" className="text-[11px] font-bold text-[#6b8a5a] flex items-center gap-1 hover:underline">
                  <PlusCircle className="w-3.5 h-3.5" /> Nueva cita
                </Link>
              </div>

              {upcomingApts.length === 0 ? (
                <div className="card p-8 bg-white rounded-3xl border border-[#e0d8d5] text-center space-y-3 shadow-sm">
                  <p className="text-xs font-medium text-[#7a6b67]">No tienes citas próximas agendadas.</p>
                  <Link
                    href="/"
                    className="inline-block py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white shadow-sm"
                    style={{ background: 'var(--blue-deep)' }}
                  >
                    Hacer una reserva
                  </Link>
                </div>
              ) : (
                <div className="space-y-3">
                  {upcomingApts.map((apt, idx) => {
                    const tokenQuery = apt.token ? `&t=${encodeURIComponent(apt.token)}` : '';
                    return (
                      <div key={apt.id || idx} className="bg-white rounded-3xl border border-[#d99ba1] p-4 sm:p-5 shadow-sm space-y-3 transition-all">
                        <div className="flex items-start justify-between gap-2 border-b border-[#f0ebe6] pb-3">
                          <div>
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-[#e8f5e9] text-[#2e7d32]">
                              <CheckCircle2 className="w-3 h-3" /> Confirmada
                            </span>
                            <h3 className="font-bold text-base text-[#2e2826] mt-1.5 leading-snug">
                              {apt.service}
                            </h3>
                          </div>
                          <div className="text-right shrink-0">
                            <span className="text-base font-black text-[#6b8a5a]">
                              {apt.price ? `${apt.price}€` : ''}
                            </span>
                            <span className="text-[10px] text-[#7a6b67] block font-semibold">
                              {apt.duration} min
                            </span>
                          </div>
                        </div>

                        {/* Desglose de servicios si son múltiples */}
                        {apt.services && apt.services.length > 1 && (
                          <div className="bg-[#faf7f4] rounded-xl p-2.5 space-y-1 text-xs">
                            <span className="text-[10px] uppercase font-black tracking-wider text-[#7a6b67] block mb-1">
                              Servicios incluidos:
                            </span>
                            {apt.services.map((s, sIdx) => (
                              <div key={sIdx} className="flex justify-between text-[#423b38]">
                                <span>• {s.name}</span>
                                <span className="font-semibold text-[#7a6b67]">
                                  {s.duration} min {s.employee ? `· ${s.employee}` : ''}
                                </span>
                              </div>
                            ))}
                          </div>
                        )}

                        <div className="grid grid-cols-2 gap-2 text-xs text-[#7a6b67] pt-1">
                          <div className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-[#6b8a5a]" />
                            <span className="font-bold text-[#2e2826]">
                              {apt.date?.split('-').reverse().join('/')} a las {apt.time}h
                            </span>
                          </div>
                          <div className="flex items-center gap-1.5 justify-end">
                            <User className="w-3.5 h-3.5 text-[#6b8a5a]" />
                            <span className="font-semibold text-[#2e2826] truncate">
                              {apt.employee || 'Especialista'}
                            </span>
                          </div>
                        </div>

                        {/* Acciones */}
                        <div className="flex gap-2 pt-2 border-t border-[#f0ebe6]">
                          <Link
                            href={`/modificar?id=${apt.id}${tokenQuery}`}
                            className="flex-1 py-2 px-3 rounded-xl font-bold text-[11px] text-center uppercase tracking-wider text-white shadow-sm transition-transform active:scale-[0.98]"
                            style={{ background: 'var(--blue-deep)' }}
                          >
                            Modificar
                          </Link>
                          <Link
                            href={`/cancelar?id=${apt.id}&cancel=1${tokenQuery}`}
                            className="py-2 px-4 rounded-xl font-bold text-[11px] text-center uppercase tracking-wider text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors"
                          >
                            Cancelar
                          </Link>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* SECCIÓN 3: HISTORIAL DE CITAS PASADAS O CANCELADAS */}
            {pastOrCancelledApts.length > 0 && (
              <div className="pt-4 border-t border-[#e0d8d5]">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#a8a29e] mb-3 px-1">
                  Historial de Citas ({pastOrCancelledApts.length})
                </h2>
                <div className="space-y-2 opacity-80">
                  {pastOrCancelledApts.map((apt, idx) => {
                    const isCanc = apt.status === 'cancelled';
                    return (
                      <div key={apt.id || idx} className="bg-white/70 rounded-2xl border border-[#e0d8d5] p-3 text-xs space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="font-bold text-[#423b38] truncate">{apt.service}</span>
                          {isCanc ? (
                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                              Cancelada
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-slate-500">Completada</span>
                          )}
                        </div>
                        <div className="flex justify-between text-[#7a6b67] text-[11px]">
                          <span>{apt.date?.split('-').reverse().join('/')} · {apt.time}h</span>
                          <span>{apt.price ? `${apt.price}€` : ''}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function MisCitasPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#faf7f4]">
        <div className="w-10 h-10 border-4 rounded-full animate-spin border-[#e0d8d5] border-t-[#6b8a5a]"></div>
      </div>
    }>
      <MisCitasContent />
    </Suspense>
  );
}
