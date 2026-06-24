// pages/api/catalog-upload.js
// 브라우저에서 이미 엑셀을 파싱해 만든 도서 목록(JSON)을 받아서
// 구글시트 "소장도서" 탭에 저장한다.
//
// 엑셀 파일 자체(수 MB~십수 MB)를 서버로 통째로 보내면 Vercel의 요청 크기
// 제한(약 4.5MB)에 걸려 "Request Entity Too Large" 오류가 나기 때문에,
// 파싱은 브라우저(pages/index.js)에서 하고 여기서는 가벼운 JSON 데이터만
// 배치(batch) 단위로 나눠 받는다.

import { replaceCatalog } from "../../lib/sheets";
import { invalidateCatalogCache } from "../../lib/catalogCache";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export const config = {
  api: {
    // JSON 배치 하나는 보통 1~2MB 이내이지만, 여유를 두어 넉넉하게 설정한다.
    bodyParser: {
      sizeLimit: "4mb",
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const password = req.headers["x-admin-password"];
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  const { books, isFirstBatch, isLastBatch } = req.body || {};

  if (!Array.isArray(books)) {
    return res.status(400).json({ error: "books 배열이 필요합니다." });
  }

  try {
    const savedCount = await replaceCatalog(books, { clearFirst: !!isFirstBatch });
    invalidateCatalogCache();

    return res.status(200).json({ ok: true, count: savedCount, isLastBatch: !!isLastBatch });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "저장 중 오류가 발생했습니다." });
  }
}
