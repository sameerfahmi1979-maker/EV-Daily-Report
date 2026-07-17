import { supabase } from './supabase';

// The OCPP tables (ocpp_chargers, ocpp_connectors, etc.) and rfid_tags were
// added via migrations after the last database.types.ts regeneration. Using an
// untyped reference bypasses the stale type schema for these tables only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

// ─── Domain types ────────────────────────────────────────────────────────────

export type ConnectorStatus =
  | 'Available' | 'Preparing' | 'Charging' | 'SuspendedEV'
  | 'SuspendedEVSE' | 'Finishing' | 'Reserved' | 'Unavailable' | 'Faulted';

export type ConnectionStatus = 'Online' | 'Offline' | 'Unknown';

export type CommandType =
  | 'RemoteStartTransaction' | 'RemoteStopTransaction' | 'UnlockConnector'
  | 'Reset' | 'ChangeConfiguration' | 'GetConfiguration' | 'ChangeAvailability'
  | 'TriggerMessage' | 'UpdateFirmware' | 'SetChargingProfile'
  | 'ClearChargingProfile' | 'GetDiagnostics' | 'SendLocalList'
  | 'GetLocalListVersion' | 'ReserveNow' | 'CancelReservation';

export type CommandStatus = 'Pending' | 'Sent' | 'Accepted' | 'Rejected' | 'Error' | 'Timeout';

export interface OcppCharger {
  id: string;
  charge_point_id: string;
  station_id: string | null;
  vendor: string | null;
  model: string | null;
  serial_number: string | null;
  firmware_version: string | null;
  protocol_version: string | null;
  registration_status: string;
  connection_status: ConnectionStatus;
  last_heartbeat_at: string | null;
  ip_address: string | null;
  location_latitude: number | null;
  location_longitude: number | null;
  installation_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  station?: { id: string; name: string; location: string | null } | null;
}

export interface OcppConnector {
  id: string;
  charger_id: string;
  connector_id: number;
  connector_type: string;
  power_kw: number;
  status: ConnectorStatus;
  error_code: string | null;
  info: string | null;
  vendor_error_code: string | null;
  current_session_id: string | null;
  last_status_update: string;
  created_at: string;
  updated_at: string;
  charger?: OcppCharger | null;
  current_session?: OcppSession | null;
}

export interface OcppSession {
  id: string;
  charger_id: string;
  connector_id: string;
  transaction_id: number;
  id_tag: string;
  start_timestamp: string;
  end_timestamp: string | null;
  energy_consumed_wh: number | null;
  calculated_cost: number | null;
  session_status: string;
  remote_start: boolean;
}

export interface OcppMessage {
  id: string;
  charger_id: string | null;
  message_type: string;
  message_id: string | null;
  action: string | null;
  direction: string;
  payload: Record<string, unknown>;
  processing_status: string;
  error_code: string | null;
  error_description: string | null;
  created_at: string;
  charger?: { charge_point_id: string } | null;
}

export interface OcppRemoteCommand {
  id: string;
  user_id: string;
  charger_id: string;
  command_type: CommandType;
  connector_id: number | null;
  parameters: Record<string, unknown>;
  status: CommandStatus;
  requested_at: string;
  executed_at: string | null;
  completed_at: string | null;
  command_result: Record<string, unknown> | null;
  error_message: string | null;
  timeout_seconds: number;
}

export interface OcppConfigKey {
  id: string;
  charger_id: string;
  key: string;
  value: string | null;
  readonly: boolean;
  created_at: string;
  updated_at: string;
}

export interface OcppFirmwareUpdate {
  id: string;
  charger_id: string;
  firmware_url: string;
  retrieve_date: string;
  status: string;
  retry_interval: number | null;
  retries: number | null;
  install_date: string | null;
  error_log: string | null;
  created_at: string;
  updated_at: string;
  charger?: { charge_point_id: string } | null;
}

export interface OcppMeterValue {
  id: string;
  session_id: string | null;
  charger_id: string;
  connector_id: string;
  timestamp: string;
  measurand: string;
  value: number;
  unit: string;
  phase: string | null;
  context: string;
}

export interface RfidTag {
  id: string;
  card_number: string;
  operator_id: string | null;
  account_name: string | null;
  card_reader: string | null;
  card_type: string;
  status: 'Active' | 'Blocked' | 'Expired' | 'Unbound';
  expiration_date: string;
  max_count: number;
  balance: number;
  notes: string | null;
  created_at: string;
  updated_at: string;
  operator?: { id: string; name: string } | null;
}

// ─── Charger queries ─────────────────────────────────────────────────────────

export async function getChargers(): Promise<OcppCharger[]> {
  const { data, error } = await db
    .from('ocpp_chargers')
    .select(`*, station:stations(id, name, location)`)
    .order('created_at', { ascending: true });
  if (error) throw error;
  return (data ?? []) as OcppCharger[];
}

export async function getCharger(id: string): Promise<OcppCharger | null> {
  const { data, error } = await db
    .from('ocpp_chargers')
    .select(`*, station:stations(id, name, location)`)
    .eq('id', id)
    .single();
  if (error) return null;
  return data as OcppCharger;
}

export async function upsertCharger(
  charger: Partial<OcppCharger> & { charge_point_id: string }
): Promise<OcppCharger> {
  const { data, error } = await db
    .from('ocpp_chargers')
    .upsert(charger, { onConflict: 'charge_point_id' })
    .select()
    .single();
  if (error) throw error;
  return data as OcppCharger;
}

export async function deleteCharger(id: string): Promise<void> {
  const { error } = await db.from('ocpp_chargers').delete().eq('id', id);
  if (error) throw error;
}

// ─── Connector queries ────────────────────────────────────────────────────────

export async function getConnectors(chargerId?: string): Promise<OcppConnector[]> {
  let query = db
    .from('ocpp_connectors')
    .select(`*, charger:ocpp_chargers(id, charge_point_id, connection_status, station:stations(name))`)
    .order('charger_id')
    .order('connector_id');

  if (chargerId) query = query.eq('charger_id', chargerId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OcppConnector[];
}

export async function getConnectorsWithSessions(): Promise<OcppConnector[]> {
  const { data, error } = await db
    .from('ocpp_connectors')
    .select(`
      *,
      charger:ocpp_chargers(id, charge_point_id, connection_status, station:stations(id, name, location)),
      current_session:ocpp_charging_sessions!fk_current_session(id, transaction_id, id_tag, start_timestamp, energy_consumed_wh, session_status)
    `)
    .order('charger_id')
    .order('connector_id');
  if (error) throw error;
  return (data ?? []) as OcppConnector[];
}

// ─── Meter values ─────────────────────────────────────────────────────────────

export async function getLatestMeterValues(
  connectorDbId: string,
  measurand: string,
  limit = 20
): Promise<OcppMeterValue[]> {
  const { data, error } = await db
    .from('ocpp_meter_values')
    .select('*')
    .eq('connector_id', connectorDbId)
    .eq('measurand', measurand)
    .order('timestamp', { ascending: false })
    .limit(limit);
  if (error) return [];
  return ((data ?? []) as OcppMeterValue[]).reverse();
}

// ─── Remote commands ──────────────────────────────────────────────────────────

export async function sendRemoteCommand(
  chargerId: string,
  commandType: CommandType,
  parameters: Record<string, unknown> = {},
  connectorId?: number
): Promise<{ commandId: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');

  const { data, error } = await db
    .from('ocpp_remote_commands')
    .insert({
      user_id: user.id,
      charger_id: chargerId,
      command_type: commandType,
      parameters,
      connector_id: connectorId ?? null,
      status: 'Pending',
    })
    .select('id')
    .single();
  if (error) throw error;
  return { commandId: data.id };
}

export async function getRecentCommands(
  chargerId: string,
  limit = 10
): Promise<OcppRemoteCommand[]> {
  const { data, error } = await db
    .from('ocpp_remote_commands')
    .select('*')
    .eq('charger_id', chargerId)
    .order('requested_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []) as OcppRemoteCommand[];
}

// ─── OCPP Messages ────────────────────────────────────────────────────────────

export async function getOcppMessages(
  chargerId?: string,
  limit = 100
): Promise<OcppMessage[]> {
  let query = db
    .from('ocpp_messages')
    .select(`*, charger:ocpp_chargers(charge_point_id)`)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (chargerId) query = query.eq('charger_id', chargerId);

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as OcppMessage[];
}

// ─── Firmware ─────────────────────────────────────────────────────────────────

export async function getFirmwareUpdates(): Promise<OcppFirmwareUpdate[]> {
  const { data, error } = await db
    .from('ocpp_firmware_updates')
    .select(`*, charger:ocpp_chargers(charge_point_id)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as OcppFirmwareUpdate[];
}

export async function scheduleFirmwareUpdate(
  chargerId: string,
  firmwareUrl: string,
  retrieveDate: string
): Promise<void> {
  const { error: insertErr } = await db
    .from('ocpp_firmware_updates')
    .insert({ charger_id: chargerId, firmware_url: firmwareUrl, retrieve_date: retrieveDate, status: 'Scheduled' });
  if (insertErr) throw insertErr;

  await sendRemoteCommand(chargerId, 'UpdateFirmware', {
    location: firmwareUrl,
    retrieveDate: retrieveDate,
  });
}

// ─── Configuration ────────────────────────────────────────────────────────────

export async function getConfigurationKeys(chargerId: string): Promise<OcppConfigKey[]> {
  const { data, error } = await db
    .from('ocpp_configuration_keys')
    .select('*')
    .eq('charger_id', chargerId)
    .order('key');
  if (error) throw error;
  return (data ?? []) as OcppConfigKey[];
}

export async function changeConfiguration(
  chargerId: string,
  key: string,
  value: string
): Promise<void> {
  await sendRemoteCommand(chargerId, 'ChangeConfiguration', { key, value });
}

export async function triggerGetConfiguration(chargerId: string): Promise<void> {
  await sendRemoteCommand(chargerId, 'GetConfiguration', {});
}

// ─── RFID Tags ────────────────────────────────────────────────────────────────

export async function getRfidTags(): Promise<RfidTag[]> {
  const { data, error } = await db
    .from('rfid_tags')
    .select(`*, operator:operators(id, name)`)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as RfidTag[];
}

export async function upsertRfidTag(
  tag: Omit<RfidTag, 'id' | 'created_at' | 'updated_at' | 'operator'> & { id?: string }
): Promise<RfidTag> {
  const { data, error } = tag.id
    ? await db.from('rfid_tags').update(tag).eq('id', tag.id).select().single()
    : await db.from('rfid_tags').insert(tag).select().single();
  if (error) throw error;
  return data as RfidTag;
}

export async function deleteRfidTag(id: string): Promise<void> {
  const { error } = await db.from('rfid_tags').delete().eq('id', id);
  if (error) throw error;
}

// ─── Alarms (faulted connectors + error messages) ────────────────────────────

export interface Alarm {
  id: string;
  type: 'connector_fault' | 'message_error';
  chargePointId: string;
  connectorId?: number;
  description: string;
  errorCode?: string;
  timestamp: string;
}

export async function getActiveAlarms(): Promise<Alarm[]> {
  const [connectorRes, messageRes] = await Promise.all([
    db
      .from('ocpp_connectors')
      .select(`*, charger:ocpp_chargers(charge_point_id)`)
      .eq('status', 'Faulted'),
    db
      .from('ocpp_messages')
      .select(`*, charger:ocpp_chargers(charge_point_id)`)
      .eq('processing_status', 'Error')
      .order('created_at', { ascending: false })
      .limit(50),
  ]);

  const alarms: Alarm[] = [];

  for (const row of (connectorRes.data ?? [])) {
    const c = row as OcppConnector & { charger: { charge_point_id: string } | null };
    alarms.push({
      id: `fault-${row.id}`,
      type: 'connector_fault',
      chargePointId: c.charger?.charge_point_id ?? c.charger_id,
      connectorId: c.connector_id,
      description: c.info ?? c.error_code ?? 'Faulted',
      errorCode: c.error_code ?? undefined,
      timestamp: c.last_status_update,
    });
  }

  for (const row of (messageRes.data ?? [])) {
    const m = row as OcppMessage & { charger: { charge_point_id: string } | null };
    alarms.push({
      id: `msg-${row.id}`,
      type: 'message_error',
      chargePointId: m.charger?.charge_point_id ?? (m.charger_id ?? ''),
      description: m.error_description ?? m.error_code ?? 'Message error',
      errorCode: m.error_code ?? undefined,
      timestamp: m.created_at,
    });
  }

  return alarms.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

// ─── Topology ────────────────────────────────────────────────────────────────

export interface TopologyNode {
  operatorId: string;
  operatorName: string;
  stations: {
    stationId: string;
    stationName: string;
    stationLocation: string | null;
    chargers: {
      chargerId: string;
      chargePointId: string;
      connectionStatus: ConnectionStatus;
      connectors: {
        connectorDbId: string;
        connectorId: number;
        connectorType: string;
        powerKw: number;
        status: ConnectorStatus;
      }[];
    }[];
  }[];
}

export async function getTopology(): Promise<TopologyNode[]> {
  const [chargerRes, connectorRes, operatorRes] = await Promise.all([
    db
      .from('ocpp_chargers')
      .select(`id, charge_point_id, connection_status, station:stations(id, name, location, operator_id)`),
    db
      .from('ocpp_connectors')
      .select(`id, charger_id, connector_id, connector_type, power_kw, status`),
    db
      .from('operators')
      .select(`id, name`),
  ]);

  const operators: Record<string, { id: string; name: string }> = {};
  for (const op of (operatorRes.data ?? [])) {
    operators[op.id] = op as { id: string; name: string };
  }

  const connectorsByCharger: Record<string, TopologyNode['stations'][0]['chargers'][0]['connectors']> = {};
  for (const conn of (connectorRes.data ?? [])) {
    const c = conn as { id: string; charger_id: string; connector_id: number; connector_type: string; power_kw: number; status: ConnectorStatus };
    if (!connectorsByCharger[c.charger_id]) connectorsByCharger[c.charger_id] = [];
    connectorsByCharger[c.charger_id].push({
      connectorDbId: c.id,
      connectorId: c.connector_id,
      connectorType: c.connector_type,
      powerKw: c.power_kw,
      status: c.status,
    });
  }

  const byOperator: Record<string, TopologyNode> = {};
  const stationsByOperator: Record<string, Record<string, TopologyNode['stations'][0]>> = {};

  for (const charger of (chargerRes.data ?? [])) {
    const c = charger as {
      id: string; charge_point_id: string; connection_status: ConnectionStatus;
      station: { id: string; name: string; location: string | null; operator_id: string | null } | null;
    };

    const station = c.station;
    if (!station) continue;

    const operatorId = station.operator_id ?? 'unassigned';
    const operatorName = operators[operatorId]?.name ?? 'Unassigned';

    if (!byOperator[operatorId]) {
      byOperator[operatorId] = { operatorId, operatorName, stations: [] };
      stationsByOperator[operatorId] = {};
    }

    if (!stationsByOperator[operatorId][station.id]) {
      const stationNode: TopologyNode['stations'][0] = {
        stationId: station.id,
        stationName: station.name,
        stationLocation: station.location,
        chargers: [],
      };
      stationsByOperator[operatorId][station.id] = stationNode;
      byOperator[operatorId].stations.push(stationNode);
    }

    stationsByOperator[operatorId][station.id].chargers.push({
      chargerId: c.id,
      chargePointId: c.charge_point_id,
      connectionStatus: c.connection_status,
      connectors: connectorsByCharger[c.id] ?? [],
    });
  }

  return Object.values(byOperator);
}

