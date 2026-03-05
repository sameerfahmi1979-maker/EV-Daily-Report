import { handleBootNotification } from './bootNotification.js';
import { handleHeartbeat } from './heartbeat.js';
import { handleAuthorize } from './authorize.js';
import { handleStartTransaction } from './startTransaction.js';
import { handleStopTransaction } from './stopTransaction.js';
import { handleStatusNotification } from './statusNotification.js';
import { handleMeterValues } from './meterValues.js';
import { handleDataTransfer } from './dataTransfer.js';
import { handleDiagnosticsStatusNotification } from './diagnosticsStatusNotification.js';

export const v16Handlers = {
  BootNotification: handleBootNotification,
  Heartbeat: handleHeartbeat,
  Authorize: handleAuthorize,
  StartTransaction: handleStartTransaction,
  StopTransaction: handleStopTransaction,
  StatusNotification: handleStatusNotification,
  MeterValues: handleMeterValues,
  DataTransfer: handleDataTransfer,
  DiagnosticsStatusNotification: handleDiagnosticsStatusNotification,
};

export {
  handleBootNotification,
  handleHeartbeat,
  handleAuthorize,
  handleStartTransaction,
  handleStopTransaction,
  handleStatusNotification,
  handleMeterValues,
  handleDataTransfer,
  handleDiagnosticsStatusNotification,
};
