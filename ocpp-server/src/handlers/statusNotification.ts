import { supabase } from '../supabase';

export async function handleStatusNotification(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { connectorId, status, errorCode, info, vendorErrorCode } = payload as Record<string, unknown>;

  // connectorId 0 = charger-level status, not a real connector
  if (connectorId === 0 || connectorId === '0') {
    console.log(`[${chargePointId}] Charger status: ${status}`);
    return {};
  }

  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .single();

  if (charger) {
    const { error } = await supabase
      .from('ocpp_connectors')
      .update({
        status: status as string,
        error_code: (errorCode as string) || null,
        info: (info as string) || null,
        vendor_error_code: (vendorErrorCode as string) || null,
        last_status_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('charger_id', charger.id)
      .eq('connector_id', Number(connectorId));

    if (error) {
      console.error(`[${chargePointId}] StatusNotification update error:`, error.message);
    } else {
      console.log(`[${chargePointId}] Connector ${connectorId} → ${status}`);
    }
  }

  return {};
}
