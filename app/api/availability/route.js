import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const NO_CACHE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
  'CDN-Cache-Control': 'no-store',
  'Vercel-CDN-Cache-Control': 'no-store'
};

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const fromDate = searchParams.get('from') || searchParams.get('startDate');
    const toDate = searchParams.get('to') || searchParams.get('endDate');

    if (!date && !fromDate) {
      return NextResponse.json({ success: false, error: 'Missing date or from parameter' }, { status: 400, headers: NO_CACHE_HEADERS });
    }

    const supabase = getSupabaseAdmin();

    let aptQuery = supabase.from('appointments').select('*');
    if (fromDate && toDate) {
      aptQuery = aptQuery.gte('date', fromDate).lte('date', toDate);
    } else if (fromDate) {
      aptQuery = aptQuery.gte('date', fromDate);
    } else {
      aptQuery = aptQuery.eq('date', date);
    }

    const [aptsRes, blocksRes, settingsRes] = await Promise.all([
      aptQuery,
      supabase.from('blocks').select('*'),
      supabase.from('settings').select('*').eq('id', 'main').maybeSingle()
    ]);

    let appointments = (aptsRes.data || []).map(a => ({
      id: a.id,
      date: a.date,
      time: a.time,
      duration: a.duration,
      employee: a.employee,
      services: a.services || [],
      status: a.status
    }));

    appointments = appointments.filter(apt => apt.status !== 'cancelled');

    const allBlocks = (blocksRes.data || []).map(b => ({
      ...b,
      startTime: b.startTime || b.start_time || '00:00',
      endTime: b.endTime || b.end_time || '23:59',
      fullDay: !!(b.fullDay || b.full_day || (b.startTime === '00:00' && b.endTime === '23:59')),
      recurrenceEnd: b.recurrenceEnd || b.recurrence_end,
      startDate: b.startDate || b.start_date
    }));

    const rawSettings = settingsRes.data || {};
    const specialDays = rawSettings.special_days || rawSettings.specialDays || {};

    if (date) {
      const reqDate = new Date(date + 'T12:00:00');
      const reqWeekday = reqDate.getDay();

      const blocks = allBlocks.filter(b => {
        if (b.recurrenceEnd && b.recurrenceEnd < date) return false;
        if (b.startDate && b.startDate > date) return false;
        if (b.recurrence && b.recurrence !== 'none' && b.date && b.date > date) return false;
        if (!b.recurrence || b.recurrence === 'none') return b.date === date;
        if (b.recurrence === 'daily') return true;
        if (b.recurrence === 'weekly') return b.weekday === reqWeekday;
        if (b.recurrence === 'biweekly') return b.weekday === reqWeekday;
        return false;
      });

      // Compute if date is globally closed
      const sp = specialDays[date];
      const isGlobalClosed = !!(sp && (sp.closed === true || sp.type === 'closed' || sp.global?.closed === true || sp.global?.type === 'closed'));
      const isWeeklyClosed = !!(rawSettings.weekly && rawSettings.weekly[reqWeekday] && rawSettings.weekly[reqWeekday].closed);
      const hasGlobalBlock = blocks.some(b => {
        const bEmp = (b.employee || '').toLowerCase();
        return (!bEmp || ['global', 'all', 'todas', 'todos', 'salon', 'centro'].includes(bEmp)) && b.fullDay;
      });

      const isClosed = isGlobalClosed || isWeeklyClosed || hasGlobalBlock;
      const closedReason = sp?.reason || sp?.global?.reason || (isWeeklyClosed ? 'Cerrado semanalmente' : (hasGlobalBlock ? 'Día cerrado' : null));

      return NextResponse.json({
        success: true,
        appointments,
        blocks,
        specialDays,
        isClosed,
        closedReason
      }, { headers: NO_CACHE_HEADERS });
    }

    return NextResponse.json({
      success: true,
      appointments,
      blocks: allBlocks,
      specialDays
    }, { headers: NO_CACHE_HEADERS });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500, headers: NO_CACHE_HEADERS });
  }
}
