// pages/api/requests/submit.js
import { appendRequestRow } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { role, classInfo, name, title, author, publisher, pubYear, price, quantity, reason, link } =
    req.body || {};

  // 교직원은 소속(classInfo) 미입력 허용, 학생은 학년/반 필수
  const classInfoRequired = role === "학생";
  if (!role || (classInfoRequired && !classInfo?.trim()) || !name?.trim() || !title?.trim()) {
    return res.status(400).json({ error: "필수 항목이 누락되었습니다." });
  }

  try {
    await appendRequestRow({
      role,
      classInfo: (classInfo || "").trim(),
      name: name.trim(),
      title: title.trim(),
      author: (author || "").trim(),
      publisher: (publisher || "").trim(),
      pubYear: (pubYear || "").trim(),
      price: (price || "").trim(),
      quantity: (quantity || "1").trim(),
      reason: (reason || "").trim(),
      link: (link || "").trim(),
      createdAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "저장 중 오류가 발생했습니다." });
  }
}
