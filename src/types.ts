export type Reservation = {
  id: string
  reservation_date: string
  slot_number: number
  student_number?: string
  student_name: string
  created_at: string
}

export type BookingTarget = {
  date: string
  dateLabel: string
  slot: number
}

