import WebSocket from 'ws';
import { supabase } from './supabase';
import { CALL, CALLRESULT, CALLERROR, PendingCall } from './types';
import { handleBootNotification } from './handlers/bootNotification';
import { handleHeartbeat } from './handlers/heartbeat';
import { handleStatusNotification } from './handlers/statusNotification';
import { handleAuthorize } from './handlers/authorize';
import { handleStartTransaction } from './handlers/startTransaction';
import { handleStopTransaction } from './handlers/stopTransaction';
import { handleMeterValues } from './handlers/meterValues';

/**
 * Pending outbound calls waiting for CallResult from charger.
 * Key: OCPP message ID, Value: promise resolve/reject.
 */
export const pendingCalls = new Map<string, PendingCall>();

export async function handleOcppMessage(
  chargePointId: string,
  ws: WebSocket,
  raw: string
): Promise<void> {
  let msg: unknown[];
  try {
    msg = JSON.parse(raw);
  } catch {
    console.error(`[${chargePointId}] Received invalid JSON: ${raw.substring(0, 100)}`);
    return;
  }

  if (!Array.isArray(msg) || msg.length < 3) {
    console.error(`[${chargePointId}] Malformed OCPP message`);
    return;
  }

  const msgType = msg[0] as number;

  if (msgType === CALL) {
    const [, msgId, action, payload] = msg as [number, string, string, Record<string, unknown>];
    await processCall(chargePointId, ws, msgId, action, payload || {});
  } else if (msgType === CALLRESULT) {
    const [, msgId, payload] = msg as [number, string, Record<string, unknown>];
    const pending = pendingCalls.get(msgId);
    if (pending) {
      pending.resolve(payload);
      pendingCalls.delete(msgId);
    }
  } else if (msgType === CALLERROR) {
    const [, msgId, errorCode, errorDescription] = msg as [number, string, string, string];
    const pending = pendingCalls.get(msgId);
    if (pending) {
      pending.reject({ errorCode, errorDescription });
      pendingCalls.delete(msgId);
    }
  }
}

async function processCall(
  chargePointId: string,
  ws: WebSocket,
  msgId: string,
  action: string,
  payload: Record<string, unknown>
): Promise<void> {
  // Best-effort: get charger DB ID for message logging
  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .select('id')
    .eq('charge_point_id', chargePointId)
    .maybeSingle();

  // Log incoming message (fire and forget)
  supabase
    .from('ocpp_messages')
    .insert({
      charger_id: charger?.id || null,
      message_type: 'Call',
      action,
      message_id: msgId,
      payload,
      direction: 'Incoming',
      processing_status: 'Success',
    })
    .then(() => {});

  let responsePayload: Record<string, unknown>;

  try {
    switch (action) {
      case 'BootNotification':
        responsePayload = await handleBootNotification(chargePointId, payload);
        break;
      case 'Heartbeat':
        responsePayload = await handleHeartbeat(chargePointId);
        break;
      case 'StatusNotification':
        responsePayload = await handleStatusNotification(chargePointId, payload);
        break;
      case 'Authorize':
        responsePayload = await handleAuthorize(chargePointId, payload);
        break;
      case 'StartTransaction':
        responsePayload = await handleStartTransaction(chargePointId, payload);
        break;
      case 'StopTransaction':
        responsePayload = await handleStopTransaction(chargePointId, payload);
        break;
      case 'MeterValues':
        responsePayload = await handleMeterValues(chargePointId, payload);
        break;
      case 'DataTransfer':
        console.log(`[${chargePointId}] DataTransfer (vendor-specific): ${JSON.stringify(payload).substring(0, 80)}`);
        responsePayload = { status: 'Accepted' };
        break;
      case 'DiagnosticsStatusNotification':
      case 'FirmwareStatusNotification':
        console.log(`[${chargePointId}] ${action}: ${JSON.stringify(payload)}`);
        responsePayload = {};
        break;
      default:
        console.warn(`[${chargePointId}] Unhandled action: ${action}`);
        responsePayload = {};
    }

    const response = JSON.stringify([CALLRESULT, msgId, responsePayload]);
    ws.send(response);

    // Log outgoing CallResult (fire and forget)
    supabase
      .from('ocpp_messages')
      .insert({
        charger_id: charger?.id || null,
        message_type: 'CallResult',
        action,
        message_id: msgId,
        payload: responsePayload,
        direction: 'Outgoing',
        processing_status: 'Success',
      })
      .then(() => {});
  } catch (err: unknown) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[${chargePointId}] Handler error for ${action}:`, errMsg);
    const errorResp = JSON.stringify([CALLERROR, msgId, 'InternalError', errMsg, {}]);
    ws.send(errorResp);
  }
}
