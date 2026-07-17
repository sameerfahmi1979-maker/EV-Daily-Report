import WebSocket from 'ws';
import { supabase } from './supabase';
import { chargerConnections } from './registry';
import { pendingCalls } from './ocppHandler';
import { CALL } from './types';

const POLL_INTERVAL_MS = 2000;
const COMMAND_TIMEOUT_MS = 30000;

export function startCommandPoller(): void {
  console.log(`Command poller started (${POLL_INTERVAL_MS}ms interval)`);
  setInterval(pollPendingCommands, POLL_INTERVAL_MS);
}

async function pollPendingCommands(): Promise<void> {
  const connectedIds = Array.from(chargerConnections.keys());
  if (connectedIds.length === 0) return;

  // Look up DB IDs for currently connected chargers
  const { data: chargers } = await supabase
    .from('ocpp_chargers')
    .select('id, charge_point_id')
    .in('charge_point_id', connectedIds);

  if (!chargers || chargers.length === 0) return;

  const chargerIdToPointId = new Map(
    chargers.map((c) => [c.id as string, c.charge_point_id as string])
  );
  const chargerDbIds = chargers.map((c) => c.id);

  // Fetch pending commands for connected chargers
  const { data: commands } = await supabase
    .from('ocpp_remote_commands')
    .select('*')
    .eq('status', 'Pending')
    .in('charger_id', chargerDbIds)
    .order('requested_at', { ascending: true })
    .limit(5);

  if (!commands || commands.length === 0) return;

  for (const cmd of commands) {
    const chargePointId = chargerIdToPointId.get(cmd.charger_id as string);
    if (!chargePointId) continue;

    const ws = chargerConnections.get(chargePointId);
    if (!ws || ws.readyState !== WebSocket.OPEN) continue;

    // Process without awaiting to avoid blocking the poll loop
    dispatchCommand(cmd, chargePointId, ws).catch((err) =>
      console.error(`[${chargePointId}] dispatchCommand error:`, err)
    );
  }
}

async function dispatchCommand(
  cmd: Record<string, unknown>,
  chargePointId: string,
  ws: WebSocket
): Promise<void> {
  const msgId = `cmd-${(cmd.id as string).substring(0, 8)}-${Date.now()}`;

  // Optimistic lock: only update if still Pending to prevent duplicate sends
  const { error: lockErr, count } = await supabase
    .from('ocpp_remote_commands')
    .update({ status: 'Sent', executed_at: new Date().toISOString() })
    .eq('id', cmd.id as string)
    .eq('status', 'Pending');

  if (lockErr || count === 0) {
    return; // Another process already picked it up
  }

  const ocppMsg = JSON.stringify([CALL, msgId, cmd.command_type, cmd.parameters || {}]);
  ws.send(ocppMsg);
  console.log(`[${chargePointId}] → ${cmd.command_type as string} [${msgId}]`);

  // Await the charger's CallResult/CallError
  const resultPromise = new Promise<Record<string, unknown>>((resolve, reject) => {
    pendingCalls.set(msgId, { resolve, reject });
    setTimeout(() => {
      if (pendingCalls.has(msgId)) {
        pendingCalls.delete(msgId);
        reject({ errorCode: 'Timeout', errorDescription: `No response within ${COMMAND_TIMEOUT_MS / 1000}s` });
      }
    }, COMMAND_TIMEOUT_MS);
  });

  try {
    const result = await resultPromise;
    const finalStatus = (result.status as string) === 'Accepted' ? 'Accepted' : 'Rejected';
    console.log(`[${chargePointId}] ✓ ${cmd.command_type as string}: ${finalStatus}`);
    await supabase
      .from('ocpp_remote_commands')
      .update({
        status: finalStatus,
        command_result: result,
        completed_at: new Date().toISOString(),
      })
      .eq('id', cmd.id as string);
  } catch (err: unknown) {
    const e = err as { errorCode?: string; errorDescription?: string };
    const isTimeout = e.errorCode === 'Timeout';
    console.error(`[${chargePointId}] ✗ ${cmd.command_type as string}: ${e.errorDescription || String(err)}`);
    await supabase
      .from('ocpp_remote_commands')
      .update({
        status: isTimeout ? 'Timeout' : 'Error',
        error_message: e.errorDescription || String(err),
        completed_at: new Date().toISOString(),
      })
      .eq('id', cmd.id as string);
  }
}
