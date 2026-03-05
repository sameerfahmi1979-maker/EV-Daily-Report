import {
  StartTransactionRequest,
  StartTransactionResponse,
  AuthorizationStatus,
  IdTagInfo,
} from '../../types.js';
import { authorizeIdTag, startSession } from '../../../services/sessionService.js';
import { getConnector, updateConnectorSession } from '../../../services/connectorService.js';
import { logger } from '../../../utils/logger.js';

let transactionCounter = 1000;

export async function handleStartTransaction(
  chargerId: string,
  request: StartTransactionRequest
): Promise<StartTransactionResponse> {
  logger.info('StartTransaction request', {
    chargerId,
    connectorId: request.connectorId,
    idTag: request.idTag,
  });

  try {
    const authStatus = await authorizeIdTag(request.idTag);

    if (authStatus !== AuthorizationStatus.Accepted) {
      const idTagInfo: IdTagInfo = {
        status: authStatus,
      };

      logger.warn('StartTransaction rejected - authorization failed', {
        chargerId,
        idTag: request.idTag,
        status: authStatus,
      });

      return {
        transactionId: -1,
        idTagInfo,
      };
    }

    const connector = await getConnector(chargerId, request.connectorId);

    if (!connector) {
      logger.error('Connector not found', { chargerId, connectorId: request.connectorId });
      return {
        transactionId: -1,
        idTagInfo: { status: AuthorizationStatus.Invalid },
      };
    }

    const transactionId = transactionCounter++;

    const session = await startSession(
      chargerId,
      connector.id,
      transactionId,
      request.idTag,
      request.meterStart,
      request.timestamp
    );

    await updateConnectorSession(connector.id, session.id);

    const response: StartTransactionResponse = {
      transactionId,
      idTagInfo: {
        status: AuthorizationStatus.Accepted,
      },
    };

    logger.info('StartTransaction accepted', {
      chargerId,
      transactionId,
      sessionId: session.id,
      connectorId: request.connectorId,
    });

    return response;
  } catch (error) {
    logger.error('Error handling StartTransaction', { error, chargerId });

    return {
      transactionId: -1,
      idTagInfo: {
        status: AuthorizationStatus.Invalid,
      },
    };
  }
}
