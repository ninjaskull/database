const CRM_BASE_URL = "https://crm.fallowl.com";

let activeTabId = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STORE_AUTH") {
    chrome.storage.local.set({
      authToken: message.token,
      apiBaseUrl: message.apiBaseUrl || CRM_BASE_URL
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
        apiBaseUrl: result.apiBaseUrl || CRM_BASE_URL
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

  if (message.type === "OPEN_AUTH") {
    chrome.tabs.create({ url: message.url || CRM_BASE_URL + "/extension-auth" });
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

chrome.action.onClicked.addListener((tab) => {
  activeTabId = tab.id;
});

chrome.runtime.onConnect.addListener((port) => {
  if (port.name === "popup") {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0]?.url?.includes("linkedin.com")) {
        chrome.tabs.sendMessage(tabs[0].id, { type: "POPUP_OPENED" }).catch(() => {});
      }
    });

    port.onDisconnect.addListener(() => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.url?.includes("linkedin.com")) {
          chrome.tabs.sendMessage(tabs[0].id, { type: "POPUP_CLOSED" }).catch(() => {});
        }
      });
    });
  }
});
