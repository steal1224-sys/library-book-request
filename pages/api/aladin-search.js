// pages/api/aladin-search.js
// 알라딘 Open API를 대신 호출해주는 서버 함수.
// 브라우저는 이 API(/api/aladin-search)만 호출하고,
// 이 함수가 서버에서 알라딘으로 요청을 보내 CORS 문제를 피한다.

const TTBKEY = process.env.ALADIN_TTBKEY;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const { query } = req.query;

  if (!query || !query.trim()) {
    return res.status(400).json({ error: "검색어(query)가 필요합니다." });
  }

  if (!TTBKEY) {
    return res
      .status(500)
      .json({ error: "서버에 알라딘 인증키(ALADIN_TTBKEY)가 설정되어 있지 않습니다." });
  }

  const url = new URL("http://www.aladin.co.kr/ttb/api/ItemSearch.aspx");
  url.searchParams.set("ttbkey", TTBKEY);
  url.searchParams.set("Query", query);
  url.searchParams.set("QueryType", "Title");
  url.searchParams.set("MaxResults", "10");
  url.searchParams.set("start", "1");
  url.searchParams.set("SearchTarget", "Book");
  url.searchParams.set("output", "js"); // JSON으로 응답
  url.searchParams.set("Version", "20131101");

  try {
    const response = await fetch(url.toString());
    const text = await response.text();

    let data;
    try {
      data = JSON.parse(text);
    } catch (e) {
      return res.status(502).json({ error: "알라딘 응답을 해석할 수 없습니다." });
    }

    if (data.errorCode) {
      return res.status(502).json({ error: data.errorMessage || "알라딘 API 오류" });
    }

    const items = (data.item || []).map((item) => ({
      title: cleanTitle(item.title),
      author: cleanAuthor(item.author),
      publisher: item.publisher || "",
      pubYear: extractYear(item.pubDate),
      pubDate: item.pubDate || "",
      isbn: item.isbn13 || item.isbn || "",
      cover: item.cover || "",
      link: item.link || "",
      priceStandard: item.priceStandard ?? null,
    }));

    return res.status(200).json({ items });
  } catch (err) {
    return res.status(500).json({ error: "알라딘 API 호출 중 오류가 발생했습니다." });
  }
}

function cleanTitle(title) {
  if (!title) return "";
  // 알라딘 제목에 종종 부제/시리즈명이 " - " 로 붙어 나오는데 그대로 두고,
  // 양쪽 공백만 정리한다.
  return title.trim();
}

function cleanAuthor(author) {
  if (!author) return "";
  // "홍길동 (지은이), 김철수 (옮긴이)" 형태를 정리
  return author
    .split(",")
    .map((a) => a.trim())
    .join(", ");
}

function extractYear(pubDate) {
  if (!pubDate) return "";
  const match = pubDate.match(/^\d{4}/);
  return match ? match[0] : "";
}
