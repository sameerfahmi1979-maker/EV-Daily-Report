import { DataTransferRequest, DataTransferResponse } from '../../types.js';
import { logger } from '../../../utils/logger.js';

export async function handleDataTransfer(
  chargerId: string,
  request: DataTransferRequest
): Promise<DataTransferResponse> {
  logger.info('DataTransfer request', {
    chargerId,
    vendorId: request.vendorId,
    messageId: request.messageId,
  });

  return {
    status: 'Accepted',
  };
}
