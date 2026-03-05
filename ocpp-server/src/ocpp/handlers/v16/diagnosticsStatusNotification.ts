import { logger } from '../../../utils/logger.js';

export interface DiagnosticsStatusNotificationRequest {
  status: string;
}

export interface DiagnosticsStatusNotificationResponse {}

export async function handleDiagnosticsStatusNotification(
  chargerId: string,
  request: DiagnosticsStatusNotificationRequest
): Promise<DiagnosticsStatusNotificationResponse> {
  logger.info('DiagnosticsStatusNotification request', {
    chargerId,
    status: request.status,
  });

  return {};
}
