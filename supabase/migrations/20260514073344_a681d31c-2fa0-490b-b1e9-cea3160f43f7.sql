
-- ============ ROLES ============
create type public.app_role as enum ('admin', 'barber');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "profiles self read" on public.profiles for select to authenticated using (true);
create policy "profiles self update" on public.profiles for update to authenticated using (auth.uid() = id);

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role app_role not null,
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists(select 1 from public.user_roles where user_id=_user_id and role=_role)
$$;

create policy "roles readable by self" on public.user_roles for select to authenticated using (auth.uid() = user_id or public.has_role(auth.uid(),'admin'));
create policy "admins manage roles" on public.user_roles for all to authenticated using (public.has_role(auth.uid(),'admin')) with check (public.has_role(auth.uid(),'admin'));

-- Auto-create profile + first user becomes admin
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare user_count int;
begin
  insert into public.profiles(id, full_name) values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email));
  select count(*) into user_count from public.user_roles;
  if user_count = 0 then
    insert into public.user_roles(user_id, role) values (new.id, 'admin');
  else
    insert into public.user_roles(user_id, role) values (new.id, 'barber');
  end if;
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- updated_at trigger helper
create or replace function public.tg_set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end; $$;

-- ============ CORE BUSINESS ============
create table public.clients (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  mobile text not null unique,
  gender text check (gender in ('male','female','other')),
  date_of_birth date,
  notes text,
  total_spent numeric(12,2) not null default 0,
  due_amount numeric(12,2) not null default 0,
  last_visit_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clients_updated before update on public.clients for each row execute function public.tg_set_updated_at();
create index on public.clients(mobile);

create table public.service_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  sort_order int not null default 0
);

create table public.services (
  id uuid primary key default gen_random_uuid(),
  category_id uuid references public.service_categories(id) on delete set null,
  name text not null,
  price numeric(10,2) not null,
  duration_min int default 30,
  is_package boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create index on public.services(category_id);

create table public.products (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sku text,
  price numeric(10,2) not null,
  cost numeric(10,2),
  stock int not null default 0,
  low_stock_threshold int default 5,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.barbers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null,
  full_name text not null,
  mobile text,
  pin text, -- hashed in app
  monthly_salary numeric(10,2) not null default 0,
  shift_start time default '10:00',
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.bills (
  id uuid primary key default gen_random_uuid(),
  bill_no serial,
  client_id uuid not null references public.clients(id) on delete restrict,
  barber_id uuid references public.barbers(id) on delete set null,
  subtotal numeric(12,2) not null default 0,
  discount_type text check (discount_type in ('none','percent','flat')) default 'none',
  discount_value numeric(10,2) not null default 0,
  discount_amount numeric(12,2) not null default 0,
  total numeric(12,2) not null default 0,
  amount_paid numeric(12,2) not null default 0,
  due_amount numeric(12,2) not null default 0,
  status text not null default 'paid' check (status in ('paid','partial','due','void')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger bills_updated before update on public.bills for each row execute function public.tg_set_updated_at();
create index on public.bills(client_id);
create index on public.bills(barber_id);
create index on public.bills(created_at desc);

create table public.bill_items (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  item_type text not null check (item_type in ('service','product')),
  service_id uuid references public.services(id) on delete set null,
  product_id uuid references public.products(id) on delete set null,
  name text not null,
  qty int not null default 1,
  unit_price numeric(10,2) not null,
  total numeric(12,2) not null
);
create index on public.bill_items(bill_id);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  bill_id uuid not null references public.bills(id) on delete cascade,
  method text not null check (method in ('cash','upi','card','gift_card')),
  amount numeric(12,2) not null,
  reference_no text,
  paid_at timestamptz not null default now()
);
create index on public.payments(bill_id);

create table public.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  amount numeric(12,2) not null,
  vendor text,
  description text,
  payment_method text check (payment_method in ('cash','upi','card')),
  spent_on date not null default current_date,
  created_at timestamptz not null default now()
);
create index on public.expenses(spent_on desc);

create table public.gift_cards (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  client_id uuid references public.clients(id) on delete set null,
  initial_value numeric(10,2) not null,
  balance numeric(10,2) not null,
  expires_on date,
  status text not null default 'active' check (status in ('active','redeemed','expired','void')),
  created_at timestamptz not null default now()
);

create table public.gift_card_transactions (
  id uuid primary key default gen_random_uuid(),
  gift_card_id uuid not null references public.gift_cards(id) on delete cascade,
  bill_id uuid references public.bills(id) on delete set null,
  amount numeric(10,2) not null,
  kind text not null check (kind in ('issue','redeem','refund','expire')),
  created_at timestamptz not null default now()
);

create table public.attendance (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','half_day')) default 'present',
  check_in time,
  check_out time,
  unique(barber_id, date)
);

create table public.salary_records (
  id uuid primary key default gen_random_uuid(),
  barber_id uuid not null references public.barbers(id) on delete cascade,
  period_year int not null,
  period_month int not null,
  base_salary numeric(10,2) not null,
  revenue_generated numeric(12,2) not null default 0,
  incentive_pct numeric(5,2) not null default 0,
  incentive_amount numeric(10,2) not null default 0,
  overtime_amount numeric(10,2) not null default 0,
  total numeric(12,2) not null default 0,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique(barber_id, period_year, period_month)
);

create table public.reminders (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  kind text not null check (kind in ('birthday','followup','custom','bill')),
  message text not null,
  channel text default 'whatsapp',
  scheduled_for timestamptz,
  sent_at timestamptz,
  status text not null default 'pending' check (status in ('pending','sent','failed','cancelled')),
  created_at timestamptz not null default now()
);

create table public.discount_rules (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  kind text not null check (kind in ('percent','flat')),
  value numeric(10,2) not null,
  min_spend numeric(10,2),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ============ RLS: any authenticated user CRUD; admins only for sensitive deletes ============
do $$
declare t text;
begin
  for t in select unnest(array[
    'clients','service_categories','services','products','barbers','bills','bill_items',
    'payments','expenses','gift_cards','gift_card_transactions','attendance','salary_records',
    'reminders','discount_rules'
  ]) loop
    execute format('alter table public.%I enable row level security', t);
    execute format('create policy "auth read %1$s" on public.%1$I for select to authenticated using (true)', t);
    execute format('create policy "auth insert %1$s" on public.%1$I for insert to authenticated with check (true)', t);
    execute format('create policy "auth update %1$s" on public.%1$I for update to authenticated using (true)', t);
    execute format('create policy "admin delete %1$s" on public.%1$I for delete to authenticated using (public.has_role(auth.uid(),''admin''))', t);
  end loop;
end $$;

-- ============ SEED: service categories + TONI&GUY rate card ============
insert into public.service_categories(name, sort_order) values
  ('Hair Services',1),('Ironing',2),('Blow Dry',3),('Tonging',4),('Styling',5),
  ('Global Color',6),('Highlights',7),('Global + Highlights',8),
  ('Straightening',9),('Smoothing',10),('Keratin',11),
  ('Protein Treatment',12),('Bond Repair',13),('Cocktail Spa',14),('Scalp Treatment',15),
  ('Beauty - Threading',20),('Beauty - Bleach/D-tan',21),
  ('Manicure',22),('Pedicure',23),('Nail Bar',24),
  ('Waxing',25),('Facials',26),('Signature Facials',27),
  ('Makeup',28),('Saree Draping',29),
  ('Bridal Package',30),('Groom Package',31);

insert into public.services(category_id, name, price, is_package) 
select c.id, s.name, s.price, s.pkg from (values
  -- Hair Services
  ('Hair Services','Mens Cut and Styling',300,false),
  ('Hair Services','Women Cut and Blowdry',500,false),
  ('Hair Services','Child Cut Boy Below 10 Yrs',250,false),
  ('Hair Services','Child Cut Girl Below 10 Yrs',400,false),
  ('Hair Services','Mens Beard Shave',200,false),
  -- Ironing
  ('Ironing','Shoulder Length',500,false),
  ('Ironing','Below Shoulder',700,false),
  ('Ironing','Extra Long',1000,false),
  -- Blow Dry
  ('Blow Dry','Wash and Blast Dry',300,false),
  ('Blow Dry','Wash and Blow Dry',600,false),
  ('Blow Dry','Extra Long',700,false),
  ('Blow Dry','Without Wash Blow Dry',350,false),
  -- Tonging
  ('Tonging','Shoulder Length',700,false),
  ('Tonging','Below Shoulder',800,false),
  ('Tonging','Extra Length',1000,false),
  -- Styling
  ('Styling','Mens Styling',200,false),
  ('Styling','Only Wash Men',150,false),
  -- Global Color
  ('Global Color','Bob Length',4000,false),
  ('Global Color','Shoulder Length',5000,false),
  ('Global Color','Below Shoulder',6000,false),
  ('Global Color','Extra Long',8000,false),
  ('Global Color','Mens All Over Colour',1200,false),
  ('Global Color','Beard Color (Men)',400,false),
  ('Global Color','Mens Ammonia Free',1500,false),
  ('Global Color','Womens Root Touch-Up',1200,false),
  -- Highlights
  ('Highlights','Per Strip',500,false),
  -- Global + Highlights
  ('Global + Highlights','Bob Length',7500,false),
  ('Global + Highlights','Shoulder Length',8500,false),
  ('Global + Highlights','Below Shoulder',9500,false),
  ('Global + Highlights','Extra Long',12000,false),
  -- Straightening
  ('Straightening','Upto Neck',3500,false),
  ('Straightening','Shoulder Length',5000,false),
  ('Straightening','Below Shoulder',7500,false),
  ('Straightening','Upto Waist',10000,false),
  -- Smoothing
  ('Smoothing','Fringe',2500,false),
  ('Smoothing','Crown Area',3500,false),
  ('Smoothing','Below Shoulder',7000,false),
  ('Smoothing','Upto Waist',10000,false),
  -- Keratin
  ('Keratin','Bob Length',5000,false),
  ('Keratin','Shoulder Length',6500,false),
  ('Keratin','Below Shoulder',7500,false),
  ('Keratin','Upto Waist',8500,false),
  ('Keratin','Extra Long',10000,false),
  -- Protein
  ('Protein Treatment','Shoulder Length',1800,false),
  ('Protein Treatment','Below Shoulder',2000,false),
  ('Protein Treatment','Upto Waist',2200,false),
  ('Protein Treatment','Extra Long',2500,false),
  ('Protein Treatment','Mens',1200,false),
  -- Bond Repair
  ('Bond Repair','Shoulder Length',1800,false),
  ('Bond Repair','Below Shoulder',2000,false),
  ('Bond Repair','Upto Waist',2200,false),
  ('Bond Repair','Extra Long',2500,false),
  ('Bond Repair','Mens',1200,false),
  -- Cocktail Spa
  ('Cocktail Spa','Shoulder Length',2000,false),
  ('Cocktail Spa','Below Shoulder',2200,false),
  ('Cocktail Spa','Upto Waist',2500,false),
  ('Cocktail Spa','Extra Long',2500,false),
  ('Cocktail Spa','Mens',1500,false),
  ('Cocktail Spa','Deep Conditioning',1000,false),
  ('Cocktail Spa','Power Dose Ampuls',1000,false),
  -- Threading
  ('Beauty - Threading','Eyebrows',100,false),
  ('Beauty - Threading','Upper Lips',50,false),
  ('Beauty - Threading','Forehead',50,false),
  ('Beauty - Threading','Chin',80,false),
  ('Beauty - Threading','Side Locks',80,false),
  ('Beauty - Threading','Full Face Threading',300,false),
  -- Bleach/D-tan
  ('Beauty - Bleach/D-tan','Underarms',200,false),
  ('Beauty - Bleach/D-tan','Half Back',750,false),
  ('Beauty - Bleach/D-tan','Full Body Bleach',4500,false),
  -- Manicure
  ('Manicure','Regular Herbal',600,false),
  ('Manicure','Chocolate',1000,false),
  ('Manicure','Jelly Spa',1200,false),
  -- Pedicure
  ('Pedicure','Heel Peel Treatment',2000,false),
  ('Pedicure','Foot Reflexology',800,false),
  ('Pedicure','Nail Filing & Paint',250,false),
  -- Waxing
  ('Waxing','Full Arms (Orange)',300,false),
  ('Waxing','Full Legs (Orange)',800,false),
  ('Waxing','Underarms Wax',250,false),
  ('Waxing','Bikini Wax',1500,false),
  ('Waxing','Nose Wax (Full)',250,false),
  ('Waxing','Ear Wax Full',250,false),
  -- Facials
  ('Facials','Hydra Sea Moisturising',2000,false),
  ('Facials','Radiance Brightening',2500,false),
  ('Facials','Clarifying',2700,false),
  -- Signature Facials
  ('Signature Facials','White Lumination',3000,false),
  ('Signature Facials','Hydra Blue Plumping',4000,false),
  -- Makeup
  ('Makeup','Simple Makeup',2000,false),
  ('Makeup','Groom Makeup',3000,false),
  -- Saree Draping
  ('Saree Draping','Simple Saree',400,false),
  ('Saree Draping','Designer Saree',600,false),
  -- Bridal & Groom
  ('Bridal Package','Pre-Bridal Package (Full)',19000,true),
  ('Groom Package','Groom Package (Hair Cut + Beard etc.)',13500,true)
) as s(cat,name,price,pkg)
join public.service_categories c on c.name = s.cat;

-- Sample products
insert into public.products(name, price, cost, stock) values
  ('Shampoo 200ml',450,250,20),
  ('Hair Serum',650,400,15),
  ('Beard Oil 50ml',350,180,25),
  ('Hair Wax',300,150,30);

-- Default discount rules
insert into public.discount_rules(name, kind, value) values
  ('Loyalty 10%','percent',10),
  ('Festival Flat ₹100','flat',100);
