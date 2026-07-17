-- Sanitized schema baseline for EV-Daily-Report staging
-- Source: production public schema snapshot (schema-only, no data)
-- Generated for Option B bootstrap. Do not apply to production.

CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

SET search_path TO public, extensions;
CREATE TABLE IF NOT EXISTS public.a1_rpc_baseline_catalog (function_name text NOT NULL, identity_args text NOT NULL DEFAULT ''::text, result_type text, security_mode text, def_md5 text NOT NULL, captured_at timestamp with time zone NOT NULL DEFAULT now(), capture_note text NOT NULL);

CREATE TABLE IF NOT EXISTS public.audit_log (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, action text NOT NULL, entity_type text NOT NULL, entity_id uuid, details jsonb DEFAULT '{}'::jsonb, ip_address text, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billing_breakdown_items (id uuid NOT NULL DEFAULT gen_random_uuid(), billing_calculation_id uuid, rate_period_id uuid, period_name text NOT NULL, start_time timestamp with time zone NOT NULL, end_time timestamp with time zone NOT NULL, duration_minutes numeric NOT NULL, energy_kwh numeric NOT NULL, rate_per_kwh numeric NOT NULL, demand_kw numeric, demand_charge numeric DEFAULT 0, energy_charge numeric NOT NULL, line_total numeric NOT NULL, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billing_breakdown_items_duplicate_archive (archive_id uuid NOT NULL DEFAULT gen_random_uuid(), billing_archive_id uuid NOT NULL, original_breakdown_item_id uuid, original_billing_calculation_id uuid NOT NULL, original_row jsonb NOT NULL, archived_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billing_calculations (id uuid NOT NULL DEFAULT gen_random_uuid(), session_id uuid NOT NULL, rate_structure_id uuid, calculation_date timestamp with time zone DEFAULT now(), breakdown jsonb, subtotal numeric NOT NULL, taxes numeric DEFAULT 0, fees numeric DEFAULT 0, total_amount numeric NOT NULL, currency text DEFAULT 'JOD'::text, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billing_calculations_duplicate_archive (archive_id uuid NOT NULL DEFAULT gen_random_uuid(), original_billing_id uuid NOT NULL, session_id uuid NOT NULL, selection_group_id uuid NOT NULL, selected_authoritative_billing_id uuid, archive_reason text NOT NULL, classification text NOT NULL, selection_score integer, original_row jsonb NOT NULL, breakdown_items_snapshot jsonb NOT NULL DEFAULT '[]'::jsonb, original_calculation_date timestamp with time zone, original_created_at timestamp with time zone, archived_at timestamp with time zone NOT NULL DEFAULT now(), archived_by text NOT NULL DEFAULT 'migration:a1_archive_dedupe_billing_and_unique_session_v2'::text, source_environment text NOT NULL DEFAULT 'qflxupfeyktdrpilctyo'::text, restore_status text NOT NULL DEFAULT 'archived'::text);

CREATE TABLE IF NOT EXISTS public.billing_duplicate_conflict_report (id uuid NOT NULL DEFAULT gen_random_uuid(), session_id uuid NOT NULL, selection_group_id uuid NOT NULL, classification text NOT NULL, selected_billing_id uuid, discarded_billing_ids uuid[] NOT NULL, min_total numeric, max_total numeric, details jsonb NOT NULL DEFAULT '{}'::jsonb, created_at timestamp with time zone NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.charging_sessions (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, transaction_id text NOT NULL, charge_id text NOT NULL, card_number text NOT NULL, start_date date NOT NULL, start_time time without time zone NOT NULL, start_ts timestamp with time zone NOT NULL, end_date date NOT NULL, end_time time without time zone NOT NULL, end_ts timestamp with time zone NOT NULL, duration_minutes integer NOT NULL, energy_consumed_kwh numeric NOT NULL, calculated_cost numeric NOT NULL, max_demand_kw numeric, station_code text, user_identifier text, import_batch_id uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now(), connector_number text, connector_type text, duration_text text, co2_reduction_kg numeric, start_soc_percent numeric, end_soc_percent numeric, has_billing_calculation boolean DEFAULT false, shift_id uuid, operator_id uuid, notes text);

CREATE TABLE IF NOT EXISTS public.fixed_charges (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, charge_name text NOT NULL, charge_type text NOT NULL, amount numeric NOT NULL, effective_from date, effective_to date, is_active boolean DEFAULT true, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.import_batches (id uuid NOT NULL DEFAULT gen_random_uuid(), filename text NOT NULL, upload_date timestamp with time zone DEFAULT now(), records_total integer DEFAULT 0, records_success integer DEFAULT 0, records_failed integer DEFAULT 0, status text DEFAULT 'processing'::text, error_log jsonb, user_id uuid, created_at timestamp with time zone DEFAULT now(), records_skipped integer DEFAULT 0);

CREATE TABLE IF NOT EXISTS public.maintenance_log (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid NOT NULL, reported_by uuid, issue_date date NOT NULL DEFAULT CURRENT_DATE, issue_type text NOT NULL DEFAULT 'maintenance'::text, description text NOT NULL, resolution text, downtime_hours numeric(8,2) DEFAULT 0, status text NOT NULL DEFAULT 'open'::text, resolved_date date, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.notifications (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid, type text NOT NULL DEFAULT 'info'::text, title text NOT NULL, body text, is_read boolean NOT NULL DEFAULT false, metadata jsonb DEFAULT '{}'::jsonb, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.operator_schedules (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, operator_id uuid, schedule_date date NOT NULL, shift_duration text NOT NULL DEFAULT '12h'::text, shift_type text NOT NULL DEFAULT 'morning'::text, is_day_off boolean NOT NULL DEFAULT false, notes text, created_by uuid, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.operators (id uuid NOT NULL DEFAULT gen_random_uuid(), user_id uuid NOT NULL, name text NOT NULL, photo_url text, phone_number text, id_number text, national_number text, card_number text NOT NULL, email text, status text DEFAULT 'active'::text, notes text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.rate_periods (id uuid NOT NULL DEFAULT gen_random_uuid(), rate_structure_id uuid, period_name text NOT NULL, start_time time without time zone NOT NULL, end_time time without time zone NOT NULL, days_of_week text[] NOT NULL, season text DEFAULT 'all'::text, energy_rate_per_kwh numeric NOT NULL, demand_charge_per_kw numeric DEFAULT 0, priority integer DEFAULT 1, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.rate_structures (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, name text NOT NULL, description text, effective_from date NOT NULL, effective_to date, is_active boolean DEFAULT true, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.shifts (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, operator_id uuid, shift_duration text NOT NULL, shift_type text NOT NULL, shift_date date NOT NULL, start_time timestamp with time zone NOT NULL, end_time timestamp with time zone NOT NULL, import_batch_id uuid, total_kwh numeric DEFAULT 0, total_amount_jod numeric(12,3) DEFAULT 0, handover_status text DEFAULT 'pending'::text, bank_deposit_slip text, bank_deposit_date date, bank_deposit_reference text, notes text, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.stations (id uuid NOT NULL DEFAULT gen_random_uuid(), name text NOT NULL, location text, address text, capacity_kw numeric, station_code text, status text DEFAULT 'active'::text, installation_date date, notes text, user_id uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.system_settings (id uuid NOT NULL DEFAULT gen_random_uuid(), key text NOT NULL, value text NOT NULL DEFAULT ''::text, category text NOT NULL, updated_by uuid, updated_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.tax_configurations (id uuid NOT NULL DEFAULT gen_random_uuid(), station_id uuid, tax_name text NOT NULL, tax_rate numeric NOT NULL, applies_to text DEFAULT 'all'::text, effective_from date, effective_to date, is_active boolean DEFAULT false, created_at timestamp with time zone DEFAULT now());

CREATE TABLE IF NOT EXISTS public.user_profiles (id uuid NOT NULL, email text NOT NULL, full_name text NOT NULL DEFAULT ''::text, role text NOT NULL DEFAULT 'station_manager'::text, phone text, is_active boolean DEFAULT true, station_id uuid, created_at timestamp with time zone DEFAULT now(), updated_at timestamp with time zone DEFAULT now());

ALTER TABLE ONLY public.a1_rpc_baseline_catalog ADD CONSTRAINT a1_rpc_baseline_catalog_pkey PRIMARY KEY (function_name, identity_args);

ALTER TABLE ONLY public.audit_log ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_breakdown_items ADD CONSTRAINT billing_breakdown_items_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_breakdown_items_duplicate_archive ADD CONSTRAINT billing_breakdown_items_duplicate_archive_pkey PRIMARY KEY (archive_id);

ALTER TABLE ONLY public.billing_calculations ADD CONSTRAINT billing_calculations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_calculations_duplicate_archive ADD CONSTRAINT billing_calculations_duplicate_archive_pkey PRIMARY KEY (archive_id);

ALTER TABLE ONLY public.billing_duplicate_conflict_report ADD CONSTRAINT billing_duplicate_conflict_report_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.fixed_charges ADD CONSTRAINT fixed_charges_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.import_batches ADD CONSTRAINT import_batches_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.maintenance_log ADD CONSTRAINT maintenance_log_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.operators ADD CONSTRAINT operators_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rate_periods ADD CONSTRAINT rate_periods_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.rate_structures ADD CONSTRAINT rate_structures_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.stations ADD CONSTRAINT stations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.system_settings ADD CONSTRAINT system_settings_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.tax_configurations ADD CONSTRAINT tax_configurations_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_pkey PRIMARY KEY (id);

ALTER TABLE ONLY public.billing_calculations ADD CONSTRAINT billing_calculations_one_per_session_key UNIQUE (session_id);

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_transaction_id_key UNIQUE (transaction_id);

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_station_id_operator_id_schedule_date_key UNIQUE (station_id, operator_id, schedule_date);

ALTER TABLE ONLY public.operators ADD CONSTRAINT operators_user_card_unique UNIQUE (user_id, card_number);

ALTER TABLE ONLY public.stations ADD CONSTRAINT stations_station_code_key UNIQUE (station_code);

ALTER TABLE ONLY public.system_settings ADD CONSTRAINT system_settings_key_key UNIQUE (key);

ALTER TABLE ONLY public.billing_calculations_duplicate_archive ADD CONSTRAINT billing_calculations_duplicate_archive_restore_status_check CHECK (restore_status = ANY (ARRAY['archived'::text, 'restored'::text, 'manual_review'::text]));

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT check_co2_non_negative CHECK (co2_reduction_kg IS NULL OR co2_reduction_kg >= 0::numeric);

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT check_end_soc_range CHECK (end_soc_percent IS NULL OR end_soc_percent >= 0::numeric AND end_soc_percent <= 100::numeric);

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT check_start_soc_range CHECK (start_soc_percent IS NULL OR start_soc_percent >= 0::numeric AND start_soc_percent <= 100::numeric);

ALTER TABLE ONLY public.maintenance_log ADD CONSTRAINT maintenance_log_issue_type_check CHECK (issue_type = ANY (ARRAY['maintenance'::text, 'breakdown'::text, 'software'::text, 'power_outage'::text, 'other'::text]));

ALTER TABLE ONLY public.maintenance_log ADD CONSTRAINT maintenance_log_status_check CHECK (status = ANY (ARRAY['open'::text, 'in_progress'::text, 'resolved'::text]));

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_type_check CHECK (type = ANY (ARRAY['upload'::text, 'deposit_pending'::text, 'billing'::text, 'deletion'::text, 'anomaly'::text, 'info'::text]));

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_shift_duration_check CHECK (shift_duration = ANY (ARRAY['8h'::text, '12h'::text]));

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_shift_type_check CHECK (shift_type = ANY (ARRAY['morning'::text, 'evening'::text, 'night'::text, 'extended_day'::text, 'extended_night'::text]));

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_handover_status_check CHECK (handover_status = ANY (ARRAY['pending'::text, 'printed'::text, 'deposited'::text, 'handed_over'::text]));

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_shift_duration_check CHECK (shift_duration = ANY (ARRAY['8h'::text, '12h'::text]));

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_shift_type_check CHECK (shift_type = ANY (ARRAY['morning'::text, 'evening'::text, 'night'::text, 'extended_day'::text, 'extended_night'::text]));

ALTER TABLE ONLY public.system_settings ADD CONSTRAINT system_settings_category_check CHECK (category = ANY (ARRAY['branding'::text, 'station_defaults'::text, 'pdf_layout'::text]));

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_role_check CHECK (role = ANY (ARRAY['global_admin'::text, 'company_manager'::text, 'station_manager'::text, 'accountant'::text]));

ALTER TABLE ONLY public.audit_log ADD CONSTRAINT audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_breakdown_items ADD CONSTRAINT billing_breakdown_items_billing_calculation_id_fkey FOREIGN KEY (billing_calculation_id) REFERENCES billing_calculations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.billing_breakdown_items ADD CONSTRAINT billing_breakdown_items_rate_period_id_fkey FOREIGN KEY (rate_period_id) REFERENCES rate_periods(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_breakdown_items_duplicate_archive ADD CONSTRAINT billing_breakdown_items_duplicate_archi_billing_archive_id_fkey FOREIGN KEY (billing_archive_id) REFERENCES billing_calculations_duplicate_archive(archive_id) ON DELETE CASCADE;

ALTER TABLE ONLY public.billing_calculations ADD CONSTRAINT billing_calculations_rate_structure_id_fkey FOREIGN KEY (rate_structure_id) REFERENCES rate_structures(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.billing_calculations ADD CONSTRAINT billing_calculations_session_id_fkey FOREIGN KEY (session_id) REFERENCES charging_sessions(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_shift_id_fkey FOREIGN KEY (shift_id) REFERENCES shifts(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.charging_sessions ADD CONSTRAINT charging_sessions_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.fixed_charges ADD CONSTRAINT fixed_charges_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.import_batches ADD CONSTRAINT import_batches_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.maintenance_log ADD CONSTRAINT maintenance_log_reported_by_fkey FOREIGN KEY (reported_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.maintenance_log ADD CONSTRAINT maintenance_log_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.notifications ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.operator_schedules ADD CONSTRAINT operator_schedules_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.operators ADD CONSTRAINT operators_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rate_periods ADD CONSTRAINT rate_periods_rate_structure_id_fkey FOREIGN KEY (rate_structure_id) REFERENCES rate_structures(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.rate_structures ADD CONSTRAINT rate_structures_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_import_batch_id_fkey FOREIGN KEY (import_batch_id) REFERENCES import_batches(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_operator_id_fkey FOREIGN KEY (operator_id) REFERENCES operators(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.shifts ADD CONSTRAINT shifts_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.stations ADD CONSTRAINT stations_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.system_settings ADD CONSTRAINT system_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id) ON DELETE SET NULL;

ALTER TABLE ONLY public.tax_configurations ADD CONSTRAINT tax_configurations_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE ONLY public.user_profiles ADD CONSTRAINT user_profiles_station_id_fkey FOREIGN KEY (station_id) REFERENCES stations(id) ON DELETE SET NULL;

CREATE INDEX idx_audit_log_action ON public.audit_log USING btree (action);

CREATE INDEX idx_audit_log_created_at ON public.audit_log USING btree (created_at DESC);

CREATE INDEX idx_audit_log_user_id ON public.audit_log USING btree (user_id);

CREATE INDEX idx_billing_calcs_session_id ON public.billing_calculations USING btree (session_id);

CREATE INDEX idx_billing_calculations_calculation_date ON public.billing_calculations USING btree (calculation_date);

CREATE INDEX idx_billing_calculations_rate_structure_id ON public.billing_calculations USING btree (rate_structure_id);

CREATE INDEX idx_billing_calculations_session_id ON public.billing_calculations USING btree (session_id);

CREATE INDEX idx_billing_dup_archive_group ON public.billing_calculations_duplicate_archive USING btree (selection_group_id);

CREATE INDEX idx_billing_dup_archive_original ON public.billing_calculations_duplicate_archive USING btree (original_billing_id);

CREATE INDEX idx_billing_dup_archive_session ON public.billing_calculations_duplicate_archive USING btree (session_id);

CREATE INDEX idx_breakdown_items_billing_id ON public.billing_breakdown_items USING btree (billing_calculation_id);

CREATE INDEX idx_breakdown_items_period_id ON public.billing_breakdown_items USING btree (rate_period_id);

CREATE INDEX idx_charging_sessions_batch_id ON public.charging_sessions USING btree (import_batch_id);

CREATE INDEX idx_charging_sessions_charge_id ON public.charging_sessions USING btree (charge_id);

CREATE INDEX idx_charging_sessions_created_at ON public.charging_sessions USING btree (created_at);

CREATE INDEX idx_charging_sessions_dates ON public.charging_sessions USING btree (start_date, end_date);

CREATE INDEX idx_charging_sessions_start_date ON public.charging_sessions USING btree (start_date);

CREATE INDEX idx_charging_sessions_start_ts ON public.charging_sessions USING btree (start_ts);

CREATE INDEX idx_charging_sessions_station_id ON public.charging_sessions USING btree (station_id);

CREATE INDEX idx_charging_sessions_transaction_id ON public.charging_sessions USING btree (transaction_id);

CREATE INDEX idx_fixed_charges_active ON public.fixed_charges USING btree (is_active);

CREATE INDEX idx_fixed_charges_dates ON public.fixed_charges USING btree (effective_from, effective_to);

CREATE INDEX idx_fixed_charges_station_id ON public.fixed_charges USING btree (station_id);

CREATE INDEX idx_import_batches_status ON public.import_batches USING btree (status);

CREATE INDEX idx_import_batches_upload_date ON public.import_batches USING btree (upload_date);

CREATE INDEX idx_import_batches_user_id ON public.import_batches USING btree (user_id);

CREATE INDEX idx_maintenance_log_date ON public.maintenance_log USING btree (issue_date DESC);

CREATE INDEX idx_maintenance_log_station ON public.maintenance_log USING btree (station_id);

CREATE INDEX idx_maintenance_log_status ON public.maintenance_log USING btree (status);

CREATE INDEX idx_notifications_created ON public.notifications USING btree (created_at DESC);

CREATE INDEX idx_notifications_user ON public.notifications USING btree (user_id, is_read);

CREATE INDEX idx_operators_card_number ON public.operators USING btree (card_number);

CREATE INDEX idx_operators_name ON public.operators USING btree (name);

CREATE INDEX idx_operators_user_id ON public.operators USING btree (user_id);

CREATE INDEX idx_rate_periods_structure_id ON public.rate_periods USING btree (rate_structure_id);

CREATE INDEX idx_rate_periods_times ON public.rate_periods USING btree (start_time, end_time);

CREATE INDEX idx_rate_structures_active ON public.rate_structures USING btree (is_active);

CREATE INDEX idx_rate_structures_dates ON public.rate_structures USING btree (effective_from, effective_to);

CREATE INDEX idx_rate_structures_station_id ON public.rate_structures USING btree (station_id);

CREATE INDEX idx_schedules_date ON public.operator_schedules USING btree (schedule_date);

CREATE INDEX idx_schedules_station ON public.operator_schedules USING btree (station_id, schedule_date);

CREATE INDEX idx_sessions_has_billing ON public.charging_sessions USING btree (has_billing_calculation);

CREATE INDEX idx_sessions_operator ON public.charging_sessions USING btree (operator_id);

CREATE INDEX idx_sessions_shift ON public.charging_sessions USING btree (shift_id);

CREATE INDEX idx_shifts_batch ON public.shifts USING btree (import_batch_id);

CREATE INDEX idx_shifts_operator ON public.shifts USING btree (operator_id);

CREATE INDEX idx_shifts_station_date ON public.shifts USING btree (station_id, shift_date);

CREATE INDEX idx_stations_station_code ON public.stations USING btree (station_code);

CREATE INDEX idx_stations_status ON public.stations USING btree (status);

CREATE INDEX idx_stations_user_id ON public.stations USING btree (user_id);

CREATE INDEX idx_tax_configurations_active ON public.tax_configurations USING btree (is_active);

CREATE INDEX idx_tax_configurations_station_id ON public.tax_configurations USING btree (station_id);

CREATE INDEX idx_user_profiles_role ON public.user_profiles USING btree (role);

CREATE INDEX idx_user_profiles_station ON public.user_profiles USING btree (station_id);

CREATE OR REPLACE FUNCTION public.calculate_batch_billing(p_batch_id uuid, p_station_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_rate_structure rate_structures%ROWTYPE;
    v_session charging_sessions%ROWTYPE;
    v_period rate_periods%ROWTYPE;
    v_total_kwh NUMERIC := 0;
    v_total_amount NUMERIC := 0;
    v_sessions_processed INT := 0;
    v_sessions_skipped INT := 0;
    v_fallback_rate NUMERIC := 0.150;
    v_fixed_charges_total NUMERIC := 0;
    v_session_cost NUMERIC;
    v_energy_kwh NUMERIC;
    v_session_start TIMESTAMPTZ;
    v_session_end TIMESTAMPTZ;
    v_segment_start TIMESTAMPTZ;
    v_segment_end TIMESTAMPTZ;
    v_segment_duration NUMERIC;
    v_segment_energy NUMERIC;
    v_total_duration NUMERIC;
    v_energy_charge NUMERIC;
    v_demand_charge NUMERIC;
    v_max_demand NUMERIC;
    v_billing_id UUID;
    v_subtotal NUMERIC;
    v_existing_calc UUID;
    v_has_rate BOOLEAN := false;
    v_day_name TEXT;
BEGIN
    -- 1. Get active rate structure for this station (ONCE)
    SELECT * INTO v_rate_structure
    FROM rate_structures
    WHERE station_id = p_station_id
      AND is_active = true
    ORDER BY effective_from DESC
    LIMIT 1;

    IF FOUND THEN
        v_has_rate := true;
    END IF;

    -- 2. Get fixed charges total (ONCE)
    SELECT COALESCE(SUM(amount), 0) INTO v_fixed_charges_total
    FROM fixed_charges
    WHERE station_id = p_station_id
      AND is_active = true;

    -- 3. Process each session in the batch
    FOR v_session IN
        SELECT *
        FROM charging_sessions
        WHERE import_batch_id = p_batch_id
        ORDER BY start_ts ASC
    LOOP
        -- Skip if billing already exists
        SELECT id INTO v_existing_calc
        FROM billing_calculations
        WHERE session_id = v_session.id
        LIMIT 1;

        IF v_existing_calc IS NOT NULL THEN
            v_sessions_skipped := v_sessions_skipped + 1;
            CONTINUE;
        END IF;

        v_energy_kwh := v_session.energy_consumed_kwh;
        v_session_start := v_session.start_ts;
        v_session_end := v_session.end_ts;
        v_max_demand := COALESCE(v_session.max_demand_kw, 0);
        v_session_cost := 0;

        v_total_duration := EXTRACT(EPOCH FROM (v_session_end - v_session_start)) / 60;
        IF v_total_duration <= 0 THEN
            v_total_duration := 1;
        END IF;

        IF NOT v_has_rate THEN
            -- Fallback flat rate
            v_session_cost := v_energy_kwh * v_fallback_rate;
            v_subtotal := v_session_cost;

            INSERT INTO billing_calculations (
                session_id, rate_structure_id, subtotal, taxes, fees,
                total_amount, currency, breakdown
            ) VALUES (
                v_session.id, NULL, v_subtotal, 0, 0,
                v_subtotal, 'JOD',
                jsonb_build_object(
                    'periodCharges', jsonb_build_array(
                        jsonb_build_object(
                            'periodName', 'Flat Rate',
                            'energy', v_energy_kwh,
                            'ratePerKwh', v_fallback_rate,
                            'energyCharge', v_session_cost,
                            'lineTotal', v_session_cost
                        )
                    ),
                    'subtotal', v_subtotal,
                    'fixedCharges', 0,
                    'taxes', 0,
                    'total', v_subtotal
                )
            ) RETURNING id INTO v_billing_id;

            INSERT INTO billing_breakdown_items (
                billing_calculation_id, period_name,
                start_time, end_time, duration_minutes,
                energy_kwh, rate_per_kwh, demand_kw,
                demand_charge, energy_charge, line_total
            ) VALUES (
                v_billing_id, 'Flat Rate',
                v_session_start, v_session_end, v_total_duration,
                v_energy_kwh, v_fallback_rate, v_max_demand,
                0, v_session_cost, v_session_cost
            );
        ELSE
            -- TOU billing with rate periods
            INSERT INTO billing_calculations (
                session_id, rate_structure_id, subtotal, taxes, fees,
                total_amount, currency
            ) VALUES (
                v_session.id, v_rate_structure.id, 0, 0, v_fixed_charges_total,
                0, 'JOD'
            ) RETURNING id INTO v_billing_id;

            v_segment_start := v_session_start;

            WHILE v_segment_start < v_session_end LOOP
                -- Get day name (trimmed and lowercased)
                v_day_name := LOWER(TRIM(TO_CHAR(v_segment_start, 'day')));

                -- Find applicable rate period
                SELECT rp.* INTO v_period
                FROM rate_periods rp
                WHERE rp.rate_structure_id = v_rate_structure.id
                  AND (rp.season = 'all' OR rp.season = (
                      CASE
                          WHEN EXTRACT(MONTH FROM v_segment_start) IN (6,7,8,9) THEN 'summer'
                          WHEN EXTRACT(MONTH FROM v_segment_start) IN (12,1,2) THEN 'winter'
                          WHEN EXTRACT(MONTH FROM v_segment_start) IN (3,4,5) THEN 'spring'
                          ELSE 'fall'
                      END
                  ))
                  AND v_day_name = ANY(rp.days_of_week)
                ORDER BY rp.priority DESC
                LIMIT 1;

                IF v_period IS NULL THEN
                    -- Fallback: use first period
                    SELECT rp.* INTO v_period
                    FROM rate_periods rp
                    WHERE rp.rate_structure_id = v_rate_structure.id
                    ORDER BY rp.priority DESC
                    LIMIT 1;
                END IF;

                IF v_period IS NULL THEN
                    -- No periods at all, jump to end
                    v_segment_start := v_session_end;
                    CONTINUE;
                END IF;

                -- Calculate segment end
                v_segment_end := (v_segment_start::date + v_period.end_time)::timestamptz;

                IF v_period.end_time <= v_period.start_time THEN
                    v_segment_end := (v_segment_start::date + INTERVAL '1 day' + v_period.end_time)::timestamptz;
                END IF;

                IF v_period.end_time = '00:00:00'::time THEN
                    v_segment_end := (v_segment_start::date + INTERVAL '1 day')::timestamptz;
                END IF;

                IF v_segment_end > v_session_end THEN
                    v_segment_end := v_session_end;
                END IF;

                IF v_segment_end <= v_segment_start THEN
                    v_segment_end := v_session_end;
                END IF;

                v_segment_duration := EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 60;

                IF v_segment_duration > 0 THEN
                    v_segment_energy := v_energy_kwh * (v_segment_duration / v_total_duration);
                    v_energy_charge := v_segment_energy * v_period.energy_rate_per_kwh;
                    v_demand_charge := v_max_demand * COALESCE(v_period.demand_charge_per_kw, 0);
                    v_session_cost := v_session_cost + v_energy_charge + v_demand_charge;

                    INSERT INTO billing_breakdown_items (
                        billing_calculation_id, rate_period_id, period_name,
                        start_time, end_time, duration_minutes,
                        energy_kwh, rate_per_kwh, demand_kw,
                        demand_charge, energy_charge, line_total
                    ) VALUES (
                        v_billing_id, v_period.id, v_period.period_name,
                        v_segment_start, v_segment_end, v_segment_duration,
                        v_segment_energy, v_period.energy_rate_per_kwh, v_max_demand,
                        v_demand_charge, v_energy_charge, v_energy_charge + v_demand_charge
                    );
                END IF;

                v_segment_start := v_segment_end;
            END LOOP;

            -- Update billing with totals
            v_subtotal := v_session_cost + v_fixed_charges_total;
            UPDATE billing_calculations
            SET subtotal = v_subtotal,
                fees = v_fixed_charges_total,
                total_amount = v_subtotal,
                breakdown = jsonb_build_object(
                    'subtotal', v_subtotal,
                    'fixedCharges', v_fixed_charges_total,
                    'taxes', 0,
                    'total', v_subtotal
                )
            WHERE id = v_billing_id;
        END IF;

        -- Update session with cost and billing flag
        UPDATE charging_sessions
        SET has_billing_calculation = true,
            calculated_cost = COALESCE(v_subtotal, v_session_cost)
        WHERE id = v_session.id;

        v_total_kwh := v_total_kwh + v_energy_kwh;
        v_total_amount := v_total_amount + COALESCE(v_subtotal, v_session_cost);
        v_sessions_processed := v_sessions_processed + 1;
    END LOOP;

    RETURN jsonb_build_object(
        'total_kwh', v_total_kwh,
        'total_amount', v_total_amount,
        'sessions_processed', v_sessions_processed,
        'sessions_skipped', v_sessions_skipped,
        'rate_structure_found', v_has_rate,
        'fixed_charges_total', v_fixed_charges_total
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.calculate_session_duration()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
IF NEW.start_ts IS NOT NULL AND NEW.end_ts IS NOT NULL THEN
NEW.duration_minutes = EXTRACT(EPOCH FROM (NEW.end_ts - NEW.start_ts)) / 60;
END IF;
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_import_batch(p_batch_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
    v_session_ids UUID[];
    v_billing_ids UUID[];
    v_deleted_sessions INT := 0;
    v_deleted_billings INT := 0;
    v_deleted_breakdowns INT := 0;
    v_batch_name TEXT;
BEGIN
    -- Get batch info
    SELECT filename INTO v_batch_name
    FROM import_batches
    WHERE id = p_batch_id;

    IF v_batch_name IS NULL THEN
        RAISE EXCEPTION 'Import batch % not found', p_batch_id;
    END IF;

    -- Get all session IDs for this batch
    SELECT ARRAY_AGG(id) INTO v_session_ids
    FROM charging_sessions
    WHERE import_batch_id = p_batch_id;

    IF v_session_ids IS NOT NULL THEN
        -- Get all billing IDs for these sessions
        SELECT ARRAY_AGG(id) INTO v_billing_ids
        FROM billing_calculations
        WHERE session_id = ANY(v_session_ids);

        IF v_billing_ids IS NOT NULL THEN
            -- Delete breakdown items first
            DELETE FROM billing_breakdown_items
            WHERE billing_calculation_id = ANY(v_billing_ids);
            GET DIAGNOSTICS v_deleted_breakdowns = ROW_COUNT;

            -- Delete billing calculations
            DELETE FROM billing_calculations
            WHERE session_id = ANY(v_session_ids);
            GET DIAGNOSTICS v_deleted_billings = ROW_COUNT;
        END IF;

        -- Delete charging sessions
        DELETE FROM charging_sessions
        WHERE import_batch_id = p_batch_id;
        GET DIAGNOSTICS v_deleted_sessions = ROW_COUNT;
    END IF;

    -- Delete the import batch itself
    DELETE FROM import_batches
    WHERE id = p_batch_id;

    RETURN jsonb_build_object(
        'batch_name', v_batch_name,
        'deleted_sessions', COALESCE(v_deleted_sessions, 0),
        'deleted_billings', COALESCE(v_deleted_billings, 0),
        'deleted_breakdowns', COALESCE(v_deleted_breakdowns, 0)
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.delete_import_batch_cascade(p_batch_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_billing_deleted INT := 0;
  v_sessions_deleted INT := 0;
  v_shifts_deleted INT := 0;
  v_batch_filename TEXT;
BEGIN
  -- Get batch info for the response
  SELECT filename INTO v_batch_filename
  FROM import_batches WHERE id = p_batch_id;

  IF v_batch_filename IS NULL THEN
    RETURN json_build_object(
      'success', false,
      'error', 'Import batch not found'
    );
  END IF;

  -- 1. Delete billing_calculations for sessions in this batch
  DELETE FROM billing_calculations
  WHERE session_id IN (
    SELECT id FROM charging_sessions WHERE import_batch_id = p_batch_id
  );
  GET DIAGNOSTICS v_billing_deleted = ROW_COUNT;

  -- 2. Delete charging sessions
  DELETE FROM charging_sessions WHERE import_batch_id = p_batch_id;
  GET DIAGNOSTICS v_sessions_deleted = ROW_COUNT;

  -- 3. Delete shifts linked to this batch
  DELETE FROM shifts WHERE import_batch_id = p_batch_id;
  GET DIAGNOSTICS v_shifts_deleted = ROW_COUNT;

  -- 4. Delete the import batch itself
  DELETE FROM import_batches WHERE id = p_batch_id;

  RETURN json_build_object(
    'success', true,
    'filename', v_batch_filename,
    'billing_deleted', v_billing_deleted,
    'sessions_deleted', v_sessions_deleted,
    'shifts_deleted', v_shifts_deleted
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.get_analytics_summary(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT json_build_object(
'totalEnergy', COALESCE((
SELECT SUM(energy_consumed_kwh)
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
), 0),
'totalSessions', COALESCE((
SELECT COUNT(*)
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
), 0),
'activeStations', COALESCE((
SELECT COUNT(DISTINCT station_id)
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
), 0),
'totalRevenue', COALESCE((
SELECT SUM(bc.total_amount)
FROM (
SELECT DISTINCT ON (session_id) session_id, total_amount
FROM billing_calculations
ORDER BY session_id, created_at DESC
) bc
INNER JOIN charging_sessions cs ON bc.session_id = cs.id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
), 0)
);
$function$
;

CREATE OR REPLACE FUNCTION public.get_best_time_to_charge(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
WITH hours AS (
SELECT generate_series(0, 23) as hour
),
hourly_data AS (
SELECT
EXTRACT(HOUR FROM cs.start_time)::int as hour,
SUM(cs.energy_consumed_kwh)::float8 as energy,
COUNT(*)::int as sessions,
COALESCE(SUM(bc.total_amount), 0)::float8 as total_cost,
COUNT(bc.session_id)::int as billed_sessions
FROM charging_sessions cs
LEFT JOIN (
SELECT DISTINCT ON (session_id) session_id, total_amount
FROM billing_calculations
ORDER BY session_id, created_at DESC
) bc ON cs.id = bc.session_id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
GROUP BY EXTRACT(HOUR FROM cs.start_time)::int
)
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.hour), '[]'::json)
FROM (
SELECT
h.hour::int,
COALESCE(hd.energy, 0)::float8 as energy,
COALESCE(hd.sessions, 0)::int as sessions,
CASE WHEN COALESCE(hd.billed_sessions, 0) > 0
THEN ROUND((hd.total_cost / hd.billed_sessions)::numeric, 4)::float8
ELSE 0
END as avg_cost
FROM hours h
LEFT JOIN hourly_data hd ON h.hour = hd.hour
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_charger_type_breakdown(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
WITH type_counts AS (
SELECT
COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as type,
COUNT(*)::int as count
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
GROUP BY type
),
total AS (
SELECT COALESCE(SUM(count), 0) as total FROM type_counts
)
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
tc.type,
tc.count,
CASE WHEN tot.total > 0
THEN ROUND((tc.count::numeric / tot.total * 100)::numeric, 2)::float8
ELSE 0
END as percentage
FROM type_counts tc, total tot
ORDER BY tc.count DESC
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_co2_impact(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT json_build_object(
'totalCO2Reduction', COALESCE(SUM(co2_reduction_kg), 0)::float8,
'treesEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 21.0)::numeric, 1)::float8,
'kmDrivenEquivalent', ROUND((COALESCE(SUM(co2_reduction_kg), 0) / 0.171)::numeric, 1)::float8,
'energyUsed', COALESCE(SUM(energy_consumed_kwh), 0)::float8
)
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end;
$function$
;

CREATE OR REPLACE FUNCTION public.get_connector_type_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown') as connector_type,
SUM(cs.energy_consumed_kwh)::float8 as energy,
COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
COUNT(*)::int as sessions,
CASE WHEN COUNT(*) > 0
THEN ROUND((SUM(cs.energy_consumed_kwh) / COUNT(*))::numeric, 2)::float8
ELSE 0
END as avg_energy,
COALESCE(SUM(cs.co2_reduction_kg), 0)::float8 as co2_reduction
FROM charging_sessions cs
LEFT JOIN (
SELECT DISTINCT ON (session_id) session_id, total_amount
FROM billing_calculations
ORDER BY session_id, created_at DESC
) bc ON cs.id = bc.session_id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
GROUP BY COALESCE(NULLIF(TRIM(cs.connector_type), ''), 'Unknown')
ORDER BY revenue DESC
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_daily_transactions_by_connector(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
start_date::text as date,
COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown') as connector_type,
COUNT(*)::int as count
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
GROUP BY start_date, COALESCE(NULLIF(TRIM(connector_type), ''), 'Unknown')
ORDER BY start_date
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_energy_trend(p_start date, p_end date, p_group_by text)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE(json_agg(row_to_json(t) ORDER BY t.period), '[]'::json)
FROM (
SELECT
CASE p_group_by
WHEN 'day' THEN start_date::text
WHEN 'week' THEN date_trunc('week', start_date)::date::text
WHEN 'month' THEN date_trunc('month', start_date)::date::text
ELSE start_date::text
END as period,
SUM(energy_consumed_kwh)::float8 as energy,
COUNT(*)::int as sessions
FROM charging_sessions
WHERE start_date >= p_start AND start_date <= p_end
GROUP BY period
ORDER BY period
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_revenue_by_station(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
s.name as station,
COALESCE(s.station_code, '') as station_code,
COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
COUNT(*)::int as sessions
FROM (
SELECT DISTINCT ON (session_id) session_id, total_amount
FROM billing_calculations
ORDER BY session_id, created_at DESC
) bc
INNER JOIN charging_sessions cs ON bc.session_id = cs.id
INNER JOIN stations s ON cs.station_id = s.id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
GROUP BY s.id, s.name, s.station_code
ORDER BY revenue DESC
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_shift_comparison(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
sub.shift,
sub.energy,
sub.revenue,
sub.sessions,
sub.co2_reduction,
sub.avg_duration
FROM (
SELECT
CASE
WHEN EXTRACT(HOUR FROM cs.start_time) >= 6 AND EXTRACT(HOUR FROM cs.start_time) < 12 THEN 'Morning'
WHEN EXTRACT(HOUR FROM cs.start_time) >= 12 AND EXTRACT(HOUR FROM cs.start_time) < 18 THEN 'Afternoon'
ELSE 'Night'
END as shift,
SUM(cs.energy_consumed_kwh)::float8 as energy,
COALESCE(SUM(bc.total_amount), 0)::float8 as revenue,
COUNT(*)::int as sessions,
COALESCE(SUM(cs.co2_reduction_kg), 0)::float8 as co2_reduction,
CASE WHEN COUNT(*) > 0
THEN ROUND(AVG(cs.duration_minutes)::numeric, 1)::float8
ELSE 0
END as avg_duration
FROM charging_sessions cs
LEFT JOIN (
SELECT DISTINCT ON (session_id) session_id, total_amount
FROM billing_calculations
ORDER BY session_id, created_at DESC
) bc ON cs.id = bc.session_id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
GROUP BY shift
) sub
ORDER BY
CASE sub.shift
WHEN 'Morning' THEN 1
WHEN 'Afternoon' THEN 2
WHEN 'Night' THEN 3
END
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.get_station_utilization(p_start date, p_end date)
 RETURNS json
 LANGUAGE sql
 STABLE
AS $function$
WITH station_data AS (
SELECT
s.name,
SUM(cs.energy_consumed_kwh)::float8 as energy,
COUNT(*)::int as sessions
FROM charging_sessions cs
INNER JOIN stations s ON cs.station_id = s.id
WHERE cs.start_date >= p_start AND cs.start_date <= p_end
GROUP BY s.id, s.name
),
total AS (
SELECT COALESCE(SUM(energy), 0) as total_energy FROM station_data
)
SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
FROM (
SELECT
sd.name,
sd.energy,
sd.sessions,
CASE WHEN tot.total_energy > 0
THEN ROUND((sd.energy / tot.total_energy * 100)::numeric, 2)::float8
ELSE 0
END as percentage
FROM station_data sd, total tot
ORDER BY sd.energy DESC
) t;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
    INSERT INTO public.user_profiles (id, email, full_name, role)
    VALUES (
        NEW.id,
        COALESCE(NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email, ''),
        COALESCE(NEW.raw_user_meta_data->>'role', 'station_manager')
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_all_shift_totals()
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_shift RECORD;
  v_updated INT := 0;
  v_total_kwh NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_result JSON;
BEGIN
  FOR v_shift IN SELECT id FROM shifts LOOP
    v_result := recalculate_shift_totals(v_shift.id);
    v_updated := v_updated + 1;
    v_total_kwh := v_total_kwh + (v_result->>'total_kwh')::numeric;
    v_total_amount := v_total_amount + (v_result->>'total_amount_jod')::numeric;
  END LOOP;

  RETURN json_build_object(
    'shifts_updated', v_updated,
    'total_kwh', ROUND(v_total_kwh, 3),
    'total_amount_jod', ROUND(v_total_amount, 3)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.recalculate_shift_totals(p_shift_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_total_kwh NUMERIC := 0;
  v_total_amount NUMERIC := 0;
  v_session_count INT := 0;
BEGIN
  -- Aggregate energy from linked charging sessions
  SELECT 
    COALESCE(COUNT(*), 0),
    COALESCE(SUM(cs.energy_consumed_kwh), 0)
  INTO v_session_count, v_total_kwh
  FROM charging_sessions cs
  WHERE cs.shift_id = p_shift_id;

  -- Aggregate billing amounts from billing_calculations for linked sessions
  SELECT COALESCE(SUM(bc.total_amount), 0)
  INTO v_total_amount
  FROM billing_calculations bc
  JOIN charging_sessions cs ON bc.session_id = cs.id
  WHERE cs.shift_id = p_shift_id;

  -- Update the shift record
  UPDATE shifts
  SET 
    total_kwh = v_total_kwh,
    total_amount_jod = v_total_amount,
    updated_at = now()
  WHERE id = p_shift_id;

  RETURN json_build_object(
    'shift_id', p_shift_id,
    'session_count', v_session_count,
    'total_kwh', ROUND(v_total_kwh, 3),
    'total_amount_jod', ROUND(v_total_amount, 3)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.replace_session_billing(p_session_id uuid, p_rate_structure_id uuid, p_subtotal numeric, p_taxes numeric, p_fees numeric, p_total_amount numeric, p_currency text DEFAULT 'JOD'::text, p_breakdown jsonb DEFAULT NULL::jsonb, p_breakdown_items jsonb DEFAULT '[]'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_billing_id uuid;
  v_item jsonb;
  v_deleted int := 0;
BEGIN
  IF p_session_id IS NULL THEN
    RAISE EXCEPTION 'session_id is required';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM charging_sessions WHERE id = p_session_id) THEN
    RAISE EXCEPTION 'Session % not found', p_session_id;
  END IF;

  DELETE FROM billing_breakdown_items bbi
  USING billing_calculations bc
  WHERE bbi.billing_calculation_id = bc.id
    AND bc.session_id = p_session_id;

  DELETE FROM billing_calculations
  WHERE session_id = p_session_id;
  GET DIAGNOSTICS v_deleted = ROW_COUNT;

  INSERT INTO billing_calculations (
    session_id, rate_structure_id, subtotal, taxes, fees, total_amount, currency, breakdown
  ) VALUES (
    p_session_id, p_rate_structure_id, p_subtotal, COALESCE(p_taxes,0), COALESCE(p_fees,0),
    p_total_amount, COALESCE(p_currency,'JOD'), p_breakdown
  )
  RETURNING id INTO v_billing_id;

  IF p_breakdown_items IS NOT NULL AND jsonb_typeof(p_breakdown_items) = 'array' THEN
    FOR v_item IN SELECT * FROM jsonb_array_elements(p_breakdown_items)
    LOOP
      INSERT INTO billing_breakdown_items (
        billing_calculation_id, rate_period_id, period_name,
        start_time, end_time, duration_minutes,
        energy_kwh, rate_per_kwh, demand_kw, demand_charge, energy_charge, line_total
      ) VALUES (
        v_billing_id,
        NULLIF(v_item->>'rate_period_id', '')::uuid,
        v_item->>'period_name',
        (v_item->>'start_time')::timestamptz,
        (v_item->>'end_time')::timestamptz,
        COALESCE((v_item->>'duration_minutes')::numeric, 0),
        COALESCE((v_item->>'energy_kwh')::numeric, 0),
        COALESCE((v_item->>'rate_per_kwh')::numeric, 0),
        COALESCE((v_item->>'demand_kw')::numeric, 0),
        COALESCE((v_item->>'demand_charge')::numeric, 0),
        COALESCE((v_item->>'energy_charge')::numeric, 0),
        COALESCE((v_item->>'line_total')::numeric, 0)
      );
    END LOOP;
  END IF;

  UPDATE charging_sessions
  SET has_billing_calculation = true,
      calculated_cost = p_total_amount
  WHERE id = p_session_id;

  RETURN jsonb_build_object(
    'billing_id', v_billing_id,
    'session_id', p_session_id,
    'replaced_count', v_deleted,
    'total_amount', p_total_amount
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.turbo_bulk_calculate_billing(p_session_ids uuid[], p_recalculate boolean DEFAULT false)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '600s'
AS $function$
DECLARE
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_total INT := array_length(p_session_ids, 1);
  v_successful INT := 0;
  v_failed INT := 0;
  v_skipped INT := 0;
  v_errors JSON[] := '{}';
  v_session RECORD;
  v_rate_structure RECORD;
  v_calc_id UUID;
  v_period RECORD;
  v_segment_start TIMESTAMPTZ;
  v_segment_end TIMESTAMPTZ;
  v_period_end_boundary TIMESTAMPTZ;
  v_total_duration_min FLOAT;
  v_segment_duration_min FLOAT;
  v_segment_energy FLOAT;
  v_energy_charge FLOAT;
  v_demand_charge FLOAT;
  v_line_total FLOAT;
  v_period_subtotal FLOAT;
  v_fixed_charges_total FLOAT;
  v_subtotal FLOAT;
  v_total_amount FLOAT;
  v_max_demand_kw FLOAT;
  v_breakdown JSON;
  v_period_charges JSON[];
  v_fixed_charges_list JSON[];
  v_current_time_min INT;
  v_period_start_min INT;
  v_period_end_min INT;
  v_day_of_week TEXT;
  v_season TEXT;
  v_month INT;
  v_found_period BOOLEAN;
  v_err_msg TEXT;
  v_session_date DATE;
BEGIN
  IF v_total IS NULL OR v_total = 0 THEN
    RETURN json_build_object(
      'total', 0, 'successful', 0, 'failed', 0, 'skipped', 0,
      'errors', '[]'::json, 'elapsed_ms', 0
    );
  END IF;

  ALTER TABLE billing_calculations DISABLE TRIGGER trg_update_session_billing_flag;

  IF p_recalculate THEN
    DELETE FROM billing_breakdown_items
    WHERE billing_calculation_id IN (
      SELECT id FROM billing_calculations
      WHERE session_id = ANY(p_session_ids)
    );

    DELETE FROM billing_calculations
    WHERE session_id = ANY(p_session_ids);

    UPDATE charging_sessions
    SET has_billing_calculation = false
    WHERE id = ANY(p_session_ids);
  END IF;

  FOR v_session IN
    SELECT
      cs.id,
      cs.station_id,
      cs.start_ts,
      cs.end_ts,
      cs.energy_consumed_kwh,
      cs.max_demand_kw,
      cs.has_billing_calculation
    FROM charging_sessions cs
    WHERE cs.id = ANY(p_session_ids)
      AND cs.station_id IS NOT NULL
  LOOP
    BEGIN
      IF v_session.has_billing_calculation AND NOT p_recalculate THEN
        v_skipped := v_skipped + 1;
        CONTINUE;
      END IF;

      -- Cast session timestamp to DATE for comparison with effective_from (DATE type)
      v_session_date := (v_session.start_ts::timestamptz)::date;

      -- Find active rate structure: effective_from is DATE, compare with DATE
      SELECT rs.* INTO v_rate_structure
      FROM rate_structures rs
      WHERE rs.station_id = v_session.station_id
        AND rs.is_active = true
        AND rs.effective_from <= v_session_date
      ORDER BY rs.effective_from DESC
      LIMIT 1;

      IF v_rate_structure IS NULL THEN
        v_failed := v_failed + 1;
        v_errors := array_append(v_errors, json_build_object(
          'sessionId', v_session.id,
          'error', 'No active rate structure found for station'
        ));
        CONTINUE;
      END IF;

      v_max_demand_kw := COALESCE(v_session.max_demand_kw, 0);

      v_segment_start := v_session.start_ts::timestamptz;
      v_total_duration_min := EXTRACT(EPOCH FROM (v_session.end_ts::timestamptz - v_session.start_ts::timestamptz)) / 60.0;
      v_period_subtotal := 0;
      v_period_charges := '{}';

      IF v_total_duration_min <= 0 THEN
        v_total_duration_min := 1;
      END IF;

      WHILE v_segment_start < v_session.end_ts::timestamptz LOOP
        v_day_of_week := lower(trim(to_char(v_segment_start, 'day')));
        v_month := EXTRACT(MONTH FROM v_segment_start)::INT;

        IF v_month >= 6 AND v_month <= 9 THEN
          v_season := 'summer';
        ELSIF v_month >= 12 OR v_month <= 2 THEN
          v_season := 'winter';
        ELSIF v_month >= 3 AND v_month <= 5 THEN
          v_season := 'spring';
        ELSE
          v_season := 'fall';
        END IF;

        v_current_time_min := EXTRACT(HOUR FROM v_segment_start)::INT * 60 + EXTRACT(MINUTE FROM v_segment_start)::INT;

        v_found_period := FALSE;

        FOR v_period IN
          SELECT rp.*
          FROM rate_periods rp
          WHERE rp.rate_structure_id = v_rate_structure.id
          ORDER BY rp.start_time ASC
        LOOP
          IF NOT (v_day_of_week = ANY(v_period.days_of_week)) THEN
            CONTINUE;
          END IF;

          IF v_period.season IS NOT NULL AND v_period.season != 'all' AND v_period.season != v_season THEN
            CONTINUE;
          END IF;

          v_period_start_min := EXTRACT(HOUR FROM v_period.start_time::time)::INT * 60
                              + EXTRACT(MINUTE FROM v_period.start_time::time)::INT;
          v_period_end_min := EXTRACT(HOUR FROM v_period.end_time::time)::INT * 60
                            + EXTRACT(MINUTE FROM v_period.end_time::time)::INT;

          IF v_period_end_min = 0 THEN
            v_period_end_min := 1440;
          END IF;

          IF v_period_end_min > v_period_start_min THEN
            IF v_current_time_min >= v_period_start_min AND v_current_time_min < v_period_end_min THEN
              v_found_period := TRUE;
            END IF;
          ELSE
            IF v_current_time_min >= v_period_start_min OR v_current_time_min < v_period_end_min THEN
              v_found_period := TRUE;
            END IF;
          END IF;

          IF v_found_period THEN
            IF v_period_end_min = 1440 THEN
              v_period_end_boundary := date_trunc('day', v_segment_start) + interval '1 day';
            ELSIF v_period_end_min > v_period_start_min THEN
              v_period_end_boundary := date_trunc('day', v_segment_start)
                + (v_period_end_min * interval '1 minute');
            ELSE
              IF v_current_time_min >= v_period_start_min THEN
                v_period_end_boundary := date_trunc('day', v_segment_start) + interval '1 day'
                  + (v_period_end_min * interval '1 minute');
              ELSE
                v_period_end_boundary := date_trunc('day', v_segment_start)
                  + (v_period_end_min * interval '1 minute');
              END IF;
            END IF;

            v_segment_end := LEAST(v_period_end_boundary, v_session.end_ts::timestamptz);
            v_segment_duration_min := EXTRACT(EPOCH FROM (v_segment_end - v_segment_start)) / 60.0;

            IF v_segment_duration_min > 0 THEN
              v_segment_energy := v_session.energy_consumed_kwh * (v_segment_duration_min / v_total_duration_min);

              v_energy_charge := v_segment_energy * v_period.energy_rate_per_kwh;
              v_demand_charge := v_max_demand_kw * COALESCE(v_period.demand_charge_per_kw, 0);
              v_line_total := v_energy_charge + v_demand_charge;
              v_period_subtotal := v_period_subtotal + v_line_total;

              v_period_charges := array_append(v_period_charges, json_build_object(
                'periodName', v_period.period_name,
                'startTime', v_segment_start,
                'endTime', v_segment_end,
                'duration', ROUND(v_segment_duration_min::numeric, 2),
                'energy', ROUND(v_segment_energy::numeric, 3),
                'ratePerKwh', v_period.energy_rate_per_kwh,
                'energyCharge', ROUND(v_energy_charge::numeric, 3),
                'demand', v_max_demand_kw,
                'demandRate', COALESCE(v_period.demand_charge_per_kw, 0),
                'demandCharge', ROUND(v_demand_charge::numeric, 3),
                'lineTotal', ROUND(v_line_total::numeric, 3)
              ));
            END IF;

            v_segment_start := v_segment_end;
            EXIT;
          END IF;
        END LOOP;

        IF NOT v_found_period THEN
          v_failed := v_failed + 1;
          v_errors := array_append(v_errors, json_build_object(
            'sessionId', v_session.id,
            'error', format('No applicable rate period for time: %s', v_segment_start)
          ));
          EXIT;
        END IF;
      END LOOP;

      IF NOT v_found_period AND v_segment_start < v_session.end_ts::timestamptz THEN
        CONTINUE;
      END IF;

      v_fixed_charges_total := 0;
      v_fixed_charges_list := '{}';

      FOR v_period IN
        SELECT fc.charge_name, fc.amount
        FROM fixed_charges fc
        WHERE fc.station_id = v_session.station_id
          AND fc.is_active = true
      LOOP
        v_fixed_charges_total := v_fixed_charges_total + v_period.amount;
        v_fixed_charges_list := array_append(v_fixed_charges_list, json_build_object(
          'name', v_period.charge_name,
          'amount', v_period.amount
        ));
      END LOOP;

      v_subtotal := v_period_subtotal + v_fixed_charges_total;
      v_total_amount := v_subtotal;

      v_breakdown := json_build_object(
        'periodCharges', COALESCE(array_to_json(v_period_charges), '[]'::json),
        'subtotal', ROUND(v_subtotal::numeric, 3),
        'fixedCharges', ROUND(v_fixed_charges_total::numeric, 3),
        'fixedChargesList', COALESCE(array_to_json(v_fixed_charges_list), '[]'::json),
        'taxes', 0,
        'total', ROUND(v_total_amount::numeric, 3)
      );

      INSERT INTO billing_calculations (
        session_id, rate_structure_id, breakdown,
        subtotal, taxes, fees, total_amount, currency
      )
      VALUES (
        v_session.id,
        v_rate_structure.id,
        v_breakdown,
        ROUND(v_subtotal::numeric, 3),
        0,
        ROUND(v_fixed_charges_total::numeric, 3),
        ROUND(v_total_amount::numeric, 3),
        'JOD'
      )
      RETURNING id INTO v_calc_id;

      INSERT INTO billing_breakdown_items (
        billing_calculation_id,
        period_name, start_time, end_time,
        duration_minutes, energy_kwh, rate_per_kwh,
        demand_kw, demand_charge, energy_charge, line_total
      )
      SELECT
        v_calc_id,
        (item->>'periodName'),
        (item->>'startTime')::timestamptz,
        (item->>'endTime')::timestamptz,
        (item->>'duration')::numeric,
        (item->>'energy')::numeric,
        (item->>'ratePerKwh')::numeric,
        (item->>'demand')::numeric,
        (item->>'demandCharge')::numeric,
        (item->>'energyCharge')::numeric,
        (item->>'lineTotal')::numeric
      FROM unnest(v_period_charges) AS item;

      v_successful := v_successful + 1;

    EXCEPTION WHEN OTHERS THEN
      GET STACKED DIAGNOSTICS v_err_msg = MESSAGE_TEXT;
      v_failed := v_failed + 1;
      v_errors := array_append(v_errors, json_build_object(
        'sessionId', v_session.id,
        'error', v_err_msg
      ));
    END;
  END LOOP;

  v_skipped := v_skipped + (
    SELECT COUNT(*)::INT FROM unnest(p_session_ids) sid
    LEFT JOIN charging_sessions cs ON cs.id = sid
    WHERE cs.station_id IS NULL OR cs.id IS NULL
  );

  UPDATE charging_sessions
  SET has_billing_calculation = true
  WHERE id IN (
    SELECT bc.session_id FROM billing_calculations bc
    WHERE bc.session_id = ANY(p_session_ids)
  );

  ALTER TABLE billing_calculations ENABLE TRIGGER trg_update_session_billing_flag;

  RETURN json_build_object(
    'total', v_total,
    'successful', v_successful,
    'failed', v_failed,
    'skipped', v_skipped,
    'errors', COALESCE(array_to_json(v_errors), '[]'::json),
    'elapsed_ms', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.turbo_calculate_all_pending(p_station_id uuid DEFAULT NULL::uuid, p_batch_size integer DEFAULT 5000)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET statement_timeout TO '600s'
AS $function$
DECLARE
  v_all_ids UUID[];
  v_batch_ids UUID[];
  v_total INT;
  v_offset INT := 0;
  v_batch_result JSON;
  v_total_successful INT := 0;
  v_total_failed INT := 0;
  v_total_skipped INT := 0;
  v_all_errors JSON[] := '{}';
  v_start_time TIMESTAMPTZ := clock_timestamp();
  v_err_count INT := 0;
BEGIN
  -- Get ALL pending session IDs directly on the server
  IF p_station_id IS NOT NULL THEN
    SELECT array_agg(id ORDER BY start_ts)
    INTO v_all_ids
    FROM charging_sessions
    WHERE has_billing_calculation = false
      AND station_id = p_station_id;
  ELSE
    SELECT array_agg(id ORDER BY start_ts)
    INTO v_all_ids
    FROM charging_sessions
    WHERE has_billing_calculation = false;
  END IF;

  IF v_all_ids IS NULL OR array_length(v_all_ids, 1) IS NULL THEN
    RETURN json_build_object(
      'total', 0, 'successful', 0, 'failed', 0, 'skipped', 0,
      'errors', '[]'::json, 'elapsed_ms', 0
    );
  END IF;

  v_total := array_length(v_all_ids, 1);

  -- Process in batches
  WHILE v_offset < v_total LOOP
    v_batch_ids := v_all_ids[v_offset + 1 : LEAST(v_offset + p_batch_size, v_total)];

    v_batch_result := turbo_bulk_calculate_billing(v_batch_ids, false);

    v_total_successful := v_total_successful + (v_batch_result->>'successful')::int;
    v_total_failed := v_total_failed + (v_batch_result->>'failed')::int;
    v_total_skipped := v_total_skipped + (v_batch_result->>'skipped')::int;

    -- Collect errors (limit to first 100)
    v_err_count := COALESCE(array_length(v_all_errors, 1), 0);
    IF json_array_length(v_batch_result->'errors') > 0 AND v_err_count < 100 THEN
      SELECT array_cat(v_all_errors, array_agg(elem::json))
      INTO v_all_errors
      FROM (
        SELECT elem
        FROM json_array_elements(v_batch_result->'errors') elem
        LIMIT GREATEST(100 - v_err_count, 0)
      ) sub;
    END IF;

    v_offset := v_offset + p_batch_size;
  END LOOP;

  RETURN json_build_object(
    'total', v_total,
    'successful', v_total_successful,
    'failed', v_total_failed,
    'skipped', v_total_skipped,
    'errors', COALESCE(array_to_json(v_all_errors), '[]'::json),
    'elapsed_ms', ROUND(EXTRACT(EPOCH FROM (clock_timestamp() - v_start_time)) * 1000)
  );
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_operators_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_session_billing_flag()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
IF TG_OP = 'INSERT' THEN
UPDATE charging_sessions 
SET has_billing_calculation = true 
WHERE id = NEW.session_id;
RETURN NEW;
ELSIF TG_OP = 'DELETE' THEN
UPDATE charging_sessions 
SET has_billing_calculation = NOT EXISTS (
SELECT 1 FROM billing_calculations 
WHERE session_id = OLD.session_id
)
WHERE id = OLD.session_id;
RETURN OLD;
END IF;
RETURN NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
NEW.updated_at = now();
RETURN NEW;
END;
$function$
;

CREATE TRIGGER calculate_charging_session_duration BEFORE INSERT OR UPDATE ON charging_sessions FOR EACH ROW EXECUTE FUNCTION calculate_session_duration();

CREATE TRIGGER operators_updated_at_trigger BEFORE UPDATE ON operators FOR EACH ROW EXECUTE FUNCTION update_operators_updated_at();

CREATE TRIGGER trg_update_session_billing_flag AFTER INSERT OR DELETE ON billing_calculations FOR EACH ROW EXECUTE FUNCTION update_session_billing_flag();

CREATE TRIGGER update_charging_sessions_updated_at BEFORE UPDATE ON charging_sessions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_rate_structures_updated_at BEFORE UPDATE ON rate_structures FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_stations_updated_at BEFORE UPDATE ON stations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.a1_rpc_baseline_catalog ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_breakdown_items ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_breakdown_items_duplicate_archive ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_calculations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_calculations_duplicate_archive ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.billing_duplicate_conflict_report ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.charging_sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.fixed_charges ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.maintenance_log ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operator_schedules ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.operators ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_periods ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.rate_structures ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shifts ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.stations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.tax_configurations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.user_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "All authenticated can read maintenance log" ON public.maintenance_log AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL)) ;

CREATE POLICY "All authenticated users can delete billing breakdown items" ON public.billing_breakdown_items AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete billing calculations" ON public.billing_calculations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete charging sessions" ON public.charging_sessions AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete fixed charges" ON public.fixed_charges AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete import batches" ON public.import_batches AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete operators" ON public.operators AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete rate periods" ON public.rate_periods AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete rate structures" ON public.rate_structures AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete stations" ON public.stations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can delete tax configurations" ON public.tax_configurations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can insert billing breakdown items" ON public.billing_breakdown_items AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert billing calculations" ON public.billing_calculations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert charging sessions" ON public.charging_sessions AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert fixed charges" ON public.fixed_charges AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert import batches" ON public.import_batches AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert operators" ON public.operators AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert rate periods" ON public.rate_periods AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert rate structures" ON public.rate_structures AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert stations" ON public.stations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can insert tax configurations" ON public.tax_configurations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "All authenticated users can update billing breakdown items" ON public.billing_breakdown_items AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update billing calculations" ON public.billing_calculations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update charging sessions" ON public.charging_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update fixed charges" ON public.fixed_charges AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update import batches" ON public.import_batches AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update operators" ON public.operators AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update rate periods" ON public.rate_periods AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update rate structures" ON public.rate_structures AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update stations" ON public.stations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can update tax configurations" ON public.tax_configurations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "All authenticated users can view all billing breakdown items" ON public.billing_breakdown_items AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all billing calculations" ON public.billing_calculations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all charging sessions" ON public.charging_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all fixed charges" ON public.fixed_charges AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all import batches" ON public.import_batches AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all operators" ON public.operators AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all rate periods" ON public.rate_periods AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all rate structures" ON public.rate_structures AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all stations" ON public.stations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "All authenticated users can view all tax configurations" ON public.tax_configurations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Any authenticated user can insert audit log" ON public.audit_log AS PERMISSIVE FOR INSERT TO public  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Authenticated can delete maintenance log" ON public.maintenance_log AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() IS NOT NULL)) ;

CREATE POLICY "Authenticated can insert maintenance log" ON public.maintenance_log AS PERMISSIVE FOR INSERT TO public  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Authenticated can update maintenance log" ON public.maintenance_log AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() IS NOT NULL)) ;

CREATE POLICY "Authenticated users can delete billing_breakdown_items" ON public.billing_breakdown_items AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete billing_calculations" ON public.billing_calculations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete charging_sessions" ON public.charging_sessions AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete fixed_charges" ON public.fixed_charges AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete import_batches" ON public.import_batches AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete operators" ON public.operators AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete rate_periods" ON public.rate_periods AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete rate_structures" ON public.rate_structures AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete shifts" ON public.shifts AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete stations" ON public.stations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete system_settings" ON public.system_settings AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete tax_configurations" ON public.tax_configurations AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can delete user_profiles" ON public.user_profiles AS PERMISSIVE FOR DELETE TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can insert billing_breakdown_items" ON public.billing_breakdown_items AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert billing_calculations" ON public.billing_calculations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert charging_sessions" ON public.charging_sessions AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert fixed_charges" ON public.fixed_charges AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert import_batches" ON public.import_batches AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert operators" ON public.operators AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rate_periods" ON public.rate_periods AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert rate_structures" ON public.rate_structures AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert shifts" ON public.shifts AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert stations" ON public.stations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert system_settings" ON public.system_settings AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert tax_configurations" ON public.tax_configurations AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can insert user_profiles" ON public.user_profiles AS PERMISSIVE FOR INSERT TO authenticated  WITH CHECK (true);

CREATE POLICY "Authenticated users can manage schedules" ON public.operator_schedules AS PERMISSIVE FOR ALL TO public USING ((auth.uid() IS NOT NULL)) ;

CREATE POLICY "Authenticated users can read shifts" ON public.shifts AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can read system_settings" ON public.system_settings AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can read user_profiles" ON public.user_profiles AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can update billing_breakdown_items" ON public.billing_breakdown_items AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update billing_calculations" ON public.billing_calculations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update charging_sessions" ON public.charging_sessions AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update fixed_charges" ON public.fixed_charges AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update import_batches" ON public.import_batches AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update operators" ON public.operators AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update rate_periods" ON public.rate_periods AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update rate_structures" ON public.rate_structures AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update shifts" ON public.shifts AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update stations" ON public.stations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update system_settings" ON public.system_settings AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update tax_configurations" ON public.tax_configurations AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can update user_profiles" ON public.user_profiles AS PERMISSIVE FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "Authenticated users can view all billing_breakdown_items" ON public.billing_breakdown_items AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all billing_calculations" ON public.billing_calculations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all charging_sessions" ON public.charging_sessions AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all fixed_charges" ON public.fixed_charges AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all import_batches" ON public.import_batches AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all operators" ON public.operators AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all rate_periods" ON public.rate_periods AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all rate_structures" ON public.rate_structures AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all stations" ON public.stations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view all tax_configurations" ON public.tax_configurations AS PERMISSIVE FOR SELECT TO authenticated USING (true) ;

CREATE POLICY "Authenticated users can view schedules" ON public.operator_schedules AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() IS NOT NULL)) ;

CREATE POLICY "Global admin and company manager can view audit log" ON public.audit_log AS PERMISSIVE FOR SELECT TO public USING (true) ;

CREATE POLICY "Service role full access a1 rpc catalog" ON public.a1_rpc_baseline_catalog AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access billing breakdown dup archive" ON public.billing_breakdown_items_duplicate_archive AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access billing conflict report" ON public.billing_duplicate_conflict_report AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access billing dup archive" ON public.billing_calculations_duplicate_archive AS PERMISSIVE FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "System can insert notifications" ON public.notifications AS PERMISSIVE FOR INSERT TO public  WITH CHECK ((auth.uid() IS NOT NULL));

CREATE POLICY "Users can delete own notifications" ON public.notifications AS PERMISSIVE FOR DELETE TO public USING ((auth.uid() = user_id)) ;

CREATE POLICY "Users can read own notifications" ON public.notifications AS PERMISSIVE FOR SELECT TO public USING ((auth.uid() = user_id)) ;

CREATE POLICY "Users can update own notifications" ON public.notifications AS PERMISSIVE FOR UPDATE TO public USING ((auth.uid() = user_id)) ;

GRANT ALL ON TABLE public.a1_rpc_baseline_catalog TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.audit_log TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.billing_breakdown_items TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.billing_breakdown_items_duplicate_archive TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.billing_calculations TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.billing_calculations_duplicate_archive TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.billing_duplicate_conflict_report TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.charging_sessions TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.fixed_charges TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.import_batches TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.maintenance_log TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.notifications TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.operator_schedules TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.operators TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.rate_periods TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.rate_structures TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.shifts TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.stations TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.system_settings TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.tax_configurations TO anon, authenticated, service_role;

GRANT ALL ON TABLE public.user_profiles TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_batch_billing(p_batch_id uuid, p_station_id uuid) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.calculate_session_duration() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_import_batch(p_batch_id uuid) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.delete_import_batch_cascade(p_batch_id uuid) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_analytics_summary(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_best_time_to_charge(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_charger_type_breakdown(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_co2_impact(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_connector_type_comparison(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_daily_transactions_by_connector(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_energy_trend(p_start date, p_end date, p_group_by text) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_revenue_by_station(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_shift_comparison(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.get_station_utilization(p_start date, p_end date) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.handle_new_user() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.recalculate_all_shift_totals() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.recalculate_shift_totals(p_shift_id uuid) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.replace_session_billing(p_session_id uuid, p_rate_structure_id uuid, p_subtotal numeric, p_taxes numeric, p_fees numeric, p_total_amount numeric, p_currency text, p_breakdown jsonb, p_breakdown_items jsonb) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.turbo_bulk_calculate_billing(p_session_ids uuid[], p_recalculate boolean) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.turbo_calculate_all_pending(p_station_id uuid, p_batch_size integer) TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_operators_updated_at() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_session_billing_flag() TO anon, authenticated, service_role;

GRANT EXECUTE ON FUNCTION public.update_updated_at_column() TO anon, authenticated, service_role;
