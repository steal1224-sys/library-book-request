// lib/catalogCache.js
// 구글시트의 "소장도서" 탭은 수천~수만 건일 수 있어, 매 검색마다 읽으면 느리다.
// 서버 메모리에 캐싱해두고, 일정 시간(기본 5분)마다 새로 불러온다.
// 관리자가 새로 업로드하면 캐시를 즉시 비워서 바로 반영되게 한다.

import { listCatalog } from "./sheets";

const CACHE_TTL_MS = 5 * 60 * 1000; // 5분

let cache = {
  books: [],
  normalizedTitles: [],
  loadedAt: 0,
};

function normalize(s) {
  if (!s) return "";
  return String(s)
    .toLowerCase()
    .replace(/[^\w가-힣]/g, "");
}

export function invalidateCatalogCache() {
  cache = { books: [], normalizedTitles: [], loadedAt: 0 };
}

export async function getCatalog() {
  const isStale = Date.now() - cache.loadedAt > CACHE_TTL_MS;
  if (!isStale && cache.books.length > 0) {
    return cache.books;
  }
  if (!isStale && cache.loadedAt > 0) {
    return cache.books;
  }

  const books = await listCatalog();
  cache = {
    books,
    normalizedTitles: books.map((b) => normalize(b.title)),
    loadedAt: Date.now(),
  };
  return books;
}

export async function searchCatalog(query, limit = 20) {
  await getCatalog(); // 캐시 갱신 보장
  const needle = normalize(query);
  if (!needle) return [];

  const results = [];
  for (let i = 0; i < cache.books.length; i++) {
    if (cache.normalizedTitles[i] && cache.normalizedTitles[i].includes(needle)) {
      results.push(cache.books[i]);
      if (results.length >= limit) break;
    }
  }
  return results;
}

export function getCatalogMeta() {
  return {
    count: cache.books.length,
    loadedAt: cache.loadedAt,
  };
}
