-- ============================================================================
-- CutBook — COMPLETE DATABASE SETUP (All 3 migrations combined)
-- ============================================================================
-- Run this ONCE in Supabase SQL Editor.
-- It creates all tables, functions, triggers, RLS policies, indexes, and seed data.
-- Safe to run on a fresh Supabase project.
-- ============================================================================


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 1: ROLES, PROFILES, AUTH FUNCTIONS                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Create the role enum with all 3 roles
CREATE TYPE public.app_role AS ENUM ('admin', 'barber', 'owner');

-- Profiles table (linked to auth.users)
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles self read" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles self update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

-- User roles table
CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Function: check if a user has a specific role
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Function: check if a user is admin or owner (manager)
CREATE OR REPLACE FUNCTION public.is_manager(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id
    AND role IN ('admin', 'owner')
  )
$$;

-- RLS policies for user_roles
CREATE POLICY "roles readable by self" ON public.user_roles
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "admins manage roles" ON public.user_roles
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Trigger function: auto-create profile + first user becomes admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE user_count int;
BEGIN
  -- Create profile with name from signup metadata or email
  INSERT INTO public.profiles(id, full_name)
  VALUES (
    new.id,
    COALESCE(
      new.raw_user_meta_data->>'full_name',
      split_part(new.email, '@', 1)
    )
  );

  -- First user in the system becomes admin automatically
  SELECT count(*) INTO user_count FROM public.user_roles;
  IF user_count = 0 THEN
    INSERT INTO public.user_roles(user_id, role) VALUES (new.id, 'admin');
  END IF;

  -- All other users get NO role — admin assigns via Admin Panel
  RETURN new;
END;
$$;

-- Attach trigger to auth.users
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Helper: auto-set updated_at on UPDATE
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN new.updated_at = now(); RETURN new; END; $$;


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 2: BUSINESS TABLES                                                    ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE TABLE public.clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  mobile text NOT NULL UNIQUE,
  gender text CHECK (gender IN ('male','female','other')),
  date_of_birth date,
  notes text,
  total_spent numeric(12,2) NOT NULL DEFAULT 0,
  due_amount numeric(12,2) NOT NULL DEFAULT 0,
  last_visit_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER clients_updated BEFORE UPDATE ON public.clients FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX ON public.clients(mobile);

CREATE TABLE public.service_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order int NOT NULL DEFAULT 0
);

CREATE TABLE public.services (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid REFERENCES public.service_categories(id) ON DELETE SET NULL,
  name text NOT NULL,
  price numeric(10,2) NOT NULL,
  duration_min int DEFAULT 30,
  is_package boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.services(category_id);

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sku text,
  price numeric(10,2) NOT NULL,
  cost numeric(10,2),
  stock int NOT NULL DEFAULT 0,
  low_stock_threshold int DEFAULT 5,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.barbers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  full_name text NOT NULL,
  mobile text,
  pin text,
  monthly_salary numeric(10,2) NOT NULL DEFAULT 0,
  shift_start time DEFAULT '10:00',
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.bills (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_no serial,
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE RESTRICT,
  barber_id uuid REFERENCES public.barbers(id) ON DELETE SET NULL,
  subtotal numeric(12,2) NOT NULL DEFAULT 0,
  discount_type text CHECK (discount_type IN ('none','percent','flat')) DEFAULT 'none',
  discount_value numeric(10,2) NOT NULL DEFAULT 0,
  discount_amount numeric(12,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  amount_paid numeric(12,2) NOT NULL DEFAULT 0,
  due_amount numeric(12,2) NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'paid' CHECK (status IN ('paid','partial','due','void')),
  notes text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER bills_updated BEFORE UPDATE ON public.bills FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE INDEX ON public.bills(client_id);
CREATE INDEX ON public.bills(barber_id);
CREATE INDEX ON public.bills(created_at DESC);

CREATE TABLE public.bill_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  item_type text NOT NULL CHECK (item_type IN ('service','product')),
  service_id uuid REFERENCES public.services(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE SET NULL,
  name text NOT NULL,
  qty int NOT NULL DEFAULT 1,
  unit_price numeric(10,2) NOT NULL,
  total numeric(12,2) NOT NULL
);
CREATE INDEX ON public.bill_items(bill_id);

CREATE TABLE public.payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id uuid NOT NULL REFERENCES public.bills(id) ON DELETE CASCADE,
  method text NOT NULL CHECK (method IN ('cash','upi','card','gift_card')),
  amount numeric(12,2) NOT NULL,
  reference_no text,
  paid_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.payments(bill_id);

CREATE TABLE public.expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  vendor text,
  description text,
  payment_method text CHECK (payment_method IN ('cash','upi','card')),
  spent_on date NOT NULL DEFAULT current_date,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX ON public.expenses(spent_on DESC);

CREATE TABLE public.gift_cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  initial_value numeric(10,2) NOT NULL,
  balance numeric(10,2) NOT NULL,
  expires_on date,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','redeemed','expired','void')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.gift_card_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  gift_card_id uuid NOT NULL REFERENCES public.gift_cards(id) ON DELETE CASCADE,
  bill_id uuid REFERENCES public.bills(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL,
  kind text NOT NULL CHECK (kind IN ('issue','redeem','refund','expire')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  date date NOT NULL,
  status text NOT NULL CHECK (status IN ('present','absent','half_day')) DEFAULT 'present',
  check_in time,
  check_out time,
  UNIQUE(barber_id, date)
);

CREATE TABLE public.salary_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  barber_id uuid NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  period_year int NOT NULL,
  period_month int NOT NULL,
  base_salary numeric(10,2) NOT NULL,
  revenue_generated numeric(12,2) NOT NULL DEFAULT 0,
  incentive_pct numeric(5,2) NOT NULL DEFAULT 0,
  incentive_amount numeric(10,2) NOT NULL DEFAULT 0,
  overtime_amount numeric(10,2) NOT NULL DEFAULT 0,
  total numeric(12,2) NOT NULL DEFAULT 0,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(barber_id, period_year, period_month)
);

CREATE TABLE public.reminders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('birthday','followup','custom','bill')),
  message text NOT NULL,
  channel text DEFAULT 'whatsapp',
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed','cancelled')),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.discount_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('percent','flat')),
  value numeric(10,2) NOT NULL,
  min_spend numeric(10,2),
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 3: ROW LEVEL SECURITY (Production-hardened)                           ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

-- Enable RLS + create policies for all business tables:
--   SELECT  = any authenticated user
--   INSERT  = admin/owner only (managers)
--   UPDATE  = admin/owner only (managers)
--   DELETE  = admin only

DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'clients','service_categories','services','products','barbers','bills','bill_items',
    'payments','expenses','gift_cards','gift_card_transactions','attendance','salary_records',
    'reminders','discount_rules'
  ]) LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);

    -- Everyone can read
    EXECUTE format(
      'CREATE POLICY "auth read %1$s" ON public.%1$I FOR SELECT TO authenticated USING (true)', t
    );
    -- Only managers (admin/owner) can insert
    EXECUTE format(
      'CREATE POLICY "manager insert %1$s" ON public.%1$I FOR INSERT TO authenticated WITH CHECK (public.is_manager(auth.uid()))', t
    );
    -- Only managers (admin/owner) can update
    EXECUTE format(
      'CREATE POLICY "manager update %1$s" ON public.%1$I FOR UPDATE TO authenticated USING (public.is_manager(auth.uid()))', t
    );
    -- Only admin can delete
    EXECUTE format(
      'CREATE POLICY "admin delete %1$s" ON public.%1$I FOR DELETE TO authenticated USING (public.has_role(auth.uid(),''admin''))', t
    );
  END LOOP;
END $$;

-- Exception: Barbers can insert/update their OWN attendance
CREATE POLICY "barber self attendance insert" ON public.attendance
  FOR INSERT TO authenticated
  WITH CHECK (
    barber_id IN (SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid())
  );

CREATE POLICY "barber self attendance update" ON public.attendance
  FOR UPDATE TO authenticated
  USING (
    barber_id IN (SELECT b.id FROM public.barbers b WHERE b.user_id = auth.uid())
  );


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 4: PERFORMANCE INDEXES                                                ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON public.user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON public.user_roles(role);
CREATE INDEX IF NOT EXISTS idx_profiles_created_at ON public.profiles(created_at);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  PART 5: SEED DATA (Service categories, rate card, products, discounts)     ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝

INSERT INTO public.service_categories(name, sort_order) VALUES
  ('Hair Services',1),('Ironing',2),('Blow Dry',3),('Tonging',4),('Styling',5),
  ('Global Color',6),('Highlights',7),('Global + Highlights',8),
  ('Straightening',9),('Smoothing',10),('Keratin',11),
  ('Protein Treatment',12),('Bond Repair',13),('Cocktail Spa',14),('Scalp Treatment',15),
  ('Beauty - Threading',20),('Beauty - Bleach/D-tan',21),
  ('Manicure',22),('Pedicure',23),('Nail Bar',24),
  ('Waxing',25),('Facials',26),('Signature Facials',27),
  ('Makeup',28),('Saree Draping',29),
  ('Bridal Package',30),('Groom Package',31);

INSERT INTO public.services(category_id, name, price, is_package)
SELECT c.id, s.name, s.price, s.pkg FROM (VALUES
  ('Hair Services','Mens Cut and Styling',300,false),
  ('Hair Services','Women Cut and Blowdry',500,false),
  ('Hair Services','Child Cut Boy Below 10 Yrs',250,false),
  ('Hair Services','Child Cut Girl Below 10 Yrs',400,false),
  ('Hair Services','Mens Beard Shave',200,false),
  ('Ironing','Shoulder Length',500,false),
  ('Ironing','Below Shoulder',700,false),
  ('Ironing','Extra Long',1000,false),
  ('Blow Dry','Wash and Blast Dry',300,false),
  ('Blow Dry','Wash and Blow Dry',600,false),
  ('Blow Dry','Extra Long',700,false),
  ('Blow Dry','Without Wash Blow Dry',350,false),
  ('Tonging','Shoulder Length',700,false),
  ('Tonging','Below Shoulder',800,false),
  ('Tonging','Extra Length',1000,false),
  ('Styling','Mens Styling',200,false),
  ('Styling','Only Wash Men',150,false),
  ('Global Color','Bob Length',4000,false),
  ('Global Color','Shoulder Length',5000,false),
  ('Global Color','Below Shoulder',6000,false),
  ('Global Color','Extra Long',8000,false),
  ('Global Color','Mens All Over Colour',1200,false),
  ('Global Color','Beard Color (Men)',400,false),
  ('Global Color','Mens Ammonia Free',1500,false),
  ('Global Color','Womens Root Touch-Up',1200,false),
  ('Highlights','Per Strip',500,false),
  ('Global + Highlights','Bob Length',7500,false),
  ('Global + Highlights','Shoulder Length',8500,false),
  ('Global + Highlights','Below Shoulder',9500,false),
  ('Global + Highlights','Extra Long',12000,false),
  ('Straightening','Upto Neck',3500,false),
  ('Straightening','Shoulder Length',5000,false),
  ('Straightening','Below Shoulder',7500,false),
  ('Straightening','Upto Waist',10000,false),
  ('Smoothing','Fringe',2500,false),
  ('Smoothing','Crown Area',3500,false),
  ('Smoothing','Below Shoulder',7000,false),
  ('Smoothing','Upto Waist',10000,false),
  ('Keratin','Bob Length',5000,false),
  ('Keratin','Shoulder Length',6500,false),
  ('Keratin','Below Shoulder',7500,false),
  ('Keratin','Upto Waist',8500,false),
  ('Keratin','Extra Long',10000,false),
  ('Protein Treatment','Shoulder Length',1800,false),
  ('Protein Treatment','Below Shoulder',2000,false),
  ('Protein Treatment','Upto Waist',2200,false),
  ('Protein Treatment','Extra Long',2500,false),
  ('Protein Treatment','Mens',1200,false),
  ('Bond Repair','Shoulder Length',1800,false),
  ('Bond Repair','Below Shoulder',2000,false),
  ('Bond Repair','Upto Waist',2200,false),
  ('Bond Repair','Extra Long',2500,false),
  ('Bond Repair','Mens',1200,false),
  ('Cocktail Spa','Shoulder Length',2000,false),
  ('Cocktail Spa','Below Shoulder',2200,false),
  ('Cocktail Spa','Upto Waist',2500,false),
  ('Cocktail Spa','Extra Long',2500,false),
  ('Cocktail Spa','Mens',1500,false),
  ('Cocktail Spa','Deep Conditioning',1000,false),
  ('Cocktail Spa','Power Dose Ampuls',1000,false),
  ('Beauty - Threading','Eyebrows',100,false),
  ('Beauty - Threading','Upper Lips',50,false),
  ('Beauty - Threading','Forehead',50,false),
  ('Beauty - Threading','Chin',80,false),
  ('Beauty - Threading','Side Locks',80,false),
  ('Beauty - Threading','Full Face Threading',300,false),
  ('Beauty - Bleach/D-tan','Underarms',200,false),
  ('Beauty - Bleach/D-tan','Half Back',750,false),
  ('Beauty - Bleach/D-tan','Full Body Bleach',4500,false),
  ('Manicure','Regular Herbal',600,false),
  ('Manicure','Chocolate',1000,false),
  ('Manicure','Jelly Spa',1200,false),
  ('Pedicure','Heel Peel Treatment',2000,false),
  ('Pedicure','Foot Reflexology',800,false),
  ('Pedicure','Nail Filing & Paint',250,false),
  ('Waxing','Full Arms (Orange)',300,false),
  ('Waxing','Full Legs (Orange)',800,false),
  ('Waxing','Underarms Wax',250,false),
  ('Waxing','Bikini Wax',1500,false),
  ('Waxing','Nose Wax (Full)',250,false),
  ('Waxing','Ear Wax Full',250,false),
  ('Facials','Hydra Sea Moisturising',2000,false),
  ('Facials','Radiance Brightening',2500,false),
  ('Facials','Clarifying',2700,false),
  ('Signature Facials','White Lumination',3000,false),
  ('Signature Facials','Hydra Blue Plumping',4000,false),
  ('Makeup','Simple Makeup',2000,false),
  ('Makeup','Groom Makeup',3000,false),
  ('Saree Draping','Simple Saree',400,false),
  ('Saree Draping','Designer Saree',600,false),
  ('Bridal Package','Pre-Bridal Package (Full)',19000,true),
  ('Groom Package','Groom Package (Hair Cut + Beard etc.)',13500,true)
) AS s(cat, name, price, pkg)
JOIN public.service_categories c ON c.name = s.cat;

INSERT INTO public.products(name, price, cost, stock) VALUES
  ('Shampoo 200ml',450,250,20),
  ('Hair Serum',650,400,15),
  ('Beard Oil 50ml',350,180,25),
  ('Hair Wax',300,150,30);

INSERT INTO public.discount_rules(name, kind, value) VALUES
  ('Loyalty 10%','percent',10),
  ('Festival Flat ₹100','flat',100);


-- ╔══════════════════════════════════════════════════════════════════════════════╗
-- ║  ✅ DONE! Your database is ready.                                           ║
-- ║  Next: Go to your app and sign up — first user becomes Admin automatically. ║
-- ╚══════════════════════════════════════════════════════════════════════════════╝
