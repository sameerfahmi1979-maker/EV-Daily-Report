import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { v4 as uuidv4 } from 'uuid';
import { config, validateConfig } from './config/index.js';
import { initSupabase, logOCPPMessage, updateChargerStatus } from './services/supabaseService.js';
import { logger } from './utils/logger.js';
import { isValidOCPPMessage, createOCPPError } from './utils/errorHandler.js';
import { v16Handlers } from './ocpp/handlers/v16/index.js';
import {
  OCPPMessageType,
  OCPPCallMessage,
  OCPPCallResultMessage,
  OCPPCallErrorMessage,
  OCPP_ERROR_CODES,
  ChargerConnection,
} from './ocpp/types.js';

const connections = new Map<string, ChargerConnection>();
const serverStartTime = new Date();

function extractChargePointId(url: string): string | null {
  const match = url.match(/\/([^/]+)$/);
  return match ? match[1] : null;
}

function sendOCPPMessage(ws: WebSocket, message: any): void {
  const messageStr = JSON.stringify(message);
  logger.debug('Sending OCPP message', { message: messageStr });
  ws.send(messageStr);
}

function sendCallResult(ws: WebSocket, messageId: string, payload: any): void {
  const message: OCPPCallResultMessage = [OCPPMessageType.CALL_RESULT, messageId, payload];
  sendOCPPMessage(ws, message);
}

function sendCallError(
  ws: WebSocket,
  messageId: string,
  errorCode: string,
  errorDescription: string,
  errorDetails: any = {}
): void {
  const message: OCPPCallErrorMessage = [
    OCPPMessageType.CALL_ERROR,
    messageId,
    errorCode,
    errorDescription,
    errorDetails,
  ];
  sendOCPPMessage(ws, message);
}

async function handleOCPPCall(
  chargePointId: string,
  chargerId: string | undefined,
  messageId: string,
  action: string,
  payload: any,
  ws: WebSocket
): Promise<void> {
  logger.info('Handling OCPP Call', { chargePointId, action, messageId });

  try {
    let response: any;

    if (action === 'BootNotification') {
      response = await v16Handlers.BootNotification(chargePointId, payload);

      const connection = connections.get(chargePointId);
      if (connection && !connection.chargerId) {
        const { findOrCreateCharger } = await import('./services/supabaseService.js');
        const charger = await findOrCreateCharger(chargePointId, payload);
        connection.chargerId = charger.id;
        connection.userId = charger.user_id;
      }
    } else {
      if (!chargerId) {
        throw createOCPPError(
          OCPP_ERROR_CODES.SECURITY_ERROR,
          'Charger not registered. Send BootNotification first.'
        );
      }

      const handler = v16Handlers[action as keyof typeof v16Handlers];

      if (!handler) {
        throw createOCPPError(
          OCPP_ERROR_CODES.NOT_IMPLEMENTED,
          `Action ${action} not implemented`
        );
      }

      response = await handler(chargerId, payload);
    }

    sendCallResult(ws, messageId, response);

    await logOCPPMessage(
      chargerId || null,
      'Call',
      action,
      messageId,
      { request: payload, response },
      'Incoming',
      'Success'
    );
  } catch (error: any) {
    logger.error('Error handling OCPP Call', { error, action, messageId });

    const errorCode = error.code || OCPP_ERROR_CODES.INTERNAL_ERROR;
    const errorDescription = error.description || error.message || 'Internal server error';

    sendCallError(ws, messageId, errorCode, errorDescription, error.details);

    await logOCPPMessage(
      chargerId || null,
      'CallError',
      action,
      messageId,
      payload,
      'Incoming',
      'Error',
      errorCode,
      errorDescription
    );
  }
}

function setupHeartbeatMonitoring(): void {
  setInterval(() => {
    const now = new Date();
    const timeout = config.ocpp.connectionTimeout * 1000;

    for (const [chargePointId, connection] of connections.entries()) {
      const timeSinceLastHeartbeat = now.getTime() - connection.lastHeartbeat.getTime();

      if (timeSinceLastHeartbeat > timeout && connection.isOnline) {
        logger.warn('Charger heartbeat timeout', {
          chargePointId,
          timeSinceLastHeartbeat: Math.floor(timeSinceLastHeartbeat / 1000),
        });

        connection.isOnline = false;

        if (connection.chargerId) {
          updateChargerStatus(connection.chargerId, 'Offline').catch((error) => {
            logger.error('Error updating charger status to offline', { error, chargePointId });
          });
        }
      }
    }
  }, 60000);
}

function getHealthStatus() {
  const uptime = Date.now() - serverStartTime.getTime();
  const connectedChargers = Array.from(connections.values())
    .filter((c) => c.isOnline)
    .map((c) => ({
      chargePointId: c.chargePointId,
      lastHeartbeat: c.lastHeartbeat.toISOString(),
    }));

  return {
    status: 'healthy',
    uptime: Math.floor(uptime / 1000),
    uptimeFormatted: formatUptime(uptime),
    timestamp: new Date().toISOString(),
    connections: {
      total: connections.size,
      online: connectedChargers.length,
      offline: connections.size - connectedChargers.length,
    },
    chargers: connectedChargers,
    version: '1.0.0',
  };
}

function formatUptime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

function startServer(): void {
  try {
    validateConfig();
    initSupabase();

    const httpServer = createServer((req, res) => {
      const url = req.url || '';

      if (url === '/health' || url === '/health/') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(getHealthStatus(), null, 2));
        return;
      }

      if (url === '/' || url === '') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify(
            {
              service: 'OCPP Server',
              version: '1.0.0',
              status: 'running',
              endpoints: {
                health: '/health',
                websocket: `ws://localhost:${config.server.port}/ocpp/{chargePointId}`,
              },
            },
            null,
            2
          )
        );
        return;
      }

      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not Found' }));
    });

    const wss = new WebSocketServer({ server: httpServer });

    httpServer.listen(config.server.port, () => {
      logger.info(`OCPP Server listening on port ${config.server.port}`);
      logger.info(`Health check available at http://localhost:${config.server.port}/health`);
      logger.info(`WebSocket endpoint: ws://localhost:${config.server.port}/ocpp/{chargePointId}`);
    });

    wss.on('connection', (ws: WebSocket, req) => {
      const chargePointId = extractChargePointId(req.url || '');

      if (!chargePointId) {
        logger.warn('Connection rejected - no charge point ID in URL', { url: req.url });
        ws.close(1008, 'Charge point ID required in URL path');
        return;
      }

      logger.info('New charger connection', { chargePointId, url: req.url });

      const connection: ChargerConnection = {
        chargePointId,
        ws,
        lastHeartbeat: new Date(),
        isOnline: true,
      };

      connections.set(chargePointId, connection);

      ws.on('message', async (data: Buffer) => {
        try {
          const messageStr = data.toString();
          logger.debug('Received message', { chargePointId, message: messageStr });

          const message = JSON.parse(messageStr);

          if (!isValidOCPPMessage(message)) {
            logger.error('Invalid OCPP message format', { message });
            sendCallError(
              ws,
              uuidv4(),
              OCPP_ERROR_CODES.PROTOCOL_ERROR,
              'Invalid message format'
            );
            return;
          }

          const messageType = message[0];
          const currentConnection = connections.get(chargePointId);

          if (messageType === OCPPMessageType.CALL) {
            const [, messageId, action, payload] = message as OCPPCallMessage;
            await handleOCPPCall(
              chargePointId,
              currentConnection?.chargerId,
              messageId,
              action,
              payload,
              ws
            );
          } else if (messageType === OCPPMessageType.CALL_RESULT) {
            logger.info('Received CallResult', { chargePointId, message });
          } else if (messageType === OCPPMessageType.CALL_ERROR) {
            logger.error('Received CallError', { chargePointId, message });
          }

          if (currentConnection) {
            currentConnection.lastHeartbeat = new Date();
            currentConnection.isOnline = true;
          }
        } catch (error) {
          logger.error('Error processing message', { error, chargePointId });
          sendCallError(
            ws,
            uuidv4(),
            OCPP_ERROR_CODES.INTERNAL_ERROR,
            'Error processing message'
          );
        }
      });

      ws.on('close', () => {
        logger.info('Charger disconnected', { chargePointId });

        const connection = connections.get(chargePointId);
        if (connection?.chargerId) {
          updateChargerStatus(connection.chargerId, 'Offline').catch((error) => {
            logger.error('Error updating charger status on disconnect', { error, chargePointId });
          });
        }

        connections.delete(chargePointId);
      });

      ws.on('error', (error) => {
        logger.error('WebSocket error', { error, chargePointId });
      });
    });

    setupHeartbeatMonitoring();

    logger.info('OCPP server started successfully');
  } catch (error) {
    logger.error('Failed to start OCPP server', { error });
    process.exit(1);
  }
}

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
