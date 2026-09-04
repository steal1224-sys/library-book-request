// pages/api/catalog-count.js
// 비로그인 상태에서도 소장도서 총 건수를 가져올 수 있는 공개 API.
// 신청 화면의 "현재 소장 도서 ○○권" 표시에 사용된다.

import { getCatalogMeta } from "../../lib/catalogCache";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  try {
    const { count } = getCatalogMeta();
    return res.status(200).json({ count });
  } catch (err) {
    return res.status(500).json({ error: err.message || "조회 중 오류가 발생했습니다." });
  }
}
