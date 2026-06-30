-- ════════════════════════════════════════════════════════════════
-- Бурҷи Бохтар — серверная агрегация (масштабирование баланса)
-- Выполнить ОДИН раз в Supabase → SQL Editor.
-- Приложение работает и БЕЗ этих функций (откат на чтение всех строк),
-- но с ними баланс/статистика считаются на сервере и не зависят от
-- количества операций (хоть 100 000).
-- Функции используют SECURITY INVOKER — RLS остаётся в силе.
-- ════════════════════════════════════════════════════════════════

-- 1. Баланс кассы (один запрос → одно число). Зеркалит логику getCashBalance():
--    income +,  advance −,  expense − (кроме оплаченных из аванса снабженца).
create or replace function cash_balance()
returns numeric
language sql
stable
security invoker
as $$
  with r as (select coalesce((select usd_rate from company where id = 1), 10.92) as rate)
  select coalesce(sum(case
    when o.type = 'income'  then coalesce(o.amount_tjs, case when o.currency='USD' then o.amount*r.rate else o.amount end)
    when o.type = 'advance' then -coalesce(o.amount_tjs, case when o.currency='USD' then o.amount*r.rate else o.amount end)
    when o.type = 'expense'
         and coalesce(o.method,'') <> 'from_advance'
         and not exists (select 1 from profiles p where p.role='supplier' and p.name = o.worker_name)
      then -coalesce(o.amount_tjs, case when o.currency='USD' then o.amount*r.rate else o.amount end)
    else 0 end), 0)
  from operations o, r;
$$;

-- 2. Свод всех операций по группам (суммы), а не построчно.
--    Кардинальность ограничена набором измерений, а НЕ числом строк —
--    поэтому при росте операций результат остаётся компактным.
create or replace function op_rollup_alltime()
returns table(
  type        text,
  currency    text,
  method      text,
  worker_name text,
  object_name text,
  ym          text,
  amount      numeric,
  amount_tjs  numeric
)
language sql
stable
security invoker
as $$
  select
    o.type,
    o.currency,
    coalesce(o.method,'')      as method,
    coalesce(o.worker_name,'') as worker_name,
    coalesce(o.object_name,'') as object_name,
    to_char(o.date::date,'YYYY-MM') as ym,
    sum(o.amount)                   as amount,
    sum(coalesce(o.amount_tjs,0))   as amount_tjs
  from operations o
  group by o.type, o.currency, coalesce(o.method,''), coalesce(o.worker_name,''),
           coalesce(o.object_name,''), to_char(o.date::date,'YYYY-MM');
$$;

-- 3. Доступ для ролей приложения
grant execute on function cash_balance()      to anon, authenticated;
grant execute on function op_rollup_alltime() to anon, authenticated;

-- 4. Индексы для скорости выборок (история по периодам и т.д.)
create index if not exists idx_operations_date     on operations(date);
create index if not exists idx_operations_type      on operations(type);
create index if not exists idx_operations_object    on operations(object_name);
create index if not exists idx_operations_worker    on operations(worker_name);
