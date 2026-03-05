import { MeterValuesRequest, MeterValuesResponse } from '../../types.js';
import { getConnector } from '../../../services/connectorService.js';
import { getActiveSession } from '../../../services/sessionService.js';
import { storeMeterValues } from '../../../services/meterValuesService.js';
import { logger } from '../../../utils/logger.js';

export async function handleMeterValues(
  chargerId: string,
  request: MeterValuesRequest
): Promise<MeterValuesResponse> {
  logger.debug('MeterValues request', {
    chargerId,
    connectorId: request.connectorId,
    transactionId: request.transactionId,
    valueCount: request.meterValue.length,
  });

  try {
    const connector = await getConnector(chargerId, request.connectorId);

    if (!connector) {
      logger.error('Connector not found', { chargerId, connectorId: request.connectorId });
      return {};
    }

    let sessionId: string | null = null;

    if (request.transactionId) {
      const session = await getActiveSession(chargerId, request.transactionId);
      if (session) {
        sessionId = session.id;
      }
    }

    await storeMeterValues(chargerId, connector.id, sessionId, request.meterValue);

    return {};
  } catch (error) {
    logger.error('Error handling MeterValues', { error, chargerId });
    return {};
  }
}
