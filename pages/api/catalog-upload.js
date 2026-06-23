// pages/api/catalog-upload.js
// 관리자가 소장도서 목록(xlsx/csv)을 업로드하면 서버가 파싱해서
// 구글시트 "소장도서" 탭에 통째로 교체 저장한다.
//
// 받아들이는 형식: 헤더가 있는 표 형태의 엑셀/CSV.
// 나이스 DLS 등에서 내보낸 도서원부는 상단에 제목/날짜 같은 머리말이
// 여러 줄 있는 경우가 많아, 헤더 행을 자동으로 찾아서 처리한다.

import * as XLSX from "xlsx";
import { replaceCatalog } from "../../lib/sheets";
import { invalidateCatalogCache } from "../../lib/catalogCache";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const config = {
  api: {
    bodyParser: false,
  },
};

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const TITLE_HEADER_CANDIDATES = ["서명", "도서명", "제목", "title"];
const AUTHOR_HEADER_CANDIDATES = ["저자", "지은이", "author"];

// 흔히 쓰이는 컬럼명 후보들 중 첫 번째로 매칭되는 값을 찾는다.
function pick(row, candidates) {
  for (const key of Object.keys(row)) {
    const norm = String(key).replace(/\s/g, "");
    for (const cand of candidates) {
      if (norm.includes(cand)) {
        return String(row[key] ?? "").trim();
      }
    }
  }
  return "";
}

// 시트를 2차원 배열로 읽어 "서명"/"도서명" 키워드가 있는 행을 찾는다.
function findHeaderRowIndex(rows2d) {
  const maxScan = Math.min(rows2d.length, 30); // 상단 30행 안에서만 탐색
  for (let i = 0; i < maxScan; i++) {
    const row = rows2d[i] || [];
    const joined = row.map((c) => String(c ?? "")).join("");
    if (TITLE_HEADER_CANDIDATES.some((cand) => joined.includes(cand))) {
      return i;
    }
  }
  return -1;
}

function parseWorkbookToBooks(buffer) {
  const workbook = XLSX.read(buffer, { type: "buffer", codepage: 65001 });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rows2d = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
    raw: false,
  });

  let rows;
  const headerIdx = findHeaderRowIndex(rows2d);

  if (headerIdx === -1) {
    // 못 찾으면 첫 행을 헤더로 가정하는 기본 방식으로 시도한다.
    rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } else {
    // xlsx의 range 옵션은 헤더 자동 인식과 충돌할 수 있어 직접 매핑한다.
    const headerRow = rows2d[headerIdx];
    const dataRows = rows2d.slice(headerIdx + 1);
    rows = dataRows.map((r) => {
      const obj = {};
      headerRow.forEach((h, i) => {
        if (h) obj[h] = r[i];
      });
      return obj;
    });
  }

  const books = rows
    .map((row) => ({
      title: pick(row, TITLE_HEADER_CANDIDATES),
      author: pick(row, AUTHOR_HEADER_CANDIDATES),
      publisher: pick(row, ["출판사", "publisher"]),
      year: pick(row, ["출판년도", "발행년도", "year"]),
      call: pick(row, ["청구기호", "call"]),
      status: pick(row, ["도서상태", "상태", "status"]),
    }))
    // 합계행, 빈 행 등 도서명이 없는 행은 제외한다.
    .filter((b) => b.title && b.title.replace(/\s/g, "") !== "합계");

  return books;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const password = req.headers["x-admin-password"];
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  try {
    const buffer = await readRawBody(req);
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: "업로드된 파일이 비어있습니다." });
    }

    const books = parseWorkbookToBooks(buffer);

    if (books.length === 0) {
      return res.status(400).json({
        error:
          "도서명(서명) 컬럼을 찾지 못했습니다. 엑셀 안에 '서명' 또는 '도서명' 열이 있는지 확인해주세요.",
      });
    }

    const savedCount = await replaceCatalog(books);
    invalidateCatalogCache();

    return res.status(200).json({ ok: true, count: savedCount });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "업로드 처리 중 오류가 발생했습니다." });
  }
}
