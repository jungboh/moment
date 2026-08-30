import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react'
import { CalendarDays, CheckCircle2, Info, LoaderCircle, X } from 'lucide-react'
import { supabase } from './supabase'
import type { BookingTarget, Reservation } from './types'

const DAYS = [
  { date: '2026-09-02', weekday: '수요일', label: '9월 2일', short: '9월 2일(수)', slots: 5 },
  { date: '2026-09-03', weekday: '목요일', label: '9월 3일', short: '9월 3일(목)', slots: 5 },
  { date: '2026-09-04', weekday: '금요일', label: '9월 4일', short: '9월 4일(금)', slots: 5 },
  { date: '2026-09-05', weekday: '토요일', label: '9월 5일', short: '9월 5일(토)', slots: 3 },
] as const

function App() {
  const [reservations, setReservations] = useState<Reservation[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [target, setTarget] = useState<BookingTarget | null>(null)
  const [studentNumber, setStudentNumber] = useState('')
  const [studentName, setStudentName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const [success, setSuccess] = useState('')

  const loadReservations = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    const { data, error } = await supabase
      .from('consult_booking_reservations')
      .select('id,reservation_date,slot_number,student_name,created_at')
      .order('reservation_date')
      .order('slot_number')

    if (error) {
      setLoadError('예약 현황을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.')
    } else {
      setReservations((data ?? []) as Reservation[])
      setLoadError('')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    void loadReservations()
    const interval = window.setInterval(() => void loadReservations(true), 15000)
    return () => {
      window.clearInterval(interval)
    }
  }, [loadReservations])

  const bySlot = useMemo(() => {
    return new Map(reservations.map((item) => [`${item.reservation_date}-${item.slot_number}`, item]))
  }, [reservations])

  const openBooking = (day: (typeof DAYS)[number], slot: number) => {
    setTarget({ date: day.date, dateLabel: day.short, slot })
    setStudentNumber('')
    setStudentName('')
    setFormError('')
    setSuccess('')
  }

  const closeBooking = () => {
    if (submitting) return
    setTarget(null)
    setFormError('')
  }

  const submitBooking = async (event: FormEvent) => {
    event.preventDefault()
    if (!target) return
    const number = studentNumber.trim()
    const name = studentName.trim()
    if (!/^\d{1,10}$/.test(number)) {
      setFormError('학번은 숫자로 입력해 주세요.')
      return
    }
    if (name.length < 2 || name.length > 20) {
      setFormError('이름을 2~20자로 입력해 주세요.')
      return
    }

    setSubmitting(true)
    setFormError('')
    const { error } = await supabase.from('consult_booking_reservations').insert({
      reservation_date: target.date,
      slot_number: target.slot,
      student_number: number,
      student_name: name,
    })

    if (error) {
      if (error.code === '23505') {
        setFormError('방금 다른 학생이 이 자리를 예약했습니다. 다른 차시를 선택해 주세요.')
      } else {
        setFormError('예약을 완료하지 못했습니다. 잠시 후 다시 시도해 주세요.')
      }
      await loadReservations(true)
      setSubmitting(false)
      return
    }

    await loadReservations(true)
    setSubmitting(false)
    setTarget(null)
    setSuccess(`${target.dateLabel} · ${target.slot}차 예약이 완료되었습니다.`)
    window.setTimeout(() => setSuccess(''), 5000)
  }

  return (
    <main className="page-shell">
      <section className="booking-page" aria-labelledby="page-title">
        <header className="hero">
          <p className="eyebrow">COUNSELING RESERVATION</p>
          <h1 id="page-title">3금융 수시 3차 상담예약</h1>
          <p className="intro">원하는 날짜와 차시의 예약 버튼을 눌러 신청하세요. 예약이 완료된 자리에는 예약자명이 표시됩니다.</p>
          <div className="period-pill"><CalendarDays aria-hidden="true" /> 예약 기간: 9월 2일(수) ~ 9월 5일(토)</div>
        </header>

        <section className="prep-panel" aria-labelledby="prep-title">
          <div className="prep-heading">
            <span className="prep-number">✓</span>
            <div>
              <p>상담 전 준비</p>
              <h2 id="prep-title">상담 전 해야 할 일</h2>
            </div>
          </div>
          <ol className="prep-list">
            <li>
              <strong>모집요강 확인</strong>
              <span>접수 일정, 합격자 발표 일정(추가합격 일정 포함), 제출 서류, 지원 자격 등을 확인하세요.</span>
            </li>
            <li>
              <strong>입결 확인</strong>
              <span>최초합격, 추가합격, 추가합격 인원 등 확인 가능한 입시 결과 자료를 모두 준비하세요.</span>
            </li>
          </ol>
        </section>

        <aside className="final-guidance" aria-label="상담 안내">
          <Info aria-hidden="true" />
          <strong>안내</strong>
          <span>최종 상담이며, 학부모 확인서가 배부됩니다.</span>
        </aside>

        {loadError && <div className="notice error-notice" role="alert">{loadError}<button onClick={() => void loadReservations()}>다시 시도</button></div>}
        {success && <div className="notice success-notice" role="status"><CheckCircle2 aria-hidden="true" />{success}</div>}

        <section className="days-grid" aria-label="날짜별 상담 예약 현황" aria-busy={loading}>
          {DAYS.map((day) => {
            const bookedCount = reservations.filter((item) => item.reservation_date === day.date).length
            const remaining = day.slots - bookedCount
            return (
              <article className="day-card" key={day.date}>
                <header className="day-header">
                  <div>
                    <span className="weekday">{day.weekday}</span>
                    <h2>{day.label}</h2>
                  </div>
                  <span className={`remaining ${remaining === 0 ? 'closed' : ''}`}>{remaining === 0 ? '예약 마감' : `${remaining}자리 가능`}</span>
                </header>
                <div className="slots">
                  {Array.from({ length: day.slots }, (_, index) => index + 1).map((slot) => {
                    const reservation = bySlot.get(`${day.date}-${slot}`)
                    return (
                      <div className={`slot-row ${reservation ? 'booked' : ''}`} key={slot}>
                        <span className="slot-number">{slot}차</span>
                        <span className={`slot-name ${reservation ? '' : 'available'}`}>{reservation?.student_name ?? '예약 가능'}</span>
                        {reservation ? (
                          <span className="complete-label">예약 완료</span>
                        ) : (
                          <button className="book-button" disabled={loading} onClick={() => openBooking(day, slot)}>예약</button>
                        )}
                      </div>
                    )
                  })}
                </div>
              </article>
            )
          })}
        </section>

        <footer className="legend">
          <div><span className="legend-dot blue" /><strong>예약 가능</strong><span>아직 예약할 수 있는 자리입니다.</span></div>
          <div><span className="legend-dot gray" /><strong>예약 완료</strong><span>이미 예약이 완료된 자리입니다.</span></div>
          <div className="legend-help"><Info aria-hidden="true" /><span>예약 변경·취소는 정보람선생님에게 문의해주세요.</span></div>
        </footer>
      </section>

      {target && (
        <div className="modal-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && closeBooking()}>
          <section className="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title">
            <button className="modal-close" onClick={closeBooking} aria-label="예약 창 닫기"><X /></button>
            <p className="modal-kicker">상담 예약</p>
            <h2 id="modal-title">{target.dateLabel} · {target.slot}차 상담</h2>
            <p className="modal-copy">학번과 이름을 정확히 입력해 주세요.</p>
            <form onSubmit={submitBooking}>
              <label>학번<input autoFocus inputMode="numeric" autoComplete="off" value={studentNumber} onChange={(event) => setStudentNumber(event.target.value)} placeholder="예: 30101" maxLength={10} /></label>
              <label>이름<input autoComplete="name" value={studentName} onChange={(event) => setStudentName(event.target.value)} placeholder="이름 입력" maxLength={20} /></label>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions">
                <button type="button" className="cancel-button" onClick={closeBooking}>취소</button>
                <button type="submit" className="confirm-button" disabled={submitting}>{submitting ? <><LoaderCircle className="spinner" />예약 중</> : '예약 완료'}</button>
              </div>
            </form>
          </section>
        </div>
      )}
    </main>
  )
}

export default App

