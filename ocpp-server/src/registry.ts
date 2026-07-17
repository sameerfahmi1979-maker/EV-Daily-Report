import WebSocket from 'ws';

/**
 * In-memory map of currently connected chargers.
 * Key: charge_point_id (string)
 * Value: open WebSocket connection
 * Shared between server.ts and commandPoller.ts without circular deps.
 */
export const chargerConnections = new Map<string, WebSocket>();
