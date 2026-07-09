// 被験者セッション(独自JWT)をsessionStorageに保持するだけの薄いラッパー。
// タブを閉じれば消える想定(パスワードそのものは一切保存しない)。
window.Session = (function () {
  const KEY = "adocs_subject_session";

  function save({ token, subjectCode, ageGroup }) {
    sessionStorage.setItem(KEY, JSON.stringify({ token, subjectCode, ageGroup }));
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

  function getSubjectCode() {
    const s = get();
    return s ? s.subjectCode : null;
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  // ログインしていなければログイン画面に戻す。呼び出し元は戻り値がnullなら
  // 以降の処理を中断すること。
  function requireLoginOrRedirect() {
    const s = get();
    if (!s || !s.token) {
      window.location.href = "login.html";
      return null;
    }
    return s;
  }

  return { save, get, getToken, getSubjectCode, clear, requireLoginOrRedirect };
})();
