import { supabase } from './supabase';

export async function logChartAccess(opts: {
  chartId: string;
  practiceId: string;
  actorId: string;
  actorRole: string;
  action?: string;
}) {
  try {
    await supabase.from('phi_access_log').insert({
      chart_id:    opts.chartId,
      practice_id: opts.practiceId,
      actor_id:    opts.actorId,
      actor_role:  opts.actorRole,
      action:      opts.action ?? 'view_chart',
    });
  } catch (err) {
    console.warn('[phi_access_log] insert failed:', err);
  }
}
