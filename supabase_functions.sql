-- ════════════════════════════════════════════════════════════════
-- Бурҷи Бохтар — серверная агрегация (масштабирование баланса)
-- Выполнить ОДИН раз в Supabase → SQL Editor.
-- Приложение работает и БЕЗ этих функций (откат на чтение всех строк),
-- но с ними баланс/статистика считаются на сервере и не зависят от
-- количества операций (хоть 100 000).
-- Функции используют SECURITY INVOKER — RLS остаётся в силе.
-- ════════════════════════════════════════════════════════════════

-- 1. УСТАРЕЛО — приложение это больше не вызывает.
--    Функция сводит доллары в сомони по курсу из company.usd_rate, а компания
--    валюты не конвертирует. Вместо неё используется cash_balance_by_currency(),
--    которая отдаёт остаток кассы отдельно по каждой валюте.
--    Оставлена только чтобы старые вкладки, не успевшие обновиться, не падали.
-- Баланс кассы (один запрос → одно число). Зеркалит логику getCashBalance():
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

-- 3. Потрачено по снабженцам — одна строка на работника вместо всех его
--    расходов построчно. Закрывает страницу «Снабженцы», карточку снабженца
--    и проверку остатка аванса при каждом сохранении расхода: раньше каждое
--    из этих мест выкачивало всю историю расходов.
--    Считается по ВАЛЮТАМ, суммой amount. Раньше складывался amount_tjs, то
--    есть доллары пересчитывались курсом на день ввода, а «выдано» по авансам
--    пересчитывалось курсом сегодняшним — из-за этого остаток у снабженца полз
--    сам по себе при каждом движении курса Нацбанка. Компания валюты не
--    конвертирует: сомони и доллары живут раздельно.
drop function if exists worker_spend(text);
create or replace function worker_spend(p_worker text default null)
returns table(worker_name text, currency text, spent numeric)
language sql
stable
security invoker
as $$
  select coalesce(o.worker_name, '') as worker_name,
         o.currency                  as currency,
         sum(coalesce(o.amount, 0))  as spent
  from operations o
  where o.type = 'expense'
    and (p_worker is null or o.worker_name = p_worker)
  group by coalesce(o.worker_name, ''), o.currency;
$$;

-- 4. Итоги за период по типу и валюте: не больше нескольких строк на любой
--    объём базы. Границы включительные; null — без ограничения.
--    drop нужен потому, что create or replace не умеет менять тип возврата:
--    если функция уже стояла в прежнем виде (без cnt), замена бы не прошла.
drop function if exists op_totals(date, date);
drop function if exists op_totals(date, date, text);
create or replace function op_totals(p_from date default null, p_to date default null,
                                     p_object text default null)
returns table(type text, currency text, cnt bigint, amount numeric, amount_tjs numeric)
language sql
stable
security invoker
as $$
  select o.type,
         o.currency,
         count(*)                       as cnt,
         sum(coalesce(o.amount, 0))     as amount,
         sum(coalesce(o.amount_tjs, 0)) as amount_tjs
  from operations o
  where (p_from   is null or o.date::date >= p_from)
    and (p_to     is null or o.date::date <= p_to)
    and (p_object is null or coalesce(o.object_name, '') = p_object)
  group by o.type, o.currency;
$$;

-- 4a. Расходы по категориям за период — для кольцевой диаграммы.
create or replace function op_by_category(p_from date default null, p_to date default null)
returns table(category_name text, amount_tjs numeric)
language sql
stable
security invoker
as $$
  select coalesce(o.category_name, '')  as category_name,
         sum(coalesce(o.amount_tjs, 0)) as amount_tjs
  from operations o
  where o.type = 'expense'
    and coalesce(o.category_name, '') <> ''
    and (p_from is null or o.date::date >= p_from)
    and (p_to   is null or o.date::date <= p_to)
  group by coalesce(o.category_name, '');
$$;

-- 4b. Приход и расход по объектам за период.
create or replace function op_by_object(p_from date default null, p_to date default null)
returns table(object_name text, inc_tjs numeric, exp_tjs numeric)
language sql
stable
security invoker
as $$
  select coalesce(o.object_name, '') as object_name,
         sum(case when o.type = 'income'  then coalesce(o.amount_tjs, 0) else 0 end) as inc_tjs,
         sum(case when o.type = 'expense' then coalesce(o.amount_tjs, 0) else 0 end) as exp_tjs
  from operations o
  where coalesce(o.object_name, '') <> ''
    and (p_from is null or o.date::date >= p_from)
    and (p_to   is null or o.date::date <= p_to)
  group by coalesce(o.object_name, '');
$$;

-- 4c. Помесячные итоги. График показывает шесть месяцев, поэтому и спрашивать
--     надо шесть, а не сводить всю историю ради шести чисел.
create or replace function op_by_month(p_from date default null, p_to date default null)
returns table(ym text, inc_tjs numeric, exp_tjs numeric)
language sql
stable
security invoker
as $$
  select to_char(o.date::date, 'YYYY-MM') as ym,
         sum(case when o.type = 'income'  then coalesce(o.amount_tjs, 0) else 0 end) as inc_tjs,
         sum(case when o.type = 'expense' then coalesce(o.amount_tjs, 0) else 0 end) as exp_tjs
  from operations o
  where (p_from is null or o.date::date >= p_from)
    and (p_to   is null or o.date::date <= p_to)
  group by to_char(o.date::date, 'YYYY-MM');
$$;

-- ────────────────────────────────────────────────────────────────
-- 4d–4h. Сводки для главной страницы.
--
-- ВАЖНО про валюты. Главная исторически складывает amount по TJS и USD в
-- один столбец, без конвертации, — в разбивках по категориям и по объектам.
-- Это поведение сохранено сознательно, по решению владельца проекта: перенос
-- на сервер не должен менять уже привычные цифры. Поэтому ниже суммируется
-- именно amount, а не amount_tjs. Если когда-нибудь решите привести к одной
-- валюте — заменяйте amount на amount_tjs здесь, и главная сойдётся со
-- «Статистикой», которая считает с конвертацией.
-- ────────────────────────────────────────────────────────────────

-- 4d. Расходы по категориям за период (без конвертации, см. примечание выше).
create or replace function op_by_category_raw(p_from date default null, p_to date default null,
                                              p_object text default null)
returns table(category_name text, amount numeric)
language sql
stable
security invoker
as $$
  select coalesce(o.category_name, '') as category_name,
         sum(coalesce(o.amount, 0))    as amount
  from operations o
  where o.type = 'expense'
    and coalesce(o.category_name, '') <> ''
    and (p_from   is null or o.date::date >= p_from)
    and (p_to     is null or o.date::date <= p_to)
    and (p_object is null or coalesce(o.object_name, '') = p_object)
  group by coalesce(o.category_name, '');
$$;

-- 4e. Приход и расход по объектам за всю историю (без конвертации).
create or replace function op_by_object_raw()
returns table(object_name text, inc numeric, exp numeric)
language sql
stable
security invoker
as $$
  select coalesce(o.object_name, '') as object_name,
         sum(case when o.type = 'income'  then coalesce(o.amount, 0) else 0 end) as inc,
         sum(case when o.type = 'expense' then coalesce(o.amount, 0) else 0 end) as exp
  from operations o
  where coalesce(o.object_name, '') <> ''
  group by coalesce(o.object_name, '');
$$;

-- 4f. Помесячный ряд только в сомони — ровно так его строила главная.
create or replace function op_by_month_tjs(p_from date default null, p_object text default null)
returns table(ym text, inc numeric, exp numeric)
language sql
stable
security invoker
as $$
  select to_char(o.date::date, 'YYYY-MM') as ym,
         sum(case when o.type = 'income'  then coalesce(o.amount, 0) else 0 end) as inc,
         sum(case when o.type = 'expense' then coalesce(o.amount, 0) else 0 end) as exp
  from operations o
  where o.currency = 'TJS'
    and (p_from   is null or o.date::date >= p_from)
    and (p_object is null or coalesce(o.object_name, '') = p_object)
  group by to_char(o.date::date, 'YYYY-MM');
$$;

-- 4g. Баланс кассы с разбивкой по валютам. Логика та же, что в cash_balance(),
--     но без сведе́ния к TJS: главная показывает сомони и доллары отдельно.
--     Расход снабженца, оплаченный из аванса, кассу второй раз не уменьшает.
create or replace function cash_balance_by_currency()
returns table(currency text, inc numeric, exp_direct numeric, adv numeric)
language sql
stable
security invoker
as $$
  select o.currency,
    sum(case when o.type = 'income' then coalesce(o.amount, 0) else 0 end) as inc,
    sum(case when o.type = 'expense'
              and coalesce(o.method, '') <> 'from_advance'
              and not exists (select 1 from profiles p
                              where p.role = 'supplier' and p.name = o.worker_name)
             then coalesce(o.amount, 0) else 0 end) as exp_direct,
    sum(case when o.type = 'advance' then coalesce(o.amount, 0) else 0 end) as adv
  from operations o
  group by o.currency;
$$;

-- 4i. Дневной ряд в сомони — спарклайны за 7 дней и сравнение 30/30 в шапке.
--     Раньше главная брала эти числа из помесячного свода, где у каждой строки
--     дата выставлена на первое число месяца. Из-за этого дневные графики
--     показывали нули во все дни, кроме первого, а в первое число — сразу
--     весь месяц. Это была ошибка, а не задумка, поэтому здесь честный
--     дневной разрез.
create or replace function op_by_day_tjs(p_from date)
returns table(d date, inc numeric, exp numeric)
language sql
stable
security invoker
as $$
  select o.date::date as d,
         sum(case when o.type = 'income'  then coalesce(o.amount, 0) else 0 end) as inc,
         sum(case when o.type = 'expense' then coalesce(o.amount, 0) else 0 end) as exp
  from operations o
  where o.currency = 'TJS'
    and o.date::date >= p_from
  group by o.date::date;
$$;

-- 4h. Сколько потрачено с авансов — по валютам, для плитки «У снабженцев».
drop function if exists advance_spend_total();
create or replace function advance_spend_total()
returns table(currency text, spent numeric)
language sql
stable
security invoker
as $$
  select o.currency, sum(coalesce(o.amount, 0)) as spent
  from operations o
  where o.type = 'expense'
    and (coalesce(o.method, '') = 'from_advance'
         or exists (select 1 from profiles p
                    where p.role = 'supplier' and p.name = o.worker_name))
  group by o.currency;
$$;

-- 4j. Выдано авансов — по валютам. Раньше клиент пересчитывал долларовые
--     авансы сегодняшним курсом, а потраченное брал по курсу на день ввода:
--     ровно отсюда и бралось «плавание» остатка.
create or replace function advance_given(p_worker text default null)
returns table(worker_name text, currency text, given numeric)
language sql
stable
security invoker
as $$
  select coalesce(a.worker_name, '') as worker_name,
         a.currency                  as currency,
         sum(coalesce(a.amount, 0))  as given
  from advances a
  where (p_worker is null or a.worker_name = p_worker)
  group by coalesce(a.worker_name, ''), a.currency;
$$;

-- 5. Доступ для ролей приложения
grant execute on function cash_balance()      to anon, authenticated;
grant execute on function op_rollup_alltime() to anon, authenticated;
grant execute on function worker_spend(text)   to anon, authenticated;
grant execute on function advance_given(text)  to anon, authenticated;
grant execute on function op_totals(date, date, text)          to anon, authenticated;
grant execute on function op_by_category(date, date)           to anon, authenticated;
grant execute on function op_by_object(date, date)             to anon, authenticated;
grant execute on function op_by_month(date, date)              to anon, authenticated;
grant execute on function op_by_category_raw(date, date, text) to anon, authenticated;
grant execute on function op_by_object_raw()                   to anon, authenticated;
grant execute on function op_by_month_tjs(date, text)          to anon, authenticated;
grant execute on function cash_balance_by_currency()           to anon, authenticated;
grant execute on function advance_spend_total()                to anon, authenticated;
grant execute on function op_by_day_tjs(date)                  to anon, authenticated;

-- 6. Индексы для скорости выборок (история по периодам и т.д.)
create index if not exists idx_operations_date     on operations(date);
create index if not exists idx_operations_type      on operations(type);
create index if not exists idx_operations_object    on operations(object_name);
create index if not exists idx_operations_worker    on operations(worker_name);
-- Составной индекс под worker_spend() и под выборки расходов конкретного
-- снабженца: по одному столбцу Postgres пришлось бы фильтровать вторым шагом.
create index if not exists idx_operations_type_worker on operations(type, worker_name);
-- Список операций всегда сортируется по date desc, id desc — под этот порядок
-- индекс позволяет читать страницу подряд, без сортировки всей выборки.
create index if not exists idx_operations_date_id on operations(date desc, id desc);

-- У advances не было ни одного индекса, хотя её фильтруют по работнику и
-- статусу на каждой странице снабженца и при каждой выдаче аванса.
create index if not exists idx_advances_worker on advances(worker_name);
create index if not exists idx_advances_status on advances(status);
create index if not exists idx_advances_worker_status on advances(worker_name, status);
create index if not exists idx_advances_object on advances(object_name);

-- ────────────────────────────────────────────────────────────────
-- НЕОБЯЗАТЕЛЬНО: чистка журнала входов.
-- user_logs пополняется при каждом входе и выходе и никогда не чистится,
-- а приложение читает оттуда последние 30 записей. Через пару лет это
-- десятки тысяч строк, которые никто не смотрит.
-- Блок намеренно закомментирован: это удаление данных, и запускать его
-- нужно осознанно. Раскомментируйте, если готовы обрезать журнал до
-- последних 90 дней.
--
-- delete from user_logs where created_at < now() - interval '90 days';
-- create index if not exists idx_user_logs_created on user_logs(created_at desc);
-- ────────────────────────────────────────────────────────────────
