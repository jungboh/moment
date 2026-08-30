create table if not exists public.consult_booking_reservations (
  id uuid primary key default gen_random_uuid(),
  reservation_date date not null,
  slot_number smallint not null,
  student_number text not null,
  student_name text not null,
  created_at timestamptz not null default now(),
  constraint consult_booking_valid_date check (reservation_date in (date '2026-09-02', date '2026-09-03', date '2026-09-04', date '2026-09-05')),
  constraint consult_booking_valid_slot check (
    (reservation_date in (date '2026-09-02', date '2026-09-03', date '2026-09-04') and slot_number between 1 and 5)
    or (reservation_date = date '2026-09-05' and slot_number between 1 and 3)
  ),
  constraint consult_booking_student_number_format check (student_number ~ '^[0-9]{1,10}$'),
  constraint consult_booking_student_name_length check (char_length(btrim(student_name)) between 2 and 20),
  constraint consult_booking_unique_slot unique (reservation_date, slot_number)
);

alter table public.consult_booking_reservations enable row level security;

revoke all on table public.consult_booking_reservations from anon, authenticated;
grant select (id, reservation_date, slot_number, student_name, created_at)
on table public.consult_booking_reservations to anon, authenticated;
grant insert (reservation_date, slot_number, student_number, student_name)
on table public.consult_booking_reservations to anon, authenticated;

create policy "consult reservations are publicly readable"
on public.consult_booking_reservations
for select
to anon, authenticated
using (true);

create policy "valid consult reservations can be created"
on public.consult_booking_reservations
for insert
to anon, authenticated
with check (
  reservation_date in (date '2026-09-02', date '2026-09-03', date '2026-09-04', date '2026-09-05')
  and student_number ~ '^[0-9]{1,10}$'
  and char_length(btrim(student_name)) between 2 and 20
);

