-- ============================================================================
-- Production Auth Hardening Migration
-- This migration tightens RLS policies for production use, ensuring:
-- 1. Only admin/owner can INSERT/UPDATE business data
-- 2. Barbers have read-only access to most tables
-- 3. Delete operations are admin-only (already the case)
-- 4. User profile updates are self-only
-- 5. The handle_new_user trigger uses email+password flow
-- ============================================================================

-- ─── 1. Update handle_new_user for email+password signup ──────────────────────
-- First user = admin, subsequent users get NO role (admin assigns manually)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count int;
BEGIN
  -- Create profile with name from metadata or email
  INSERT INTO public.profiles(id, full_name)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  );

  -- First user in the system becomes admin
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'admin');
  END IF;

  -- All other users get no role by default — admin assigns via the admin panel
  RETURN new;
END;
$$;

-- ─── 2. Helper function: check if user is admin or owner ──────────────────────
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'owner')
  )
$$;

-- ─── 3. Tighten INSERT/UPDATE policies on business tables ─────────────────────
-- Only admin/owner can create or modify business data.
-- Barbers retain SELECT access (already handled by "auth read" policies).

-- Drop existing permissive INSERT/UPDATE policies and replace with role-restricted ones
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients','service_categories','services','products','barbers','bills','bill_items',
    'payments','expenses','gift_cards','gift_card_transactions','attendance','salary_records',
    'reminders','discount_rules'
  ]) LOOP
    -- Drop the old wide-open insert/update policies
    EXECUTE format('DROP POLICY IF EXISTS "auth insert %1$s" ON public.%1$I', t);
    EXECUTE format('DROP POLICY IF EXISTS "auth update %1$s" ON public.%1$I', t);

    -- Create manager-only insert/update policies
    EXECUTE format(
      'CREATE POLICY "manager insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()))',
      t
    );
    EXECUTE format(
      'CREATE POLICY "manager update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()))',
      t
    );
  END LOOP;
END $$;

-- ─── 4. Exception: Barbers can update their own attendance ────────────────────
-- (They need to check in/out)
CREATE POLICY "barber self attendance insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    barber_id IN (
      SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid()
    )
  );

CREATE POLICY "barber self attendance update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    barber_id IN (
      SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid()
    )
  );

-- ─── 5. Profile policies: users can only update their own profile ─────────────
-- (Already exists from initial migration, but let's ensure it's correct)
-- No changes needed — the existing "profiles self update" policy uses auth.uid() = id

-- ─── 6. Add index for performance on user_roles lookups ───────────────────────
-- This is critical for the has_role and is_manager functions at scale
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);

-- ─── 7. Add index for faster profile lookups ──────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);
