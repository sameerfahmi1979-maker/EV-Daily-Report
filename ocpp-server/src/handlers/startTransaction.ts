import { supabase } from '../supabase';

// Simple monotonic transaction counter seeded from epoch seconds
let txCounter = Math.floor(Date.now() / 1000);

export async function handleStartTransaction(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { connectorId, idTag, meterStart, timestamp, reservationId } = payload as Record<string, unknown>;

  txCounter++;
  const transactionId = txCounter;

  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .single();

  if (!charger) {
    console.error(`[${chargePointId}] StartTransaction: charger not found in DB`);
    return { transactionId, idTagInfo: { status: 'Invalid' } };
  }

  const { data: connector } = await supabase
    .from('ocpp_connectors')
    .select('id')
    .eq('charger_id', charger.id)
    .eq('connector_id', Number(connectorId))
    .single();

  if (!connector) {
    console.error(`[${chargePointId}] StartTransaction: connector ${connectorId} not found`);
    return { transactionId, idTagInfo: { status: 'Invalid' } };
  }

  // Look up operator by RFID card
  const { data: operator } = await supabase
    .from('operators')
    .select('id')
    .eq('card_number', idTag as string)
    .maybeSingle();

  const startTs = (timestamp as string) || new Date().toISOString();

  const { error } = await supabase.from('ocpp_charging_sessions').insert({
    charger_id: charger.id,
    connector_id: connector.id,
    transaction_id: transactionId,
    operator_id: operator?.id || null,
    id_tag: idTag as string,
    authorization_status: 'Accepted',
    start_timestamp: startTs,
    start_meter_value: Number(meterStart) || 0,
    session_status: 'Active',
    reservation_id: reservationId ? Number(reservationId) : null,
  });

  if (error) {
    console.error(`[${chargePointId}] StartTransaction insert error:`, error.message);
  } else {
    console.log(`[${chargePointId}] Session started: txId=${transactionId}, idTag=${idTag}, connector=${connectorId}`);
  }

  // Update connector to Charging
  await supabase
    .from('ocpp_connectors')
    .update({ status: 'Charging', last_status_update: new Date().toISOString() })
    .eq('id', connector.id);

  return {
    transactionId,
    idTagInfo: { status: 'Accepted' },
  };
}
