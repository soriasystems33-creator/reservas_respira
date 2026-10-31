'use client';
import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Calendar, Clock, User, Scissors, AlertCircle, ArrowLeft, PlusCircle, CheckCircle2, XCircle, ShieldCheck, Lock } from 'lucide-react';

function MisCitasContent() {
  const searchParams = useSearchParams();
  const idParam = searchParams.get('id') || '';

  const [loading, setLoading] = useState(true);
  const [clientName, setClientName] = useState('');
  const [appointments, setAppointments] = useState([]);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!idParam) {
      setLoading(false);
      return;
    }

    const fetchCitas = async () => {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch(`/api/mis-citas?id=${encodeURIComponent(idParam)}`);
        const data = await res.json();
        if (data.success) {
          setAppointments(data.appointments || []);
          setClientName(data.clientName || '');
        } else {
          setErrorMsg(data.error || 'No se pudieron cargar tus citas.');
          setAppointments([]);
        }
      } catch (e) {
        console.error(e);
        setErrorMsg('Error de conexión. Inténtalo de nuevo.');
        setAppointments([]);
      }
      setLoading(false);
    };

    fetchCitas();
  }, [idParam]);

  const todayStr = new Date().toISOString().split('T')[0];

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
          <Link href="/" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#a8876b] uppercase tracking-wider mb-2 hover:underline">
            <ArrowLeft className="w-3.5 h-3.5" /> Estetica Respira
          </Link>
          <h1 className="text-3xl sm:text-4xl font-semibold italic text-[#2e2826]" style={{ fontFamily: "'Cormorant Garamond', serif" }}>
            Mis Citas
          </h1>
          {clientName && (
            <p className="text-xs font-semibold text-[#7a6b67] mt-1">
              Hola, <span className="text-[#a8876b] font-bold">{clientName}</span> 👋
            </p>
          )}
        </div>

        {/* Sin token / ID privado */}
        {!idParam && !loading && (
          <div className="card p-8 bg-white rounded-3xl border border-[#e0d8d5] text-center shadow-sm space-y-4">
            <div className="w-14 h-14 bg-[#fbf2f3] rounded-full flex items-center justify-center mx-auto text-[#a8876b]">
              <Lock className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[#2e2826]">Acceso Seguro a tus Citas</h2>
              <p className="text-xs text-[#7a6b67] mt-2 leading-relaxed">
                Por motivos de privacidad y protección de datos, el acceso a tu agenda personal se realiza a través del enlace privado que te enviamos por <strong>WhatsApp</strong> o <strong>correo electrónico</strong> al confirmar tu cita.
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
            <div className="w-10 h-10 border-4 rounded-full animate-spin mx-auto mb-4 border-[#e0d8d5] border-t-[#a8876b]"></div>
            <p className="text-xs font-bold uppercase tracking-widest text-[#7a6b67]">Cargando tus citas seguras...</p>
          </div>
        )}

        {/* Error State */}
        {idParam && errorMsg && !loading && (
          <div className="p-8 bg-[#fff5f5] rounded-3xl border border-[#fecaca] text-center space-y-3 shadow-sm mb-6">
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto text-red-500">
              <AlertCircle className="w-6 h-6" />
            </div>
            <p className="font-bold text-xs text-red-600 leading-relaxed">{errorMsg}</p>
            <Link href="/" className="inline-block text-xs font-bold text-[#a8876b] uppercase hover:underline">
              Ir a la página principal
            </Link>
          </div>
        )}

        {/* Lista de Citas */}
        {idParam && !loading && !errorMsg && (
          <div className="space-y-6">
            {/* Próximas Citas */}
            <div>
              <div className="flex items-center justify-between mb-3 px-1">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#7a6b67] flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#a8876b]" />
                  Próximas Citas ({upcomingApts.length})
                </h2>
                <Link href="/" className="text-[11px] font-bold text-[#a8876b] flex items-center gap-1 hover:underline">
                  <PlusCircle className="w-3.5 h-3.5" /> Nueva cita
                </Link>
              </div>

              {upcomingApts.length === 0 ? (
                <div className="card p-8 bg-white rounded-3xl border border-[#e0d8d5] text-center space-y-3 shadow-sm">
                  <p className="text-xs font-medium text-[#7a6b67]">No tienes citas próximas activas.</p>
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
                  {upcomingApts.map((apt, idx) => (
                    <div key={apt.id || idx} className="bg-white rounded-2xl border border-[#d99ba1] p-4 sm:p-5 shadow-sm space-y-3 transition-all">
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
                          <span className="text-base font-black text-[#a8876b]">
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
                          <Clock className="w-3.5 h-3.5 text-[#a8876b]" />
                          <span className="font-bold text-[#2e2826]">
                            {apt.date?.split('-').reverse().join('/')} a las {apt.time}h
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 justify-end">
                          <User className="w-3.5 h-3.5 text-[#a8876b]" />
                          <span className="font-semibold text-[#2e2826] truncate">
                            {apt.employee || 'Especialista'}
                          </span>
                        </div>
                      </div>

                      {/* Acciones */}
                      <div className="flex gap-2 pt-2 border-t border-[#f0ebe6]">
                        <Link
                          href={`/modificar?id=${apt.id}`}
                          className="flex-1 py-2 px-3 rounded-xl font-bold text-[11px] text-center uppercase tracking-wider text-white shadow-sm transition-transform active:scale-[0.98]"
                          style={{ background: 'var(--blue-deep)' }}
                        >
                          Modificar
                        </Link>
                        <Link
                          href={`/cancelar?id=${apt.id}&cancel=1`}
                          className="py-2 px-4 rounded-xl font-bold text-[11px] text-center uppercase tracking-wider text-red-600 border border-red-200 bg-red-50/50 hover:bg-red-50 transition-colors"
                        >
                          Cancelar
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Historial / Pasadas o Canceladas */}
            {pastOrCancelledApts.length > 0 && (
              <div className="pt-4 border-t border-[#e0d8d5]">
                <h2 className="text-xs font-black uppercase tracking-wider text-[#a8a29e] mb-3 px-1">
                  Historial de Citas ({pastOrCancelledApts.length})
                </h2>
                <div className="space-y-2 opacity-80">
                  {pastOrCancelledApts.map((apt, idx) => {
                    const isCanc = apt.status === 'cancelled';
                    return (
                      <div key={apt.id || idx} className="bg-white/70 rounded-xl border border-[#e0d8d5] p-3 text-xs space-y-1">
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
        <div className="spinner border-[#e0d8d5] border-t-[#a8876b]"></div>
      </div>
    }>
      <MisCitasContent />
    </Suspense>
  );
}
