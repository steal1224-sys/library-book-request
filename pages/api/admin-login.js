// pages/api/admin-login.js
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { password } = req.body || {};

  if (!ADMIN_PASSWORD) {
    return res.status(500).json({ error: "서버에 관리자 비밀번호가 설정되어 있지 않습니다." });
  }

  if (password === ADMIN_PASSWORD) {
    return res.status(200).json({ ok: true });
  }

  return res.status(401).json({ error: "비밀번호가 올바르지 않습니다." });
}
