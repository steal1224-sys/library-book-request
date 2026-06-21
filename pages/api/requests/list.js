// pages/api/requests/list.js
import { listRequestRows } from "../../../lib/sheets";

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({ error: "GET 요청만 지원합니다." });
  }

  const password = req.headers["x-admin-password"];
  if (!ADMIN_PASSWORD || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
  }

  try {
    const rows = await listRequestRows();
    rows.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.status(200).json({ items: rows });
  } catch (err) {
    return res.status(500).json({ error: err.message || "조회 중 오류가 발생했습니다." });
  }
}
