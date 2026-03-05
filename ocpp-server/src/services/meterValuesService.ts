import { getSupabase } from './supabaseService.js';
import { logger } from '../utils/logger.js';
import { MeterValue } from '../ocpp/types.js';

export async function storeMeterValues(
  chargerId: string,
  connectorDbId: string,
  sessionId: string | null,
  meterValues: MeterValue[]
): Promise<void> {
  const supabase = getSupabase();

  const records: any[] = [];

  for (const meterValue of meterValues) {
    for (const sampledValue of meterValue.sampledValue) {
      records.push({
        session_id: sessionId,
        charger_id: chargerId,
        connector_id: connectorDbId,
        timestamp: meterValue.timestamp,
        measurand: sampledValue.measurand || 'Energy.Active.Import.Register',
        value: parseFloat(sampledValue.value),
        unit: sampledValue.unit || 'Wh',
        phase: sampledValue.phase || null,
        context: sampledValue.context || 'Sample.Periodic',
        format: sampledValue.format || 'Raw',
        location: sampledValue.location || 'Outlet',
      });
    }
  }

  if (records.length === 0) {
    return;
  }

  const { error } = await supabase.from('ocpp_meter_values').insert(records);

  if (error) {
    logger.error('Error storing meter values', {
      error,
      chargerId,
      connectorDbId,
      count: records.length,
    });
    throw error;
  }

  logger.info('Meter values stored', {
    chargerId,
    connectorDbId,
    sessionId,
    count: records.length,
  });
}

export default {
  storeMeterValues,
};
