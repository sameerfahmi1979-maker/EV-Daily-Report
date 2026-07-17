import { supabase } from '../supabase';

interface SampledValue {
  value: string;
  measurand?: string;
  unit?: string;
  phase?: string;
  context?: string;
  format?: string;
  location?: string;
}

interface MeterValueEntry {
  timestamp?: string;
  sampledValue?: SampledValue[];
}

export async function handleMeterValues(
  chargePointId: string,
  payload: Record<string, unknown>
): Promise<Record<string, unknown>> {
  const { connectorId, transactionId, meterValue } = payload as {
    connectorId: number;
    transactionId?: number;
    meterValue?: MeterValueEntry[];
  };

  if (!Array.isArray(meterValue) || meterValue.length === 0) return {};

  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .single();

  if (!charger) return {};

  const { data: connector } = await supabase
    .from('ocpp_connectors')
    .select('id')
    .eq('charger_id', charger.id)
    .eq('connector_id', connectorId)
    .maybeSingle();

  let sessionId: string | null = null;
  if (transactionId) {
    const { data: session } = await supabase
      .from('ocpp_charging_sessions')
      .select('id')
      .eq('charger_id', charger.id)
      .eq('transaction_id', transactionId)
      .maybeSingle();
    sessionId = session?.id || null;
  }

  const rows: Record<string, unknown>[] = [];
  for (const mv of meterValue) {
    const ts = mv.timestamp || new Date().toISOString();
    for (const sv of mv.sampledValue || []) {
      rows.push({
        session_id: sessionId,
        charger_id: charger.id,
        connector_id: connector?.id || null,
        timestamp: ts,
        measurand: sv.measurand || 'Energy.Active.Import.Register',
        value: parseFloat(sv.value) || 0,
        unit: sv.unit || 'Wh',
        phase: sv.phase || null,
        context: sv.context || 'Sample.Periodic',
        format: sv.format || 'Raw',
        location: sv.location || 'Outlet',
      });
    }
  }

  if (rows.length > 0) {
    const { error } = await supabase.from('ocpp_meter_values').insert(rows);
    if (error) {
      console.error(`[${chargePointId}] MeterValues insert error:`, error.message);
    }
  }

  return {};
}
