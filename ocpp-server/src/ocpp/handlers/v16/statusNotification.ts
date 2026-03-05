import {
  StatusNotificationRequest,
  StatusNotificationResponse,
} from '../../types.js';
import { updateConnectorStatus } from '../../../services/connectorService.js';
import { logger } from '../../../utils/logger.js';

export async function handleStatusNotification(
  chargerId: string,
  request: StatusNotificationRequest
): Promise<StatusNotificationResponse> {
  logger.info('StatusNotification request', {
    chargerId,
    connectorId: request.connectorId,
    status: request.status,
  });

  try {
    await updateConnectorStatus(
      chargerId,
      request.connectorId,
      request.status,
      request.errorCode,
      request.info,
      request.vendorErrorCode
    );

    logger.info('Connector status updated', {
      chargerId,
      connectorId: request.connectorId,
      status: request.status,
    });

    return {};
  } catch (error) {
    logger.error('Error handling StatusNotification', { error, chargerId });
    return {};
  }
}
