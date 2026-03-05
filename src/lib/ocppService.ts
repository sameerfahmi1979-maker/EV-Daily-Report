import { supabase } from './supabase';
import { Database } from './database.types';

type OcppCharger = Database['public']['Tables']['ocpp_chargers']['Row'];
type OcppConnector = Database['public']['Tables']['ocpp_connectors']['Row'];
type OcppChargingSession = Database['public']['Tables']['ocpp_charging_sessions']['Row'];

interface ChargerWithConnectors extends OcppCharger {
  connectors: OcppConnector[];
  station?: {
    id: string;
    name: string;
    station_code: string | null;
  };
}

interface ActiveSessionWithDetails extends OcppChargingSession {
  charger: {
    charge_point_id: string;
    vendor: string | null;
    model: string | null;
  };
  connector: {
    connector_id: number;
    connector_type: string;
    power_kw: number | null;
  };
  operator: {
    name: string;
    email: string | null;
    phone: string | null;
    rfid_card_number: string | null;
  } | null;
}

export interface SystemHealth {
  totalChargers: number;
  onlineChargers: number;
  offlineChargers: number;
  errorChargers: number;
  activeSessions: number;
  totalConnectors: number;
  availableConnectors: number;
  chargingConnectors: number;
  faultedConnectors: number;
  systemUptime: number;
  averageResponseTime: number;
}

export const ocppService = {
  async getAllChargers(): Promise<ChargerWithConnectors[]> {
    const { data, error } = await supabase
      .from('ocpp_chargers')
      .select(`
        *,
        connectors:ocpp_connectors(*),
        station:stations(id, name, station_code)
      `)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getChargerById(chargerId: string): Promise<ChargerWithConnectors | null> {
    const { data, error } = await supabase
      .from('ocpp_chargers')
      .select(`
        *,
        connectors:ocpp_connectors(*),
        station:stations(id, name, station_code)
      `)
      .eq('id', chargerId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getActiveSessions(): Promise<ActiveSessionWithDetails[]> {
    const { data, error } = await supabase
      .from('ocpp_charging_sessions')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id,
          vendor,
          model
        ),
        connector:ocpp_connectors!connector_id(
          connector_id,
          connector_type,
          power_kw
        ),
        operator:operators(
          name,
          email,
          phone,
          rfid_card_number
        )
      `)
      .eq('session_status', 'Active')
      .order('start_timestamp', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async getRecentMessages(limit: number = 50) {
    const { data, error } = await supabase
      .from('ocpp_messages')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id
        )
      `)
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async updateConnectorStatus(
    connectorId: string,
    status: string,
    errorCode?: string | null,
    info?: string | null
  ) {
    const { error } = await supabase
      .from('ocpp_connectors')
      .update({
        status,
        error_code: errorCode,
        info,
        last_status_update: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId);

    if (error) throw error;
  },

  async updateChargerHeartbeat(chargerId: string) {
    const { error } = await supabase
      .from('ocpp_chargers')
      .update({
        last_heartbeat_at: new Date().toISOString(),
        connection_status: 'Online',
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargerId);

    if (error) throw error;
  },

  async createCharger(
    userId: string,
    chargerData: {
      charge_point_id: string;
      vendor: string;
      model: string;
      serial_number?: string;
      firmware_version?: string;
      protocol_version: string;
      station_id?: string;
      location_latitude?: number;
      location_longitude?: number;
      installation_date?: string;
      notes?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('ocpp_chargers')
      .insert({
        user_id: userId,
        charge_point_id: chargerData.charge_point_id,
        vendor: chargerData.vendor,
        model: chargerData.model,
        serial_number: chargerData.serial_number || null,
        firmware_version: chargerData.firmware_version || null,
        protocol_version: chargerData.protocol_version,
        station_id: chargerData.station_id || null,
        location_latitude: chargerData.location_latitude || null,
        location_longitude: chargerData.location_longitude || null,
        installation_date: chargerData.installation_date || null,
        notes: chargerData.notes || null,
        registration_status: 'Pending',
        connection_status: 'Unknown',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateCharger(
    chargerId: string,
    userId: string,
    updates: {
      charge_point_id?: string;
      vendor?: string;
      model?: string;
      serial_number?: string;
      firmware_version?: string;
      protocol_version?: string;
      station_id?: string;
      location_latitude?: number;
      location_longitude?: number;
      installation_date?: string;
      notes?: string;
    }
  ) {
    const { data, error } = await supabase
      .from('ocpp_chargers')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', chargerId)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteCharger(chargerId: string, userId: string) {
    const { error } = await supabase
      .from('ocpp_chargers')
      .delete()
      .eq('id', chargerId)
      .eq('user_id', userId);

    if (error) throw error;
  },

  async createConnector(
    chargerId: string,
    connectorData: {
      connector_id: number;
      connector_type: string;
      power_kw: number;
    }
  ) {
    const { data, error } = await supabase
      .from('ocpp_connectors')
      .insert({
        charger_id: chargerId,
        connector_id: connectorData.connector_id,
        connector_type: connectorData.connector_type,
        power_kw: connectorData.power_kw,
        status: 'Unknown',
        last_status_update: new Date().toISOString(),
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async updateConnector(
    connectorId: string,
    updates: {
      connector_type?: string;
      power_kw?: number;
    }
  ) {
    const { data, error } = await supabase
      .from('ocpp_connectors')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', connectorId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async deleteConnector(connectorId: string) {
    const { error } = await supabase
      .from('ocpp_connectors')
      .delete()
      .eq('id', connectorId);

    if (error) throw error;
  },

  async sendRemoteCommand(
    userId: string,
    chargerId: string,
    commandType: string,
    parameters: Record<string, any> = {},
    connectorId?: string
  ) {
    const { data, error } = await supabase
      .from('ocpp_remote_commands')
      .insert({
        user_id: userId,
        charger_id: chargerId,
        connector_id: connectorId || null,
        command_type: commandType,
        parameters,
        status: 'Pending',
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getRemoteCommands(userId: string, limit: number = 50) {
    const { data, error } = await supabase
      .from('ocpp_remote_commands')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id,
          vendor,
          model,
          user_id
        ),
        connector:ocpp_connectors(
          connector_id,
          connector_type
        )
      `)
      .eq('charger.user_id', userId)
      .order('requested_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data || [];
  },

  async getCommandById(commandId: string, userId: string) {
    const { data, error } = await supabase
      .from('ocpp_remote_commands')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id,
          vendor,
          model,
          user_id
        ),
        connector:ocpp_connectors(
          connector_id,
          connector_type
        )
      `)
      .eq('id', commandId)
      .eq('charger.user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async remoteStartTransaction(
    userId: string,
    chargerId: string,
    connectorId: string,
    idTag: string
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'RemoteStartTransaction',
      { idTag, connectorId: parseInt(connectorId) },
      connectorId
    );
  },

  async remoteStopTransaction(
    userId: string,
    chargerId: string,
    transactionId: number
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'RemoteStopTransaction',
      { transactionId }
    );
  },

  async unlockConnector(
    userId: string,
    chargerId: string,
    connectorId: string
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'UnlockConnector',
      { connectorId: parseInt(connectorId) },
      connectorId
    );
  },

  async resetCharger(
    userId: string,
    chargerId: string,
    resetType: 'Hard' | 'Soft'
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'Reset',
      { type: resetType }
    );
  },

  async changeAvailability(
    userId: string,
    chargerId: string,
    connectorId: string | null,
    availabilityType: 'Operative' | 'Inoperative'
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'ChangeAvailability',
      {
        connectorId: connectorId ? parseInt(connectorId) : 0,
        type: availabilityType,
      },
      connectorId || undefined
    );
  },

  async changeConfiguration(
    userId: string,
    chargerId: string,
    key: string,
    value: string
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'ChangeConfiguration',
      { key, value }
    );
  },

  async getConfiguration(
    userId: string,
    chargerId: string,
    keys?: string[]
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'GetConfiguration',
      keys ? { key: keys } : {}
    );
  },

  async triggerMessage(
    userId: string,
    chargerId: string,
    requestedMessage: string,
    connectorId?: string
  ) {
    return ocppService.sendRemoteCommand(
      userId,
      chargerId,
      'TriggerMessage',
      {
        requestedMessage,
        connectorId: connectorId ? parseInt(connectorId) : undefined,
      },
      connectorId
    );
  },

  async getHistoricalSessions(
    userId: string,
    limit: number = 50,
    filters?: {
      chargerId?: string;
      operatorId?: string;
      startDate?: string;
      endDate?: string;
      status?: string;
    }
  ) {
    let query = supabase
      .from('ocpp_charging_sessions')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id,
          vendor,
          model,
          user_id
        ),
        connector:ocpp_connectors!connector_id(
          connector_id,
          connector_type,
          power_kw
        ),
        operator:operators(
          name,
          email,
          phone,
          rfid_card_number
        )
      `)
      .eq('charger.user_id', userId);

    if (filters?.chargerId) {
      query = query.eq('charger_id', filters.chargerId);
    }

    if (filters?.operatorId) {
      query = query.eq('operator_id', filters.operatorId);
    }

    if (filters?.startDate) {
      query = query.gte('start_timestamp', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('start_timestamp', filters.endDate);
    }

    if (filters?.status) {
      query = query.eq('session_status', filters.status);
    }

    query = query.order('start_timestamp', { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getSessionById(sessionId: string, userId: string) {
    const { data, error } = await supabase
      .from('ocpp_charging_sessions')
      .select(`
        *,
        charger:ocpp_chargers!inner(
          charge_point_id,
          vendor,
          model,
          station_id,
          user_id
        ),
        connector:ocpp_connectors!connector_id(
          connector_id,
          connector_type,
          power_kw
        ),
        operator:operators(
          name,
          email,
          phone,
          rfid_card_number
        )
      `)
      .eq('id', sessionId)
      .eq('charger.user_id', userId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getSessionStatistics(userId: string, days: number = 30) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('ocpp_charging_sessions')
      .select(`
        id,
        session_status,
        energy_consumed_wh,
        duration_minutes,
        calculated_cost,
        start_timestamp,
        charger:ocpp_chargers!inner(user_id)
      `)
      .eq('charger.user_id', userId)
      .gte('start_timestamp', startDate.toISOString());

    if (error) throw error;

    const sessions = data || [];
    const activeSessions = sessions.filter((s) => s.session_status === 'Active');
    const completedSessions = sessions.filter((s) => s.session_status === 'Completed');

    const totalEnergy = sessions.reduce(
      (sum, s) => sum + (Number(s.energy_consumed_wh) || 0),
      0
    );
    const totalDuration = sessions.reduce(
      (sum, s) => sum + (Number(s.duration_minutes) || 0),
      0
    );
    const totalRevenue = sessions.reduce(
      (sum, s) => sum + (Number(s.calculated_cost) || 0),
      0
    );

    return {
      total: sessions.length,
      active: activeSessions.length,
      completed: completedSessions.length,
      totalEnergy,
      totalDuration,
      totalRevenue,
      averageEnergy: sessions.length > 0 ? totalEnergy / sessions.length : 0,
      averageDuration: sessions.length > 0 ? totalDuration / sessions.length : 0,
    };
  },

  async stopOCPPSession(userId: string, sessionId: string, reason: string = 'Remote') {
    const session = await ocppService.getSessionById(sessionId, userId);
    if (!session) {
      throw new Error('Session not found');
    }

    return ocppService.remoteStopTransaction(
      userId,
      session.charger_id,
      session.transaction_id
    );
  },

  async getMessages(
    userId: string,
    limit: number = 100,
    filters?: {
      chargerId?: string;
      messageType?: string;
      action?: string;
      direction?: string;
      processingStatus?: string;
      startDate?: string;
      endDate?: string;
    }
  ) {
    let query = supabase
      .from('ocpp_messages')
      .select(`
        *,
        charger:ocpp_chargers(
          charge_point_id,
          vendor,
          model,
          user_id
        )
      `);

    if (filters?.chargerId) {
      query = query.eq('charger_id', filters.chargerId);
    }

    if (filters?.messageType) {
      query = query.eq('message_type', filters.messageType);
    }

    if (filters?.action) {
      query = query.ilike('action', `%${filters.action}%`);
    }

    if (filters?.direction) {
      query = query.eq('direction', filters.direction);
    }

    if (filters?.processingStatus) {
      query = query.eq('processing_status', filters.processingStatus);
    }

    if (filters?.startDate) {
      query = query.gte('timestamp', filters.startDate);
    }

    if (filters?.endDate) {
      query = query.lte('timestamp', filters.endDate);
    }

    query = query.order('timestamp', { ascending: false }).limit(limit);

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  },

  async getMessageById(messageId: string, userId: string) {
    const { data, error } = await supabase
      .from('ocpp_messages')
      .select(`
        *,
        charger:ocpp_chargers(
          charge_point_id,
          vendor,
          model,
          station_id,
          user_id
        )
      `)
      .eq('id', messageId)
      .maybeSingle();

    if (error) throw error;

    if (data && data.charger && data.charger.user_id !== userId) {
      throw new Error('Unauthorized');
    }

    return data;
  },

  async getMessageStatistics(userId: string, days: number = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('ocpp_messages')
      .select(`
        id,
        message_type,
        direction,
        processing_status,
        timestamp,
        charger:ocpp_chargers!inner(user_id)
      `)
      .eq('charger.user_id', userId)
      .gte('timestamp', startDate.toISOString());

    if (error) throw error;

    const messages = data || [];

    const incomingMessages = messages.filter((m) => m.direction === 'Incoming');
    const outgoingMessages = messages.filter((m) => m.direction === 'Outgoing');
    const callMessages = messages.filter((m) => m.message_type === 'Call');
    const callResultMessages = messages.filter((m) => m.message_type === 'CallResult');
    const callErrorMessages = messages.filter((m) => m.message_type === 'CallError');
    const successMessages = messages.filter((m) => m.processing_status === 'Success');
    const errorMessages = messages.filter((m) => m.processing_status === 'Error');

    return {
      total: messages.length,
      incoming: incomingMessages.length,
      outgoing: outgoingMessages.length,
      calls: callMessages.length,
      callResults: callResultMessages.length,
      callErrors: callErrorMessages.length,
      success: successMessages.length,
      errors: errorMessages.length,
      successRate:
        messages.length > 0 ? (successMessages.length / messages.length) * 100 : 0,
    };
  },

  async deleteMessage(messageId: string, userId: string) {
    const message = await ocppService.getMessageById(messageId, userId);
    if (!message) {
      throw new Error('Message not found');
    }

    const { error } = await supabase.from('ocpp_messages').delete().eq('id', messageId);

    if (error) throw error;
  },

  async clearOldMessages(userId: string, daysToKeep: number = 30) {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

    const chargers = await ocppService.getAllChargers(userId);
    const chargerIds = chargers.map((c) => c.id);

    if (chargerIds.length === 0) return 0;

    const { error, count } = await supabase
      .from('ocpp_messages')
      .delete()
      .in('charger_id', chargerIds)
      .lt('timestamp', cutoffDate.toISOString());

    if (error) throw error;
    return count || 0;
  },

  async getSystemHealth(userId: string) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) {
      return {
        totalChargers: 0,
        onlineChargers: 0,
        offlineChargers: 0,
        errorChargers: 0,
        totalConnectors: 0,
        availableConnectors: 0,
        chargingConnectors: 0,
        faultedConnectors: 0,
        activeSessions: 0,
        systemUptime: 100,
        averageResponseTime: 0,
      };
    }

    const chargerIds = chargers.map((c) => c.id);

    const onlineChargers = chargers.filter((c) => c.connection_status === 'Online');
    const offlineChargers = chargers.filter((c) => c.connection_status === 'Offline');

    const { data: connectors } = await supabase
      .from('ocpp_connectors')
      .select('*')
      .in('charger_id', chargerIds);

    const allConnectors = connectors || [];
    const availableConnectors = allConnectors.filter((c) => c.status === 'Available');
    const chargingConnectors = allConnectors.filter((c) => c.status === 'Charging');
    const faultedConnectors = allConnectors.filter(
      (c) => c.status === 'Faulted' || c.status === 'Unavailable'
    );

    const { data: activeSessions } = await supabase
      .from('ocpp_charging_sessions')
      .select('id')
      .in('charger_id', chargerIds)
      .eq('session_status', 'Active');

    const errorChargers = chargers.filter((c) => {
      const hasRecentHeartbeat =
        c.last_heartbeat_at &&
        new Date(c.last_heartbeat_at).getTime() > Date.now() - 5 * 60 * 1000;
      return c.connection_status === 'Online' && !hasRecentHeartbeat;
    });

    const systemUptime =
      chargers.length > 0 ? (onlineChargers.length / chargers.length) * 100 : 0;

    const oneHourAgo = new Date();
    oneHourAgo.setHours(oneHourAgo.getHours() - 1);

    const { data: recentMessages } = await supabase
      .from('ocpp_messages')
      .select('timestamp, created_at')
      .in('charger_id', chargerIds)
      .gte('timestamp', oneHourAgo.toISOString())
      .limit(100);

    let averageResponseTime = 0;
    if (recentMessages && recentMessages.length > 0) {
      const responseTimes = recentMessages
        .map((m) => {
          const timestamp = new Date(m.timestamp).getTime();
          const created = new Date(m.created_at).getTime();
          return created - timestamp;
        })
        .filter((t) => t >= 0 && t < 10000);

      if (responseTimes.length > 0) {
        averageResponseTime =
          responseTimes.reduce((sum, t) => sum + t, 0) / responseTimes.length;
      }
    }

    return {
      totalChargers: chargers.length,
      onlineChargers: onlineChargers.length,
      offlineChargers: offlineChargers.length,
      errorChargers: errorChargers.length,
      totalConnectors: allConnectors.length,
      availableConnectors: availableConnectors.length,
      chargingConnectors: chargingConnectors.length,
      faultedConnectors: faultedConnectors.length,
      activeSessions: activeSessions?.length || 0,
      systemUptime,
      averageResponseTime,
    };
  },

  async getChargerHealthDetails(userId: string) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) return [];

    const chargerIds = chargers.map((c) => c.id);

    const { data: connectors } = await supabase
      .from('ocpp_connectors')
      .select('*')
      .in('charger_id', chargerIds);

    const { data: activeSessions } = await supabase
      .from('ocpp_charging_sessions')
      .select('charger_id, id')
      .in('charger_id', chargerIds)
      .eq('session_status', 'Active');

    const { data: recentErrors } = await supabase
      .from('ocpp_messages')
      .select('charger_id, id')
      .in('charger_id', chargerIds)
      .eq('message_type', 'CallError')
      .gte(
        'timestamp',
        new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
      );

    const connectorsByCharger: Record<string, any[]> = {};
    (connectors || []).forEach((conn) => {
      if (!connectorsByCharger[conn.charger_id]) {
        connectorsByCharger[conn.charger_id] = [];
      }
      connectorsByCharger[conn.charger_id].push(conn);
    });

    const sessionsByCharger: Record<string, number> = {};
    (activeSessions || []).forEach((session) => {
      sessionsByCharger[session.charger_id] =
        (sessionsByCharger[session.charger_id] || 0) + 1;
    });

    const errorsByCharger: Record<string, number> = {};
    (recentErrors || []).forEach((error) => {
      errorsByCharger[error.charger_id] = (errorsByCharger[error.charger_id] || 0) + 1;
    });

    return chargers.map((charger) => {
      const chargerConnectors = connectorsByCharger[charger.id] || [];
      const availableCount = chargerConnectors.filter((c) => c.status === 'Available').length;
      const chargingCount = chargerConnectors.filter((c) => c.status === 'Charging').length;
      const faultedCount = chargerConnectors.filter(
        (c) => c.status === 'Faulted' || c.status === 'Unavailable'
      ).length;

      const hasRecentHeartbeat =
        charger.last_heartbeat_at &&
        new Date(charger.last_heartbeat_at).getTime() > Date.now() - 5 * 60 * 1000;

      const uptimeMinutes = charger.last_heartbeat_at
        ? Math.floor((Date.now() - new Date(charger.created_at).getTime()) / 60000)
        : 0;

      let healthStatus: 'healthy' | 'warning' | 'error' | 'offline';
      if (charger.connection_status === 'Offline') {
        healthStatus = 'offline';
      } else if (faultedCount > 0 || !hasRecentHeartbeat) {
        healthStatus = 'error';
      } else if (errorsByCharger[charger.id] > 5) {
        healthStatus = 'warning';
      } else {
        healthStatus = 'healthy';
      }

      return {
        id: charger.id,
        chargePointId: charger.charge_point_id,
        vendor: charger.vendor,
        model: charger.model,
        connectionStatus: charger.connection_status,
        lastHeartbeat: charger.last_heartbeat_at,
        hasRecentHeartbeat,
        firmwareVersion: charger.firmware_version,
        totalConnectors: chargerConnectors.length,
        availableConnectors: availableCount,
        chargingConnectors: chargingCount,
        faultedConnectors: faultedCount,
        activeSessions: sessionsByCharger[charger.id] || 0,
        recentErrors: errorsByCharger[charger.id] || 0,
        uptimeMinutes,
        healthStatus,
      };
    });
  },

  async getErrorLog(userId: string, limit: number = 50) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) return [];

    const chargerIds = chargers.map((c) => c.id);

    const { data: errors, error } = await supabase
      .from('ocpp_messages')
      .select(
        `
        *,
        charger:ocpp_chargers(
          charge_point_id,
          vendor,
          model
        )
      `
      )
      .in('charger_id', chargerIds)
      .or('message_type.eq.CallError,processing_status.eq.Error')
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return errors || [];
  },

  async getConnectorStatusHistory(
    userId: string,
    connectorId: string,
    hours: number = 24
  ) {
    const startDate = new Date();
    startDate.setHours(startDate.getHours() - hours);

    const { data: connector } = await supabase
      .from('ocpp_connectors')
      .select(
        `
        *,
        charger:ocpp_chargers!inner(user_id)
      `
      )
      .eq('id', connectorId)
      .eq('charger.user_id', userId)
      .maybeSingle();

    if (!connector) {
      throw new Error('Connector not found');
    }

    const { data: statusChanges, error } = await supabase
      .from('ocpp_messages')
      .select('timestamp, payload, action')
      .eq('charger_id', connector.charger_id)
      .eq('action', 'StatusNotification')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw error;

    return (statusChanges || [])
      .filter((change: any) => {
        const payload = change.payload;
        return payload.connectorId === connector.connector_id;
      })
      .map((change: any) => ({
        timestamp: change.timestamp,
        status: change.payload.status,
        errorCode: change.payload.errorCode || null,
      }));
  },

  async getChargerUptime(userId: string, chargerId: string, days: number = 7) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data: heartbeats, error } = await supabase
      .from('ocpp_messages')
      .select('timestamp')
      .eq('charger_id', chargerId)
      .eq('action', 'Heartbeat')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: true });

    if (error) throw error;

    if (!heartbeats || heartbeats.length === 0) {
      return {
        uptimePercentage: 0,
        totalHeartbeats: 0,
        missedHeartbeats: 0,
        longestDowntime: 0,
        averageInterval: 0,
      };
    }

    const intervals: number[] = [];
    for (let i = 1; i < heartbeats.length; i++) {
      const interval =
        new Date(heartbeats[i].timestamp).getTime() -
        new Date(heartbeats[i - 1].timestamp).getTime();
      intervals.push(interval);
    }

    const expectedInterval = 60000;
    const missedHeartbeats = intervals.filter((i) => i > expectedInterval * 2).length;
    const longestDowntime = intervals.length > 0 ? Math.max(...intervals) : 0;
    const averageInterval =
      intervals.length > 0 ? intervals.reduce((sum, i) => sum + i, 0) / intervals.length : 0;

    const totalExpectedHeartbeats = Math.floor((days * 24 * 60 * 60 * 1000) / expectedInterval);
    const uptimePercentage =
      ((heartbeats.length - missedHeartbeats) / totalExpectedHeartbeats) * 100;

    return {
      uptimePercentage: Math.min(100, Math.max(0, uptimePercentage)),
      totalHeartbeats: heartbeats.length,
      missedHeartbeats,
      longestDowntime,
      averageInterval,
    };
  },

  async getDiagnosticInfo(userId: string, chargerId: string) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const { data: configKeys } = await supabase
      .from('ocpp_configuration_keys')
      .select('*')
      .eq('charger_id', chargerId)
      .order('key_name', { ascending: true });

    const { data: recentCommands } = await supabase
      .from('ocpp_remote_commands')
      .select('*')
      .eq('charger_id', chargerId)
      .order('requested_at', { ascending: false })
      .limit(10);

    const { data: recentMessages } = await supabase
      .from('ocpp_messages')
      .select('*')
      .eq('charger_id', chargerId)
      .order('timestamp', { ascending: false })
      .limit(20);

    const oneDayAgo = new Date();
    oneDayAgo.setDate(oneDayAgo.getDate() - 1);

    const { data: errorMessages } = await supabase
      .from('ocpp_messages')
      .select('*')
      .eq('charger_id', chargerId)
      .or('message_type.eq.CallError,processing_status.eq.Error')
      .gte('timestamp', oneDayAgo.toISOString());

    return {
      charger,
      configurationKeys: configKeys || [],
      recentCommands: recentCommands || [],
      recentMessages: recentMessages || [],
      recentErrors: errorMessages || [],
      errorCount24h: errorMessages?.length || 0,
    };
  },

  async getConfigurationKeys(userId: string, chargerId: string) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const { data: keys, error } = await supabase
      .from('ocpp_configuration_keys')
      .select('*')
      .eq('charger_id', chargerId)
      .order('key_name', { ascending: true });

    if (error) throw error;
    return keys || [];
  },

  async sendGetConfigurationCommand(
    userId: string,
    chargerId: string,
    keys: string[] = []
  ) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const { data: command, error } = await supabase
      .from('ocpp_remote_commands')
      .insert({
        user_id: userId,
        charger_id: chargerId,
        command_type: 'GetConfiguration',
        parameters: { keys: keys.length > 0 ? keys : undefined },
        status: 'Pending',
      })
      .select()
      .single();

    if (error) throw error;
    return command;
  },

  async sendChangeConfigurationCommand(
    userId: string,
    chargerId: string,
    key: string,
    value: string
  ) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const { data: command, error } = await supabase
      .from('ocpp_remote_commands')
      .insert({
        user_id: userId,
        charger_id: chargerId,
        command_type: 'ChangeConfiguration',
        parameters: { key, value },
        status: 'Pending',
      })
      .select()
      .single();

    if (error) throw error;
    return command;
  },

  async getAllConfigurationKeys(userId: string) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) return [];

    const chargerIds = chargers.map((c) => c.id);

    const { data: keys, error } = await supabase
      .from('ocpp_configuration_keys')
      .select(
        `
        *,
        charger:ocpp_chargers(
          charge_point_id,
          vendor,
          model
        )
      `
      )
      .in('charger_id', chargerIds)
      .order('charger_id', { ascending: true })
      .order('key_name', { ascending: true });

    if (error) throw error;
    return keys || [];
  },

  async getConfigurationKeySummary(userId: string) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) {
      return {
        totalChargers: 0,
        chargersWithConfig: 0,
        totalKeys: 0,
        commonKeys: [],
      };
    }

    const chargerIds = chargers.map((c) => c.id);

    const { data: keys } = await supabase
      .from('ocpp_configuration_keys')
      .select('charger_id, key_name')
      .in('charger_id', chargerIds);

    const allKeys = keys || [];
    const chargerIdsWithConfig = new Set(allKeys.map((k) => k.charger_id));

    const keyFrequency: Record<string, number> = {};
    allKeys.forEach((k) => {
      keyFrequency[k.key_name] = (keyFrequency[k.key_name] || 0) + 1;
    });

    const commonKeys = Object.entries(keyFrequency)
      .filter(([_, count]) => count >= Math.ceil(chargers.length / 2))
      .map(([keyName, count]) => ({ keyName, count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalChargers: chargers.length,
      chargersWithConfig: chargerIdsWithConfig.size,
      totalKeys: allKeys.length,
      commonKeys,
    };
  },

  async getFirmwareVersions(userId: string) {
    const chargers = await ocppService.getAllChargers(userId);

    if (chargers.length === 0) return [];

    const firmwareGroups: Record<
      string,
      { version: string; count: number; chargers: string[] }
    > = {};

    chargers.forEach((charger) => {
      const version = charger.firmware_version || 'Unknown';
      if (!firmwareGroups[version]) {
        firmwareGroups[version] = {
          version,
          count: 0,
          chargers: [],
        };
      }
      firmwareGroups[version].count++;
      firmwareGroups[version].chargers.push(charger.charge_point_id);
    });

    return Object.values(firmwareGroups).sort((a, b) => b.count - a.count);
  },

  async getAuthorizationList() {
    const { data: operators, error } = await supabase
      .from('operators')
      .select('*')
      .eq('status', 'Active')
      .order('name', { ascending: true});

    if (error) throw error;
    return operators || [];
  },

  async updateConfigurationKey(
    userId: string,
    chargerId: string,
    keyName: string,
    newValue: string
  ) {
    const charger = await ocppService.getChargerById(chargerId, userId);
    if (!charger) {
      throw new Error('Charger not found');
    }

    const { data: existingKey } = await supabase
      .from('ocpp_configuration_keys')
      .select('*')
      .eq('charger_id', chargerId)
      .eq('key_name', keyName)
      .maybeSingle();

    if (existingKey && existingKey.readonly) {
      throw new Error('Cannot update read-only configuration key');
    }

    const command = await ocppService.sendChangeConfigurationCommand(
      userId,
      chargerId,
      keyName,
      newValue
    );

    return command;
  },

  async refreshConfigurationKeys(userId: string, chargerId: string) {
    const command = await ocppService.sendGetConfigurationCommand(userId, chargerId, []);
    return command;
  },
};
