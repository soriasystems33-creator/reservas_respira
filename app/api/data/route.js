import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const [settingsRes, servicesRes, categoriesRes, employeesRes] = await Promise.all([
      supabase.from('settings').select('*').eq('id', 'main').single(),
      supabase.from('services').select('*'),
      supabase.from('categories').select('*'),
      supabase.from('employees').select('*')
    ]);

    const rawSettings = settingsRes.data || {};
    const settings = {
      ...rawSettings,
      start: rawSettings.start || '10:00',
      end: rawSettings.end || '20:00',
      specialDays: rawSettings.special_days || rawSettings.specialDays || {},
      weekly: rawSettings.weekly || {}
    };

    if (settings.weekly && typeof settings.weekly === 'object') {
      for (const k in settings.weekly) {
        if (k.startsWith('weekly_') || k.startsWith('weekly__')) {
          const normKey = 'weekly_' + k.replace(/^weekly_+/, '');
          settings[normKey] = settings.weekly[k];
        }
      }
    }

    const services = servicesRes.data || [];
    const categories = categoriesRes.data || [];
    const employees = employeesRes.data || [];

    return NextResponse.json({ success: true, settings, services, categories, employees });
  } catch (error) {
    console.error('Error fetching basic data:', error);
    return NextResponse.json({ success: false, error: 'Internal Server Error' }, { status: 500 });
  }
}
