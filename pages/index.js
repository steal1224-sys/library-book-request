<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>앱 화면 미리보기</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Gowun+Batang:wght@700&family=Do+Hyeon&display=swap">
<link rel="stylesheet" as="style" crossorigin="anonymous" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/static/pretendard.css">
<style>
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: 'Pretendard', sans-serif; background: #d0d0d0; padding: 24px; display: flex; justify-content: center; }

.phone {
  width: 390px;
  background: #F5F3FA;
  border-radius: 40px;
  overflow: hidden;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3), inset 0 0 0 2px #333;
}

/* 헤더 */
header {
  background: #E0F0F3;
  border-bottom: 1px solid #DDD8F0;
  box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);
  padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.header-left { display: flex; align-items: center; gap: 10px; }
.icon { width: 36px; height: 36px; background: #02343F; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-size: 18px; flex-shrink: 0; }
.main-title { font-family: 'Gowun Batang', serif; font-size: 13px; font-weight: 700; color: #02343F; white-space: nowrap; }
.tabs { display: flex; gap: 3px; background: #E8E4F5; border-radius: 8px; padding: 3px; }
.tab { font-size: 11px; padding: 4px 8px; border-radius: 5px; font-weight: 500; color: #4A6B70; }
.tab.active { background: white; color: #02343F; box-shadow: 0 1px 2px rgba(0,0,0,0.1); }

/* 본문 */
main { padding: 20px 16px; height: 720px; overflow-y: auto; }

/* 소장검색 박스 */
.search-box {
  border: 2px solid #04657A;
  border-radius: 12px;
  background: white;
  padding: 14px;
  margin-bottom: 20px;
  box-shadow: 0 4px 12px rgba(4,101,122,0.15), 0 2px 4px rgba(0,0,0,0.08);
}
.search-box-title { font-size: 13px; font-weight: 700; color: #02343F; margin-bottom: 4px; }
.search-box-desc { font-size: 11px; color: #4A6B70; margin-bottom: 10px; }
.search-input-wrap { position: relative; }
.search-input {
  width: 100%; border: 1px solid #DDD8F0; border-radius: 6px;
  padding: 9px 36px 9px 12px; font-size: 13px; color: #9CA3AF;
  font-family: 'Pretendard';
}
.search-icon { position: absolute; right: 12px; top: 50%; transform: translateY(-50%); font-size: 13px; color: #9CA3AF; }

/* 섹션 제목 */
.section-title {
  font-family: 'Pretendard', sans-serif;
  font-size: 20px; font-weight: 800; color: #02343F; margin-bottom: 4px;
}
.section-desc { font-size: 13px; color: #4B5563; margin-bottom: 16px; line-height: 1.6; }

/* 신청 완료 메시지 */
.success-msg {
  background: #E1F5EE; border: 1px solid #5DCAA5;
  border-radius: 8px; padding: 10px 14px;
  font-size: 12px; color: #085041;
  display: flex; align-items: center; gap: 8px;
  margin-bottom: 14px;
}

/* 폼 */
label { display: block; font-size: 12px; font-weight: 700; color: #02343F; margin-bottom: 5px; margin-top: 12px; font-family: 'Pretendard'; }
input, textarea, select {
  width: 100%; border: 1px solid #DDD8F0; border-radius: 6px;
  padding: 9px 12px; font-size: 13px; color: #9CA3AF;
  font-family: 'Pretendard'; background: white;
}
textarea { height: 60px; resize: none; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.role-btns { display: flex; gap: 8px; margin-top: 4px; }
.role-btn {
  flex: 1; border: 1px solid #DDD8F0; border-radius: 6px;
  padding: 9px; font-size: 12px; font-weight: 500;
  color: #4A6B70; text-align: center;
}
.role-btn.active { border-color: #04657A; background: #E0F0F3; color: #02343F; }
.price-wrap { position: relative; }
.price-wrap input { padding-right: 24px; }
.price-unit { position: absolute; right: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: #9CA3AF; }

.submit-btn {
  width: 100%; background: #02343F; color: white;
  border-radius: 6px; padding: 12px;
  font-size: 14px; font-weight: 600;
  text-align: center; margin-top: 16px;
  display: flex; align-items: center; justify-content: center; gap: 6px;
}
</style>
</head>
<body>
<div class="phone">
  <header>
    <div class="header-left">
      <div class="icon">🩷</div>
      <div>
        <div class="main-title">모란글샘 구입희망도서 신청</div>
      </div>
    </div>
    <div class="tabs">
      <div class="tab active">신청</div>
      <div class="tab">🔒 관리</div>
    </div>
  </header>

  <main>
    <!-- 소장검색 박스 (입체) -->
    <div class="search-box">
      <div class="search-box-title">✅ 먼저, 우리 학교도서관에 있는지 확인해보세요.</div>
      <div class="search-box-desc">도서명을 입력하면 모란글샘 소장 목록에서 바로 찾아드려요.</div>
      <div class="search-input-wrap">
        <input class="search-input" type="text" placeholder="책 제목을 입력해 보세요">
        <span class="search-icon">🔎</span>
      </div>
    </div>

    <!-- 섹션 제목 -->
    <div style="margin-bottom: 16px;">
      <div class="section-title">✨ 읽고 싶은 책을 신청해 주세요!</div>
      <div class="section-desc">** 도서명을 입력하면 알라딘 검색 결과가 나타나요. 원하는 책을 선택하면 저자·출판사·출판년도가 자동으로 채워집니다.</div>
    </div>

    <!-- 신청 폼 -->
    <label><span style="font-size:9px;">🟣</span> 신청자 구분</label>
    <div class="role-btns">
      <div class="role-btn active">🎓 학생</div>
      <div class="role-btn">👤 교직원</div>
    </div>

    <div class="grid-2">
      <div>
        <label><span style="font-size:9px;">🟣</span> 학년/반 *</label>
        <input type="text" placeholder="예: 203">
      </div>
      <div>
        <label><span style="font-size:9px;">🟣</span> 이름 *</label>
        <input type="text" placeholder="홍길동">
      </div>
    </div>

    <label><span style="font-size:9px;">🟣</span> 도서명 *</label>
    <input type="text" placeholder="책 제목을 입력하면 검색돼요">

    <div class="grid-2">
      <div>
        <label><span style="font-size:9px;">🟣</span> 저자</label>
        <input type="text" placeholder="저자명">
      </div>
      <div>
        <label><span style="font-size:9px;">🟣</span> 출판사</label>
        <input type="text" placeholder="출판사명">
      </div>
      <div>
        <label><span style="font-size:9px;">🟣</span> 출판년도</label>
        <input type="text" placeholder="2024">
      </div>
      <div>
        <label><span style="font-size:9px;">🟣</span> 가격</label>
        <div class="price-wrap">
          <input type="text" placeholder="15000">
          <span class="price-unit">원</span>
        </div>
      </div>
    </div>

    <label><span style="font-size:9px;">🟣</span> 구입 수량</label>
    <input type="number" placeholder="1">

    <label><span style="font-size:9px;">🟣</span> 신청 사유</label>
    <textarea placeholder="예: 수업 활용, 진로 관심, 흥미 등 (선택)"></textarea>

    <div class="submit-btn">📖 신청하기</div>
  </main>
</div>
</body>
</html>
