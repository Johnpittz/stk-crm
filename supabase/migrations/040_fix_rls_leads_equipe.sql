-- Migration: Corrige RLS da tabela leads para gestores só verem sua equipe
-- Problema: policy "gestores_veem_todos_leads" permitia que qualquer gerente_comercial visse TODOS os leads
-- Solução: separa em policy específica para diretoria (tudo) e gestor (apenas sua equipe)

-- ============================================================
-- 1. Remove a policy antiga que dava acesso irrestrito a gestores
-- ============================================================

DROP POLICY IF EXISTS "gestores_veem_todos_leads" ON public.leads;

-- ============================================================
-- 2. Policy para DIRETORIA/ADMIN — vê todos os leads
-- ============================================================

DROP POLICY IF EXISTS "diretoria_veem_todos_leads" ON public.leads;
CREATE POLICY "diretoria_veem_todos_leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.cargo IN ('diretor', 'admin')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.cargo IN ('diretor', 'admin')
    )
  );

-- ============================================================
-- 3. Policy para GESTOR — vê apenas leads da sua equipe + não atribuídos
-- ============================================================

DROP POLICY IF EXISTS "gestor_veem_equipe_leads" ON public.leads;
CREATE POLICY "gestor_veem_equipe_leads" ON public.leads
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.cargo = 'gerente_comercial'
    )
    AND (
      -- Leads não atribuídos (gestor pode distribuir)
      vendedor_id IS NULL
      -- OU leads de vendedores cuja equipe pertence a este gestor
      OR EXISTS (
        SELECT 1 FROM public.profiles v
        WHERE v.id = leads.vendedor_id
          AND v.gestor_id = auth.uid()
      )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid()
        AND p.cargo = 'gerente_comercial'
    )
    AND (
      vendedor_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.profiles v
        WHERE v.id = leads.vendedor_id
          AND v.gestor_id = auth.uid()
      )
    )
  );

-- ============================================================
-- 4. Policy para VENDEDOR — mantém inalterada (vê apenas seus leads)
-- ============================================================

-- Já existe: "vendedores_veem_seus_leads"
