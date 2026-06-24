// lib/sheets.js
// 구글 스프레드시트 읽기/쓰기를 위한 공용 함수.

import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";

const SHEET_ID = process.env.GOOGLE_SHEET_ID;
const CLIENT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
// Vercel 환경변수에 줄바꿈(\n)이 문자 그대로 들어가는 경우가 많아 복원해준다.
const PRIVATE_KEY = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");

const HEADERS = [
  "신청일시",
  "구분",
  "학년반/소속",
  "이름",
  "도서명",
  "저자",
  "출판사",
  "출판년도",
  "가격",
  "신청사유",
  "참고링크",
];

let cachedDoc = null;

export async function getSheet() {
  if (!SHEET_ID || !CLIENT_EMAIL || !PRIVATE_KEY) {
    throw new Error(
      "구글 시트 연동에 필요한 환경변수(GOOGLE_SHEET_ID, GOOGLE_SERVICE_ACCOUNT_EMAIL, GOOGLE_PRIVATE_KEY)가 설정되어 있지 않습니다."
    );
  }

  if (!cachedDoc) {
    const auth = new JWT({
      email: CLIENT_EMAIL,
      key: PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    cachedDoc = new GoogleSpreadsheet(SHEET_ID, auth);
  }

  await cachedDoc.loadInfo();
  let sheet = cachedDoc.sheetsByIndex[0];

  // 헤더가 비어있으면 만들어준다 (최초 1회).
  await sheet.loadHeaderRow().catch(() => null);
  if (!sheet.headerValues || sheet.headerValues.length === 0) {
    await sheet.setHeaderRow(HEADERS);
  } else if (!sheet.headerValues.includes("가격")) {
    // 기존에 만들어둔 시트에 "가격" 컬럼이 없으면 추가해준다.
    await sheet.setHeaderRow([...sheet.headerValues, "가격"]);
  }

  return sheet;
}

export async function appendRequestRow(entry) {
  const sheet = await getSheet();
  await sheet.addRow({
    신청일시: entry.createdAt,
    구분: entry.role,
    "학년반/소속": entry.classInfo,
    이름: entry.name,
    도서명: entry.title,
    저자: entry.author,
    출판사: entry.publisher,
    출판년도: entry.pubYear,
    가격: entry.price,
    신청사유: entry.reason,
    참고링크: entry.link,
  });
}

export async function listRequestRows() {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  return rows.map((row, idx) => ({
    rowIndex: row.rowNumber,
    createdAt: row.get("신청일시") || "",
    role: row.get("구분") || "",
    classInfo: row.get("학년반/소속") || "",
    name: row.get("이름") || "",
    title: row.get("도서명") || "",
    author: row.get("저자") || "",
    publisher: row.get("출판사") || "",
    pubYear: row.get("출판년도") || "",
    price: row.get("가격") || "",
    reason: row.get("신청사유") || "",
    link: row.get("참고링크") || "",
  }));
}

export async function deleteRequestRow(rowIndex) {
  const sheet = await getSheet();
  const rows = await sheet.getRows();
  const target = rows.find((r) => r.rowNumber === rowIndex);
  if (!target) {
    throw new Error("해당 행을 찾을 수 없습니다.");
  }
  await target.delete();
}

// ---- 소장도서 카탈로그 (두 번째 시트) ----
// 사서선생님이 관리 탭에서 엑셀을 업로드하면 이 시트에 통째로 교체 저장된다.

const CATALOG_SHEET_TITLE = "소장도서";
const CATALOG_HEADERS = ["서명", "저자", "출판사", "출판년도", "청구기호", "도서상태"];

async function getCatalogSheet() {
  if (!cachedDoc) {
    await getSheet(); // cachedDoc 초기화
  }
  await cachedDoc.loadInfo();
  let sheet = cachedDoc.sheetsByTitle[CATALOG_SHEET_TITLE];
  if (!sheet) {
    sheet = await cachedDoc.addSheet({
      title: CATALOG_SHEET_TITLE,
      headerValues: CATALOG_HEADERS,
    });
  }
  return sheet;
}

export async function replaceCatalog(books, { clearFirst = true } = {}) {
  const sheet = await getCatalogSheet();

  if (clearFirst) {
    await sheet.clear();
    await sheet.setHeaderRow(CATALOG_HEADERS);
  }

  const rows = books.map((b) => ({
    서명: b.title || "",
    저자: b.author || "",
    출판사: b.publisher || "",
    출판년도: b.year || "",
    청구기호: b.call || "",
    도서상태: b.status || "",
  }));

  // 구글시트 API는 한 번에 너무 많은 행을 보내면 타임아웃이 날 수 있어 묶음으로 나눠 추가한다.
  const BATCH_SIZE = 500;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    await sheet.addRows(rows.slice(i, i + BATCH_SIZE));
  }

  return rows.length;
}

export async function listCatalog() {
  const sheet = await getCatalogSheet();
  const rows = await sheet.getRows();
  return rows.map((row) => ({
    title: row.get("서명") || "",
    author: row.get("저자") || "",
    publisher: row.get("출판사") || "",
    year: row.get("출판년도") || "",
    call: row.get("청구기호") || "",
    status: row.get("도서상태") || "",
  }));
}

