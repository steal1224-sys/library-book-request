// pages/api/book-search.js
// 카카오(Daum) 책 검색 API를 대신 호출해주는 서버 함수.
// (알라딘 OpenAPI 종료로 aladin-search.js를 대체)
// 브라우저는 이 API(/api/book-search)만 호출하고,
// 이 함수가 서버에서 카카오로 요청을 보내 인증키가 노출되지 않게 한다.
// 응답 형식은 기존 aladin-search.js와 동일하게 맞춰서 화면 코드는 그대로 쓴다.

const KAKAO_KEY = process.env.KAKAO_KEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "검색어(query)가 필요합니다." });
  }

  if (!KAKAO_KEY) {
    return res
      .status(500)
      .json({ error: "서버에 카카오 인증키(KAKAO_KEY)가 설정되어 있지 않습니다." });
  }

  const url = new URL("https://dapi.kakao.com/v3/search/book");
  url.searchParams.set("query", query.trim());
  url.searchParams.set("target", "title"); // 기존과 같이 제목 기준 검색
  url.searchParams.set("size", "10");
  url.searchParams.set("sort", "accuracy");

  try {
    const response = await fetch(url.toString(), {
      headers: { Authorization: `KakaoAK ${KAKAO_KEY}` },
    });

    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: "카카오 응답을 해석할 수 없습니다." });
    }

    if (!response.ok) {
      return res
        .status(502)
        .json({ error: data.message || `카카오 API 오류 (${response.status})` });
    }

    const seen = new Set();
    const items = [];

    for (const doc of data.documents || []) {
      const isbn = pickIsbn13(doc.isbn);
      // 카카오는 같은 책이 중복으로 오는 경우가 있어 ISBN으로 걸러낸다
      const key = isbn || `${doc.title}|${doc.publisher}`;
      if (seen.has(key)) continue;
      seen.add(key);

      items.push({
        title: (doc.title || "").trim(),
        author: formatAuthors(doc.authors, doc.translators),
        publisher: doc.publisher || "",
        pubYear: extractYear(doc.datetime),
        pubDate: doc.datetime ? doc.datetime.slice(0, 10) : "",
        isbn,
        cover: doc.thumbnail || "",
        link: doc.url || "",
        priceStandard: typeof doc.price === "number" && doc.price > 0 ? doc.price : null,
      });
    }

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: "카카오 API 호출 중 오류가 발생했습니다." });
  }
}

// 카카오 isbn 필드는 "ISBN10 ISBN13" 처럼 공백으로 구분되어 온다
function pickIsbn13(isbnField) {
  if (!isbnField) return "";
  const parts = isbnField.split(/\s+/).filter(Boolean);
  return parts.find((p) => p.length === 13) || parts[0] || "";
}

// 저자 배열 + 옮긴이 배열을 "홍길동, 김철수 (옮긴이)" 형태로 정리
function formatAuthors(authors, translators) {
  const a = (authors || []).map((s) => s.trim()).filter(Boolean).join(", ");
  const t = (translators || []).map((s) => s.trim()).filter(Boolean).join(", ");
  if (a && t) return `${a}, ${t} (옮긴이)`;
  return a || (t ? `${t} (옮긴이)` : "");
}

// datetime: "2014-11-17T00:00:00.000+09:00"
function extractYear(datetime) {
  if (!datetime) return "";
  const match = datetime.match(/^\d{4}/);
  return match ? match[0] : "";
}
