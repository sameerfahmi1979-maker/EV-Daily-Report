import { supabase } from './supabase';
import type { Database } from './database.types';

type ChargerInsert = Database['public']['Tables']['ocpp_chargers']['Insert'];
type ConnectorInsert = Database['public']['Tables']['ocpp_connectors']['Insert'];

export interface BulkChargerData {
  chargePointId: string;
  vendor: string;
  model: string;
  serialNumber: string;
  firmwareVersion?: string;
  stationId?: string;
  locationLatitude?: number;
  locationLongitude?: number;
  installationDate?: string;
  iccid?: string;
  imsi?: string;
  ipAddress?: string;
  notes?: string;
  connectors: {
    connectorId: number;
    connectorType: 'Type2' | 'CCS' | 'CHAdeMO' | 'Type1';
    powerKw: number;
  }[];
}

export interface BulkRegistrationResult {
  success: boolean;
  chargerId?: string;
  chargePointId: string;
  error?: string;
}

export const bulkChargerService = {
  async registerCharger(
    userId: string,
    chargerData: BulkChargerData
  ): Promise<BulkRegistrationResult> {
    try {
      const chargerInsert: ChargerInsert = {
        user_id: userId,
        charge_point_id: chargerData.chargePointId,
        vendor: chargerData.vendor,
        model: chargerData.model,
        serial_number: chargerData.serialNumber,
        firmware_version: chargerData.firmwareVersion || 'Unknown',
        protocol_version: '1.6J',
        registration_status: 'Pending',
        connection_status: 'Offline',
        station_id: chargerData.stationId || null,
        location_latitude: chargerData.locationLatitude || null,
        location_longitude: chargerData.locationLongitude || null,
        installation_date: chargerData.installationDate || null,
        iccid: chargerData.iccid || null,
        imsi: chargerData.imsi || null,
        ip_address: chargerData.ipAddress || null,
        notes: chargerData.notes || null,
      };

      const { data: charger, error: chargerError } = await supabase
        .from('ocpp_chargers')
        .insert(chargerInsert)
        .select()
        .single();

      if (chargerError) {
        throw new Error(`Failed to create charger: ${chargerError.message}`);
      }

      const connectorInserts: ConnectorInsert[] = chargerData.connectors.map((conn) => ({
        charger_id: charger.id,
        connector_id: conn.connectorId,
        connector_type: conn.connectorType,
        power_kw: conn.powerKw,
        status: 'Unknown',
      }));

      const { error: connectorsError } = await supabase
        .from('ocpp_connectors')
        .insert(connectorInserts);

      if (connectorsError) {
        await supabase.from('ocpp_chargers').delete().eq('id', charger.id);
        throw new Error(`Failed to create connectors: ${connectorsError.message}`);
      }

      return {
        success: true,
        chargerId: charger.id,
        chargePointId: chargerData.chargePointId,
      };
    } catch (error: any) {
      console.error('Error registering charger:', error);
      return {
        success: false,
        chargePointId: chargerData.chargePointId,
        error: error.message,
      };
    }
  },

  async registerMultipleChargers(
    userId: string,
    chargersData: BulkChargerData[]
  ): Promise<BulkRegistrationResult[]> {
    const results: BulkRegistrationResult[] = [];

    for (const chargerData of chargersData) {
      const result = await this.registerCharger(userId, chargerData);
      results.push(result);

      if (result.success) {
        console.log(`✓ Registered charger: ${result.chargePointId}`);
      } else {
        console.error(`✗ Failed to register charger: ${result.chargePointId} - ${result.error}`);
      }
    }

    return results;
  },

  async validateChargerData(chargerData: BulkChargerData): Promise<{ valid: boolean; errors: string[] }> {
    const errors: string[] = [];

    if (!chargerData.chargePointId || chargerData.chargePointId.trim() === '') {
      errors.push('Charge Point ID is required');
    }

    if (!chargerData.vendor || chargerData.vendor.trim() === '') {
      errors.push('Vendor is required');
    }

    if (!chargerData.model || chargerData.model.trim() === '') {
      errors.push('Model is required');
    }

    if (!chargerData.serialNumber || chargerData.serialNumber.trim() === '') {
      errors.push('Serial Number is required');
    }

    if (!chargerData.connectors || chargerData.connectors.length === 0) {
      errors.push('At least one connector is required');
    } else {
      chargerData.connectors.forEach((conn, index) => {
        if (!conn.connectorId || conn.connectorId < 1) {
          errors.push(`Connector ${index + 1}: Valid connector ID is required`);
        }
        if (!conn.connectorType) {
          errors.push(`Connector ${index + 1}: Connector type is required`);
        }
        if (!conn.powerKw || conn.powerKw <= 0) {
          errors.push(`Connector ${index + 1}: Valid power rating is required`);
        }
      });
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  },

  async checkDuplicateChargePointId(chargePointId: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('ocpp_chargers')
      .select('id')
      .eq('charge_point_id', chargePointId)
      .maybeSingle();

    if (error) {
      console.error('Error checking duplicate:', error);
      return false;
    }

    return data !== null;
  },

  async getRegistrationSummary() {
    const { data: chargers, error } = await supabase
      .from('ocpp_chargers')
      .select('id, charge_point_id, registration_status, connection_status');

    if (error) {
      throw new Error(`Failed to get summary: ${error.message}`);
    }

    const summary = {
      total: chargers?.length || 0,
      pending: chargers?.filter((c) => c.registration_status === 'Pending').length || 0,
      accepted: chargers?.filter((c) => c.registration_status === 'Accepted').length || 0,
      rejected: chargers?.filter((c) => c.registration_status === 'Rejected').length || 0,
      online: chargers?.filter((c) => c.connection_status === 'Online').length || 0,
      offline: chargers?.filter((c) => c.connection_status === 'Offline').length || 0,
    };

    return summary;
  },

  generateChargePointId(location: string, number: number): string {
    const sanitizedLocation = location.replace(/[^A-Z0-9]/gi, '').toUpperCase();
    const paddedNumber = String(number).padStart(2, '0');
    return `CV-${sanitizedLocation}-CP${paddedNumber}`;
  },

  createChargerTemplate(
    location: string,
    chargerNumber: number,
    stationId?: string
  ): BulkChargerData {
    return {
      chargePointId: this.generateChargePointId(location, chargerNumber),
      vendor: 'ChargeCore Verde',
      model: 'Verde-22',
      serialNumber: `SN-${location.toUpperCase()}-${String(chargerNumber).padStart(3, '0')}`,
      firmwareVersion: '1.0.0',
      stationId: stationId || undefined,
      connectors: [
        {
          connectorId: 1,
          connectorType: 'Type2',
          powerKw: 22,
        },
        {
          connectorId: 2,
          connectorType: 'Type2',
          powerKw: 22,
        },
      ],
    };
  },

  async exportChargersToCSV(): Promise<string> {
    const { data: chargers, error } = await supabase
      .from('ocpp_chargers')
      .select(`
        *,
        station:stations(name),
        connectors:ocpp_connectors(connector_id, connector_type, power_kw, status)
      `)
      .order('charge_point_id');

    if (error) {
      throw new Error(`Failed to export chargers: ${error.message}`);
    }

    const headers = [
      'Charge Point ID',
      'Vendor',
      'Model',
      'Serial Number',
      'Firmware',
      'Protocol',
      'Registration Status',
      'Connection Status',
      'Station',
      'Connectors',
      'Installation Date',
      'Last Heartbeat',
    ].join(',');

    const rows = chargers?.map((charger) => {
      const connectorCount = (charger.connectors as any[])?.length || 0;
      const stationName = (charger.station as any)?.name || 'Not Linked';

      return [
        charger.charge_point_id,
        charger.vendor,
        charger.model,
        charger.serial_number,
        charger.firmware_version,
        charger.protocol_version,
        charger.registration_status,
        charger.connection_status,
        stationName,
        connectorCount,
        charger.installation_date || 'Not Set',
        charger.last_heartbeat_at || 'Never',
      ].map((val) => `"${val}"`).join(',');
    }) || [];

    return [headers, ...rows].join('\n');
  },
};
