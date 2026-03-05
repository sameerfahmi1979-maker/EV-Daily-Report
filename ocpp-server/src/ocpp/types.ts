export enum OCPPMessageType {
  CALL = 2,
  CALL_RESULT = 3,
  CALL_ERROR = 4,
}

export type OCPPMessage = [OCPPMessageType, string, string, any] | [OCPPMessageType, string, any];

export type OCPPCallMessage = [OCPPMessageType.CALL, string, string, any];
export type OCPPCallResultMessage = [OCPPMessageType.CALL_RESULT, string, any];
export type OCPPCallErrorMessage = [OCPPMessageType.CALL_ERROR, string, string, string, any];

export enum OCPPAction {
  Authorize = 'Authorize',
  BootNotification = 'BootNotification',
  DataTransfer = 'DataTransfer',
  DiagnosticsStatusNotification = 'DiagnosticsStatusNotification',
  FirmwareStatusNotification = 'FirmwareStatusNotification',
  Heartbeat = 'Heartbeat',
  MeterValues = 'MeterValues',
  StartTransaction = 'StartTransaction',
  StatusNotification = 'StatusNotification',
  StopTransaction = 'StopTransaction',
  ChangeAvailability = 'ChangeAvailability',
  ChangeConfiguration = 'ChangeConfiguration',
  ClearCache = 'ClearCache',
  GetConfiguration = 'GetConfiguration',
  RemoteStartTransaction = 'RemoteStartTransaction',
  RemoteStopTransaction = 'RemoteStopTransaction',
  Reset = 'Reset',
  UnlockConnector = 'UnlockConnector',
  UpdateFirmware = 'UpdateFirmware',
  TriggerMessage = 'TriggerMessage',
}

export enum RegistrationStatus {
  Accepted = 'Accepted',
  Pending = 'Pending',
  Rejected = 'Rejected',
}

export enum AuthorizationStatus {
  Accepted = 'Accepted',
  Blocked = 'Blocked',
  Expired = 'Expired',
  Invalid = 'Invalid',
  ConcurrentTx = 'ConcurrentTx',
}

export enum ChargePointStatus {
  Available = 'Available',
  Preparing = 'Preparing',
  Charging = 'Charging',
  SuspendedEV = 'SuspendedEV',
  SuspendedEVSE = 'SuspendedEVSE',
  Finishing = 'Finishing',
  Reserved = 'Reserved',
  Unavailable = 'Unavailable',
  Faulted = 'Faulted',
}

export enum Measurand {
  EnergyActiveImportRegister = 'Energy.Active.Import.Register',
  PowerActiveImport = 'Power.Active.Import',
  CurrentImport = 'Current.Import',
  Voltage = 'Voltage',
  SoC = 'SoC',
  Temperature = 'Temperature',
}

export enum ReadingContext {
  InterruptionBegin = 'Interruption.Begin',
  InterruptionEnd = 'Interruption.End',
  SampleClock = 'Sample.Clock',
  SamplePeriodic = 'Sample.Periodic',
  TransactionBegin = 'Transaction.Begin',
  TransactionEnd = 'Transaction.End',
  Trigger = 'Trigger',
  Other = 'Other',
}

export enum ValueFormat {
  Raw = 'Raw',
  SignedData = 'SignedData',
}

export enum Location {
  Cable = 'Cable',
  EV = 'EV',
  Inlet = 'Inlet',
  Outlet = 'Outlet',
  Body = 'Body',
}

export enum UnitOfMeasure {
  Wh = 'Wh',
  kWh = 'kWh',
  W = 'W',
  kW = 'kW',
  A = 'A',
  V = 'V',
  Celsius = 'Celsius',
  Percent = 'Percent',
}

export interface BootNotificationRequest {
  chargePointVendor: string;
  chargePointModel: string;
  chargePointSerialNumber?: string;
  chargeBoxSerialNumber?: string;
  firmwareVersion?: string;
  iccid?: string;
  imsi?: string;
  meterType?: string;
  meterSerialNumber?: string;
}

export interface BootNotificationResponse {
  status: RegistrationStatus;
  currentTime: string;
  interval: number;
}

export interface HeartbeatRequest {}

export interface HeartbeatResponse {
  currentTime: string;
}

export interface AuthorizeRequest {
  idTag: string;
}

export interface AuthorizeResponse {
  idTagInfo: IdTagInfo;
}

export interface IdTagInfo {
  status: AuthorizationStatus;
  expiryDate?: string;
  parentIdTag?: string;
}

export interface StartTransactionRequest {
  connectorId: number;
  idTag: string;
  meterStart: number;
  timestamp: string;
  reservationId?: number;
}

export interface StartTransactionResponse {
  transactionId: number;
  idTagInfo: IdTagInfo;
}

export interface StopTransactionRequest {
  transactionId: number;
  meterStop: number;
  timestamp: string;
  reason?: string;
  idTag?: string;
  transactionData?: MeterValue[];
}

export interface StopTransactionResponse {
  idTagInfo?: IdTagInfo;
}

export interface StatusNotificationRequest {
  connectorId: number;
  errorCode: string;
  status: ChargePointStatus;
  info?: string;
  timestamp?: string;
  vendorId?: string;
  vendorErrorCode?: string;
}

export interface StatusNotificationResponse {}

export interface MeterValuesRequest {
  connectorId: number;
  transactionId?: number;
  meterValue: MeterValue[];
}

export interface MeterValuesResponse {}

export interface MeterValue {
  timestamp: string;
  sampledValue: SampledValue[];
}

export interface SampledValue {
  value: string;
  context?: ReadingContext;
  format?: ValueFormat;
  measurand?: Measurand;
  phase?: string;
  location?: Location;
  unit?: UnitOfMeasure;
}

export interface DataTransferRequest {
  vendorId: string;
  messageId?: string;
  data?: string;
}

export interface DataTransferResponse {
  status: 'Accepted' | 'Rejected' | 'UnknownMessageId' | 'UnknownVendorId';
  data?: string;
}

export interface RemoteStartTransactionRequest {
  connectorId?: number;
  idTag: string;
}

export interface RemoteStartTransactionResponse {
  status: 'Accepted' | 'Rejected';
}

export interface RemoteStopTransactionRequest {
  transactionId: number;
}

export interface RemoteStopTransactionResponse {
  status: 'Accepted' | 'Rejected';
}

export interface UnlockConnectorRequest {
  connectorId: number;
}

export interface UnlockConnectorResponse {
  status: 'Unlocked' | 'UnlockFailed' | 'NotSupported';
}

export interface ResetRequest {
  type: 'Hard' | 'Soft';
}

export interface ResetResponse {
  status: 'Accepted' | 'Rejected';
}

export interface GetConfigurationRequest {
  key?: string[];
}

export interface GetConfigurationResponse {
  configurationKey?: ConfigurationKey[];
  unknownKey?: string[];
}

export interface ConfigurationKey {
  key: string;
  readonly: boolean;
  value?: string;
}

export interface ChangeConfigurationRequest {
  key: string;
  value: string;
}

export interface ChangeConfigurationResponse {
  status: 'Accepted' | 'Rejected' | 'RebootRequired' | 'NotSupported';
}

export interface ChangeAvailabilityRequest {
  connectorId: number;
  type: 'Operative' | 'Inoperative';
}

export interface ChangeAvailabilityResponse {
  status: 'Accepted' | 'Rejected' | 'Scheduled';
}

export interface TriggerMessageRequest {
  requestedMessage: string;
  connectorId?: number;
}

export interface TriggerMessageResponse {
  status: 'Accepted' | 'Rejected' | 'NotImplemented';
}

export interface ChargerConnection {
  chargePointId: string;
  chargerId?: string;
  userId?: string;
  ws: any;
  lastHeartbeat: Date;
  isOnline: boolean;
}

export interface OCPPErrorCode {
  code: string;
  description: string;
}

export const OCPP_ERROR_CODES = {
  NOT_IMPLEMENTED: 'NotImplemented',
  NOT_SUPPORTED: 'NotSupported',
  INTERNAL_ERROR: 'InternalError',
  PROTOCOL_ERROR: 'ProtocolError',
  SECURITY_ERROR: 'SecurityError',
  FORMATION_VIOLATION: 'FormationViolation',
  PROPERTY_CONSTRAINT_VIOLATION: 'PropertyConstraintViolation',
  OCCURENCE_CONSTRAINT_VIOLATION: 'OccurenceConstraintViolation',
  TYPE_CONSTRAINT_VIOLATION: 'TypeConstraintViolation',
  GENERIC_ERROR: 'GenericError',
};
