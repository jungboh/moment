alter table public.consult_booking_reservations
drop constraint if exists consult_booking_valid_slot;

alter table public.consult_booking_reservations
add constraint consult_booking_valid_slot
check (slot_number between 1 and 6);

