export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      stations: {
        Row: {
          id: string
          name: string
          location: string | null
          address: string | null
          capacity_kw: number | null
          station_code: string | null
          status: string | null
          installation_date: string | null
          notes: string | null
          user_id: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          name: string
          location?: string | null
          address?: string | null
          capacity_kw?: number | null
          station_code?: string | null
          status?: string | null
          installation_date?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          name?: string
          location?: string | null
          address?: string | null
          capacity_kw?: number | null
          station_code?: string | null
          status?: string | null
          installation_date?: string | null
          notes?: string | null
          user_id?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      operators: {
        Row: {
          id: string
          user_id: string
          name: string
          photo_url: string | null
          phone_number: string | null
          id_number: string | null
          national_number: string | null
          card_number: string
          email: string | null
          status: string | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          photo_url?: string | null
          phone_number?: string | null
          id_number?: string | null
          national_number?: string | null
          card_number: string
          email?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          name?: string
          photo_url?: string | null
          phone_number?: string | null
          id_number?: string | null
          national_number?: string | null
          card_number?: string
          email?: string | null
          status?: string | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      rate_structures: {
        Row: {
          id: string
          station_id: string | null
          name: string
          description: string | null
          effective_from: string
          effective_to: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          station_id?: string | null
          name: string
          description?: string | null
          effective_from: string
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          station_id?: string | null
          name?: string
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      rate_periods: {
        Row: {
          id: string
          rate_structure_id: string | null
          period_name: string
          start_time: string
          end_time: string
          days_of_week: string[]
          season: string | null
          energy_rate_per_kwh: number
          demand_charge_per_kw: number | null
          priority: number | null
          created_at: string | null
        }
        Insert: {
          id?: string
          rate_structure_id?: string | null
          period_name: string
          start_time: string
          end_time: string
          days_of_week: string[]
          season?: string | null
          energy_rate_per_kwh: number
          demand_charge_per_kw?: number | null
          priority?: number | null
          created_at?: string | null
        }
        Update: {
          id?: string
          rate_structure_id?: string | null
          period_name?: string
          start_time?: string
          end_time?: string
          days_of_week?: string[]
          season?: string | null
          energy_rate_per_kwh?: number
          demand_charge_per_kw?: number | null
          priority?: number | null
          created_at?: string | null
        }
      }
      charging_sessions: {
        Row: {
          id: string
          station_id: string | null
          transaction_id: string
          charge_id: string
          card_number: string
          start_date: string
          start_time: string
          start_ts: string
          end_date: string
          end_time: string
          end_ts: string
          duration_minutes: number
          energy_consumed_kwh: number
          calculated_cost: number
          max_demand_kw: number | null
          station_code: string | null
          user_identifier: string | null
          import_batch_id: string | null
          connector_number: string | null
          connector_type: string | null
          duration_text: string | null
          co2_reduction_kg: number | null
          start_soc_percent: number | null
          end_soc_percent: number | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          station_id?: string | null
          transaction_id: string
          charge_id: string
          card_number: string
          start_date: string
          start_time: string
          start_ts: string
          end_date: string
          end_time: string
          end_ts: string
          duration_minutes: number
          energy_consumed_kwh: number
          calculated_cost: number
          max_demand_kw?: number | null
          station_code?: string | null
          user_identifier?: string | null
          import_batch_id?: string | null
          connector_number?: string | null
          connector_type?: string | null
          duration_text?: string | null
          co2_reduction_kg?: number | null
          start_soc_percent?: number | null
          end_soc_percent?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          station_id?: string | null
          transaction_id?: string
          charge_id?: string
          card_number?: string
          start_date?: string
          start_time?: string
          start_ts?: string
          end_date?: string
          end_time?: string
          end_ts?: string
          duration_minutes?: number
          energy_consumed_kwh?: number
          calculated_cost?: number
          max_demand_kw?: number | null
          station_code?: string | null
          user_identifier?: string | null
          import_batch_id?: string | null
          connector_number?: string | null
          connector_type?: string | null
          duration_text?: string | null
          co2_reduction_kg?: number | null
          start_soc_percent?: number | null
          end_soc_percent?: number | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      import_batches: {
        Row: {
          id: string
          filename: string
          upload_date: string | null
          records_total: number | null
          records_success: number | null
          records_skipped: number | null
          records_failed: number | null
          status: string | null
          error_log: Json | null
          user_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          filename: string
          upload_date?: string | null
          records_total?: number | null
          records_success?: number | null
          records_skipped?: number | null
          records_failed?: number | null
          status?: string | null
          error_log?: Json | null
          user_id?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          filename?: string
          upload_date?: string | null
          records_total?: number | null
          records_success?: number | null
          records_skipped?: number | null
          records_failed?: number | null
          status?: string | null
          error_log?: Json | null
          user_id?: string | null
          created_at?: string | null
        }
      }
      billing_calculations: {
        Row: {
          id: string
          session_id: string | null
          rate_structure_id: string | null
          calculation_date: string | null
          breakdown: Json | null
          subtotal: number
          taxes: number | null
          fees: number | null
          total_amount: number
          currency: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          session_id?: string | null
          rate_structure_id?: string | null
          calculation_date?: string | null
          breakdown?: Json | null
          subtotal: number
          taxes?: number | null
          fees?: number | null
          total_amount: number
          currency?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          session_id?: string | null
          rate_structure_id?: string | null
          calculation_date?: string | null
          breakdown?: Json | null
          subtotal?: number
          taxes?: number | null
          fees?: number | null
          total_amount?: number
          currency?: string | null
          created_at?: string | null
        }
      }
      billing_breakdown_items: {
        Row: {
          id: string
          billing_calculation_id: string | null
          rate_period_id: string | null
          period_name: string
          start_time: string
          end_time: string
          duration_minutes: number
          energy_kwh: number
          rate_per_kwh: number
          demand_kw: number | null
          demand_charge: number | null
          energy_charge: number
          line_total: number
          created_at: string | null
        }
        Insert: {
          id?: string
          billing_calculation_id?: string | null
          rate_period_id?: string | null
          period_name: string
          start_time: string
          end_time: string
          duration_minutes: number
          energy_kwh: number
          rate_per_kwh: number
          demand_kw?: number | null
          demand_charge?: number | null
          energy_charge: number
          line_total: number
          created_at?: string | null
        }
        Update: {
          id?: string
          billing_calculation_id?: string | null
          rate_period_id?: string | null
          period_name?: string
          start_time?: string
          end_time?: string
          duration_minutes?: number
          energy_kwh?: number
          rate_per_kwh?: number
          demand_kw?: number | null
          demand_charge?: number | null
          energy_charge?: number
          line_total?: number
          created_at?: string | null
        }
      }
      fixed_charges: {
        Row: {
          id: string
          station_id: string | null
          charge_name: string
          charge_type: string
          amount: number
          effective_from: string | null
          effective_to: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          station_id?: string | null
          charge_name: string
          charge_type: string
          amount: number
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          station_id?: string | null
          charge_name?: string
          charge_type?: string
          amount?: number
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
      }
      tax_configurations: {
        Row: {
          id: string
          station_id: string | null
          tax_name: string
          tax_rate: number
          applies_to: string | null
          effective_from: string | null
          effective_to: string | null
          is_active: boolean | null
          created_at: string | null
        }
        Insert: {
          id?: string
          station_id?: string | null
          tax_name: string
          tax_rate: number
          applies_to?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
        Update: {
          id?: string
          station_id?: string | null
          tax_name?: string
          tax_rate?: number
          applies_to?: string | null
          effective_from?: string | null
          effective_to?: string | null
          is_active?: boolean | null
          created_at?: string | null
        }
      }
    }
  }
}
