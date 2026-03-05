import {
  StopTransactionRequest,
  StopTransactionResponse,
  AuthorizationStatus,
} from '../../types.js';
import { stopSession, getActiveSession } from '../../../services/sessionService.js';
import { updateConnectorSession } from '../../../services/connectorService.js';
import { storeMeterValues } from '../../../services/meterValuesService.js';
import { logger } from '../../../utils/logger.js';

export async function handleStopTransaction(
  chargerId: string,
  request: StopTransactionRequest
): Promise<StopTransactionResponse> {
  logger.info('StopTransaction request', {
    chargerId,
    transactionId: request.transactionId,
  });

  try {
    const session = await getActiveSession(chargerId, request.transactionId);

    if (!session) {
      logger.warn('Active session not found', {
        chargerId,
        transactionId: request.transactionId,
      });

      return {
        idTagInfo: {
          status: AuthorizationStatus.Invalid,
        },
      };
    }

    if (request.transactionData && request.transactionData.length > 0) {
      await storeMeterValues(
        chargerId,
        session.connector_id,
        session.id,
        request.transactionData
      );
    }

    await stopSession(
      chargerId,
      request.transactionId,
      request.meterStop,
      request.timestamp,
      request.reason
    );

    await updateConnectorSession(session.connector_id, null);

    const response: StopTransactionResponse = {
      idTagInfo: {
        status: AuthorizationStatus.Accepted,
      },
    };

    logger.info('StopTransaction accepted', {
      chargerId,
      transactionId: request.transactionId,
      sessionId: session.id,
    });

    return response;
  } catch (error) {
    logger.error('Error handling StopTransaction', { error, chargerId });

    return {};
  }
}
