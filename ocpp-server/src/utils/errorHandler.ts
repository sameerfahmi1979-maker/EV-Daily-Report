import { logger } from './logger.js';

export class OCPPError extends Error {
  constructor(
    public code: string,
    public description: string,
    public details: any = {}
  ) {
    super(description);
    this.name = 'OCPPError';
  }
}

export function handleError(error: unknown, context: string): void {
  if (error instanceof OCPPError) {
    logger.error(`OCPP Error in ${context}`, {
      code: error.code,
      description: error.description,
      details: error.details,
    });
  } else if (error instanceof Error) {
    logger.error(`Error in ${context}: ${error.message}`, {
      stack: error.stack,
    });
  } else {
    logger.error(`Unknown error in ${context}`, { error });
  }
}

export function createOCPPError(
  code: string,
  description: string,
  details?: any
): OCPPError {
  return new OCPPError(code, description, details);
}

export function isValidOCPPMessage(message: any): boolean {
  if (!Array.isArray(message)) {
    return false;
  }

  const messageType = message[0];
  if (![2, 3, 4].includes(messageType)) {
    return false;
  }

  if (messageType === 2 && message.length !== 4) {
    return false;
  }

  if (messageType === 3 && message.length !== 3) {
    return false;
  }

  if (messageType === 4 && message.length !== 5) {
    return false;
  }

  return true;
}
