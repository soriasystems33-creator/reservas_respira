import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    const fromDate = searchParams.get('from') || searchParams.get('startDate');
    const toDate = searchParams.get('to') || searchParams.get('endDate');

    if (!date && !fromDate) {
      return NextResponse.json({ success: false, error: 'Missing date or from parameter' }, { status: 400 });
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

    const [aptsRes, blocksRes] = await Promise.all([
      aptQuery,
      supabase.from('blocks').select('*')
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
      startTime: b.startTime || b.start_time,
      endTime: b.endTime || b.end_time,
      recurrenceEnd: b.recurrenceEnd || b.recurrence_end,
      startDate: b.startDate || b.start_date
    }));

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

      return NextResponse.json({ success: true, appointments, blocks });
    }

    return NextResponse.json({ success: true, appointments, blocks: allBlocks });
  } catch (error) {
    console.error('Error fetching availability:', error);
    return NextResponse.json({ success: false, error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
