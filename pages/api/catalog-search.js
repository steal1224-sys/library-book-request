// pages/api/catalog-search.js
// 관리자가 업로드한 소장도서 목록(구글시트 "소장도서" 탭)에서
// 도서명을 부분일치로 검색해주는 API.

import { searchCatalog } from "../../lib/catalogCache";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { query } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "검색어(query)가 필요합니다." });
  }

  try {
    const items = await searchCatalog(query.trim(), 20);
    return res.status(200).json({ items, total: items.length });
  } catch (err) {
    return res
      .status(500)
      .json({ error: err.message || "소장 도서 검색 중 오류가 발생했습니다." });
  }
}
