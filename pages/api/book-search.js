// pages/api/book-search.js
// 예스24 Open API로 책을 검색해주는 서버 함수.
// (알라딘 OpenAPI 종료 → 예스24로 교체)
// 브라우저는 이 API(/api/book-search)만 호출하고,
// 이 함수가 서버에서 예스24로 요청을 보내 인증키가 노출되지 않게 한다.
// 응답 형식은 기존과 동일하게 맞춰서 화면 코드는 그대로 쓴다.

const YES24_API_KEY = process.env.YES24_API_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { query } = req.query;
  if (!query || !query.trim()) {
    return res.status(400).json({ error: "검색어(query)가 필요합니다." });
  }
  if (!YES24_API_KEY) {
    return res
      .status(500)
      .json({ error: "서버에 예스24 인증키(YES24_API_KEY)가 설정되어 있지 않습니다." });
  }

  const url = new URL("https://apis.yes24.com/v1/goods/itemList");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("category", "BOOK"); // 국내도서
  url.searchParams.set("sort", "RELATION"); // 정확도순
  url.searchParams.set("page", "1");
  url.searchParams.set("pageSize", "10");

  try {
    const response = await fetch(url.toString(), {
      headers: { "X-Api-Key": YES24_API_KEY },
    });

    // 검색 결과가 없으면 예스24는 404(SEARCH_001)를 준다 → 빈 목록으로 처리
    if (response.status === 404) {
      return res.status(200).json({ items: [] });
    }

    let data;
    try {
      data = await response.json();
    } catch (e) {
      return res.status(502).json({ error: "예스24 응답을 해석할 수 없습니다." });
    }

    if (!response.ok || !data.success) {
      return res
        .status(502)
        .json({ error: data.message || `예스24 API 오류 (${response.status})` });
    }

    const list = (data.data && data.data.items) || [];
    const seen = new Set();
    const items = [];

    for (const b of list) {
      const key = b.isbn13 || b.itemId;
      if (seen.has(key)) continue;
      seen.add(key);

      const pubDate = formatDate(b.publishDate);
      items.push({
        title: (b.title || "").trim(),
        author: (b.author || "").trim(),
        publisher: b.publisher || "",
        pubYear: pubDate.slice(0, 4),
        pubDate,
        isbn: b.isbn13 || "",
        cover: b.cover || "",
        link: b.link || "",
        priceStandard: typeof b.shopPrice === "number" && b.shopPrice > 0 ? b.shopPrice : null,
      });
    }

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: "예스24 API 호출 중 오류가 발생했습니다." });
  }
}

// "20001220", "2000-12-20", "2000년 12월" 등 → "2000-12-20" / "2000"
function formatDate(v) {
  const digits = String(v || "").replace(/\D/g, "");
  if (digits.length >= 8) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}-${digits.slice(6, 8)}`;
  if (digits.length >= 6) return `${digits.slice(0, 4)}-${digits.slice(4, 6)}`;
  return digits.slice(0, 4);
}
