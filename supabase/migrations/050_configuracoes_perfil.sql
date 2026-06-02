-- Migration: Configurações de Perfil
-- Adiciona coluna whatsapp à tabela profiles e configura bucket de avatares

-- 1. Adicionar coluna whatsapp em profiles (se não existir)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'whatsapp'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN whatsapp TEXT;
  END IF;
END $$;

-- 2. Criar bucket 'avatars' no Storage (se não existir)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  2097152, -- 2MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- 3. Policies para o bucket avatars
DO $$
BEGIN
  -- Policy: usuários autenticados podem fazer upload
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Usuários autenticados podem fazer upload de avatar'
  ) THEN
    CREATE POLICY "Usuários autenticados podem fazer upload de avatar"
    ON storage.objects
    FOR INSERT
    TO authenticated
    WITH CHECK (bucket_id = 'avatars');
  END IF;

  -- Policy: usuários autenticados podem atualizar avatares
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Usuários autenticados podem atualizar avatar'
  ) THEN
    CREATE POLICY "Usuários autenticados podem atualizar avatar"
    ON storage.objects
    FOR UPDATE
    TO authenticated
    USING (bucket_id = 'avatars');
  END IF;

  -- Policy: qualquer um autenticado pode ler avatares
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Avatares são públicos'
  ) THEN
    CREATE POLICY "Avatares são públicos"
    ON storage.objects
    FOR SELECT
    TO authenticated
    USING (bucket_id = 'avatars');
  END IF;
END $$;

-- 4. Garantir que usuários possam atualizar seu próprio perfil (preparação para RLS)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'profiles'
    AND policyname = 'Usuários autenticados podem atualizar próprio perfil'
  ) THEN
    CREATE POLICY "Usuários autenticados podem atualizar próprio perfil"
    ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
  END IF;
END $$;
