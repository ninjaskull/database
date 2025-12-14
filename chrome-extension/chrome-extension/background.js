chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STORE_AUTH") {
    chrome.storage.local.set({
      authToken: message.token,
      apiBaseUrl: message.apiBaseUrl
    }, () => {
      console.log("Auth token stored successfully");
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "CLEAR_AUTH") {
    chrome.storage.local.remove(["authToken", "apiBaseUrl"], () => {
      console.log("Auth data cleared");
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "GET_AUTH") {
    chrome.storage.local.get(["authToken", "apiBaseUrl"], (result) => {
      sendResponse({
        token: result.authToken,
        apiBaseUrl: result.apiBaseUrl
      });
    });
    return true;
  }

  if (message.type === "LINKEDIN_PROFILE") {
    chrome.action.setBadgeText({ text: "!" });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6" });
    sendResponse({ success: true });
    return true;
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (!tab.url.includes("linkedin.com/in/")) {
      chrome.action.setBadgeText({ text: "" });
    }
  }
});
