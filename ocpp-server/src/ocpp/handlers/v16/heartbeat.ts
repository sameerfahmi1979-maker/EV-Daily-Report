import { HeartbeatRequest, HeartbeatResponse } from '../../types.js';
import { updateHeartbeat } from '../../../services/supabaseService.js';
import { logger } from '../../../utils/logger.js';

export async function handleHeartbeat(
  chargerId: string,
  _request: HeartbeatRequest
): Promise<HeartbeatResponse> {
  try {
    await updateHeartbeat(chargerId);

    const response: HeartbeatResponse = {
      currentTime: new Date().toISOString(),
    };

    return response;
  } catch (error) {
    logger.error('Error handling Heartbeat', { error, chargerId });

    return {
      currentTime: new Date().toISOString(),
    };
  }
}
