// Supabase Edge Functionを呼び出す共通ヘルパー。
// 通信エラー・タイムアウト・サーバーエラーはすべてここで日本語の案内文に変換し、
// スタックトレースやHTTPステータスなど専門的な情報を画面に出さないようにする。
window.Api = (function () {
  const TIMEOUT_MS = 15000;

  async function callFunction(name, { body, token } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      const res = await fetch(`${window.APP_CONFIG.FUNCTIONS_BASE_URL}/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      let data = null;
      try {
        data = await res.json();
      } catch (_e) {
        // ok
      }

      if (!data || data.ok === false) {
        const message = (data && data.message) || window.MESSAGES.NETWORK_ERROR;
        return { ok: false, message, status: res.status, data };
      }

      return { ok: true, data };
    } catch (e) {
      const isAbort = e && e.name === "AbortError";
      const message = isAbort ? window.MESSAGES.FREEZE_ERROR : window.MESSAGES.NETWORK_ERROR;
      reportError(`${name} failed: ${isAbort ? "timeout" : String(e)}`);
      return { ok: false, message };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  // クライアント側で起きたエラーをベストエフォートで記録する(失敗しても無視)。
  function reportError(detail) {
    try {
      const subjectCode = window.Session ? window.Session.getSubjectCode() : null;
      fetch(`${window.APP_CONFIG.FUNCTIONS_BASE_URL}/log-error`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject_code: subjectCode, error_detail: String(detail).slice(0, 2000) }),
        keepalive: true,
      }).catch(() => {});
    } catch (_e) {
      // 送信自体の失敗は無視する
    }
  }

  // callFunctionは常にJSONとして応答をパースするため、CSVなどファイルを
  // 返すエンドポイント専用に、blobとして受け取ってブラウザにダウンロードさせる。
  async function downloadFile(name, { body, token, filename } = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

    try {
      const headers = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = "Bearer " + token;

      const res = await fetch(`${window.APP_CONFIG.FUNCTIONS_BASE_URL}/${name}`, {
        method: "POST",
        headers,
        body: JSON.stringify(body ?? {}),
        signal: controller.signal,
      });

      if (!res.ok) {
        let message = window.MESSAGES.NETWORK_ERROR;
        try {
          const data = await res.json();
          if (data && data.message) message = data.message;
        } catch (_e) {
          // ok
        }
        return { ok: false, message, status: res.status };
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename || "export.csv";
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);

      return { ok: true };
    } catch (e) {
      const isAbort = e && e.name === "AbortError";
      const message = isAbort ? window.MESSAGES.FREEZE_ERROR : window.MESSAGES.NETWORK_ERROR;
      reportError(`${name} failed: ${isAbort ? "timeout" : String(e)}`);
      return { ok: false, message };
    } finally {
      clearTimeout(timeoutId);
    }
  }

  return { callFunction, downloadFile, reportError };
})();
