# 3금융 수시 2차 상담예약

9월 2일(수)부터 9월 5일(토)까지의 상담 차시를 한 화면에서 확인하고 예약하는 단일 페이지 앱입니다.

## 실행

```bash
npm install
npm run dev
```

기본 설정은 연결된 Supabase 프로젝트의 공개 publishable key를 사용합니다. 다른 프로젝트에 연결할 때는 `.env.example`을 참고해 `.env.local`을 생성하세요.

## 데이터베이스

`supabase/migrations/202608300001_create_consult_booking_reservations.sql`을 적용합니다. 공개 조회에서는 학번을 제외한 예약 날짜·차시·이름만 제공하고, 생성 시에만 학번을 받습니다. 수정·삭제 정책은 없습니다. `(reservation_date, slot_number)` 고유 제약으로 동시 중복 예약을 차단합니다.

