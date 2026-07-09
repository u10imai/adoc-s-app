// 管理者セッション(独自JWT)をsessionStorageに保持するだけの薄いラッパー。
// 被験者セッション(session.js)とは別ファイル・別キーにして混同を防ぐ。
window.AdminSession = (function () {
  const KEY = "adocs_admin_session";

  function save({ token, adminCode, name }) {
    sessionStorage.setItem(KEY, JSON.stringify({ token, adminCode, name }));
  }

  function get() {
    try {
      const raw = sessionStorage.getItem(KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (_e) {
      return null;
    }
  }

  function getToken() {
    const s = get();
    return s ? s.token : null;
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  function requireLoginOrRedirect() {
    const s = get();
    if (!s || !s.token) {
      window.location.href = "admin-login.html";
      return null;
    }
    return s;
  }

  return { save, get, getToken, clear, requireLoginOrRedirect };
})();
