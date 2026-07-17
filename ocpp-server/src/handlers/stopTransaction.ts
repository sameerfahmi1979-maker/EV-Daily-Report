import { supabase } from '../supabase';

export async function handleStopTransaction(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { transactionId, meterStop, timestamp, reason } = payload as Record<string, unknown>;

  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .single();

  if (!charger) {
    return { idTagInfo: { status: 'Accepted' } };
  }

  const { data: session } = await supabase
    .from('ocpp_charging_sessions')
    .select('id, connector_id, start_meter_value, start_timestamp')
    .eq('charger_id', charger.id)
    .eq('transaction_id', Number(transactionId))
    .maybeSingle();

  if (session) {
    const endTs = (timestamp as string) || new Date().toISOString();
    const energyWh = (Number(meterStop) || 0) - (Number(session.start_meter_value) || 0);
    const durationMs =
      new Date(endTs).getTime() - new Date(session.start_timestamp as string).getTime();
    const durationMinutes = Math.max(0, Math.round(durationMs / 60000));

    await supabase
      .from('ocpp_charging_sessions')
      .update({
        end_timestamp: endTs,
        end_meter_value: Number(meterStop) || 0,
        stop_reason: (reason as string) || 'Local',
        energy_consumed_wh: energyWh,
        duration_minutes: durationMinutes,
        session_status: 'Completed',
        updated_at: new Date().toISOString(),
      })
      .eq('id', session.id);

    // Return connector to Available
    await supabase
      .from('ocpp_connectors')
      .update({
        status: 'Available',
        current_session_id: null,
        last_status_update: new Date().toISOString(),
      })
      .eq('id', session.connector_id);

    console.log(
      `[${chargePointId}] Session stopped: txId=${transactionId}, energy=${energyWh}Wh, duration=${durationMinutes}min, reason=${reason || 'Local'}`
    );
  } else {
    console.warn(`[${chargePointId}] StopTransaction: session txId=${transactionId} not found`);
  }

  return { idTagInfo: { status: 'Accepted' } };
}
