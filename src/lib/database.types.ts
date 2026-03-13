export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: Json | null
          entity_id: string | null
          entity_type: string
          id: string
          ip_address: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: Json | null
          entity_id?: string | null
          entity_type?: string
          id?: string
          ip_address?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      billing_breakdown_items: {
        Row: {
          billing_calculation_id: string | null
          created_at: string | null
          demand_charge: number | null
          demand_kw: number | null
          duration_minutes: number
          end_time: string
          energy_charge: number
          energy_kwh: number
          id: string
          line_total: number
          period_name: string
          rate_per_kwh: number
          rate_period_id: string | null
          start_time: string
        }
        Insert: {
          billing_calculation_id?: string | null
          created_at?: string | null
          demand_charge?: number | null
          demand_kw?: number | null
          duration_minutes: number
          end_time: string
          energy_charge: number
          energy_kwh: number
          id?: string
          line_total: number
          period_name: string
          rate_per_kwh: number
          rate_period_id?: string | null
          start_time: string
        }
        Update: {
          billing_calculation_id?: string | null
          created_at?: string | null
          demand_charge?: number | null
          demand_kw?: number | null
          duration_minutes?: number
          end_time?: string
          energy_charge?: number
          energy_kwh?: number
          id?: string
          line_total?: number
          period_name?: string
          rate_per_kwh?: number
          rate_period_id?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_breakdown_items_billing_calculation_id_fkey"
            columns: ["billing_calculation_id"]
            isOneToOne: false
            referencedRelation: "billing_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_breakdown_items_rate_period_id_fkey"
            columns: ["rate_period_id"]
            isOneToOne: false
            referencedRelation: "rate_periods"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_calculations: {
        Row: {
          breakdown: Json | null
          calculation_date: string | null
          created_at: string | null
          currency: string | null
          fees: number | null
          id: string
          rate_structure_id: string | null
          session_id: string | null
          subtotal: number
          taxes: number | null
          total_amount: number
        }
        Insert: {
          breakdown?: Json | null
          calculation_date?: string | null
          created_at?: string | null
          currency?: string | null
          fees?: number | null
          id?: string
          rate_structure_id?: string | null
          session_id?: string | null
          subtotal: number
          taxes?: number | null
          total_amount: number
        }
        Update: {
          breakdown?: Json | null
          calculation_date?: string | null
          created_at?: string | null
          currency?: string | null
          fees?: number | null
          id?: string
          rate_structure_id?: string | null
          session_id?: string | null
          subtotal?: number
          taxes?: number | null
          total_amount?: number
        }
        Relationships: [
          {
            foreignKeyName: "billing_calculations_rate_structure_id_fkey"
            columns: ["rate_structure_id"]
            isOneToOne: false
            referencedRelation: "rate_structures"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_calculations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      charging_sessions: {
        Row: {
          calculated_cost: number
          card_number: string
          charge_id: string
          co2_reduction_kg: number | null
          connector_number: string | null
          connector_type: string | null
          created_at: string | null
          duration_minutes: number
          duration_text: string | null
          end_date: string
          end_soc_percent: number | null
          end_time: string
          end_ts: string
          energy_consumed_kwh: number
          has_billing_calculation: boolean | null
          id: string
          import_batch_id: string | null
          max_demand_kw: number | null
          notes: string | null
          operator_id: string | null
          shift_id: string | null
          start_date: string
          start_soc_percent: number | null
          start_time: string
          start_ts: string
          station_code: string | null
          station_id: string | null
          transaction_id: string
          updated_at: string | null
          user_identifier: string | null
        }
        Insert: {
          calculated_cost: number
          card_number: string
          charge_id: string
          co2_reduction_kg?: number | null
          connector_number?: string | null
          connector_type?: string | null
          created_at?: string | null
          duration_minutes: number
          duration_text?: string | null
          end_date: string
          end_soc_percent?: number | null
          end_time: string
          end_ts: string
          energy_consumed_kwh: number
          has_billing_calculation?: boolean | null
          id?: string
          import_batch_id?: string | null
          max_demand_kw?: number | null
          notes?: string | null
          operator_id?: string | null
          shift_id?: string | null
          start_date: string
          start_soc_percent?: number | null
          start_time: string
          start_ts: string
          station_code?: string | null
          station_id?: string | null
          transaction_id: string
          updated_at?: string | null
          user_identifier?: string | null
        }
        Update: {
          calculated_cost?: number
          card_number?: string
          charge_id?: string
          co2_reduction_kg?: number | null
          connector_number?: string | null
          connector_type?: string | null
          created_at?: string | null
          duration_minutes?: number
          duration_text?: string | null
          end_date?: string
          end_soc_percent?: number | null
          end_time?: string
          end_ts?: string
          energy_consumed_kwh?: number
          has_billing_calculation?: boolean | null
          id?: string
          import_batch_id?: string | null
          max_demand_kw?: number | null
          notes?: string | null
          operator_id?: string | null
          shift_id?: string | null
          start_date?: string
          start_soc_percent?: number | null
          start_time?: string
          start_ts?: string
          station_code?: string | null
          station_id?: string | null
          transaction_id?: string
          updated_at?: string | null
          user_identifier?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "charging_sessions_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_sessions_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_sessions_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charging_sessions_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_charges: {
        Row: {
          amount: number
          charge_name: string
          charge_type: string
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          station_id: string | null
        }
        Insert: {
          amount: number
          charge_name: string
          charge_type: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          station_id?: string | null
        }
        Update: {
          amount?: number
          charge_name?: string
          charge_type?: string
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fixed_charges_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string | null
          error_log: Json | null
          filename: string
          id: string
          records_failed: number | null
          records_skipped: number | null
          records_success: number | null
          records_total: number | null
          status: string | null
          upload_date: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          error_log?: Json | null
          filename: string
          id?: string
          records_failed?: number | null
          records_skipped?: number | null
          records_success?: number | null
          records_total?: number | null
          status?: string | null
          upload_date?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          error_log?: Json | null
          filename?: string
          id?: string
          records_failed?: number | null
          records_skipped?: number | null
          records_success?: number | null
          records_total?: number | null
          status?: string | null
          upload_date?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      maintenance_log: {
        Row: {
          created_at: string | null
          description: string
          downtime_hours: number | null
          id: string
          issue_date: string
          issue_type: string
          reported_by: string | null
          resolution: string | null
          resolved_date: string | null
          station_id: string
          status: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description: string
          downtime_hours?: number | null
          id?: string
          issue_date?: string
          issue_type?: string
          reported_by?: string | null
          resolution?: string | null
          resolved_date?: string | null
          station_id: string
          status?: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string
          downtime_hours?: number | null
          id?: string
          issue_date?: string
          issue_type?: string
          reported_by?: string | null
          resolution?: string | null
          resolved_date?: string | null
          station_id?: string
          status?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "maintenance_log_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string | null
          id: string
          is_read: boolean
          metadata: Json | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title: string
          type?: string
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string | null
          id?: string
          is_read?: boolean
          metadata?: Json | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: []
      }
      operator_schedules: {
        Row: {
          created_at: string | null
          created_by: string | null
          id: string
          is_day_off: boolean
          notes: string | null
          operator_id: string | null
          schedule_date: string
          shift_duration: string
          shift_type: string
          station_id: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_day_off?: boolean
          notes?: string | null
          operator_id?: string | null
          schedule_date: string
          shift_duration?: string
          shift_type?: string
          station_id?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          id?: string
          is_day_off?: boolean
          notes?: string | null
          operator_id?: string | null
          schedule_date?: string
          shift_duration?: string
          shift_type?: string
          station_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "operator_schedules_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "operator_schedules_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      operators: {
        Row: {
          card_number: string
          created_at: string | null
          email: string | null
          id: string
          id_number: string | null
          name: string
          national_number: string | null
          notes: string | null
          phone_number: string | null
          photo_url: string | null
          status: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          card_number: string
          created_at?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          name: string
          national_number?: string | null
          notes?: string | null
          phone_number?: string | null
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          card_number?: string
          created_at?: string | null
          email?: string | null
          id?: string
          id_number?: string | null
          name?: string
          national_number?: string | null
          notes?: string | null
          phone_number?: string | null
          photo_url?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      rate_periods: {
        Row: {
          created_at: string | null
          days_of_week: string[]
          demand_charge_per_kw: number | null
          end_time: string
          energy_rate_per_kwh: number
          id: string
          period_name: string
          priority: number | null
          rate_structure_id: string | null
          season: string | null
          start_time: string
        }
        Insert: {
          created_at?: string | null
          days_of_week: string[]
          demand_charge_per_kw?: number | null
          end_time: string
          energy_rate_per_kwh: number
          id?: string
          period_name: string
          priority?: number | null
          rate_structure_id?: string | null
          season?: string | null
          start_time: string
        }
        Update: {
          created_at?: string | null
          days_of_week?: string[]
          demand_charge_per_kw?: number | null
          end_time?: string
          energy_rate_per_kwh?: number
          id?: string
          period_name?: string
          priority?: number | null
          rate_structure_id?: string | null
          season?: string | null
          start_time?: string
        }
        Relationships: [
          {
            foreignKeyName: "rate_periods_rate_structure_id_fkey"
            columns: ["rate_structure_id"]
            isOneToOne: false
            referencedRelation: "rate_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_structures: {
        Row: {
          created_at: string | null
          description: string | null
          effective_from: string
          effective_to: string | null
          id: string
          is_active: boolean | null
          name: string
          station_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          effective_from: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          name: string
          station_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          effective_from?: string
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          name?: string
          station_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "rate_structures_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      shifts: {
        Row: {
          bank_deposit_date: string | null
          bank_deposit_reference: string | null
          bank_deposit_slip: string | null
          created_at: string | null
          end_time: string
          handover_status: string | null
          id: string
          import_batch_id: string | null
          notes: string | null
          operator_id: string | null
          shift_date: string
          shift_duration: string
          shift_type: string
          start_time: string
          station_id: string | null
          total_amount_jod: number | null
          total_kwh: number | null
          updated_at: string | null
        }
        Insert: {
          bank_deposit_date?: string | null
          bank_deposit_reference?: string | null
          bank_deposit_slip?: string | null
          created_at?: string | null
          end_time: string
          handover_status?: string | null
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          operator_id?: string | null
          shift_date: string
          shift_duration: string
          shift_type: string
          start_time: string
          station_id?: string | null
          total_amount_jod?: number | null
          total_kwh?: number | null
          updated_at?: string | null
        }
        Update: {
          bank_deposit_date?: string | null
          bank_deposit_reference?: string | null
          bank_deposit_slip?: string | null
          created_at?: string | null
          end_time?: string
          handover_status?: string | null
          id?: string
          import_batch_id?: string | null
          notes?: string | null
          operator_id?: string | null
          shift_date?: string
          shift_duration?: string
          shift_type?: string
          start_time?: string
          station_id?: string | null
          total_amount_jod?: number | null
          total_kwh?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "shifts_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "shifts_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      stations: {
        Row: {
          address: string | null
          capacity_kw: number | null
          created_at: string | null
          id: string
          installation_date: string | null
          location: string | null
          name: string
          notes: string | null
          station_code: string | null
          status: string | null
          updated_at: string | null
          user_id: string | null
        }
        Insert: {
          address?: string | null
          capacity_kw?: number | null
          created_at?: string | null
          id?: string
          installation_date?: string | null
          location?: string | null
          name: string
          notes?: string | null
          station_code?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Update: {
          address?: string | null
          capacity_kw?: number | null
          created_at?: string | null
          id?: string
          installation_date?: string | null
          location?: string | null
          name?: string
          notes?: string | null
          station_code?: string | null
          status?: string | null
          updated_at?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      system_settings: {
        Row: {
          category: string
          id: string
          key: string
          updated_at: string | null
          updated_by: string | null
          value: string
        }
        Insert: {
          category: string
          id?: string
          key: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Update: {
          category?: string
          id?: string
          key?: string
          updated_at?: string | null
          updated_by?: string | null
          value?: string
        }
        Relationships: []
      }
      tax_configurations: {
        Row: {
          applies_to: string | null
          created_at: string | null
          effective_from: string | null
          effective_to: string | null
          id: string
          is_active: boolean | null
          station_id: string | null
          tax_name: string
          tax_rate: number
        }
        Insert: {
          applies_to?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          station_id?: string | null
          tax_name: string
          tax_rate: number
        }
        Update: {
          applies_to?: string | null
          created_at?: string | null
          effective_from?: string | null
          effective_to?: string | null
          id?: string
          is_active?: boolean | null
          station_id?: string | null
          tax_name?: string
          tax_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "tax_configurations_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_profiles: {
        Row: {
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          role: string
          station_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          station_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          role?: string
          station_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      calculate_batch_billing: {
        Args: { p_batch_id: string; p_station_id: string }
        Returns: Json
      }
      delete_import_batch: { Args: { p_batch_id: string }; Returns: Json }
      get_analytics_summary: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_best_time_to_charge: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_charger_type_breakdown: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_co2_impact: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_connector_type_comparison: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_daily_transactions_by_connector: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_energy_trend: {
        Args: { p_end: string; p_group_by: string; p_start: string }
        Returns: Json
      }
      get_revenue_by_station: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_shift_comparison: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_station_utilization: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const

