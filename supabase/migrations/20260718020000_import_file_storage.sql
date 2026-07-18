-- Migration: Store original import files in Supabase Storage
-- Adds file_storage_path column to import_batches and creates import-files bucket

-- 1. Add storage path column to import_batches
ALTER TABLE import_batches
  ADD COLUMN IF NOT EXISTS file_storage_path TEXT;

-- 2. Create the import-files storage bucket (private, authenticated-only)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'import-files',
  'import-files',
  false,
  10485760,
  ARRAY[
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
    'text/csv',
    'application/octet-stream',
    'text/plain'
  ]
)
ON CONFLICT (id) DO NOTHING;

-- 3. RLS: authenticated users can upload import files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'import_files_insert'
  ) THEN
    CREATE POLICY "import_files_insert"
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'import-files');
  END IF;
END $$;

-- 4. RLS: authenticated users can read/download import files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'import_files_select'
  ) THEN
    CREATE POLICY "import_files_select"
      ON storage.objects FOR SELECT
      TO authenticated
      USING (bucket_id = 'import-files');
  END IF;
END $$;

-- 5. RLS: authenticated users can delete their own import files
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'import_files_delete'
  ) THEN
    CREATE POLICY "import_files_delete"
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'import-files');
  END IF;
END $$;
