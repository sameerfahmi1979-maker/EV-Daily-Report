import { supabase } from '../supabase';

export async function handleHeartbeat(chargePointId: string): Promise<Record<string, unknown>> {
  const now = new Date().toISOString();

  await supabase
    .from('ocpp_chargers')
    .update({ last_heartbeat_at: now, connection_status: 'Online', updated_at: now })
    .eq('charge_point_id', chargePointId);

  return { currentTime: now };
}
