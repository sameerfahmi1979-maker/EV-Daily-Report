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

  // ── Live updates ──────────────────────────────────────────────────────────
  // Walk sampled values to extract live power (W → kW) and cumulative energy (Wh)
  let latestPowerW: number | null = null;
  let latestEnergyWh: number | null = null;

  for (const mv of meterValue) {
    for (const sv of mv.sampledValue || []) {
      const measurand = sv.measurand || 'Energy.Active.Import.Register';
      const val = parseFloat(sv.value);
      if (isNaN(val)) continue;

      if (measurand === 'Power.Active.Import') {
        // Normalise to kW — charger may report in W or kW
        latestPowerW = sv.unit === 'kW' ? val * 1000 : val;
      } else if (measurand === 'Energy.Active.Import.Register') {
        // Normalise to Wh — charger may report in kWh or Wh
        latestEnergyWh = sv.unit === 'kWh' ? val * 1000 : val;
      }
    }
  }

  if (connector && (latestPowerW !== null)) {
    await supabase
      .from('ocpp_connectors')
      .update({ power_kw: latestPowerW / 1000, updated_at: new Date().toISOString() })
      .eq('id', connector.id);
  }

  if (sessionId && latestEnergyWh !== null) {
    // energy_consumed_wh = cumulative register - start meter value
    const { data: session } = await supabase
      .from('ocpp_charging_sessions')
      .select('start_meter_value')
      .eq('id', sessionId)
      .single();

    const consumed = session ? latestEnergyWh - (session.start_meter_value || 0) : latestEnergyWh;
    await supabase
      .from('ocpp_charging_sessions')
      .update({ energy_consumed_wh: Math.max(0, consumed), updated_at: new Date().toISOString() })
      .eq('id', sessionId);
  }

  console.log(
    `[${chargePointId}] MeterValues connector=${connectorId}` +
    (latestPowerW !== null ? ` power=${(latestPowerW / 1000).toFixed(2)}kW` : '') +
    (latestEnergyWh !== null ? ` energy=${latestEnergyWh.toFixed(0)}Wh` : '')
  );

  return {};
}
