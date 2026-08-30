alter table public.consult_booking_reservations
drop constraint if exists consult_booking_valid_slot;

alter table public.consult_booking_reservations
add constraint consult_booking_valid_slot
check (
  (reservation_date in (date '2026-09-02', date '2026-09-03', date '2026-09-04') and slot_number between 1 and 6)
  or (reservation_date = date '2026-09-05' and slot_number between 1 and 4)
);

