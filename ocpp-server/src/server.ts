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

// WebSocket server mounted at /ocpp
// Chargers connect to: wss://<domain>/ocpp/<chargePointId>
const wss = new WebSocketServer({ server: httpServer, path: '/ocpp' });

wss.on('connection', (ws, req) => {
  // URL format: /ocpp/CHARGE_POINT_ID
  const url = req.url || '';
  const parts = url.replace(/^\/+/, '').split('/');
  // parts[0] = 'ocpp', parts[1] = chargePointId
  const chargePointId = parts[1];

  if (!chargePointId) {
    console.warn('Connection rejected: no chargePointId in URL', url);
    ws.close(4001, 'chargePointId required in URL path');
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

    // Mark charger offline in DB (fire and forget)
    supabase
      .from('ocpp_chargers')
      .update({ connection_status: 'Offline', updated_at: new Date().toISOString() })
      .eq('charge_point_id', chargePointId)
      .then(() => {});
  });

  ws.on('error', (err) => {
    console.error(`[${chargePointId}] WebSocket error:`, err.message);
  });
});

// Periodic heartbeat monitor — mark chargers Offline if no heartbeat for 3 minutes
setInterval(async () => {
  const threshold = new Date(Date.now() - 3 * 60 * 1000).toISOString();
  await supabase
    .from('ocpp_chargers')
    .update({ connection_status: 'Offline' })
    .eq('connection_status', 'Online')
    .lt('last_heartbeat_at', threshold);
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
