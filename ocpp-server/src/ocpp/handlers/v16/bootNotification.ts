import {
  BootNotificationRequest,
  BootNotificationResponse,
  RegistrationStatus,
} from '../../types.js';
import { findOrCreateCharger, updateRegistrationStatus } from '../../../services/supabaseService.js';
import { logger } from '../../../utils/logger.js';
import { config } from '../../../config/index.js';

export async function handleBootNotification(
  chargePointId: string,
  request: BootNotificationRequest
): Promise<BootNotificationResponse> {
  logger.info('BootNotification received', { chargePointId, request });

  try {
    const charger = await findOrCreateCharger(chargePointId, request);

    await updateRegistrationStatus(charger.id, RegistrationStatus.Accepted);

    const response: BootNotificationResponse = {
      status: RegistrationStatus.Accepted,
      currentTime: new Date().toISOString(),
      interval: config.ocpp.heartbeatInterval,
    };

    logger.info('BootNotification accepted', { chargePointId, chargerId: charger.id });

    return response;
  } catch (error) {
    logger.error('Error handling BootNotification', { error, chargePointId });

    return {
      status: RegistrationStatus.Rejected,
      currentTime: new Date().toISOString(),
      interval: config.ocpp.heartbeatInterval,
    };
  }
}
