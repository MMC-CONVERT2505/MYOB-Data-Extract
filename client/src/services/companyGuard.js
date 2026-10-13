// Keeps the browser and the server in agreement about WHICH MYOB company
// file is active. Every API request carries X-Company-Id (the company this
// tab is showing). If the server's session has a different company (e.g.
// another tab switched it) the server answers 409 COMPANY_MISMATCH instead
// of silently returning another company's data, and we reload this tab.

let activeCompanyId = null;
let reloading = false;

export const setActiveCompanyId = (id) => {
  activeCompanyId = id || null;
};

export function installCompanyGuard(instance) {
  instance.interceptors.request.use((config) => {
    if (activeCompanyId) {
      config.headers = config.headers || {};
      config.headers["X-Company-Id"] = activeCompanyId;
    }
    return config;
  });

  instance.interceptors.response.use(
    (res) => res,
    async (err) => {
      const data = err?.response?.data;
      // Blob responses (downloads) carry the JSON error as a Blob.
      let code = data?.code;
      if (!code && data instanceof Blob && err?.response?.status === 409) {
        try { code = JSON.parse(await data.text())?.code; } catch { /* ignore */ }
      }
      if (err?.response?.status === 409 && code === "COMPANY_MISMATCH" && !reloading) {
        reloading = true;
        window.alert(
          "The selected MYOB company file was changed in another tab or session. This page will reload to show the active company."
        );
        window.location.reload();
      }
      return Promise.reject(err);
    }
  );
}
