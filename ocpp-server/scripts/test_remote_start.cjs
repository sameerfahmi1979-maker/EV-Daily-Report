/**
 * Test script: Insert a RemoteStartTransaction command for a connected charger.
 * The commandPoller in the OCPP server picks it up within 2s and delivers it.
 *
 * Usage:
 *   node scripts/test_remote_start.cjs [chargePointId] [connectorId] [idTag]
 *
 * Example:
 *   node scripts/test_remote_start.cjs 244901000006 1 TEST-RFID-001
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

// Load .env from ocpp-server root
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

const CHARGE_POINT_ID = process.argv[2] || '244901000006';
const CONNECTOR_ID = parseInt(process.argv[3] || '1', 10);
const ID_TAG = process.argv[4] || 'TEST-RFID-001';

async function main() {
  console.log('===========================================');
  console.log(' OCPP Remote Start Test');
  console.log(`  Charger:   ${CHARGE_POINT_ID}`);
  console.log(`  Connector: ${CONNECTOR_ID}`);
  console.log(`  idTag:     ${ID_TAG}`);
  console.log('===========================================\n');

  // 1. Verify charger exists and is online
  const { data: charger, error: chargerErr } = await supabase
    .from('ocpp_chargers')
    .select('id, charge_point_id, connection_status, last_heartbeat_at, vendor, model')
    .eq('charge_point_id', CHARGE_POINT_ID)
    .single();

  if (chargerErr || !charger) {
    console.error('ERROR: Charger not found in DB.');
    console.error('  → Has the charger connected and sent BootNotification yet?');
    if (chargerErr) console.error('  DB error:', chargerErr.message);
    process.exit(1);
  }

  console.log(`Charger: ${charger.vendor} ${charger.model}`);
  console.log(`Status:  ${charger.connection_status}`);
  console.log(`Last heartbeat: ${charger.last_heartbeat_at || 'never'}\n`);

  if (charger.connection_status !== 'Online') {
    console.warn('WARNING: Charger is not Online. The command will be queued but the');
    console.warn('         commandPoller will not send it until the charger reconnects.\n');
  }

  // 2. Look up connector
  const { data: connector, error: connErr } = await supabase
    .from('ocpp_connectors')
    .select('id, connector_id, status')
    .eq('charger_id', charger.id)
    .eq('connector_id', CONNECTOR_ID)
    .single();

  if (connErr || !connector) {
    console.error(`ERROR: Connector ${CONNECTOR_ID} not found for this charger.`);
    console.error('  → Has the charger sent BootNotification? Connectors are auto-created on boot.');
    process.exit(1);
  }

  console.log(`Connector ${CONNECTOR_ID} status: ${connector.status}\n`);

  // 3. Insert RemoteStartTransaction command
  const { data: cmd, error: cmdErr } = await supabase
    .from('ocpp_remote_commands')
    .insert({
      user_id: null,
      charger_id: charger.id,
      connector_id: connector.id,
      command_type: 'RemoteStartTransaction',
      parameters: {
        connectorId: CONNECTOR_ID,
        idTag: ID_TAG,
      },
      status: 'Pending',
    })
    .select()
    .single();

  if (cmdErr || !cmd) {
    console.error('ERROR: Failed to insert command:', cmdErr?.message);
    process.exit(1);
  }

  console.log(`Command queued: ${cmd.id}`);
  console.log('Waiting for commandPoller to deliver it...\n');

  // 4. Poll for completion (up to 35s)
  const deadline = Date.now() + 35000;
  let dots = 0;

  while (Date.now() < deadline) {
    await sleep(1000);
    process.stdout.write('.');
    dots++;

    const { data: updated } = await supabase
      .from('ocpp_remote_commands')
      .select('status, command_result, error_message, executed_at, completed_at')
      .eq('id', cmd.id)
      .single();

    if (updated && !['Pending', 'Sent'].includes(updated.status)) {
      console.log('\n');
      console.log('===========================================');
      console.log(` Result: ${updated.status}`);
      if (updated.executed_at) console.log(` Sent at:      ${updated.executed_at}`);
      if (updated.completed_at) console.log(` Completed at: ${updated.completed_at}`);
      if (updated.command_result) {
        console.log(` Charger response: ${JSON.stringify(updated.command_result, null, 2)}`);
      }
      if (updated.error_message) {
        console.log(` Error: ${updated.error_message}`);
      }
      console.log('===========================================');

      if (updated.status === 'Accepted') {
        console.log('\n✓ SUCCESS: Charger accepted the remote start command!');
      } else if (updated.status === 'Rejected') {
        console.log('\n✗ Charger rejected the command (connector may be in use or unavailable).');
      } else if (updated.status === 'Timeout') {
        console.log('\n✗ Timeout: charger did not respond. Check Railway logs.');
      } else {
        console.log('\n✗ Command ended with status:', updated.status);
      }
      process.exit(0);
    }
  }

  console.log('\n\nTimeout: command did not complete within 35 seconds.');
  console.log('Check Railway logs for the OCPP server output.');
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
