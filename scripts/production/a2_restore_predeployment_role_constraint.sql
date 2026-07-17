-- Restore legacy role check (pre-A2)
ALTER TABLE public.user_profiles DROP CONSTRAINT IF EXISTS user_profiles_role_check;
ALTER TABLE public.user_profiles
  ADD CONSTRAINT user_profiles_role_check
  CHECK (role = ANY (ARRAY['global_admin'::text, 'company_manager'::text, 'station_manager'::text, 'accountant'::text]));
UPDATE public.user_profiles SET role = 'global_admin' WHERE role = 'system_admin';
UPDATE public.user_profiles SET role = 'company_manager' WHERE role = 'operations_manager';
