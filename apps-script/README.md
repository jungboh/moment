# 영수증 분개 연습 - 백엔드(Apps Script) 설정 방법

`accounting.html`이 영수증 사진을 인식하고(OCR) 학생의 분개를 AI로 채점하려면,
이 폴더의 `Code.gs`를 Google Apps Script 웹앱으로 배포해야 합니다.
Gemini API를 사용하며, 학교/개인 계정 기준으로 무료 사용량 안에서 충분히 쓸 수 있습니다.

## 1. Gemini API 키 발급

1. https://aistudio.google.com/apikey 접속 (구글 계정 로그인)
2. "API 키 만들기(Create API key)" 클릭 후 키를 복사해둡니다.

## 2. Apps Script 프로젝트 만들기

1. https://script.google.com 접속 → "새 프로젝트"
2. 왼쪽 파일 목록에서 기본 `Code.gs` 내용을 지우고, 이 저장소의
   `apps-script/Code.gs` 내용 전체를 복사해서 붙여넣습니다.
3. 좌측 "프로젝트 설정" 톱니바퀴 아이콘 옆의 `appsscript.json` 매니페스트를 수정하려면
   "프로젝트 설정"에서 "'appsscript.json' 매니페스트 파일을 편집기에서 보기"를 체크한 뒤,
   `apps-script/appsscript.json` 내용으로 교체합니다. (선택사항 — 기본값으로도 동작합니다)

## 3. API 키 등록 (코드에 직접 넣지 않습니다)

1. Apps Script 편집기에서 좌측 톱니바퀴(프로젝트 설정) 클릭
2. "스크립트 속성" 항목에서 "스크립트 속성 추가"
3. 속성 이름: `GEMINI_API_KEY`, 값: 1번에서 발급받은 API 키 입력 후 저장

## 4. 웹앱으로 배포

1. 편집기 우측 상단 "배포" → "새 배포"
2. 유형 선택에서 "웹앱" 선택
3. 옵션 설정:
   - 실행 계정: **나(본인)**
   - 액세스 권한: **모든 사용자** (학생들이 로그인 없이 접근하려면 필요)
4. "배포" 클릭 → 권한 승인(본인 구글 계정) → 배포 완료 후 나오는
   **웹앱 URL**(`https://script.google.com/macros/s/…/exec`)을 복사합니다.

## 5. 프런트엔드에 연결

`accounting.html` 상단 스크립트에서 아래 줄을 찾아 방금 복사한 URL로 바꿉니다.

```js
const GAS_URL = 'https://script.google.com/macros/s/여기에_배포_후_받은_ID를_넣으세요/exec';
```

저장 후 `accounting.html`을 열어 영수증 사진을 올려보면 자동 인식과 채점이 동작합니다.

## 6. 코드 수정 후 재배포

`Code.gs`를 수정했다면 "배포" → "배포 관리" → 기존 배포 옆 연필 아이콘 → 버전을
"새 버전"으로 바꾸고 "배포"를 눌러야 변경사항이 실제 URL에 반영됩니다
(URL 자체는 바뀌지 않습니다).

## 참고

- 채점 결과는 서버에 저장되지 않습니다. 학생 기기의 브라우저(localStorage)에만
  최근 30건의 연습 기록이 남습니다.
- 계정과목 목록을 바꾸고 싶다면 `accounting.html`의 `DR_ACCOUNTS`/`CR_ACCOUNTS`와
  `Code.gs`의 `DR_ACCOUNTS`/`CR_ACCOUNTS`를 **동일하게** 함께 수정하세요.
