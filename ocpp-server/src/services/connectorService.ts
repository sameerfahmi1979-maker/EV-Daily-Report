import { getSupabase } from './supabaseService.js';
import { logger } from '../utils/logger.js';
import { ChargePointStatus } from '../ocpp/types.js';

export async function findOrCreateConnector(
  chargerId: string,
  connectorId: number
): Promise<any> {
  const supabase = getSupabase();

  const { data: existing, error: selectError } = await supabase
    .from('ocpp_connectors')
    .select('*')
    .eq('charger_id', chargerId)
    .eq('connector_id', connectorId)
    .maybeSingle();

  if (selectError) {
    logger.error('Error finding connector', { error: selectError, chargerId, connectorId });
    throw selectError;
  }

  if (existing) {
    return existing;
  }

  const { data: newConnector, error: insertError } = await supabase
    .from('ocpp_connectors')
    .insert({
      charger_id: chargerId,
      connector_id: connectorId,
      status: 'Unavailable',
    })
    .select()
    .single();

  if (insertError) {
    logger.error('Error creating connector', { error: insertError, chargerId, connectorId });
    throw insertError;
  }

  logger.info('Connector created', { connectorDbId: newConnector.id, chargerId, connectorId });
  return newConnector;
}

export async function updateConnectorStatus(
  chargerId: string,
  connectorId: number,
  status: ChargePointStatus,
  errorCode: string = 'NoError',
  info?: string,
  vendorErrorCode?: string
): Promise<void> {
  const supabase = getSupabase();

  const connector = await findOrCreateConnector(chargerId, connectorId);

  const { error } = await supabase
    .from('ocpp_connectors')
    .update({
      status,
      error_code: errorCode,
      info: info || null,
      vendor_error_code: vendorErrorCode || null,
      last_status_update: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', connector.id);

  if (error) {
    logger.error('Error updating connector status', {
      error,
      connectorId: connector.id,
      status,
    });
    throw error;
  }

  logger.info('Connector status updated', {
    connectorDbId: connector.id,
    chargerId,
    connectorId,
    status,
  });
}

export async function getConnector(
  chargerId: string,
  connectorId: number
): Promise<any> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('ocpp_connectors')
    .select('*')
    .eq('charger_id', chargerId)
    .eq('connector_id', connectorId)
    .maybeSingle();

  if (error) {
    logger.error('Error getting connector', { error, chargerId, connectorId });
    throw error;
  }

  return data;
}

export async function updateConnectorSession(
  connectorDbId: string,
  sessionId: string | null
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('ocpp_connectors')
    .update({
      current_session_id: sessionId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', connectorDbId);

  if (error) {
    logger.error('Error updating connector session', { error, connectorDbId, sessionId });
    throw error;
  }
}

export default {
  findOrCreateConnector,
  updateConnectorStatus,
  getConnector,
  updateConnectorSession,
};
