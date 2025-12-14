chrome.runtime.onInstalled.addListener(() => {
  console.log("Prospect Lookup extension installed");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "STORE_TOKEN") {
    chrome.storage.local.set({ authToken: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "STORE_API_URL") {
    chrome.storage.local.set({ apiBaseUrl: message.url }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get(["authToken"], (result) => {
      sendResponse({ token: result.authToken });
    });
    return true;
  }

  if (message.type === "CLEAR_TOKEN") {
    chrome.storage.local.remove(["authToken"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (message.type === "LINKEDIN_PROFILE_DETECTED") {
    chrome.action.setBadgeText({ text: "1", tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6", tabId: sender.tab?.id });
  }
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tab.url) {
    if (!tab.url.includes("linkedin.com/in/")) {
      chrome.action.setBadgeText({ text: "", tabId });
    }
  }
});
