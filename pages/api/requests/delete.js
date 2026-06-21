// pages/api/requests/delete.js
import { deleteRequestRow } from "../../../lib/sheets";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const password = req.headers["x-admin-password"];
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  const { rowIndex } = req.body || {};
  if (!rowIndex) {
    return res.status(400).json({ error: "삭제할 행 정보가 없습니다." });
  }

  try {
    await deleteRequestRow(rowIndex);
    return res.status(200).json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || "삭제 중 오류가 발생했습니다." });
  }
}
