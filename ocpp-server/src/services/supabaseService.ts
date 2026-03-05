import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

let supabase: SupabaseClient;

export function initSupabase(): SupabaseClient {
  if (!supabase) {
    supabase = createClient(config.supabase.url, config.supabase.serviceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
    logger.info('Supabase client initialized');
  }
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabase;
}

export async function findOrCreateCharger(
  chargePointId: string,
  bootInfo: any
): Promise<any> {
  const supabase = getSupabase();

  const { data: existing, error: selectError } = await supabase
    .from('ocpp_chargers')
    .select('*')
    .eq('charge_point_id', chargePointId)
    .maybeSingle();

  if (selectError) {
    logger.error('Error finding charger', { error: selectError, chargePointId });
    throw selectError;
  }

  if (existing) {
    const { error: updateError } = await supabase
      .from('ocpp_chargers')
      .update({
        vendor: bootInfo.chargePointVendor,
        model: bootInfo.chargePointModel,
        serial_number: bootInfo.chargePointSerialNumber,
        firmware_version: bootInfo.firmwareVersion,
        iccid: bootInfo.iccid,
        imsi: bootInfo.imsi,
        last_heartbeat_at: new Date().toISOString(),
        connection_status: 'Online',
        updated_at: new Date().toISOString(),
      })
      .eq('id', existing.id);

    if (updateError) {
      logger.error('Error updating charger', { error: updateError, chargerId: existing.id });
      throw updateError;
    }

    logger.info('Charger updated', { chargerId: existing.id, chargePointId });
    return existing;
  }

  const { data: newCharger, error: insertError } = await supabase
    .from('ocpp_chargers')
    .insert({
      charge_point_id: chargePointId,
      vendor: bootInfo.chargePointVendor,
      model: bootInfo.chargePointModel,
      serial_number: bootInfo.chargePointSerialNumber,
      firmware_version: bootInfo.firmwareVersion,
      iccid: bootInfo.iccid,
      imsi: bootInfo.imsi,
      protocol_version: '1.6J',
      registration_status: 'Pending',
      connection_status: 'Online',
      last_heartbeat_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (insertError) {
    logger.error('Error creating charger', { error: insertError, chargePointId });
    throw insertError;
  }

  logger.info('Charger created', { chargerId: newCharger.id, chargePointId });
  return newCharger;
}

export async function updateHeartbeat(chargerId: string): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('ocpp_chargers')
    .update({
      last_heartbeat_at: new Date().toISOString(),
      connection_status: 'Online',
      updated_at: new Date().toISOString(),
    })
    .eq('id', chargerId);

  if (error) {
    logger.error('Error updating heartbeat', { error, chargerId });
    throw error;
  }
}

export async function updateChargerStatus(
  chargerId: string,
  status: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('ocpp_chargers')
    .update({
      connection_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chargerId);

  if (error) {
    logger.error('Error updating charger status', { error, chargerId, status });
    throw error;
  }
}

export async function updateRegistrationStatus(
  chargerId: string,
  status: string
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase
    .from('ocpp_chargers')
    .update({
      registration_status: status,
      updated_at: new Date().toISOString(),
    })
    .eq('id', chargerId);

  if (error) {
    logger.error('Error updating registration status', { error, chargerId, status });
    throw error;
  }
}

export async function logOCPPMessage(
  chargerId: string | null,
  messageType: string,
  action: string,
  messageId: string,
  payload: any,
  direction: string,
  processingStatus: string = 'Success',
  errorCode: string | null = null,
  errorDescription: string | null = null
): Promise<void> {
  const supabase = getSupabase();

  const { error } = await supabase.from('ocpp_messages').insert({
    charger_id: chargerId,
    message_type: messageType,
    action,
    message_id: messageId,
    payload,
    direction,
    processing_status: processingStatus,
    error_code: errorCode,
    error_description: errorDescription,
  });

  if (error) {
    logger.error('Error logging OCPP message', { error, action, messageId });
  }
}

export default {
  initSupabase,
  getSupabase,
  findOrCreateCharger,
  updateHeartbeat,
  updateChargerStatus,
  updateRegistrationStatus,
  logOCPPMessage,
};
