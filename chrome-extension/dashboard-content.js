(function() {
  const CRM_BASE_URL = "https://crm.fallowl.com";
  const apiBaseUrl = window.location.origin;

  function syncAuthToExtension(token) {
    if (token) {
      chrome.runtime.sendMessage({
        type: "STORE_AUTH",
        token: token,
        apiBaseUrl: apiBaseUrl,
      });
    } else {
      chrome.runtime.sendMessage({ type: "CLEAR_AUTH" });
    }
  }

  function checkAndSyncAuth() {
    const token = localStorage.getItem("extension_auth_token");
    const storedUrl = localStorage.getItem("extension_api_base_url");
    const timestamp = localStorage.getItem("extension_auth_timestamp");

    if (token) {
      const authTime = parseInt(timestamp || "0", 10);
      const now = Date.now();

      if (now - authTime < 120000) {
        chrome.runtime.sendMessage({
          type: "STORE_AUTH",
          token: token,
          apiBaseUrl: storedUrl || apiBaseUrl,
        });

        localStorage.removeItem("extension_auth_token");
        localStorage.removeItem("extension_api_base_url");
        localStorage.removeItem("extension_auth_timestamp");
      }
    }
  }

  function listenForAuthMessages() {
    window.addEventListener("message", (event) => {
      if (event.source !== window) return;

      if (event.data && event.data.type === "CRM_EXTENSION_AUTH") {
        chrome.runtime.sendMessage({
          type: "STORE_AUTH",
          token: event.data.token,
          apiBaseUrl: event.data.apiBaseUrl || apiBaseUrl,
        });
      }
    });
  }

  function syncCurrentSession() {
    const currentToken = localStorage.getItem("authToken");

    if (currentToken) {
      chrome.storage.local.get(["authToken", "apiBaseUrl"], (result) => {
        const needsSync = result.authToken !== currentToken || result.apiBaseUrl !== apiBaseUrl;
        if (needsSync) {
          syncAuthToExtension(currentToken);
        }
      });
    }
  }

  checkAndSyncAuth();
  listenForAuthMessages();

  setTimeout(syncCurrentSession, 500);

  setInterval(() => {
    const currentToken = localStorage.getItem("authToken");
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken !== currentToken) {
        syncAuthToExtension(currentToken);
      }
    });
  }, 2000);

  window.addEventListener("storage", (event) => {
    if (event.key === "authToken") {
      syncAuthToExtension(event.newValue);
    }
  });
})();
