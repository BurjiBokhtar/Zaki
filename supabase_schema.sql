-- ════════════════════════════════════════════════
-- BINO ERP — Supabase Schema
-- Запустите этот файл в Supabase → SQL Editor
-- ════════════════════════════════════════════════

-- 1. КОМПАНИЯ
create table if not exists company (
  id bigint primary key default 1,
  name text default 'ООО СтройКомпания',
  phone text default '+992 123 45 67',
  email text default 'info@company.tj',
  address text default 'Душанбе, Таджикистан',
  usd_rate numeric default 10.92,
  lang text default 'ru',
  updated_at timestamptz default now()
);
insert into company (id) values (1) on conflict (id) do nothing;

-- 2. ПОЛЬЗОВАТЕЛИ (дополнение к auth.users)
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  role text not null check (role in ('accountant','supplier','director')),
  phone text,
  object_name text,
  is_active boolean default true,
  created_at timestamptz default now()
);

-- 3. ОБЪЕКТЫ
create table if not exists objects (
  id bigserial primary key,
  name text not null,
  address text,
  status text default 'active',
  created_at timestamptz default now()
);
insert into objects (name) values
  ('Объект А-1'),('Объект Б-2'),('Объект В-3'),('Офис')
on conflict do nothing;

-- 4. КАТЕГОРИИ
create table if not exists categories (
  id bigserial primary key,
  name text not null,
  type text not null check (type in ('income','expense')),
  icon text default '📦'
);
insert into categories (name, type) values
  ('Продажа квартир','income'),('Продажа бетона','income'),
  ('Аренда','income'),('Услуги','income'),('Прочий доход','income'),
  ('Материалы','expense'),('Цемент','expense'),('Арматура','expense'),
  ('Доставка','expense'),('Бензин','expense'),('Зарплата','expense'),
  ('Питание','expense'),('Инструменты','expense'),('Другие расходы','expense')
on conflict do nothing;

-- 5. ЕДИНИЦЫ ИЗМЕРЕНИЯ
create table if not exists units (
  id bigserial primary key,
  name text not null unique
);
insert into units (name) values
  ('шт'),('кг'),('л'),('м²'),('м³'),('тонн'),('мешок'),('рейс'),('компл'),('м')
on conflict do nothing;

-- 6. ОПЕРАЦИИ (приходы, расходы, авансы)
create table if not exists operations (
  id bigserial primary key,
  type text not null check (type in ('income','expense','advance')),
  date date not null,
  object_name text default '',
  category_name text default '',
  description text default '',
  qty numeric,
  unit text,
  price numeric,
  amount numeric not null,
  currency text not null default 'TJS',
  amount_tjs numeric,
  amount_usd numeric,
  usd_rate numeric default 10.92,
  method text default 'cash',
  worker_name text default '',
  target_worker text default '',
  note text default '',
  created_by uuid references auth.users(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 7. АВАНСЫ СНАБЖЕНЦАМ
create table if not exists advances (
  id bigserial primary key,
  worker_name text not null,
  object_name text default '',
  task text default '',
  amount numeric not null,
  currency text default 'TJS',
  stage int default 0,
  stages int default 4,
  stage_names jsonb default '["Старт","Закупка","Доставка","Сдача"]',
  due_date date,
  status text default 'active',
  created_at timestamptz default now()
);

-- 8. МАСТЕРА
create table if not exists masters (
  id bigserial primary key,
  name text not null,
  phone text,
  specialty text,
  object_name text,
  advance_amount numeric default 0,
  worked_amount numeric default 0,
  currency text default 'TJS',
  due_date date,
  status text default 'active',
  notes text,
  created_at timestamptz default now()
);

-- 9. РАБОТЫ МАСТЕРОВ
create table if not exists master_works (
  id bigserial primary key,
  master_id bigint references masters(id) on delete cascade,
  date date not null,
  amount numeric not null,
  description text,
  created_at timestamptz default now()
);

-- 10. ДОЛГИ
create table if not exists debts (
  id bigserial primary key,
  type text not null check (type in ('creditor','debtor')),
  name text not null,
  description text,
  total_amount numeric not null,
  paid_amount numeric default 0,
  currency text default 'TJS',
  due_date date,
  status text default 'active',
  created_at timestamptz default now()
);

-- 11. ВОЗВРАТЫ ДОЛГОВ
create table if not exists debt_returns (
  id bigserial primary key,
  debt_id bigint references debts(id) on delete cascade,
  type text check (type in ('money','barter')),
  amount numeric not null,
  date date not null,
  description text,
  created_at timestamptz default now()
);

-- 12. AUDIT LOG
create table if not exists audit_log (
  id bigserial primary key,
  user_id uuid,
  user_name text,
  action text,
  table_name text,
  record_id bigint,
  details jsonb,
  created_at timestamptz default now()
);

-- ════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ════════════════════════════════════════════════
alter table profiles enable row level security;
alter table operations enable row level security;
alter table advances enable row level security;
alter table masters enable row level security;
alter table debts enable row level security;
alter table debt_returns enable row level security;
alter table objects enable row level security;
alter table categories enable row level security;
alter table units enable row level security;
alter table company enable row level security;
alter table audit_log enable row level security;
alter table master_works enable row level security;

-- Profiles: каждый видит свой профиль
create policy "profiles_select" on profiles for select using (auth.uid() = id);
create policy "profiles_insert" on profiles for insert with check (auth.uid() = id);
create policy "profiles_update" on profiles for update using (auth.uid() = id);

-- Публичные справочники (все авторизованные)
create policy "objects_all" on objects for all using (auth.role() = 'authenticated');
create policy "categories_all" on categories for all using (auth.role() = 'authenticated');
create policy "units_all" on units for all using (auth.role() = 'authenticated');
create policy "company_all" on company for all using (auth.role() = 'authenticated');

-- Операции: supplier видит только свои
create policy "ops_select" on operations for select using (
  auth.role() = 'authenticated'
);
create policy "ops_insert" on operations for insert with check (auth.role() = 'authenticated');
create policy "ops_update" on operations for update using (auth.role() = 'authenticated');
create policy "ops_delete" on operations for delete using (auth.role() = 'authenticated');

-- Авансы, мастера, долги — все авторизованные
create policy "advances_all" on advances for all using (auth.role() = 'authenticated');
create policy "masters_all" on masters for all using (auth.role() = 'authenticated');
create policy "master_works_all" on master_works for all using (auth.role() = 'authenticated');
create policy "debts_all" on debts for all using (auth.role() = 'authenticated');
create policy "debt_returns_all" on debt_returns for all using (auth.role() = 'authenticated');
create policy "audit_all" on audit_log for all using (auth.role() = 'authenticated');

-- ════════════════════════════════════════════════
-- SEED DEMO DATA
-- ════════════════════════════════════════════════
insert into advances (worker_name, object_name, task, amount, stage) values
  ('Алишер Рахимов', 'Объект А-1', 'Закупка арматуры', 10000, 2),
  ('Бахром Назаров', 'Объект Б-2', 'Доставка цемента', 5000, 1)
on conflict do nothing;

insert into masters (name, phone, specialty, object_name, advance_amount, worked_amount, due_date) values
  ('Хасанов Бобур', '+992 901 111 222', 'Бетонные работы', 'Объект А-1', 10000, 4000, '2026-06-01'),
  ('Рахимов Зафар', '+992 918 333 444', 'Кладка', 'Объект Б-2', 8000, 8000, '2026-05-01')
on conflict do nothing;

insert into debts (type, name, description, total_amount, paid_amount, due_date) values
  ('creditor', 'ООО СтройМатериал', 'Цемент М400', 5400, 0, '2026-04-30'),
  ('debtor', 'Камол Мирзоев', 'Личный долг', 8000, 3200, '2026-06-01')
on conflict do nothing;

-- ════════════════════════════════════════════════
-- ФУНКЦИЯ для получения статистики дашборда
-- ════════════════════════════════════════════════
create or replace function get_dashboard_stats(period_filter text default 'all')
returns json language plpgsql security definer as $$
declare
  date_from date;
  result json;
begin
  if period_filter = 'today' then date_from := current_date;
  elsif period_filter = 'month' then date_from := date_trunc('month', current_date)::date;
  elsif period_filter = 'year' then date_from := date_trunc('year', current_date)::date;
  else date_from := '2000-01-01';
  end if;

  select json_build_object(
    'income_tjs', coalesce(sum(case when type='income' then amount_tjs else 0 end),0),
    'income_usd', coalesce(sum(case when type='income' then amount_usd else 0 end),0),
    'expense_tjs', coalesce(sum(case when type='expense' then amount_tjs else 0 end),0),
    'expense_usd', coalesce(sum(case when type='expense' then amount_usd else 0 end),0),
    'advance_tjs', coalesce(sum(case when type='advance' then amount_tjs else 0 end),0),
    'count', count(*)
  ) into result
  from operations
  where date >= date_from;

  return result;
end;
$$;
