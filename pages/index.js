import { useState, useEffect, useCallback, useRef } from "react";
import {
  BookPlus,
  Search,
  Lock,
  LockOpen,
  Trash2,
  Check,
  GraduationCap,
  User,
  RefreshCw,
  Loader2,
  Upload,
  FileSpreadsheet,
} from "lucide-react";

const emptyForm = {
 role: "학생",
  classInfo: "",
  name: "",
  title: "",
  author: "",
  publisher: "",
  pubYear: "",
  price: "",
  quantity: "1",
  reason: "",
  link: "",
};

function formatDate(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}.${mm}.${dd}`;
}

// ---- 소장도서 엑셀 파싱 헬퍼 ----
// 브라우저에서 직접 파일을 읽어 파싱한다 (서버로 큰 파일을 보내지 않기 위함).
// 나이스 DLS 등에서 내보낸 도서원부는 상단에 제목/날짜 같은 머리말이
// 여러 줄 있는 경우가 많아, 헤더 행을 자동으로 찾아서 처리한다.

const TITLE_HEADER_CANDIDATES = ["서명", "도서명", "제목", "title"];
const AUTHOR_HEADER_CANDIDATES = ["저자", "지은이", "author"];

function pickField(row, candidates) {
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

function parseWorkbookToBooks(XLSX, buffer) {
  const workbook = XLSX.read(buffer, { type: "array", codepage: 65001 });
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

  return rows
    .map((row) => ({
      title: pickField(row, TITLE_HEADER_CANDIDATES),
      author: pickField(row, AUTHOR_HEADER_CANDIDATES),
      publisher: pickField(row, ["출판사", "publisher"]),
      year: pickField(row, ["출판년도", "발행년도", "year"]),
      call: pickField(row, ["청구기호", "call"]),
      status: pickField(row, ["도서상태", "상태", "status"]),
    }))
    // 합계행, 빈 행 등 도서명이 없는 행은 제외한다.
    .filter((b) => b.title && b.title.replace(/\s/g, "") !== "합계");
}

export default function Home() {
  const [view, setView] = useState("apply"); // apply | admin

  // ---- 신청 폼 상태 ----
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  // ---- 장바구니 상태 ----
  const [cart, setCart] = useState([]); // [{title, author, publisher, pubYear, price, quantity, reason, link}]
  const [cartError, setCartError] = useState("");

  // ---- 알라딘 검색 상태 ----
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const searchTimer = useRef(null);
  const searchBoxRef = useRef(null);

  // ---- 우리 학교도서관 소장 검색 상태 ----
  const [catalogQuery, setCatalogQuery] = useState("");
  const [catalogResults, setCatalogResults] = useState([]);
  const [catalogSearching, setCatalogSearching] = useState(false);
  const [catalogSearched, setCatalogSearched] = useState(false);
  const catalogTimer = useRef(null);

  // ---- 관리자 상태 ----
  const [authed, setAuthed] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [pwInput, setPwInput] = useState("");
  const [pwError, setPwError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);

  const [requests, setRequests] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [query, setQueryText] = useState("");
  const [roleFilter, setRoleFilter] = useState("전체");

  // ---- 관리자: 소장도서 업로드 상태 ----
  const [catalogCount, setCatalogCount] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [uploadError, setUploadError] = useState("");
  const fileInputRef = useRef(null);

  // 검색창 바깥 클릭 시 결과 닫기
  useEffect(() => {
    function onClickOutside(e) {
      if (searchBoxRef.current && !searchBoxRef.current.contains(e.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  function updateField(key, value) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function handleTitleChange(value) {
    updateField("title", value);
    setSelectedBook(null);

    if (searchTimer.current) clearTimeout(searchTimer.current);

    if (!value.trim() || value.trim().length < 2) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `/api/aladin-search?query=${encodeURIComponent(value.trim())}`
        );
        const data = await res.json();
        if (res.ok && Array.isArray(data.items)) {
          setSearchResults(data.items);
          setShowResults(true);
        } else {
          setSearchResults([]);
        }
      } catch (e) {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 450);
  }

  function selectBook(book) {
    setForm((f) => ({
      ...f,
      title: book.title,
      author: book.author,
      publisher: book.publisher,
      pubYear: book.pubYear,
      price: book.priceStandard != null ? String(book.priceStandard) : f.price,
      link: book.link || f.link,
    }));
    setSelectedBook(book);
    setShowResults(false);
  }

  function handleCatalogChange(value) {
    setCatalogQuery(value);
    setCatalogSearched(false);

    if (catalogTimer.current) clearTimeout(catalogTimer.current);

    if (!value.trim() || value.trim().length < 2) {
      setCatalogResults([]);
      return;
    }

    catalogTimer.current = setTimeout(async () => {
      setCatalogSearching(true);
      try {
        const res = await fetch(
          `/api/catalog-search?query=${encodeURIComponent(value.trim())}`
        );
        const data = await res.json();
        setCatalogResults(res.ok && Array.isArray(data.items) ? data.items : []);
      } catch (e) {
        setCatalogResults([]);
      } finally {
        setCatalogSearching(false);
        setCatalogSearched(true);
      }
    }, 400);
  }

  function useCatalogQueryForApply() {
    handleTitleChange(catalogQuery);
    if (searchBoxRef.current) {
      searchBoxRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }

  // ---- 장바구니에 담기 ----
  function handleAddToCart() {
    setCartError("");
    if (!form.title.trim()) {
      setCartError("도서명을 입력해주세요.");
      return;
    }
    const bookFields = {
      title: form.title,
      author: form.author,
      publisher: form.publisher,
      pubYear: form.pubYear,
      price: form.price,
      quantity: form.quantity,
      reason: form.reason,
      link: form.link,
    };
    setCart((prev) => [...prev, bookFields]);
    // 도서 정보만 초기화 (신청자 정보 유지)
    setForm((f) => ({
      ...f,
      title: "",
      author: "",
      publisher: "",
      pubYear: "",
      price: "",
      quantity: "1",
      reason: "",
      link: "",
    }));
    setSelectedBook(null);
    setSearchResults([]);
  }

  function removeFromCart(idx) {
    setCart((prev) => prev.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");

    // 장바구니가 비어있으면 현재 입력된 도서도 같이 처리
    const classInfoRequired = form.role === "학생";
    if (!form.name.trim() || (classInfoRequired && !form.classInfo.trim())) {
      setSubmitError(form.role === "학생" ? "이름과 학년/반을 입력해주세요." : "이름을 입력해주세요.");
      return;
    }

    // 장바구니 + 현재 입력 중인 도서 합치기
    let booksToSubmit = [...cart];
    if (form.title.trim()) {
      booksToSubmit.push({
        title: form.title,
        author: form.author,
        publisher: form.publisher,
        pubYear: form.pubYear,
        price: form.price,
        quantity: form.quantity,
        reason: form.reason,
        link: form.link,
      });
    }

    if (booksToSubmit.length === 0) {
      setSubmitError("신청할 도서를 한 권 이상 입력해주세요.");
      return;
    }

    setSubmitting(true);
    try {
      // 각 도서를 개별 레코드로 제출
      for (const book of booksToSubmit) {
        const res = await fetch("/api/requests/submit", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            role: form.role,
            classInfo: form.classInfo,
            name: form.name,
            ...book,
          }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "신청 중 문제가 발생했어요.");
        }
      }
      setForm(emptyForm);
      setSelectedBook(null);
      setCart([]);
      setJustSubmitted(true);
      setTimeout(() => setJustSubmitted(false), 3500);
    } catch (err) {
      setSubmitError(err.message || "신청 중 문제가 발생했어요. 다시 시도해주세요.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(e) {
    e.preventDefault();
    setPwError("");
    setLoggingIn(true);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password: pwInput }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "비밀번호가 올바르지 않아요.");
      }
      setAdminPassword(pwInput);
      setAuthed(true);
      setPwInput("");
    } catch (err) {
      setPwError(err.message || "비밀번호가 올바르지 않아요.");
    } finally {
      setLoggingIn(false);
    }
  }

  const loadRequests = useCallback(async () => {
    if (!adminPassword) return;
    setLoadingList(true);
    setLoadError("");
    try {
      const res = await fetch("/api/requests/list", {
        headers: { "x-admin-password": adminPassword },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회에 실패했어요.");
      setRequests(data.items || []);
    } catch (err) {
      setLoadError(err.message || "목록을 불러오지 못했어요.");
    } finally {
      setLoadingList(false);
    }
  }, [adminPassword]);

  const loadCatalogStatus = useCallback(async () => {
    if (!adminPassword) return;
    try {
      const res = await fetch("/api/catalog-status", {
        headers: { "x-admin-password": adminPassword },
      });
      const data = await res.json();
      if (res.ok) setCatalogCount(data.count);
    } catch (e) {
      // 상태 조회 실패는 조용히 무시 (핵심 기능 아님)
    }
  }, [adminPassword]);

  useEffect(() => {
    if (view === "admin" && authed) {
      loadRequests();
      loadCatalogStatus();
    }
  }, [view, authed, loadRequests, loadCatalogStatus]);

  async function handleDelete(rowIndex) {
    try {
      const res = await fetch("/api/requests/delete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-admin-password": adminPassword,
        },
        body: JSON.stringify({ rowIndex }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "삭제에 실패했어요.");
      }
      setRequests((prev) => prev.filter((r) => r.rowIndex !== rowIndex));
    } catch (err) {
      setLoadError(err.message || "삭제 중 오류가 발생했어요.");
    }
  }

  async function handleCatalogUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setUploadMessage("");
    setUploadError("");

    try {
      // xlsx 라이브러리는 브라우저에서만 필요해서, 페이지 로드시 매번 불러오지 않고
      // 업로드할 때만 동적으로 불러온다 (초기 로딩 속도에 영향 없게).
      const XLSX = await import("xlsx");

      const buffer = await file.arrayBuffer();
      const books = parseWorkbookToBooks(XLSX, buffer);

      if (books.length === 0) {
        throw new Error(
          "도서명(서명) 컬럼을 찾지 못했습니다. 엑셀 안에 '서명' 또는 '도서명' 열이 있는지 확인해주세요."
        );
      }

      // 엑셀 파일은 통째로 보내면 용량 제한에 걸리지만, 파싱된 JSON은 훨씬 가벼워서
      // 그래도 큰 학교(수만 권)를 대비해 배치로 나눠 전송한다.
      const BATCH_SIZE = 2000;
      const totalBatches = Math.ceil(books.length / BATCH_SIZE);
      let savedCount = 0;

      for (let i = 0; i < totalBatches; i++) {
        const batch = books.slice(i * BATCH_SIZE, (i + 1) * BATCH_SIZE);
        const isFirstBatch = i === 0;
        const isLastBatch = i === totalBatches - 1;

        setUploadMessage(`업로드 중... (${i + 1}/${totalBatches}단계)`);

        const res = await fetch("/api/catalog-upload", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-admin-password": adminPassword,
          },
          body: JSON.stringify({ books: batch, isFirstBatch, isLastBatch }),
        });
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || "업로드 중 오류가 발생했어요.");
        }
        // 서버는 "이번 배치에서 저장한 건수"를 반환하므로, 전체 건수는
        // 브라우저에서 직접 누적해서 계산한다 (마지막 배치 숫자만 보이는 문제 방지).
        savedCount += batch.length;
      }

      setUploadMessage(`${savedCount.toLocaleString()}건의 소장도서가 등록되었습니다.`);
      setCatalogCount(savedCount);
    } catch (err) {
      setUploadError(err.message || "업로드 중 오류가 발생했어요.");
      setUploadMessage("");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  const filtered = requests.filter((r) => {
    const matchesRole = roleFilter === "전체" || r.role === roleFilter;
    const q = query.trim().toLowerCase();
    const matchesQuery =
      !q ||
      r.title.toLowerCase().includes(q) ||
      r.name.toLowerCase().includes(q) ||
      r.author.toLowerCase().includes(q) ||
      r.classInfo.toLowerCase().includes(q);
    return matchesRole && matchesQuery;
  });

  const studentCount = requests.filter((r) => r.role === "학생").length;
  const teacherCount = requests.filter((r) => r.role === "교직원").length;
  const totalPrice = requests.reduce((sum, r) => sum + (Number(r.price) || 0), 0);

  // ---- 중복 도서명 감지 ----
  const titleCountMap = requests.reduce((acc, r) => {
    const key = r.title.trim().toLowerCase();
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
  const isDuplicate = (title) => titleCountMap[title.trim().toLowerCase()] > 1;

  return (
    <div className="w-full min-h-screen bg-[#FAF9FE] flex flex-col">
      <header className="border-b border-[#C4B5E8] bg-[#EDE8F8] sticky top-0 z-20">
        <div className="max-w-4xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-start gap-2.5">
            <span style={{ fontSize: "38px", lineHeight: 1, alignSelf: "flex-start", marginTop: "2px" }}>📝</span>
            <div className="pt-1">
              <h1
                className="text-[17px] font-bold text-[#2E3A52] leading-tight"
                style={{ fontFamily: "'Gowun Dodum', sans-serif" }}
              >
                모란글샘 구입희망도서 신청
              </h1>
              <p className="text-[18px] text-[#7B5EA7] leading-loose" style={{ fontFamily: "'Nanum Pen Script', cursive" }}>부개여고 도서관</p>
            </div>
          </div>
          <div className="flex gap-1 bg-[#E8E4F5] rounded-lg p-1">
            <button
              onClick={() => setView("apply")}
              className={`text-[13px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === "apply"
                  ? "bg-white text-[#02343F] shadow-sm"
                  : "text-[#4A6B70] hover:text-[#02343F]"
              }`}
            >
              신청하기
            </button>
            <button
              onClick={() => setView("admin")}
              className={`text-[13px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                view === "admin"
                  ? "bg-white text-[#02343F] shadow-sm"
                  : "text-[#4A6B70] hover:text-[#02343F]"
              }`}
            >
              {authed ? <LockOpen size={13} /> : <Lock size={13} />}
              관리
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-6xl mx-auto w-full px-5 py-8">
        {view === "apply" && (
          <div className="flex gap-6 items-start">

            {/* ── 왼쪽: STEP 1 소장 검색 ── */}
            <div className="w-[420px] shrink-0">
              <div className="rounded-xl border-2 border-[#5B7B8A] bg-white overflow-hidden">
                <div className="bg-[#5B7B8A] px-4 py-3">
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    🔍 STEP 1 &nbsp;·&nbsp; 소장 도서 확인
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{ color: "#F9E4B7", fontFamily: "'Gowun Dodum', sans-serif" }}>
                    먼저 우리 학교도서관에 있는지 확인해보세요.
                  </p>
                </div>
                <div className="p-4">
                <div className="relative">
                  <input
                    type="text"
                    value={catalogQuery}
                    onChange={(e) => handleCatalogChange(e.target.value)}
                    placeholder="책 제목을 입력해 보세요"
                    autoComplete="off"
                    className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 pr-9 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {catalogSearching ? (
                      <Loader2 size={15} className="animate-spin text-[#9CA3AF]" />
                    ) : (
                      <Search size={15} className="text-[#9CA3AF]" />
                    )}
                  </div>
                </div>

                {!catalogSearching && catalogSearched && catalogResults.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-[12px] text-[#0F6E56] font-medium flex items-center gap-1">
                      <Check size={12} /> 우리 학교도서관에 있어요! ({catalogResults.length}건)
                    </p>
                    <div className="max-h-64 overflow-y-auto rounded-md border border-[#DDD8F0] divide-y divide-[#E8E4F5]">
                      {catalogResults.map((b, i) => (
                        <div key={i} className="px-3 py-2 bg-[#F7F9F6]">
                          <p className="text-[13px] font-medium text-[#02343F]">{b.title}</p>
                          <p className="text-[11px] text-[#4A6B70]">
                            {[b.author, b.publisher, b.year].filter(Boolean).join(" · ")}
                            {b.call ? ` · 청구기호 ${b.call}` : ""}
                          </p>
                          {b.status && b.status !== "대출가능" && (
                            <p className="text-[11px] text-[#993C1D]">현재 상태: {b.status}</p>
                          )}
                        </div>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#4A6B70] pt-1">
                      이미 있는 책이에요. 그래도 더 구입하고 싶으시면 오른쪽에서 신청해주세요.
                    </p>
                  </div>
                )}

                {!catalogSearching && catalogSearched && catalogResults.length === 0 && (
                  <div className="mt-3 rounded-md bg-[#FAECE7] px-3 py-2.5 space-y-2">
                    <p className="text-[12px] text-[#993C1D]">
                      우리 학교도서관에는 없는 책이에요.
                    </p>
                    <button
                      type="button"
                      onClick={useCatalogQueryForApply}
                      className="w-full text-[11px] font-medium text-white bg-[#4C3280] hover:opacity-90 px-2.5 py-1.5 rounded-md"
                    >
                      이 책 오른쪽에서 신청하기 →
                    </button>
                  </div>
                )}
                </div>
              </div>
              {/* ── 유의사항 ── */}
              <div className="mt-4 rounded-xl border border-[#DDD8F0] bg-white overflow-hidden">
                <div className="bg-[#F5F3FA] px-4 py-2.5 border-b border-[#DDD8F0]">
                  <p className="text-[13px] font-bold text-[#02343F]">📋 희망도서 신청 유의사항</p>
                </div>
                <ul className="p-4 space-y-2 text-[12px] text-[#4A6B70] leading-snug list-none">
                  <li className="flex gap-1.5"><span className="shrink-0 text-[#4C3280] font-bold">·</span><span>학습참고서·문제집은 신청이 어렵습니다.</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 text-[#4C3280] font-bold">·</span><span>신청한 도서는 예산 및 심의 후 구입 여부가 결정됩니다.</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 text-[#4C3280] font-bold">·</span><span>구입이 결정된 도서는 신청자에게 <strong className="text-[#02343F]">우선 대출</strong> 기회가 주어집니다.</span></li>
                  <li className="flex gap-1.5"><span className="shrink-0 text-[#4C3280] font-bold">·</span><span>문의: 모란글샘 담당 선생님</span></li>
                </ul>
              </div>
            </div>

            {/* ── 오른쪽: STEP 2 신청 폼 ── */}
            <div className="flex-1 min-w-0">
              <div className="rounded-xl border-2 border-[#5B7B8A] bg-white overflow-hidden mb-5">
                <div className="bg-[#5B7B8A] px-4 py-3">
                  <h3 className="text-[15px] font-bold text-white flex items-center gap-2">
                    ✏️ STEP 2 &nbsp;·&nbsp; 희망 도서 신청 양식
                  </h3>
                  <p className="text-[12px] mt-0.5" style={{ color: "#F9E4B7", fontFamily: "'Gowun Dodum', sans-serif" }}>
                    도서명을 입력하면 온라인 서점 검색 결과가 나타나요. 원하는 책을 선택하면 서지정보가 자동으로 채워집니다.
                  </p>
                </div>
              </div>

              {justSubmitted && (
                <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-[13px] text-[#085041]">
                  <Check size={16} className="shrink-0" />
                  신청이 접수되었어요! 도서관 선생님이 검토 후 구입 여부를 결정해요. 감사합니다 😊
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4">

              {/* ── 통합 카드 ── */}
              <div className="rounded-xl border border-[#DDD8F0] bg-white overflow-hidden">
                <div className="p-4 space-y-4">
                  {/* 신청자 정보 */}
                  <div>
                    <p className="text-[12px] font-bold text-[#4C3280] uppercase tracking-wide mb-2">👤 신청자 정보</p>
                    <div className="flex gap-2 mb-3">
                      {["학생", "교직원"].map((r) => (
                        <button
                          key={r}
                          type="button"
                          onClick={() => updateField("role", r)}
                          className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${
                            form.role === r
                              ? "border-[#04657A] bg-[#E0F0F3] text-[#02343F]"
                              : "border-[#DDD8F0] text-[#4A6B70] hover:border-[#A8D4DB]"
                          }`}
                        >
                          {r === "학생" ? <GraduationCap size={14} /> : <User size={14} />}
                          {r}
                        </button>
                      ))}
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                          {form.role === "학생" ? "학년/반" : "소속"}{form.role === "학생" && <span className="text-[#D85A30]"> *</span>}
                        </label>
                        <input
                          type="text"
                          value={form.classInfo}
                          onChange={(e) => updateField("classInfo", e.target.value)}
                          placeholder={form.role === "학생" ? "예: 203" : "예: 국어과"}
                          className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                        />
                      </div>
                      <div>
                        <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                          이름<span className="text-[#D85A30]"> *</span>
                        </label>
                        <input
                          type="text"
                          value={form.name}
                          onChange={(e) => updateField("name", e.target.value)}
                          placeholder="홍길동"
                          className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                        />
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-[#EDE8F8]" />

                  {/* 도서 정보 */}
                  <div>
                    <p className="text-[12px] font-bold text-[#4C3280] uppercase tracking-wide mb-2">📚 도서 정보</p>
                    <div className="space-y-4">
                    <div className="relative" ref={searchBoxRef}>
                    <div className="mb-1.5">
                      <label className="block text-[13px] font-bold text-[#02343F]" style={{ fontFamily: "Pretendard, sans-serif" }}>
                        도서명<span className="text-[#D85A30]"> *</span>
                      </label>
                    </div>
                    <div className="relative">
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => handleTitleChange(e.target.value)}
                        onFocus={() => searchResults.length > 0 && setShowResults(true)}
                        placeholder="책 제목을 입력하면 검색돼요"
                        autoComplete="off"
                        className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 pr-9 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                      />
                      <div className="absolute right-3 top-1/2 -translate-y-1/2">
                        {searching ? (
                          <Loader2 size={15} className="animate-spin text-[#9CA3AF]" />
                        ) : (
                          <Search size={15} className="text-[#9CA3AF]" />
                        )}
                      </div>
                    </div>

                    {showResults && searchResults.length > 0 && (
                      <div className="absolute z-30 mt-1 w-full bg-white border border-[#DDD8F0] rounded-md shadow-lg max-h-80 overflow-y-auto">
                        {searchResults.map((book, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => selectBook(book)}
                            className="w-full flex gap-3 items-start text-left px-3 py-2.5 hover:bg-[#F7F4EC] border-b border-[#E8E4F5] last:border-b-0"
                          >
                            {book.cover ? (
                              <img
                                src={book.cover}
                                alt=""
                                className="w-9 h-12 object-cover rounded-sm shrink-0 bg-[#E8E4F5]"
                              />
                            ) : (
                              <div className="w-9 h-12 rounded-sm bg-[#E8E4F5] shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-[13px] font-medium text-[#02343F] leading-snug truncate">
                                {book.title}
                              </p>
                              <p className="text-[12px] text-[#4A6B70] truncate">
                                {[book.author, book.publisher, book.pubYear]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </p>
                              {book.priceStandard != null && (
                                <p className="text-[12px] text-[#0F6E56] font-medium">
                                  {book.priceStandard.toLocaleString()}원
                                </p>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {showResults &&
                      !searching &&
                      searchResults.length === 0 &&
                      form.title.trim().length >= 2 && (
                        <div className="absolute z-30 mt-1 w-full bg-white border border-[#DDD8F0] rounded-md shadow-lg px-3 py-3 text-[13px] text-[#4A6B70]">
                          검색 결과가 없어요. 제목을 직접 입력해 신청할 수 있어요.
                        </div>
                      )}

                    {selectedBook && (
                      <p className="mt-1.5 text-[12px] text-[#0F6E56] flex items-center gap-1">
                        <Check size={12} /> 알라딘 검색 결과에서 정보를 가져왔어요
                      </p>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                        저자
                      </label>
                      <input
                        type="text"
                        value={form.author}
                        onChange={(e) => updateField("author", e.target.value)}
                        placeholder="저자명"
                        className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                        출판사
                      </label>
                      <input
                        type="text"
                        value={form.publisher}
                        onChange={(e) => updateField("publisher", e.target.value)}
                        placeholder="출판사명"
                        className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                        출판년도
                      </label>
                      <input
                        type="text"
                        value={form.pubYear}
                        onChange={(e) => updateField("pubYear", e.target.value)}
                        placeholder="2024"
                        className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                      />
                    </div>
                    <div>
                      <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                        가격
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={form.price}
                          onChange={(e) => updateField("price", e.target.value.replace(/[^0-9]/g, ""))}
                          placeholder="15000"
                          className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 pr-8 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                        />
                        <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#9CA3AF]">
                          원
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[13px] font-bold text-[#02343F] mb-1.5" style={{ fontFamily: "Pretendard, sans-serif" }}>
                      구입 수량
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={form.quantity}
                      onChange={(e) => updateField("quantity", e.target.value)}
                      placeholder="1"
                      className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                    />
                  </div>
                  </div>
                  </div>

                  <div className="border-t border-[#EDE8F8]" />

                  {/* 신청 사유 */}
                  <div>
                    <p className="text-[12px] font-bold text-[#4C3280] uppercase tracking-wide mb-2">💬 신청 사유 <span className="text-[11px] font-normal text-[#9CA3AF]">(선택)</span></p>
                    <textarea
                      value={form.reason}
                      onChange={(e) => updateField("reason", e.target.value)}
                      placeholder="예: 수업 활용, 진로 관심, 흥미 등"
                      rows={3}
                      className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A] resize-none"
                    />
                  </div>

                  {/* 장바구니에 담기 버튼 */}
                  {cartError && (
                    <p className="text-[13px] text-[#993C1D] bg-[#FAECE7] rounded-md px-3 py-2">
                      {cartError}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={handleAddToCart}
                    className="w-full flex items-center justify-center gap-2 rounded-md border-2 border-[#4C3280] text-[#4C3280] py-2 text-[14px] font-medium hover:bg-[#F5F3FA] transition-colors"
                  >
                    <BookPlus size={15} />
                    신청 장바구니에 추가하기
                  </button>
                </div>
              </div>

              {/* ── 장바구니 목록 ── */}
              {cart.length > 0 && (
                <div className="rounded-xl border border-[#4C3280] bg-[#FAF8FF] overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#5B7B8A]">
                    <p className="text-[13px] font-bold text-white">🛒 신청 목록 ({cart.length}권)</p>
                  </div>
                  <ul className="divide-y divide-[#EDE8F8]">
                    {cart.map((book, idx) => (
                      <li key={idx} className="flex items-start gap-3 px-4 py-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-[13px] font-medium text-[#02343F] leading-snug">{book.title}</p>
                          <p className="text-[12px] text-[#4A6B70] mt-0.5">
                            {[book.author, book.publisher].filter(Boolean).join(" · ")}
                            {book.price && ` · ${Number(book.price).toLocaleString()}원`}
                            {book.quantity && book.quantity !== "1" && ` · ${book.quantity}권`}
                          </p>
                          {book.reason && (
                            <p className="text-[11px] text-[#7B5EA7] mt-0.5">💬 {book.reason}</p>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeFromCart(idx)}
                          className="shrink-0 text-[#9CA3AF] hover:text-[#993C1D] transition-colors mt-0.5"
                        >
                          <Trash2 size={14} />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

                {submitError && (
                  <p className="text-[13px] text-[#993C1D] bg-[#FAECE7] rounded-md px-3 py-2">
                    {submitError}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex items-center justify-center gap-2 rounded-md bg-[#02343F] text-white py-2.5 text-[14px] font-medium hover:bg-[#024F5F] transition-colors disabled:opacity-60"
                >
                  <BookPlus size={16} />
                  {submitting ? "신청 중..." : cart.length > 0 ? `${cart.length + (form.title.trim() ? 1 : 0)}권 신청하기` : "신청하기"}
                </button>
              </form>
            </div>
          </div>
        )}

        {view === "admin" && !authed && (
          <div className="max-w-sm mx-auto mt-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#E8E4F5] flex items-center justify-center mx-auto mb-4">
              <Lock size={20} className="text-[#4A6B70]" />
            </div>
            <h2
              className="text-[16px] font-bold text-[#02343F] mb-1"
              style={{ fontFamily: "Pretendard, sans-serif" }}
            >
              관리자 전용 화면
            </h2>
            <p className="text-[13px] text-[#4A6B70] mb-5">
              비밀번호를 입력하면 신청 목록을 확인할 수 있어요.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[14px] text-center text-[#02343F] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                autoFocus
              />
              {pwError && <p className="text-[13px] text-[#993C1D]">{pwError}</p>}
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-md bg-[#02343F] text-white py-2.5 text-[14px] font-medium hover:bg-[#02343F] transition-colors disabled:opacity-60"
              >
                {loggingIn ? "확인 중..." : "확인"}
              </button>
            </form>
          </div>
        )}

        {view === "admin" && authed && (
          <div>
            <div className="mb-6 rounded-xl border border-[#DDD8F0] bg-white p-4">
              <h3
                className="text-[14px] font-bold text-[#02343F] mb-1 flex items-center gap-1.5"
                style={{ fontFamily: "Pretendard, sans-serif" }}
              >
                <FileSpreadsheet size={15} className="text-[#04657A]" />
                우리 학교도서관 소장도서 업로드
              </h3>
              <p className="text-[12px] text-[#4A6B70] mb-3">
                도서관리 시스템에서 받은 소장도서 엑셀(.xls, .xlsx, .csv)을 업로드하면, 신청
                화면의 소장 검색에 바로 반영돼요. 새로 업로드하면 기존 목록은 전체 교체됩니다.
              </p>

              {catalogCount !== null && (
                <p className="text-[12px] text-[#0F6E56] font-medium mb-3">
                  현재 {catalogCount.toLocaleString()}건의 소장도서가 등록되어 있어요.
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                onChange={handleCatalogUpload}
                className="hidden"
                id="catalog-file-input"
              />
              <label
                htmlFor="catalog-file-input"
                className={`inline-flex items-center gap-2 rounded-md border border-[#04657A] text-[#02343F] bg-[#E0F0F3] hover:bg-[#E2DFFB] px-3 py-2 text-[13px] font-medium cursor-pointer transition-colors ${
                  uploading ? "opacity-60 pointer-events-none" : ""
                }`}
              >
                {uploading ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Upload size={15} />
                )}
                {uploading ? "업로드 중..." : "엑셀 파일 선택"}
              </label>

              {uploadMessage && (
                <p className="text-[12px] text-[#0F6E56] mt-2">{uploadMessage}</p>
              )}
              {uploadError && (
                <p className="text-[12px] text-[#993C1D] mt-2">{uploadError}</p>
              )}

              <p className="text-[11px] text-[#4A6B70] mt-3">
                엑셀 첫 행(또는 표 안)에 "서명"(또는 "도서명", "제목") 열이 있으면 인식돼요.
                "저자", "출판사", "출판년도", "청구기호", "도서상태" 열이 있으면 함께
                저장됩니다.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="bg-[#E8E4F5] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#4A6B70] mb-1">전체 신청</p>
                <p className="text-[22px] font-medium text-[#02343F]">{requests.length}</p>
              </div>
              <div className="bg-[#E8E4F5] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#4A6B70] mb-1">학생 신청</p>
                <p className="text-[22px] font-medium text-[#02343F]">{studentCount}</p>
              </div>
              <div className="bg-[#E8E4F5] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#4A6B70] mb-1">교직원 신청</p>
                <p className="text-[22px] font-medium text-[#02343F]">{teacherCount}</p>
              </div>
              <div className="bg-[#E0F0F3] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#4A6B70] mb-1">신청 도서 정가 합계</p>
                <p className="text-[22px] font-medium text-[#02343F]">{totalPrice.toLocaleString()}원</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="도서명, 이름, 저자, 학년반으로 검색"
                  className="w-full rounded-md border border-[#DDD8F0] bg-white pl-9 pr-3 py-2 text-[13px] text-[#02343F] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0] focus:border-[#04657A]"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-[#DDD8F0] bg-white px-3 py-2 text-[13px] text-[#02343F] focus:outline-none focus:ring-2 focus:ring-[#7CC4D0]"
              >
                <option value="전체">전체</option>
                <option value="학생">학생</option>
                <option value="교직원">교직원</option>
              </select>
              <button
                onClick={loadRequests}
                className="rounded-md border border-[#DDD8F0] bg-white p-2 text-[#4A6B70] hover:bg-[#E8E4F5] transition-colors"
                title="새로고침"
              >
                <RefreshCw size={15} className={loadingList ? "animate-spin" : ""} />
              </button>
            </div>

            {loadError && <p className="text-[13px] text-[#993C1D] mb-3">{loadError}</p>}

            {loadingList && requests.length === 0 && (
              <p className="text-[13px] text-[#4A6B70] text-center py-10">불러오는 중...</p>
            )}

            {!loadingList && filtered.length === 0 && (
              <div className="text-center py-14">
                <p className="text-[14px] text-[#4A6B70]">
                  {requests.length === 0
                    ? "아직 신청된 도서가 없어요."
                    : "검색 결과가 없어요."}
                </p>
              </div>
            )}

            <div className="space-y-2">
              {filtered.map((r) => (
                <div
                  key={r.rowIndex}
                  className={`bg-white border rounded-lg px-4 py-3 ${isDuplicate(r.title) ? "border-[#993C1D] border-2" : "border-[#DDD8F0]"}`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            r.role === "학생"
                              ? "bg-[#E0F0F3] text-[#02343F]"
                              : "bg-[#E1F5EE] text-[#0F6E56]"
                          }`}
                        >
                          {r.role}
                        </span>
                        <span className="text-[12px] text-[#4A6B70]">
                          {r.classInfo} · {r.name}
                        </span>
                        <span className="text-[11px] text-[#9CA3AF] ml-auto">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-[15px] font-medium text-[#02343F] mb-0.5 flex items-center gap-2 flex-wrap">
                        {r.title}
                        {isDuplicate(r.title) && (
                          <span className="text-[10px] font-bold text-white bg-[#993C1D] px-1.5 py-0.5 rounded shrink-0">중복</span>
                        )}
                      </p>
                      {(r.author || r.publisher || r.pubYear || r.price) && (
                        <p className="text-[12px] text-[#4A6B70]">
                          {[r.author, r.publisher, r.pubYear].filter(Boolean).join(" · ")}
                          {r.price && (
                            <span className="text-[#0F6E56] font-medium">
                              {(r.author || r.publisher || r.pubYear) && " · "}
                              {Number(r.price).toLocaleString()}원
                            </span>
                          )}
                        </p>
                      )}
                      {r.reason && (
                        <p className="text-[12px] text-[#4A6B70] mt-1.5 bg-[#F5F3FA] rounded px-2 py-1.5">
                          {r.reason}
                        </p>
                      )}
                      {r.link && (
                        <a
                          href={r.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[12px] text-[#185FA5] underline mt-1 inline-block break-all"
                        >
                          {r.link}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() => handleDelete(r.rowIndex)}
                      className="shrink-0 text-[#9CA3AF] hover:text-[#993C1D] p-1"
                      title="삭제"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
