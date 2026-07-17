import { supabase } from '../supabase';

export async function handleBootNotification(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { chargePointVendor, chargePointModel, chargePointSerialNumber, firmwareVersion, iccid, imsi } = payload as Record<string, string>;

  const now = new Date().toISOString();

  const { error } = await supabase.from('ocpp_chargers').upsert(
    {
      charge_point_id: chargePointId,
      vendor: chargePointVendor || 'ChargeCore Verde',
      model: chargePointModel || null,
      serial_number: chargePointSerialNumber || null,
      firmware_version: firmwareVersion || null,
      iccid: iccid || null,
      imsi: imsi || null,
      registration_status: 'Accepted',
      connection_status: 'Online',
      last_heartbeat_at: now,
      updated_at: now,
    },
    { onConflict: 'charge_point_id' }
  );

  if (error) {
    console.error(`[${chargePointId}] BootNotification DB error:`, error.message);
  }

  // Ensure 2 connectors exist for this charger
  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .single();

  if (charger) {
    for (const connId of [1, 2]) {
      await supabase.from('ocpp_connectors').upsert(
        {
          charger_id: charger.id,
          connector_id: connId,
          connector_type: 'Type2',
          status: 'Available',
          last_status_update: now,
        },
        { onConflict: 'charger_id,connector_id' }
      );
    }
    console.log(`[${chargePointId}] Registered: vendor=${chargePointVendor}, model=${chargePointModel}, fw=${firmwareVersion}`);
  }

  return {
    status: 'Accepted',
    currentTime: now,
    interval: 60,
  };
}
