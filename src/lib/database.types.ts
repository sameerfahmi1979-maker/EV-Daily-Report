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
      a1_rpc_baseline_catalog: {
        Row: {
          capture_note: string
          captured_at: string
          def_md5: string
          function_name: string
          identity_args: string
          result_type: string | null
          security_mode: string | null
        }
        Insert: {
          capture_note: string
          captured_at?: string
          def_md5: string
          function_name: string
          identity_args?: string
          result_type?: string | null
          security_mode?: string | null
        }
        Update: {
          capture_note?: string
          captured_at?: string
          def_md5?: string
          function_name?: string
          identity_args?: string
          result_type?: string | null
          security_mode?: string | null
        }
        Relationships: []
      }
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
          calculation_engine_version: string | null
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
          rate_structure_id: string | null
          start_time: string
        }
        Insert: {
          billing_calculation_id?: string | null
          calculation_engine_version?: string | null
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
          rate_structure_id?: string | null
          start_time: string
        }
        Update: {
          billing_calculation_id?: string | null
          calculation_engine_version?: string | null
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
          rate_structure_id?: string | null
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
          {
            foreignKeyName: "billing_breakdown_items_rate_structure_id_fkey"
            columns: ["rate_structure_id"]
            isOneToOne: false
            referencedRelation: "rate_structures"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_breakdown_items_duplicate_archive: {
        Row: {
          archive_id: string
          archived_at: string
          billing_archive_id: string
          original_billing_calculation_id: string
          original_breakdown_item_id: string | null
          original_row: Json
        }
        Insert: {
          archive_id?: string
          archived_at?: string
          billing_archive_id: string
          original_billing_calculation_id: string
          original_breakdown_item_id?: string | null
          original_row: Json
        }
        Update: {
          archive_id?: string
          archived_at?: string
          billing_archive_id?: string
          original_billing_calculation_id?: string
          original_breakdown_item_id?: string | null
          original_row?: Json
        }
        Relationships: [
          {
            foreignKeyName: "billing_breakdown_items_duplicate_archi_billing_archive_id_fkey"
            columns: ["billing_archive_id"]
            isOneToOne: false
            referencedRelation: "billing_calculations_duplicate_archive"
            referencedColumns: ["archive_id"]
          },
        ]
      }
      billing_calculations: {
        Row: {
          applied_rate_summary: string | null
          billing_source: string | null
          breakdown: Json | null
          calculated_at: string | null
          calculation_date: string | null
          calculation_engine_version: string | null
          calculation_method: string | null
          created_at: string | null
          currency: string | null
          fees: number | null
          id: string
          rate_structure_id: string | null
          recalculated_by: string | null
          recalculation_reason: string | null
          session_id: string
          source_import_batch_id: string | null
          subtotal: number
          taxes: number | null
          total_amount: number
          verification_token: string
        }
        Insert: {
          applied_rate_summary?: string | null
          billing_source?: string | null
          breakdown?: Json | null
          calculated_at?: string | null
          calculation_date?: string | null
          calculation_engine_version?: string | null
          calculation_method?: string | null
          created_at?: string | null
          currency?: string | null
          fees?: number | null
          id?: string
          rate_structure_id?: string | null
          recalculated_by?: string | null
          recalculation_reason?: string | null
          session_id: string
          source_import_batch_id?: string | null
          subtotal: number
          taxes?: number | null
          total_amount: number
          verification_token?: string
        }
        Update: {
          applied_rate_summary?: string | null
          billing_source?: string | null
          breakdown?: Json | null
          calculated_at?: string | null
          calculation_date?: string | null
          calculation_engine_version?: string | null
          calculation_method?: string | null
          created_at?: string | null
          currency?: string | null
          fees?: number | null
          id?: string
          rate_structure_id?: string | null
          recalculated_by?: string | null
          recalculation_reason?: string | null
          session_id?: string
          source_import_batch_id?: string | null
          subtotal?: number
          taxes?: number | null
          total_amount?: number
          verification_token?: string
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
            foreignKeyName: "billing_calculations_recalculated_by_fkey"
            columns: ["recalculated_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_calculations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "charging_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_calculations_source_import_batch_id_fkey"
            columns: ["source_import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_calculations_duplicate_archive: {
        Row: {
          archive_id: string
          archive_reason: string
          archived_at: string
          archived_by: string
          breakdown_items_snapshot: Json
          classification: string
          original_billing_id: string
          original_calculation_date: string | null
          original_created_at: string | null
          original_row: Json
          restore_status: string
          selected_authoritative_billing_id: string | null
          selection_group_id: string
          selection_score: number | null
          session_id: string
          source_environment: string
        }
        Insert: {
          archive_id?: string
          archive_reason: string
          archived_at?: string
          archived_by?: string
          breakdown_items_snapshot?: Json
          classification: string
          original_billing_id: string
          original_calculation_date?: string | null
          original_created_at?: string | null
          original_row: Json
          restore_status?: string
          selected_authoritative_billing_id?: string | null
          selection_group_id: string
          selection_score?: number | null
          session_id: string
          source_environment?: string
        }
        Update: {
          archive_id?: string
          archive_reason?: string
          archived_at?: string
          archived_by?: string
          breakdown_items_snapshot?: Json
          classification?: string
          original_billing_id?: string
          original_calculation_date?: string | null
          original_created_at?: string | null
          original_row?: Json
          restore_status?: string
          selected_authoritative_billing_id?: string | null
          selection_group_id?: string
          selection_score?: number | null
          session_id?: string
          source_environment?: string
        }
        Relationships: []
      }
      billing_duplicate_conflict_report: {
        Row: {
          classification: string
          created_at: string
          details: Json
          discarded_billing_ids: string[]
          id: string
          max_total: number | null
          min_total: number | null
          selected_billing_id: string | null
          selection_group_id: string
          session_id: string
        }
        Insert: {
          classification: string
          created_at?: string
          details?: Json
          discarded_billing_ids: string[]
          id?: string
          max_total?: number | null
          min_total?: number | null
          selected_billing_id?: string | null
          selection_group_id: string
          session_id: string
        }
        Update: {
          classification?: string
          created_at?: string
          details?: Json
          discarded_billing_ids?: string[]
          id?: string
          max_total?: number | null
          min_total?: number | null
          selected_billing_id?: string | null
          selection_group_id?: string
          session_id?: string
        }
        Relationships: []
      }
      cash_handover_adjustments: {
        Row: {
          adjustment_type: string
          amount_jod: number
          approved_at: string | null
          approved_by: string | null
          cash_impact: string
          created_at: string
          evidence_reference: string | null
          handover_id: string
          id: string
          reason: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          requested_by: string | null
          status: string
        }
        Insert: {
          adjustment_type: string
          amount_jod: number
          approved_at?: string | null
          approved_by?: string | null
          cash_impact: string
          created_at?: string
          evidence_reference?: string | null
          handover_id: string
          id?: string
          reason: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
        }
        Update: {
          adjustment_type?: string
          amount_jod?: number
          approved_at?: string | null
          approved_by?: string | null
          cash_impact?: string
          created_at?: string
          evidence_reference?: string | null
          handover_id?: string
          id?: string
          reason?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          requested_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_handover_adjustments_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "cash_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_handover_events: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          details: Json | null
          from_status: string | null
          handover_id: string
          id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          from_status?: string | null
          handover_id: string
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          details?: Json | null
          from_status?: string | null
          handover_id?: string
          id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_handover_events_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "cash_handovers"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_handover_sessions: {
        Row: {
          amount_jod: number
          billing_calculation_id: string | null
          created_at: string
          handover_id: string
          id: string
          payment_allocation_id: string | null
          payment_method: string
          session_id: string
        }
        Insert: {
          amount_jod: number
          billing_calculation_id?: string | null
          created_at?: string
          handover_id: string
          id?: string
          payment_allocation_id?: string | null
          payment_method: string
          session_id: string
        }
        Update: {
          amount_jod?: number
          billing_calculation_id?: string | null
          created_at?: string
          handover_id?: string
          id?: string
          payment_allocation_id?: string | null
          payment_method?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_handover_sessions_handover_id_fkey"
            columns: ["handover_id"]
            isOneToOne: false
            referencedRelation: "cash_handovers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handover_sessions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_handovers: {
        Row: {
          actual_cash_received: number | null
          approved_at: string | null
          approved_by: string | null
          billing_total: number
          card_total: number
          cash_total: number
          cliq_total: number
          created_at: string
          created_by: string | null
          currency: string
          discrepancy_reason: string | null
          expected_cash: number
          handover_number: string
          id: string
          locked_at: string | null
          locked_by: string | null
          net_adjustments: number
          notes: string | null
          operator_id: string
          rejected_at: string | null
          rejected_by: string | null
          rejection_reason: string | null
          reopen_reason: string | null
          reopened_at: string | null
          reopened_by: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          shift_date: string
          shift_id: string | null
          shortage_amount: number
          station_id: string
          status: string
          submitted_at: string | null
          submitted_by: string | null
          surplus_amount: number
          unassigned_count: number
          updated_at: string
          version: number
        }
        Insert: {
          actual_cash_received?: number | null
          approved_at?: string | null
          approved_by?: string | null
          billing_total?: number
          card_total?: number
          cash_total?: number
          cliq_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          discrepancy_reason?: string | null
          expected_cash?: number
          handover_number: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          net_adjustments?: number
          notes?: string | null
          operator_id: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date: string
          shift_id?: string | null
          shortage_amount?: number
          station_id: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          surplus_amount?: number
          unassigned_count?: number
          updated_at?: string
          version?: number
        }
        Update: {
          actual_cash_received?: number | null
          approved_at?: string | null
          approved_by?: string | null
          billing_total?: number
          card_total?: number
          cash_total?: number
          cliq_total?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          discrepancy_reason?: string | null
          expected_cash?: number
          handover_number?: string
          id?: string
          locked_at?: string | null
          locked_by?: string | null
          net_adjustments?: number
          notes?: string | null
          operator_id?: string
          rejected_at?: string | null
          rejected_by?: string | null
          rejection_reason?: string | null
          reopen_reason?: string | null
          reopened_at?: string | null
          reopened_by?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          shift_date?: string
          shift_id?: string | null
          shortage_amount?: number
          station_id?: string
          status?: string
          submitted_at?: string | null
          submitted_by?: string | null
          surplus_amount?: number
          unassigned_count?: number
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "cash_handovers_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_shift_id_fkey"
            columns: ["shift_id"]
            isOneToOne: false
            referencedRelation: "shifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_handovers_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
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
          source_file_hash: string | null
          source_row_number: number | null
          source_transaction_id: string | null
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
          source_file_hash?: string | null
          source_row_number?: number | null
          source_transaction_id?: string | null
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
          source_file_hash?: string | null
          source_row_number?: number | null
          source_transaction_id?: string | null
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
      engine_metadata_repair_log: {
        Row: {
          actor_id: string | null
          applied: boolean
          billing_id: string
          confidence: string
          created_at: string
          id: string
          inference_basis: string
          inferred_engine_version: string
          previous_engine_version: string | null
          reason: string
          session_id: string
        }
        Insert: {
          actor_id?: string | null
          applied?: boolean
          billing_id: string
          confidence: string
          created_at?: string
          id?: string
          inference_basis: string
          inferred_engine_version: string
          previous_engine_version?: string | null
          reason: string
          session_id: string
        }
        Update: {
          actor_id?: string | null
          applied?: boolean
          billing_id?: string
          confidence?: string
          created_at?: string
          id?: string
          inference_basis?: string
          inferred_engine_version?: string
          previous_engine_version?: string | null
          reason?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "engine_metadata_repair_log_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "engine_metadata_repair_log_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
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
      historical_correction_archive: {
        Row: {
          actor_id: string | null
          applied_result: Json | null
          approval_snapshot: Json | null
          archived_event: string
          comparison_snapshot: Json | null
          correction_id: string
          created_at: string
          id: string
          original_billing_calculation: Json | null
          original_breakdown_items: Json | null
          rollback_result: Json | null
          session_id: string
        }
        Insert: {
          actor_id?: string | null
          applied_result?: Json | null
          approval_snapshot?: Json | null
          archived_event: string
          comparison_snapshot?: Json | null
          correction_id: string
          created_at?: string
          id?: string
          original_billing_calculation?: Json | null
          original_breakdown_items?: Json | null
          rollback_result?: Json | null
          session_id: string
        }
        Update: {
          actor_id?: string | null
          applied_result?: Json | null
          approval_snapshot?: Json | null
          archived_event?: string
          comparison_snapshot?: Json | null
          correction_id?: string
          created_at?: string
          id?: string
          original_billing_calculation?: Json | null
          original_breakdown_items?: Json | null
          rollback_result?: Json | null
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_correction_archive_correction_id_fkey"
            columns: ["correction_id"]
            isOneToOne: false
            referencedRelation: "historical_correction_queue"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_correction_queue: {
        Row: {
          applied_at: string | null
          applied_by: string | null
          approved_at: string | null
          approved_by: string | null
          billing_id: string | null
          classification: string
          comparison_snapshot: Json | null
          confidence: string
          created_at: string
          current_amount: number | null
          defer_reason: string | null
          difference: number | null
          evidence: Json
          exception_types: string[]
          failure_reason: string | null
          id: string
          match_tier: string | null
          proposed_action: string
          proposed_amount: number | null
          reason: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          risk: string
          rolled_back_at: string | null
          rolled_back_by: string | null
          session_id: string
          station_id: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
          version: number
        }
        Insert: {
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_id?: string | null
          classification: string
          comparison_snapshot?: Json | null
          confidence?: string
          created_at?: string
          current_amount?: number | null
          defer_reason?: string | null
          difference?: number | null
          evidence?: Json
          exception_types?: string[]
          failure_reason?: string | null
          id?: string
          match_tier?: string | null
          proposed_action: string
          proposed_amount?: number | null
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          session_id: string
          station_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          version?: number
        }
        Update: {
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          billing_id?: string | null
          classification?: string
          comparison_snapshot?: Json | null
          confidence?: string
          created_at?: string
          current_amount?: number | null
          defer_reason?: string | null
          difference?: number | null
          evidence?: Json
          exception_types?: string[]
          failure_reason?: string | null
          id?: string
          match_tier?: string | null
          proposed_action?: string
          proposed_amount?: number | null
          reason?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          risk?: string
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          session_id?: string
          station_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "historical_correction_queue_billing_id_fkey"
            columns: ["billing_id"]
            isOneToOne: false
            referencedRelation: "billing_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_correction_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_correction_queue_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      historical_payment_classification_queue: {
        Row: {
          affected_session_count: number
          affected_total_amount: number | null
          applied_at: string | null
          applied_by: string | null
          approved_at: string | null
          approved_by: string | null
          batch_id: string | null
          confidence: string
          created_at: string
          evidence: Json
          evidence_source: string
          failure_reason: string | null
          id: string
          notes: string | null
          proposed_classification: string
          rejection_reason: string | null
          rolled_back_at: string | null
          rolled_back_by: string | null
          scope: string
          session_id: string | null
          station_id: string | null
          status: string
          submitted_at: string
          submitted_by: string | null
          updated_at: string
        }
        Insert: {
          affected_session_count?: number
          affected_total_amount?: number | null
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          confidence?: string
          created_at?: string
          evidence?: Json
          evidence_source: string
          failure_reason?: string | null
          id?: string
          notes?: string | null
          proposed_classification: string
          rejection_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          scope: string
          session_id?: string | null
          station_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Update: {
          affected_session_count?: number
          affected_total_amount?: number | null
          applied_at?: string | null
          applied_by?: string | null
          approved_at?: string | null
          approved_by?: string | null
          batch_id?: string | null
          confidence?: string
          created_at?: string
          evidence?: Json
          evidence_source?: string
          failure_reason?: string | null
          id?: string
          notes?: string | null
          proposed_classification?: string
          rejection_reason?: string | null
          rolled_back_at?: string | null
          rolled_back_by?: string | null
          scope?: string
          session_id?: string | null
          station_id?: string | null
          status?: string
          submitted_at?: string
          submitted_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "historical_payment_classification_queue_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_payment_classification_queue_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "historical_payment_classification_queue_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          billing_engine_version: string | null
          billing_error_log: Json | null
          billing_status: string | null
          created_at: string | null
          detected_card_id: string | null
          detected_operator_name: string | null
          error_log: Json | null
          failure_reason: string | null
          file_hash: string | null
          file_size_bytes: number | null
          filename: string
          id: string
          normalized_filename: string | null
          operator_match_status: string | null
          parser_version: string | null
          posted_by: string | null
          posting_completed_at: string | null
          posting_started_at: string | null
          records_failed: number | null
          records_skipped: number | null
          records_success: number | null
          records_total: number | null
          selected_operator_id: string | null
          sheet_name: string | null
          station_id: string | null
          status: string | null
          upload_date: string | null
          user_id: string | null
          validation_summary: Json | null
          workflow_version: string | null
        }
        Insert: {
          billing_engine_version?: string | null
          billing_error_log?: Json | null
          billing_status?: string | null
          created_at?: string | null
          detected_card_id?: string | null
          detected_operator_name?: string | null
          error_log?: Json | null
          failure_reason?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          filename: string
          id?: string
          normalized_filename?: string | null
          operator_match_status?: string | null
          parser_version?: string | null
          posted_by?: string | null
          posting_completed_at?: string | null
          posting_started_at?: string | null
          records_failed?: number | null
          records_skipped?: number | null
          records_success?: number | null
          records_total?: number | null
          selected_operator_id?: string | null
          sheet_name?: string | null
          station_id?: string | null
          status?: string | null
          upload_date?: string | null
          user_id?: string | null
          validation_summary?: Json | null
          workflow_version?: string | null
        }
        Update: {
          billing_engine_version?: string | null
          billing_error_log?: Json | null
          billing_status?: string | null
          created_at?: string | null
          detected_card_id?: string | null
          detected_operator_name?: string | null
          error_log?: Json | null
          failure_reason?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          filename?: string
          id?: string
          normalized_filename?: string | null
          operator_match_status?: string | null
          parser_version?: string | null
          posted_by?: string | null
          posting_completed_at?: string | null
          posting_started_at?: string | null
          records_failed?: number | null
          records_skipped?: number | null
          records_success?: number | null
          records_total?: number | null
          selected_operator_id?: string | null
          sheet_name?: string | null
          station_id?: string | null
          status?: string | null
          upload_date?: string | null
          user_id?: string | null
          validation_summary?: Json | null
          workflow_version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_batches_selected_operator_id_fkey"
            columns: ["selected_operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_batches_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
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
      operator_card_history: {
        Row: {
          change_reason: string | null
          changed_by: string | null
          created_at: string
          id: string
          new_card_normalized: string | null
          new_card_number: string | null
          old_card_normalized: string | null
          old_card_number: string | null
          operator_id: string
        }
        Insert: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_card_normalized?: string | null
          new_card_number?: string | null
          old_card_normalized?: string | null
          old_card_number?: string | null
          operator_id: string
        }
        Update: {
          change_reason?: string | null
          changed_by?: string | null
          created_at?: string
          id?: string
          new_card_normalized?: string | null
          new_card_number?: string | null
          old_card_normalized?: string | null
          old_card_number?: string | null
          operator_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "operator_card_history_operator_id_fkey"
            columns: ["operator_id"]
            isOneToOne: false
            referencedRelation: "operators"
            referencedColumns: ["id"]
          },
        ]
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
          card_number_normalized: string | null
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
          card_number_normalized?: string | null
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
          card_number_normalized?: string | null
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
      session_payment_allocations: {
        Row: {
          amount_jod: number
          assigned_at: string
          assigned_by: string | null
          assignment_source: string
          billing_calculation_id: string | null
          created_at: string
          currency: string
          id: string
          is_active: boolean
          notes: string | null
          payment_method: string
          payment_reference: string | null
          session_id: string
          superseded_by: string | null
          updated_at: string
        }
        Insert: {
          amount_jod: number
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string
          billing_calculation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_method: string
          payment_reference?: string | null
          session_id: string
          superseded_by?: string | null
          updated_at?: string
        }
        Update: {
          amount_jod?: number
          assigned_at?: string
          assigned_by?: string | null
          assignment_source?: string
          billing_calculation_id?: string | null
          created_at?: string
          currency?: string
          id?: string
          is_active?: boolean
          notes?: string | null
          payment_method?: string
          payment_reference?: string | null
          session_id?: string
          superseded_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_payment_allocations_billing_calculation_id_fkey"
            columns: ["billing_calculation_id"]
            isOneToOne: false
            referencedRelation: "billing_calculations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_payment_allocations_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "charging_sessions"
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
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          disable_reason: string | null
          disabled_at: string | null
          disabled_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          legacy_role: string | null
          must_change_password: boolean
          phone: string | null
          role: string
          station_id: string | null
          updated_at: string | null
        }
        Insert: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          disable_reason?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          email: string
          full_name?: string
          id: string
          is_active?: boolean | null
          legacy_role?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: string
          station_id?: string | null
          updated_at?: string | null
        }
        Update: {
          approval_status?: string
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string | null
          disable_reason?: string | null
          disabled_at?: string | null
          disabled_by?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean | null
          legacy_role?: string | null
          must_change_password?: boolean
          phone?: string | null
          role?: string
          station_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_profiles_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_disabled_by_fkey"
            columns: ["disabled_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_profiles_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_station_access: {
        Row: {
          access_level: string
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          station_id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          station_id: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          station_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_station_access_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_station_access_station_id_fkey"
            columns: ["station_id"]
            isOneToOne: false
            referencedRelation: "stations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_station_access_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "user_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      a2_assert_can_mutate_station: {
        Args: { p_rpc: string; p_station_id: string }
        Returns: undefined
      }
      a2_assert_can_replace_session_billing: {
        Args: { p_session_id: string }
        Returns: string
      }
      a2_assert_fleet_recalc: { Args: { p_rpc: string }; Returns: undefined }
      admin_force_delete_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      admin_force_delete_shift: { Args: { p_shift_id: string }; Returns: Json }
      apply_batch_default_payment_method: {
        Args: {
          p_batch_id: string
          p_only_unassigned?: boolean
          p_payment_method: string
        }
        Returns: Json
      }
      apply_engine_metadata_repair: {
        Args: { p_billing_id: string; p_reason: string }
        Returns: Json
      }
      apply_historical_correction: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      apply_historical_payment_classification: {
        Args: { p_id: string }
        Returns: Json
      }
      approve_handover: { Args: { p_handover_id: string }; Returns: Json }
      approve_handover_adjustment: {
        Args: { p_adjustment_id: string }
        Returns: Json
      }
      approve_historical_correction: {
        Args: { p_correction_id: string; p_reason?: string }
        Returns: Json
      }
      approve_historical_payment_classification: {
        Args: { p_id: string }
        Returns: Json
      }
      assign_session_payment_method: {
        Args: {
          p_notes?: string
          p_payment_method: string
          p_payment_reference?: string
          p_session_id: string
          p_source?: string
        }
        Returns: Json
      }
      b_amman_at: {
        Args: { p_date: string; p_minutes: number }
        Returns: string
      }
      b_find_period: {
        Args: { p_structure_id: string; p_ts: string }
        Returns: {
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
        SetofOptions: {
          from: "*"
          to: "rate_periods"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      b_find_structure: {
        Args: { p_station_id: string; p_ts: string }
        Returns: string
      }
      b_local_date: { Args: { p_ts: string }; Returns: string }
      b_local_dow: { Args: { p_ts: string }; Returns: string }
      b_local_minutes: { Args: { p_ts: string }; Returns: number }
      b_round_jod3: { Args: { p_value: number }; Returns: number }
      b_time_to_minutes: { Args: { p_time: string }; Returns: number }
      b_validate_rate_structure_coverage: {
        Args: { p_rate_structure_id: string }
        Returns: Json
      }
      calculate_batch_billing: {
        Args: { p_batch_id: string; p_station_id: string }
        Returns: Json
      }
      calculate_batch_billing_v2: {
        Args: { p_batch_id: string; p_station_id: string }
        Returns: Json
      }
      calculate_session_billing_v2: {
        Args: { p_reason?: string; p_session_id: string; p_source?: string }
        Returns: Json
      }
      cancel_unposted_import_batch: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      compare_historical_batch_to_v2: {
        Args: {
          p_end: string
          p_limit?: number
          p_offset?: number
          p_start: string
          p_station_id?: string
        }
        Returns: {
          cannot_compare_reason: string
          current_total: number
          difference: number
          expected_total: number
          match_tier: string
          primary_classification: string
          session_id: string
          transaction_id: string
        }[]
      }
      compare_historical_session_to_v2: {
        Args: { p_session_id: string }
        Returns: Json
      }
      create_handover_adjustment: {
        Args: {
          p_amount: number
          p_cash_impact: string
          p_evidence?: string
          p_handover_id: string
          p_reason: string
        }
        Returns: Json
      }
      create_handover_draft: { Args: { p_shift_id: string }; Returns: Json }
      current_user_can_import: {
        Args: { p_station_id: string }
        Returns: boolean
      }
      current_user_can_manage_tariffs: { Args: never; Returns: boolean }
      current_user_can_manage_users: { Args: never; Returns: boolean }
      current_user_can_recalculate_billing: {
        Args: { p_station_id: string }
        Returns: boolean
      }
      current_user_has_station_access: {
        Args: { p_station_id: string }
        Returns: boolean
      }
      current_user_is_approved: { Args: never; Returns: boolean }
      current_user_is_operations_manager: { Args: never; Returns: boolean }
      current_user_is_system_admin: { Args: never; Returns: boolean }
      current_user_profile: {
        Args: never
        Returns: {
          approval_status: string
          approved_at: string | null
          approved_by: string | null
          created_at: string | null
          disable_reason: string | null
          disabled_at: string | null
          disabled_by: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean | null
          legacy_role: string | null
          phone: string | null
          role: string
          station_id: string | null
          updated_at: string | null
        }
        SetofOptions: {
          from: "*"
          to: "user_profiles"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      current_user_role: { Args: never; Returns: string }
      d_assert_handover_workflow: { Args: never; Returns: undefined }
      d_assert_payment_workflow: { Args: never; Returns: undefined }
      d_current_user_can_settle_handover: {
        Args: { p_station_id: string }
        Returns: boolean
      }
      defer_historical_correction: {
        Args: { p_correction_id: string; p_reason: string }
        Returns: Json
      }
      delete_import_batch: { Args: { p_batch_id: string }; Returns: Json }
      delete_import_batch_cascade: {
        Args: { p_batch_id: string }
        Returns: Json
      }
      f_admin_force_delete_sessions: {
        Args: { p_session_ids: string[] }
        Returns: Json
      }
      f_assert_admin_hard_delete: { Args: never; Returns: undefined }
      f_assert_correction_role: {
        Args: { p_require_approver?: boolean }
        Returns: undefined
      }
      f_assert_flag_enabled: {
        Args: { p_flag_key: string }
        Returns: undefined
      }
      f_classify_historical_session: {
        Args: { p_session_id: string }
        Returns: Json
      }
      f_compute_v2_billing_preview: {
        Args: { p_session_id: string }
        Returns: Json
      }
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
      get_sessions_with_billing_filtered: {
        Args: {
          p_billing_status?: string
          p_end_date?: string
          p_limit?: number
          p_offset?: number
          p_search_term?: string
          p_start_date?: string
          p_station_id?: string
        }
        Returns: Json
      }
      get_shift_comparison: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      get_shifts_paginated: {
        Args: {
          p_date_from?: string
          p_date_to?: string
          p_handover_status?: string
          p_limit?: number
          p_offset?: number
          p_operator_id?: string
          p_search?: string
          p_station_id?: string
        }
        Returns: Json
      }
      get_station_utilization: {
        Args: { p_end: string; p_start: string }
        Returns: Json
      }
      investigate_engine_metadata: {
        Args: { p_billing_id: string }
        Returns: Json
      }
      lock_handover: { Args: { p_handover_id: string }; Returns: Json }
      normalize_operator_card: { Args: { p_card: string }; Returns: string }
      post_import_batch_v2: {
        Args: {
          p_allow_conflict_override?: boolean
          p_allow_filename_warning?: boolean
          p_batch_id: string
          p_file_hash: string
          p_operator_id: string
          p_sessions: Json
          p_station_id: string
        }
        Returns: Json
      }
      propose_historical_payment_classification: {
        Args: {
          p_batch_id: string
          p_classification: string
          p_confidence?: string
          p_evidence: Json
          p_evidence_source: string
          p_notes?: string
          p_scope: string
          p_session_id: string
        }
        Returns: Json
      }
      recalculate_all_shift_totals: { Args: never; Returns: Json }
      recalculate_session_billing_v2: {
        Args: { p_reason: string; p_session_id: string }
        Returns: Json
      }
      recalculate_shift_totals: { Args: { p_shift_id: string }; Returns: Json }
      refresh_handover_totals: {
        Args: { p_handover_id: string }
        Returns: Json
      }
      reject_handover: {
        Args: { p_handover_id: string; p_reason: string }
        Returns: Json
      }
      reject_handover_adjustment: {
        Args: { p_adjustment_id: string; p_reason: string }
        Returns: Json
      }
      reject_historical_correction: {
        Args: { p_correction_id: string; p_reason: string }
        Returns: Json
      }
      reject_historical_payment_classification: {
        Args: { p_id: string; p_reason: string }
        Returns: Json
      }
      reopen_handover: {
        Args: { p_handover_id: string; p_reason: string }
        Returns: Json
      }
      replace_session_billing: {
        Args: {
          p_breakdown?: Json
          p_breakdown_items?: Json
          p_currency?: string
          p_fees: number
          p_rate_structure_id: string
          p_session_id: string
          p_subtotal: number
          p_taxes: number
          p_total_amount: number
        }
        Returns: Json
      }
      report_assert_access: {
        Args: { p_station_id?: string }
        Returns: undefined
      }
      report_assert_date_range: {
        Args: { p_end: string; p_max_days?: number; p_start: string }
        Returns: undefined
      }
      report_billing_reconciliation: {
        Args: {
          p_end: string
          p_engine_version?: string
          p_exception_status?: string
          p_locked?: boolean
          p_page_offset?: number
          p_page_size?: number
          p_payment_method?: string
          p_start: string
          p_station_id?: string
        }
        Returns: {
          billing_source: string
          billing_total: number
          breakdown_sum: number
          demand_charge_sum: number
          difference: number
          engine_version: string
          exception_status: string
          handover_id: string
          handover_locked: boolean
          handover_number: string
          payment_method: string
          session_id: string
          start_ts: string
          station_id: string
          taxes: number
          total_count: number
          transaction_id: string
        }[]
      }
      report_cash_handover_summary: {
        Args: {
          p_end: string
          p_start: string
          p_station_id?: string
          p_status?: string
        }
        Returns: {
          actual_cash_received: number
          approved_at: string
          billing_total: number
          card_total: number
          cash_total: number
          cliq_total: number
          discrepancy_reason: string
          expected_cash: number
          handover_id: string
          handover_number: string
          locked_at: string
          net_adjustments: number
          operator_id: string
          operator_name: string
          reopened_at: string
          shift_date: string
          shift_id: string
          shortage_amount: number
          station_id: string
          station_name: string
          status: string
          submitted_at: string
          surplus_amount: number
          unassigned_count: number
          version: number
        }[]
      }
      report_correction_queue: {
        Args: {
          p_confidence?: string
          p_page_offset?: number
          p_page_size?: number
          p_risk?: string
          p_station_id?: string
          p_status?: string
        }
        Returns: {
          applied_at: string
          approved_at: string
          classification: string
          confidence: string
          current_amount: number
          difference: number
          exception_types: string[]
          id: string
          match_tier: string
          proposed_action: string
          proposed_amount: number
          reason: string
          risk: string
          session_id: string
          station_id: string
          status: string
          submitted_at: string
          total_count: number
          transaction_id: string
        }[]
      }
      report_current_role_is_global: { Args: never; Returns: boolean }
      report_exception_summary: {
        Args: {
          p_end: string
          p_exception_type?: string
          p_page_offset?: number
          p_page_size?: number
          p_start: string
          p_station_id?: string
        }
        Returns: {
          amount: number
          batch_id: string
          detail: string
          exception_type: string
          handover_id: string
          occurred_on: string
          session_id: string
          station_id: string
          total_count: number
          transaction_id: string
        }[]
      }
      report_handover_detail: { Args: { p_handover_id: string }; Returns: Json }
      report_historical_engine_comparison: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          avg_amount: number
          billing_total: number
          engine_label: string
          session_count: number
        }[]
      }
      report_historical_handover_readiness: {
        Args: {
          p_end: string
          p_page_offset?: number
          p_page_size?: number
          p_start: string
          p_station_id?: string
        }
        Returns: {
          billing_total: number
          blockers: string[]
          handover_status: string
          payment_status: string
          readiness: string
          session_id: string
          start_ts: string
          station_id: string
          total_count: number
          transaction_id: string
        }[]
      }
      report_historical_inventory_summary: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: Json
      }
      report_historical_payment_classification_queue: {
        Args: {
          p_page_offset?: number
          p_page_size?: number
          p_station_id?: string
          p_status?: string
        }
        Returns: {
          affected_session_count: number
          affected_total_amount: number
          applied_at: string
          approved_at: string
          batch_id: string
          confidence: string
          evidence_source: string
          id: string
          proposed_classification: string
          scope: string
          session_id: string
          station_id: string
          status: string
          submitted_at: string
          total_count: number
        }[]
      }
      report_import_reconciliation: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          batch_id: string
          billed_count: number
          billing_failed_count: number
          created_at: string
          detected_operator_name: string
          file_hash: string
          filename: string
          operator_match_status: string
          operator_name: string
          posting_completed_at: string
          records_failed: number
          records_skipped: number
          records_success: number
          records_total: number
          station_id: string
          station_name: string
          status: string
        }[]
      }
      report_locked_handover_snapshot: {
        Args: { p_handover_id: string }
        Returns: Json
      }
      report_operator_shift_summary: {
        Args: {
          p_end: string
          p_operator_id?: string
          p_start: string
          p_station_id?: string
        }
        Returns: {
          actual_cash_received: number
          approved_adjustment_total: number
          billing_total: number
          card_total: number
          cash_total: number
          cliq_total: number
          end_time: string
          energy_kwh: number
          expected_cash: number
          handover_id: string
          handover_number: string
          handover_status: string
          handover_version: number
          operational_reconciled: boolean
          operational_total_amount_jod: number
          operator_id: string
          operator_name: string
          session_count: number
          shift_date: string
          shift_id: string
          shortage_amount: number
          start_time: string
          station_id: string
          station_name: string
          surplus_amount: number
          unassigned_total: number
        }[]
      }
      report_payment_method_summary: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          billing_total: number
          card_count: number
          card_total: number
          cash_count: number
          cash_total: number
          cliq_count: number
          cliq_total: number
          session_count: number
          unassigned_count: number
          unassigned_total: number
        }[]
      }
      report_payment_reconciliation: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          billing_total: number
          card_total: number
          cash_total: number
          cliq_total: number
          difference: number
          reconciled: boolean
          report_date: string
          station_id: string
          station_name: string
          unassigned_total: number
        }[]
      }
      report_revenue_summary: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          billing_total: number
          energy_kwh: number
          legacy_count: number
          report_date: string
          session_count: number
          station_id: string
          station_name: string
          unknown_engine_count: number
          v2_count: number
        }[]
      }
      report_shift_totals_reconciliation: {
        Args: { p_shift_id: string }
        Returns: Json
      }
      report_station_daily_summary: {
        Args: { p_end: string; p_start: string; p_station_id?: string }
        Returns: {
          actual_cash: number
          billing_total: number
          card_total: number
          cash_total: number
          cliq_total: number
          energy_kwh: number
          expected_cash: number
          handover_count: number
          locked_handover_count: number
          report_date: string
          session_count: number
          shortage: number
          station_id: string
          station_name: string
          surplus: number
          unassigned_total: number
        }[]
      }
      resolve_operator_match_status: {
        Args: {
          p_detected_card: string
          p_detected_operator_name: string
          p_selected_operator_id: string
        }
        Returns: string
      }
      review_historical_correction: {
        Args: { p_correction_id: string }
        Returns: Json
      }
      rollback_historical_correction: {
        Args: { p_correction_id: string; p_reason: string }
        Returns: Json
      }
      rollback_historical_payment_classification: {
        Args: { p_id: string; p_reason: string }
        Returns: Json
      }
      round_jod3: { Args: { p: number }; Returns: number }
      self_mark_password_changed: { Args: never; Returns: Json }
      session_in_locked_handover: {
        Args: { p_session_id: string }
        Returns: boolean
      }
      set_handover_manual_totals: {
        Args: {
          p_card: number
          p_cash: number
          p_cliq: number
          p_handover_id: string
          p_note?: string
        }
        Returns: Json
      }
      submit_handover: { Args: { p_handover_id: string }; Returns: Json }
      submit_historical_correction: {
        Args: {
          p_evidence?: Json
          p_proposed_action: string
          p_reason: string
          p_session_id: string
        }
        Returns: Json
      }
      verify_invoice_public: { Args: { p_token: string }; Returns: Json }
      turbo_bulk_calculate_billing: {
        Args: { p_recalculate?: boolean; p_session_ids: string[] }
        Returns: Json
      }
      turbo_calculate_all_pending: {
        Args: { p_batch_size?: number; p_station_id?: string }
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
