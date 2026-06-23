// pages/api/catalog-search.js
// 학교도서관 소장 카탈로그(data/library_catalog.json)에서
// 도서명을 부분일치로 검색해주는 API.
// 매 요청마다 파일을 새로 읽지 않고, 서버 메모리에 캐싱해서 빠르게 응답한다.

import fs from "fs";
import path from "path";

let cachedCatalog = null;

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[^\w가-힣]/g, "");
}

function loadCatalog() {
  if (cachedCatalog) return cachedCatalog;
  const filePath = path.join(process.cwd(), "data", "library_catalog.json");
  const raw = fs.readFileSync(filePath, "utf-8");
  cachedCatalog = JSON.parse(raw);
  return cachedCatalog;
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { query } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "검색어(query)가 필요합니다." });
  }

  let catalog;
  try {
    catalog = loadCatalog();
  } catch (err) {
    return res.status(500).json({ error: "소장 도서 목록을 불러올 수 없습니다." });
  }

  const needle = normalize(query);
  if (!needle) {
    return res.status(200).json({ items: [] });
  }

  const matches = [];
  for (const book of catalog) {
    if (book.n && book.n.includes(needle)) {
      matches.push(book);
      if (matches.length >= 20) break;
    }
  }

  const items = matches.map((b) => ({
    title: b.t,
    author: b.a,
    publisher: b.p,
    year: b.y,
    call: b.c,
    status: b.s,
  }));

  return res.status(200).json({ items, total: items.length });
}
