import http from 'http';
import { WebSocketServer } from 'ws';
import dotenv from 'dotenv';
dotenv.config();

import { chargerConnections } from './registry';
import { handleOcppMessage } from './ocppHandler';
import { startCommandPoller } from './commandPoller';
import { supabase } from './supabase';

const PORT = parseInt(process.env.PORT || '3001', 10);

// HTTP server — Railway terminates TLS, we speak plain HTTP internally
const httpServer = http.createServer((req, res) => {
  if (req.url === '/health') {
    const connected = chargerConnections.size;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', connectedChargers: connected }));
  } else {
    res.writeHead(404);
    res.end('Not found');
  }
});

// WebSocket server — no path filter here; we match manually in the connection handler.
// Chargers connect to: wss://<domain>/ocpp/<chargePointId>
// We also negotiate the OCPP 1.6J subprotocol so chargers don't abort the handshake.
const wss = new WebSocketServer({
  server: httpServer,
  handleProtocols: (protocols: Set<string>) => {
    if (protocols.has('ocpp1.6')) return 'ocpp1.6';
    if (protocols.has('ocpp1.6j')) return 'ocpp1.6j';
    // Accept even if no subprotocol (some chargers omit it)
    return protocols.values().next().value ?? false;
  },
});

wss.on('connection', (ws, req) => {
  // Expected URL: /ocpp/<chargePointId>
  // Strip query string first, then split
  const rawUrl = (req.url || '').split('?')[0];
  const match = rawUrl.match(/^\/ocpp\/(.+)$/);
  const chargePointId = match ? match[1] : null;

  if (!chargePointId) {
    console.warn('Connection rejected — expected /ocpp/<chargePointId>, got:', rawUrl);
    ws.close(4001, 'chargePointId required in URL path: /ocpp/<chargePointId>');
    return;
  }

  const remoteIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  console.log(`[${chargePointId}] Connected from ${remoteIp}`);
  chargerConnections.set(chargePointId, ws);

  ws.on('message', async (data) => {
    const raw = data.toString();
    // Skip logging heartbeats to avoid console noise (they log at handler level if needed)
    const isHeartbeat = raw.includes('"Heartbeat"');
    if (!isHeartbeat) {
      console.log(`[${chargePointId}] ← ${raw.substring(0, 200)}`);
    }
    await handleOcppMessage(chargePointId, ws, raw);
  });

  ws.on('close', (code, reason) => {
    console.log(`[${chargePointId}] Disconnected (code=${code}, reason=${reason.toString() || 'none'})`);
    chargerConnections.delete(chargePointId);
    markChargerOffline(chargePointId);
  });

  ws.on('error', (err) => {
    console.error(`[${chargePointId}] WebSocket error:`, err.message);
  });
});

// Marks a charger and all its connectors offline — called on WS close and heartbeat timeout
async function markChargerOffline(chargePointId: string) {
  const { data: charger } = await supabase
    .from('ocpp_chargers')
    .update({ connection_status: 'Offline', updated_at: new Date().toISOString() })
    .eq('charge_point_id', chargePointId)
    .select('id')
    .single();

  if (charger) {
    // Reset all connectors to Unavailable and clear live power reading
    await supabase
      .from('ocpp_connectors')
      .update({
        status: 'Unavailable',
        power_kw: 0,
        last_status_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('charger_id', charger.id);
  }
}

// Periodic heartbeat monitor — mark chargers Offline if no heartbeat for 3 minutes
setInterval(async () => {
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();

  const { data: staleChargers } = await supabase
    .from('ocpp_chargers')
    .select('charge_point_id, id')
    .eq('connection_status', 'Online')
    .lt('last_heartbeat_at', threshold);

  if (!staleChargers || staleChargers.length === 0) return;

  for (const charger of staleChargers) {
    console.log(`[${charger.charge_point_id}] Heartbeat timeout — marking Offline`);
    await supabase
      .from('ocpp_chargers')
      .update({ connection_status: 'Offline', updated_at: new Date().toISOString() })
      .eq('id', charger.id);

    await supabase
      .from('ocpp_connectors')
      .update({
        status: 'Unavailable',
        power_kw: 0,
        last_status_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('charger_id', charger.id);
  }
}, 60000);

httpServer.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(` OCPP 1.6J Central System`);
  console.log(` Listening on port ${PORT}`);
  console.log(` Health: http://localhost:${PORT}/health`);
  console.log(` OCPP:   ws://localhost:${PORT}/ocpp/<chargePointId>`);
  console.log(`=================================================`);
  startCommandPoller();
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled rejection:', reason);
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err.message);
});
