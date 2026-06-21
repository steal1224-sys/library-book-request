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
  Library,
  Loader2,
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

export default function Home() {
  const [view, setView] = useState("apply"); // apply | admin

  // ---- 신청 폼 상태 ----
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [justSubmitted, setJustSubmitted] = useState(false);

  // ---- 알라딘 검색 상태 ----
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);
  const searchTimer = useRef(null);
  const searchBoxRef = useRef(null);

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

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitError("");
    if (!form.name.trim() || !form.classInfo.trim() || !form.title.trim()) {
      setSubmitError("이름, 학년/반 또는 소속, 도서명은 꼭 입력해주세요.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/requests/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "신청 중 문제가 발생했어요.");
      }
      setForm(emptyForm);
      setSelectedBook(null);
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

  useEffect(() => {
    if (view === "admin" && authed) {
      loadRequests();
    }
  }, [view, authed, loadRequests]);

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
  const teacherCount = requests.filter((r) => r.role === "교사").length;

  return (
    <div className="w-full min-h-screen bg-[#FAF7F0] flex flex-col">
      <header className="border-b border-[#E4DCC8] bg-[#FAF7F0] sticky top-0 z-20">
        <div className="max-w-3xl mx-auto px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-md bg-[#3C3489] flex items-center justify-center shrink-0">
              <Library size={18} className="text-[#EEEDFE]" />
            </div>
            <div>
              <h1 className="text-[16px] font-bold text-[#26215C] leading-tight">
                모란글샘 구입희망도서 신청
              </h1>
              <p className="text-[12px] text-[#7A7460] leading-tight">부개여고 도서관</p>
            </div>
          </div>
          <div className="flex gap-1 bg-[#F1EBDD] rounded-lg p-1">
            <button
              onClick={() => setView("apply")}
              className={`text-[13px] px-3 py-1.5 rounded-md font-medium transition-colors ${
                view === "apply"
                  ? "bg-white text-[#26215C] shadow-sm"
                  : "text-[#7A7460] hover:text-[#26215C]"
              }`}
            >
              신청하기
            </button>
            <button
              onClick={() => setView("admin")}
              className={`text-[13px] px-3 py-1.5 rounded-md font-medium transition-colors flex items-center gap-1 ${
                view === "admin"
                  ? "bg-white text-[#26215C] shadow-sm"
                  : "text-[#7A7460] hover:text-[#26215C]"
              }`}
            >
              {authed ? <LockOpen size={13} /> : <Lock size={13} />}
              관리
            </button>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-3xl mx-auto w-full px-5 py-8">
        {view === "apply" && (
          <div className="max-w-xl mx-auto">
            <div className="mb-6">
              <h2 className="text-[20px] font-medium text-[#26215C] mb-1.5">
                읽고 싶은 책을 신청해 주세요!
              </h2>
              <p className="text-[14px] text-[#7A7460] leading-relaxed">
                **도서명을 입력하면 알라딘 검색 결과가 나타납니다. 원하는 책을 선택하면
                저자·출판사·출판년도·가격이 자동으로 채워집니다.
              </p>
            </div>

            {justSubmitted && (
              <div className="mb-5 flex items-center gap-2 rounded-lg border border-[#5DCAA5] bg-[#E1F5EE] px-4 py-3 text-[13px] text-[#085041]">
                <Check size={16} className="shrink-0" />
                신청이 접수되었어요. 감사합니다!
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                  신청자 구분
                </label>
                <div className="flex gap-2">
                  {["학생", "교사"].map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => updateField("role", r)}
                      className={`flex-1 flex items-center justify-center gap-1.5 rounded-md border px-3 py-2 text-[13px] font-medium transition-colors ${
                        form.role === r
                          ? "border-[#534AB7] bg-[#EEEDFE] text-[#26215C]"
                          : "border-[#E4DCC8] text-[#7A7460] hover:border-[#C9BFA3]"
                      }`}
                    >
                      {r === "학생" ? <GraduationCap size={14} /> : <User size={14} />}
                      {r}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    {form.role === "학생" ? "학년/반" : "소속"}
                    <span className="text-[#D85A30]"> *</span>
                  </label>
                  <input
                    type="text"
                    value={form.classInfo}
                    onChange={(e) => updateField("classInfo", e.target.value)}
                    placeholder={form.role === "학생" ? "예: 2학년 3반" : "예: 국어과 교사"}
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    이름<span className="text-[#D85A30]"> *</span>
                  </label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => updateField("name", e.target.value)}
                    placeholder="홍길동"
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                </div>
              </div>

              <div className="relative" ref={searchBoxRef}>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-[13px] font-medium text-[#26215C]">
                    도서명<span className="text-[#D85A30]"> *</span>
                  </label>
                  <a
                    href="https://read365.edunet.net/PureScreen/SchoolSearch?schoolName=%EB%B6%80%EA%B0%9C%EC%97%AC%EC%9E%90%EA%B3%A0%EB%93%B1%ED%95%99%EA%B5%90%20%EB%8F%84%EC%84%9C%EA%B4%80&provCode=E10&neisCode=E100000214"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-[#185FA5] underline hover:text-[#0F3D6E]"
                  >
                    우리학교도서관에서 검색해보기 ↗
                  </a>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    value={form.title}
                    onChange={(e) => handleTitleChange(e.target.value)}
                    onFocus={() => searchResults.length > 0 && setShowResults(true)}
                    placeholder="책 제목을 입력하면 검색돼요"
                    autoComplete="off"
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 pr-9 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    {searching ? (
                      <Loader2 size={15} className="animate-spin text-[#B0A887]" />
                    ) : (
                      <Search size={15} className="text-[#B0A887]" />
                    )}
                  </div>
                </div>

                {showResults && searchResults.length > 0 && (
                  <div className="absolute z-30 mt-1 w-full bg-white border border-[#E4DCC8] rounded-md shadow-lg max-h-80 overflow-y-auto">
                    {searchResults.map((book, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => selectBook(book)}
                        className="w-full flex gap-3 items-start text-left px-3 py-2.5 hover:bg-[#F7F4EC] border-b border-[#F1EBDD] last:border-b-0"
                      >
                        {book.cover ? (
                          <img
                            src={book.cover}
                            alt=""
                            className="w-9 h-12 object-cover rounded-sm shrink-0 bg-[#F1EBDD]"
                          />
                        ) : (
                          <div className="w-9 h-12 rounded-sm bg-[#F1EBDD] shrink-0" />
                        )}
                        <div className="min-w-0">
                          <p className="text-[13px] font-medium text-[#26215C] leading-snug truncate">
                            {book.title}
                          </p>
                          <p className="text-[12px] text-[#7A7460] truncate">
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
                    <div className="absolute z-30 mt-1 w-full bg-white border border-[#E4DCC8] rounded-md shadow-lg px-3 py-3 text-[13px] text-[#7A7460]">
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
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    저자
                  </label>
                  <input
                    type="text"
                    value={form.author}
                    onChange={(e) => updateField("author", e.target.value)}
                    placeholder="저자명"
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    출판사
                  </label>
                  <input
                    type="text"
                    value={form.publisher}
                    onChange={(e) => updateField("publisher", e.target.value)}
                    placeholder="출판사명"
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    출판년도
                  </label>
                  <input
                    type="text"
                    value={form.pubYear}
                    onChange={(e) => updateField("pubYear", e.target.value)}
                    placeholder="2024"
                    className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                  />
                </div>
                <div>
                  <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                    가격
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={form.price}
                      onChange={(e) => updateField("price", e.target.value.replace(/[^0-9]/g, ""))}
                      placeholder="15000"
                      className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 pr-8 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[13px] text-[#B0A887]">
                      원
                    </span>
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-[13px] font-medium text-[#26215C] mb-1.5">
                  신청 사유
                </label>
                <textarea
                  value={form.reason}
                  onChange={(e) => updateField("reason", e.target.value)}
                  placeholder="예: 수업 활용, 진로 관심, 흥미 등 (선택)"
                  rows={3}
                  className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7] resize-none"
                />
              </div>

              {submitError && (
                <p className="text-[13px] text-[#993C1D] bg-[#FAECE7] rounded-md px-3 py-2">
                  {submitError}
                </p>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full flex items-center justify-center gap-2 rounded-md bg-[#3C3489] text-white py-2.5 text-[14px] font-medium hover:bg-[#26215C] transition-colors disabled:opacity-60"
              >
                <BookPlus size={16} />
                {submitting ? "신청 중..." : "신청하기"}
              </button>
            </form>
          </div>
        )}

        {view === "admin" && !authed && (
          <div className="max-w-sm mx-auto mt-10 text-center">
            <div className="w-12 h-12 rounded-full bg-[#F1EBDD] flex items-center justify-center mx-auto mb-4">
              <Lock size={20} className="text-[#7A7460]" />
            </div>
            <h2 className="text-[16px] font-medium text-[#26215C] mb-1">
              사서선생님 전용 화면
            </h2>
            <p className="text-[13px] text-[#7A7460] mb-5">
              비밀번호를 입력하면 신청 목록을 확인할 수 있어요.
            </p>
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <input
                type="password"
                value={pwInput}
                onChange={(e) => setPwInput(e.target.value)}
                placeholder="비밀번호"
                className="w-full rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[14px] text-center text-[#26215C] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                autoFocus
              />
              {pwError && <p className="text-[13px] text-[#993C1D]">{pwError}</p>}
              <button
                type="submit"
                disabled={loggingIn}
                className="w-full rounded-md bg-[#3C3489] text-white py-2.5 text-[14px] font-medium hover:bg-[#26215C] transition-colors disabled:opacity-60"
              >
                {loggingIn ? "확인 중..." : "확인"}
              </button>
            </form>
          </div>
        )}

        {view === "admin" && authed && (
          <div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-[#F1EBDD] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#7A7460] mb-1">전체 신청</p>
                <p className="text-[22px] font-medium text-[#26215C]">{requests.length}</p>
              </div>
              <div className="bg-[#F1EBDD] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#7A7460] mb-1">학생 신청</p>
                <p className="text-[22px] font-medium text-[#26215C]">{studentCount}</p>
              </div>
              <div className="bg-[#F1EBDD] rounded-md px-4 py-3">
                <p className="text-[12px] text-[#7A7460] mb-1">교사 신청</p>
                <p className="text-[22px] font-medium text-[#26215C]">{teacherCount}</p>
              </div>
            </div>

            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-[#B0A887]"
                />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQueryText(e.target.value)}
                  placeholder="도서명, 이름, 저자, 학년반으로 검색"
                  className="w-full rounded-md border border-[#E4DCC8] bg-white pl-9 pr-3 py-2 text-[13px] text-[#26215C] placeholder:text-[#B0A887] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC] focus:border-[#534AB7]"
                />
              </div>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="rounded-md border border-[#E4DCC8] bg-white px-3 py-2 text-[13px] text-[#26215C] focus:outline-none focus:ring-2 focus:ring-[#AFA9EC]"
              >
                <option value="전체">전체</option>
                <option value="학생">학생</option>
                <option value="교사">교사</option>
              </select>
              <button
                onClick={loadRequests}
                className="rounded-md border border-[#E4DCC8] bg-white p-2 text-[#7A7460] hover:bg-[#F1EBDD] transition-colors"
                title="새로고침"
              >
                <RefreshCw size={15} className={loadingList ? "animate-spin" : ""} />
              </button>
            </div>

            {loadError && <p className="text-[13px] text-[#993C1D] mb-3">{loadError}</p>}

            {loadingList && requests.length === 0 && (
              <p className="text-[13px] text-[#7A7460] text-center py-10">불러오는 중...</p>
            )}

            {!loadingList && filtered.length === 0 && (
              <div className="text-center py-14">
                <p className="text-[14px] text-[#7A7460]">
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
                  className="bg-white border border-[#E4DCC8] rounded-lg px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span
                          className={`text-[11px] font-medium px-1.5 py-0.5 rounded ${
                            r.role === "학생"
                              ? "bg-[#EEEDFE] text-[#3C3489]"
                              : "bg-[#E1F5EE] text-[#0F6E56]"
                          }`}
                        >
                          {r.role}
                        </span>
                        <span className="text-[12px] text-[#7A7460]">
                          {r.classInfo} · {r.name}
                        </span>
                        <span className="text-[11px] text-[#B0A887] ml-auto">
                          {formatDate(r.createdAt)}
                        </span>
                      </div>
                      <p className="text-[15px] font-medium text-[#26215C] mb-0.5">
                        {r.title}
                      </p>
                      {(r.author || r.publisher || r.pubYear || r.price) && (
                        <p className="text-[12px] text-[#7A7460]">
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
                        <p className="text-[12px] text-[#7A7460] mt-1.5 bg-[#FAF7F0] rounded px-2 py-1.5">
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
                      className="shrink-0 text-[#B0A887] hover:text-[#993C1D] p-1"
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
