// pages/api/requests/submit.js
import { appendRequestRow } from "../../../lib/sheets";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { role, classInfo, name, title, author, publisher, pubYear, price, reason, link } =
    req.body || {};

  if (!role || !classInfo?.trim() || !name?.trim() || !title?.trim()) {
    return res.status(400).json({ error: "필수 항목이 누락되었습니다." });
  }

  try {
    await appendRequestRow({
      role,
      classInfo: classInfo.trim(),
      name: name.trim(),
      title: title.trim(),
      author: (author || "").trim(),
      publisher: (publisher || "").trim(),
      pubYear: (pubYear || "").trim(),
      price: (price || "").trim(),
      reason: (reason || "").trim(),
      link: (link || "").trim(),
      createdAt: new Date().toISOString(),
    });
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "저장 중 오류가 발생했습니다." });
  }
}
