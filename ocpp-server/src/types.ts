export const CALL = 2;
export const CALLRESULT = 3;
export const CALLERROR = 4;

export interface PendingCall {
  resolve: (result: Record<string, unknown>) => void;
  reject: (err: OcppError) => void;
}

export interface OcppError {
  errorCode: string;
  errorDescription: string;
}
