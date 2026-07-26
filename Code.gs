/**
 * 영수증 분개 연습 - Google Apps Script 백엔드
 *
 * accounting.html 이 호출하는 3가지 액션을 처리합니다.
 *   - action: 'extract' → 영수증 사진에서 가맹점명/거래일자/금액 추출
 *   - action: 'hint'    → 학생용 힌트와 모범 분개 생성
 *   - action 없음       → 학생이 제출한 분개 채점
 *
 * 사전 설정:
 * 1. Apps Script 프로젝트 설정 → 스크립트 속성
 * 2. 속성 이름: GEMINI_API_KEY
 * 3. 값: 발급받은 Gemini API 키
 */

// 프런트엔드(accounting.html)의 계정과목 목록과 동일하게 유지하세요.
var DR_ACCOUNTS = [
  '소모품비',
  '도서인쇄비',
  '여비교통비',
  '회의비',
  '접대비',
  '복리후생비',
  '통신비',
  '수도광열비',
  '차량유지비',
  '교육훈련비',
  '광고선전비',
  '사무용품비',
  '식대',
  '기타잡비'
];

var CR_ACCOUNTS = [
  '현금',
  '보통예금',
  '미지급금',
  '미지급비용'
];

var GEMINI_MODEL = 'gemini-3.5-flash-lite';

// 계정과목 이름만 제시하면 유사 계정 간 판단이 흔들리므로 수업용 판단 기준도 함께 제공합니다.
var ACCOUNTING_RULES = [
  '소모품비: 청소용품, 생활용품, 포장재 등 단기간 사용하는 일반 소모품',
  '사무용품비: 문구류, 복사용지, 파일, 토너 등 사무 목적 물품',
  '도서인쇄비: 책, 교재, 인쇄, 복사, 제본',
  '여비교통비: 버스, 지하철, 철도, 택시, 출장 교통비',
  '회의비: 업무상 회의 참석자의 통상적인 식음료',
  '접대비: 거래처 등 외부 관계자를 위한 식사·선물',
  '복리후생비: 임직원 전체 또는 복리후생 목적의 식사·간식·물품',
  '식대: 일반적인 업무 관련 식사로 회의·접대·복리후생 근거가 없는 경우',
  '통신비: 전화, 인터넷, 우편, 택배',
  '수도광열비: 전기, 수도, 가스, 난방',
  '차량유지비: 주유, 주차, 통행료, 차량 수리·세차',
  '교육훈련비: 강의, 연수, 교육 참가비',
  '광고선전비: 광고, 홍보물, 온라인 홍보',
  '기타잡비: 위 계정으로 합리적으로 분류할 수 없는 소액 비용',
  '신용카드 결제: 미지급금, 체크카드·계좌이체: 보통예금, 현금 결제: 현금',
  '영수증에 결제수단이 명확하지 않으면 단정하지 말고 confidence를 낮출 것'
];

/**
 * 웹앱 주소를 브라우저에서 직접 열었을 때 실행됩니다.
 */
function doGet(e) {
  return ContentService
    .createTextOutput('영수증 분개 연습 백엔드가 정상 동작 중입니다.')
    .setMimeType(ContentService.MimeType.TEXT);
}

/**
 * accounting.html에서 POST 요청을 보냈을 때 실행됩니다.
 */
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      throw new Error('요청 본문이 없습니다.');
    }

    var body = JSON.parse(e.postData.contents);
    var action = body.action || 'grade';
    var result;

    if (action === 'extract') {
      result = extractReceipt(body);
    } else if (action === 'hint') {
      result = buildHint(body);
    } else if (action === 'grade') {
      result = gradeEntry(body);
    } else {
      throw new Error('지원하지 않는 action입니다: ' + action);
    }

    return jsonOutput({
      ok: true,
      result: result
    });
  } catch (err) {
    console.error(err);
    return jsonOutput({
      ok: false,
      error: err && err.message ? err.message : String(err)
    });
  }
}

/**
 * JSON 응답 생성
 */
function jsonOutput(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * 영수증을 한 번 읽어 이후 힌트와 채점에서 재사용할 구조화 자료를 만듭니다.
 */
function extractReceipt(body) {
  requireImage(body);

  var schema = {
    type: 'OBJECT',
    properties: {
      vendor: {
        type: 'STRING',
        description: '가맹점명 또는 상호명. 확인할 수 없으면 빈 문자열'
      },
      date: {
        type: 'STRING',
        description: 'YYYY-MM-DD 형식의 거래일자. 확인할 수 없으면 빈 문자열'
      },
      amount: {
        type: 'NUMBER',
        description: '최종 결제 금액. 원 단위 숫자만. 확인할 수 없으면 0'
      },
      supply_amount: { type: 'NUMBER', description: '공급가액. 확인할 수 없으면 0' },
      vat_amount: { type: 'NUMBER', description: '부가세. 확인할 수 없으면 0' },
      items: {
        type: 'ARRAY',
        items: {
          type: 'OBJECT',
          properties: {
            name: { type: 'STRING' },
            quantity: { type: 'NUMBER' },
            amount: { type: 'NUMBER' }
          },
          required: ['name', 'quantity', 'amount']
        },
        description: '읽을 수 있는 구매 품목 목록'
      },
      payment_method: {
        type: 'STRING',
        enum: ['신용카드', '체크카드', '현금', '계좌이체', '불명'],
        description: '영수증에 실제 표시된 결제수단'
      },
      receipt_text: { type: 'STRING', description: '판단에 중요한 영수증 문구를 줄바꿈하여 전사' },
      suggested_debit_account: { type: 'STRING', enum: DR_ACCOUNTS },
      suggested_credit_account: { type: 'STRING', enum: CR_ACCOUNTS },
      classification_reason: { type: 'STRING' },
      confidence: { type: 'NUMBER', description: '전체 판독 및 분류 신뢰도 0~100' },
      unclear_fields: {
        type: 'ARRAY',
        items: { type: 'STRING' },
        description: 'vendor, date, amount 중 확신할 수 없는 항목 이름'
      }
    },
    required: ['vendor', 'date', 'amount', 'supply_amount', 'vat_amount', 'items', 'payment_method', 'receipt_text', 'suggested_debit_account', 'suggested_credit_account', 'classification_reason', 'confidence', 'unclear_fields']
  };

  var prompt = [
    '학생이 제출한 한국 영수증 사진입니다. 글자를 먼저 충실히 판독한 뒤 구조화하세요.',
    '1. vendor: 카드사나 VAN사가 아니라 실제 가맹점명 또는 상호명',
    '2. date: 승인일시 또는 거래일자를 YYYY-MM-DD 형식으로 변환하세요.',
    '   연도가 보이지 않으면 현재 연도인 ' + new Date().getFullYear() + '년으로 추정하세요.',
    '3. amount는 최종 승인금액/받을금액/합계 중 실제 결제액입니다. 공급가액이나 부가세를 합계로 오인하지 마세요.',
    '4. 품목, 공급가액, 부가세, 결제수단과 판단에 중요한 원문도 추출하세요.',
    '5. 아래 수업용 기준에 따라 가장 적절한 차변·대변 계정 하나와 이유를 제안하세요.',
    ACCOUNTING_RULES.join('\n'),
    '6. unclear_fields에는 확신할 수 없는 필드명을 담고 confidence는 0~100으로 답하세요.',
    '   모두 확실하면 빈 배열로 답하세요.',
    '사진에 없는 글자나 품목을 만들어내지 마세요.'
  ].join('\n');

  return callGemini(
    prompt,
    body.imageBase64,
    body.imageMediaType,
    schema
  );
}

/**
 * 학생이 요청한 힌트와 모범 분개를 생성합니다.
 */
function buildHint(body) {
  requireImage(body);

  var schema = {
    type: 'OBJECT',
    properties: {
      explanation: {
        type: 'STRING',
        description: '학생 눈높이에 맞춘 3~5문장의 쉬운 설명'
      },
      correct_answer: {
        type: 'STRING',
        description: '차변) 계정과목 금액원 / 대변) 계정과목 금액원 형식의 모범 분개'
      }
    },
    required: ['explanation', 'correct_answer']
  };

  var prompt = buildAccountingPrompt([
    '학생이 이 영수증을 보고 스스로 분개를 작성하다가 힌트를 요청했습니다.',
    '[앞 단계에서 판독한 영수증 자료]',
    receiptDataText(body.receiptData),
    '학생이 원리를 이해할 수 있도록 다음 내용을 작성하세요.',
    '1. explanation: 거래의 성격과 계정과목 및 결제수단을 선택하는 이유를 존댓말로 3~5문장 설명하세요.',
    '2. correct_answer: 모범 분개를 "차변) 계정과목 금액원"과 "대변) 계정과목 금액원" 형식으로 작성하세요.',
    '여러 줄이면 줄바꿈으로 구분하세요.'
  ]);

  return callGemini(
    prompt,
    body.imageBase64,
    body.imageMediaType,
    schema
  );
}

/**
 * 학생이 제출한 분개를 채점합니다.
 */
function gradeEntry(body) {
  requireImage(body);

  if (!body.lines || !body.lines.length) {
    throw new Error('제출된 분개 줄이 없습니다.');
  }

  var schema = {
    type: 'OBJECT',
    properties: {
      verdict: {
        type: 'STRING',
        enum: ['정답', '부분정답', '오답']
      },
      score: {
        type: 'NUMBER',
        description: '0부터 100 사이의 정수'
      },
      feedback: {
        type: 'STRING',
        description: '학생에게 보여줄 존댓말 피드백 3~5문장'
      },
      correct_answer: {
        type: 'STRING',
        description: '차변) 계정과목 금액원 / 대변) 계정과목 금액원 형식의 모범 분개'
      }
    },
    required: ['verdict', 'score', 'feedback', 'correct_answer']
  };

  var drLines = body.lines.filter(function (line) {
    return line.side === 'dr';
  });

  var crLines = body.lines.filter(function (line) {
    return line.side === 'cr';
  });

  var studentEntryText = [
    drLines.map(function (line) {
      return '  차변) ' + line.account + ' ' + formatWon(line.amount);
    }).join('\n'),
    crLines.map(function (line) {
      return '  대변) ' + line.account + ' ' + formatWon(line.amount);
    }).join('\n')
  ].join('\n');

  var prompt = buildAccountingPrompt([
    '학생이 아래와 같이 이 영수증에 대한 분개를 작성해 제출했습니다.',
    '',
    '[학생이 입력한 정보]',
    '거래일자: ' + (body.date || '(입력 안 함)'),
    '가맹점명: ' + (body.vendor || '(입력 안 함)'),
    '힌트 사용 여부: ' + (body.hintUsed ? '예' : '아니오'),
    '학생이 작성한 분개:',
    studentEntryText,
    '',
    '[앞 단계에서 판독한 영수증 자료]',
    receiptDataText(body.receiptData),
    '',
    '[채점 기준]',
    '1. 영수증 사진 속 가맹점 업종과 구매 내역을 보고 가장 적절한 차변 계정과목을 판단하세요.',
    '2. 대변 계정과목은 영수증의 결제수단을 근거로 판단하세요.',
    '   카드결제이면 미지급금 또는 보통예금, 현금결제이면 현금이 일반적입니다.',
    '3. 차변 합계와 대변 합계가 일치하는지 확인하세요.',
    '4. 분개 합계가 영수증의 실제 최종 결제금액과 일치하는지 확인하세요.',
    '5. 점수 기준:',
    '   - 정답 90~100점: 계정과목, 금액, 차변·대변 방향이 모두 적절하고 대차가 일치함',
    '   - 부분정답 40~75점: 금액과 방향은 맞지만 유사 계정과목을 선택했거나 사소한 오류가 있음',
    '   - 오답 0~35점: 금액, 대차, 방향 또는 계정과목에 중요한 오류가 있음',
    '6. feedback은 학생에게 존댓말로 무엇이 맞았고 무엇을 고치면 좋은지 3~5문장으로 설명하세요.',
    '7. correct_answer는 모범 분개를 제시하세요.'
  ]);

  return callGemini(
    prompt,
    body.imageBase64,
    body.imageMediaType,
    schema
  );
}

/**
 * 회계 채점용 공통 프롬프트
 */
function buildAccountingPrompt(bodyLines) {
  return [
    '당신은 상업계 고등학교 회계원리 과목을 가르치는 선생님입니다.',
    '',
    '[사용 가능한 계정과목]',
    '차변 비용 계정: ' + DR_ACCOUNTS.join(', '),
    '대변 결제수단 계정: ' + CR_ACCOUNTS.join(', '),
    '',
    '[계정과목 판단 기준]',
    ACCOUNTING_RULES.join('\n'),
    ''
  ]
    .concat(bodyLines)
    .concat([
      '',
      '반드시 지정된 JSON 스키마에 맞는 JSON만 답변하세요.'
    ])
    .join('\n');
}

function receiptDataText(receiptData) {
  if (!receiptData) return '(전달되지 않음 — 이미지를 직접 확인하세요)';
  return JSON.stringify(receiptData);
}

/**
 * 이미지 전달 여부 확인
 */
function requireImage(body) {
  if (!body || !body.imageBase64 || !body.imageMediaType) {
    throw new Error('영수증 이미지가 전달되지 않았습니다.');
  }
}

/**
 * 원화 표시
 */
function formatWon(amount) {
  var numberValue = Number(amount) || 0;
  return numberValue.toLocaleString('ko-KR') + '원';
}

/**
 * Gemini API 호출
 */
function callGemini(promptText, imageBase64, imageMediaType, schema) {
  var apiKey = PropertiesService
    .getScriptProperties()
    .getProperty('GEMINI_API_KEY');

  if (!apiKey) {
    throw new Error(
      'GEMINI_API_KEY가 설정되지 않았습니다. Apps Script의 프로젝트 설정 → 스크립트 속성에서 등록해주세요.'
    );
  }

  var url =
    'https://generativelanguage.googleapis.com/v1beta/models/' +
    GEMINI_MODEL +
    ':generateContent?key=' +
    encodeURIComponent(apiKey);

  var payload = {
    contents: [
      {
        parts: [
          { text: promptText },
          {
            inline_data: {
              mime_type: imageMediaType,
              data: imageBase64
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema: schema
    }
  };

  var response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  var statusCode = response.getResponseCode();
  var responseText = response.getContentText();

  if (statusCode < 200 || statusCode >= 300) {
    throw new Error(
      'Gemini API 오류 (' + statusCode + '): ' + responseText
    );
  }

  var data = JSON.parse(responseText);
  var candidate = data.candidates && data.candidates[0];

  if (
    !candidate ||
    !candidate.content ||
    !candidate.content.parts
  ) {
    throw new Error(
      'Gemini 응답에서 결과를 찾을 수 없습니다: ' + responseText
    );
  }

  var outputText = candidate.content.parts
    .map(function (part) {
      return part.text || '';
    })
    .join('');

  return JSON.parse(outputText);
}
