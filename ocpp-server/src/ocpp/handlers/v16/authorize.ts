import { AuthorizeRequest, AuthorizeResponse, IdTagInfo, AuthorizationStatus } from '../../types.js';
import { authorizeIdTag } from '../../../services/sessionService.js';
import { logger } from '../../../utils/logger.js';

export async function handleAuthorize(
  chargerId: string,
  request: AuthorizeRequest
): Promise<AuthorizeResponse> {
  logger.info('Authorize request', { chargerId, idTag: request.idTag });

  try {
    const status = await authorizeIdTag(request.idTag);

    const idTagInfo: IdTagInfo = {
      status,
    };

    const response: AuthorizeResponse = {
      idTagInfo,
    };

    logger.info('Authorize response', { chargerId, idTag: request.idTag, status });

    return response;
  } catch (error) {
    logger.error('Error handling Authorize', { error, chargerId });

    return {
      idTagInfo: {
        status: AuthorizationStatus.Invalid,
      },
    };
  }
}
