# 구입희망도서 신청 앱

학생/교사 누구나 도서명을 입력해 구입희망도서를 신청하고, 사서선생님은 비밀번호로
관리 화면에 들어가 전체 신청 내역을 확인할 수 있는 앱입니다.

- 도서명을 입력하면 **알라딘 Open API**로 검색해 저자/출판사/출판년도를 자동 입력
- 모든 신청 데이터는 **구글 스프레드시트**에 누적 저장
- **Vercel**에 배포하여 누구나 접속 가능한 URL 생성

## 환경변수 설정 (Vercel)

Vercel 프로젝트 설정 → Settings → Environment Variables 에서 아래 값을 등록하세요.

| 이름 | 설명 |
|---|---|
| `ALADIN_TTBKEY` | 알라딘 Open API 인증키 |
| `ADMIN_PASSWORD` | 사서선생님 관리 화면 비밀번호 |
| `GOOGLE_SHEET_ID` | 구글 스프레드시트 ID |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | 구글 서비스 계정 이메일 |
| `GOOGLE_PRIVATE_KEY` | 구글 서비스 계정 JSON 파일의 `private_key` 값 (줄바꿈 포함 그대로) |

`GOOGLE_PRIVATE_KEY`는 JSON 파일에서 아래와 같은 형태로 들어있습니다:

```
-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQ...
-----END PRIVATE KEY-----
```

Vercel 환경변수 입력창에 **그대로 줄바꿈 포함해서 복사+붙여넣기** 하면 됩니다.

## 로컬에서 테스트하려면

```bash
npm install
cp .env.example .env.local   # 이후 .env.local 안의 값을 실제 키로 채우기
npm run dev
```

`http://localhost:3000` 에서 확인할 수 있습니다.

## 구글 시트 구조

시트 1행에 아래 헤더가 자동으로 생성됩니다 (이미 만들어두셨다면 그대로 사용됩니다):

```
신청일시 | 구분 | 학년반/소속 | 이름 | 도서명 | 저자 | 출판사 | 출판년도 | 신청사유 | 참고링크
```
