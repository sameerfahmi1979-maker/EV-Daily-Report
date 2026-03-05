import { getSupabase } from './supabaseService.js';
import { logger } from '../utils/logger.js';
import { AuthorizationStatus } from '../ocpp/types.js';

export async function authorizeIdTag(idTag: string): Promise<AuthorizationStatus> {
  const supabase = getSupabase();

  const { data: operator, error } = await supabase
    .from('operators')
    .select('*')
    .eq('rfid_card_number', idTag)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('Error authorizing ID tag', { error, idTag });
    return AuthorizationStatus.Invalid;
  }

  if (!operator) {
    logger.warn('ID tag not found or inactive', { idTag });
    return AuthorizationStatus.Invalid;
  }

  logger.info('ID tag authorized', { idTag, operatorId: operator.id });
  return AuthorizationStatus.Accepted;
}

export async function getOperatorByIdTag(idTag: string): Promise<any | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('operators')
    .select('*')
    .eq('rfid_card_number', idTag)
    .eq('is_active', true)
    .maybeSingle();

  if (error) {
    logger.error('Error getting operator by ID tag', { error, idTag });
    return null;
  }

  return data;
}

export async function startSession(
  chargerId: string,
  connectorDbId: string,
  transactionId: number,
  idTag: string,
  meterStart: number,
  timestamp: string
): Promise<any> {
  const supabase = getSupabase();

  const operator = await getOperatorByIdTag(idTag);

  const { data: session, error } = await supabase
    .from('ocpp_charging_sessions')
    .insert({
      charger_id: chargerId,
      connector_id: connectorDbId,
      transaction_id: transactionId,
      operator_id: operator?.id || null,
      id_tag: idTag,
      authorization_status: 'Accepted',
      start_timestamp: timestamp,
      start_meter_value: meterStart,
      session_status: 'Active',
    })
    .select()
    .single();

  if (error) {
    logger.error('Error creating session', {
      error,
      chargerId,
      connectorDbId,
      transactionId,
    });
    throw error;
  }

  logger.info('Session started', {
    sessionId: session.id,
    transactionId,
    chargerId,
    idTag,
  });

  return session;
}

export async function stopSession(
  chargerId: string,
  transactionId: number,
  meterStop: number,
  timestamp: string,
  reason?: string
): Promise<void> {
  const supabase = getSupabase();

  const { data: session, error: selectError } = await supabase
    .from('ocpp_charging_sessions')
    .select('*')
    .eq('charger_id', chargerId)
    .eq('transaction_id', transactionId)
    .maybeSingle();

  if (selectError) {
    logger.error('Error finding session', { error: selectError, chargerId, transactionId });
    throw selectError;
  }

  if (!session) {
    logger.warn('Session not found', { chargerId, transactionId });
    return;
  }

  const energyConsumed = meterStop - session.start_meter_value;
  const startTime = new Date(session.start_timestamp);
  const endTime = new Date(timestamp);
  const durationMinutes = Math.floor((endTime.getTime() - startTime.getTime()) / 60000);

  const { error: updateError } = await supabase
    .from('ocpp_charging_sessions')
    .update({
      end_timestamp: timestamp,
      end_meter_value: meterStop,
      stop_reason: reason || null,
      energy_consumed_wh: energyConsumed,
      duration_minutes: durationMinutes,
      session_status: 'Completed',
      updated_at: new Date().toISOString(),
    })
    .eq('id', session.id);

  if (updateError) {
    logger.error('Error stopping session', { error: updateError, sessionId: session.id });
    throw updateError;
  }

  logger.info('Session stopped', {
    sessionId: session.id,
    transactionId,
    energyConsumed,
    durationMinutes,
  });
}

export async function getActiveSession(
  chargerId: string,
  transactionId: number
): Promise<any | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('ocpp_charging_sessions')
    .select('*')
    .eq('charger_id', chargerId)
    .eq('transaction_id', transactionId)
    .eq('session_status', 'Active')
    .maybeSingle();

  if (error) {
    logger.error('Error getting active session', { error, chargerId, transactionId });
    return null;
  }

  return data;
}

export default {
  authorizeIdTag,
  getOperatorByIdTag,
  startSession,
  stopSession,
  getActiveSession,
};
