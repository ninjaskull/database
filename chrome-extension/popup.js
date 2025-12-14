const API_BASE_URL = "";

const loadingView = document.getElementById("loading-view");
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");

const userName = document.getElementById("user-name");
const planBadge = document.getElementById("plan-badge");
const usageCount = document.getElementById("usage-count");
const usageProgress = document.getElementById("usage-progress");

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const linkedinLookup = document.getElementById("linkedin-lookup");
const lookupBtn = document.getElementById("lookup-btn");

const resultsSection = document.getElementById("results-section");
const resultsList = document.getElementById("results-list");
const contactDetail = document.getElementById("contact-detail");
const contactInfo = document.getElementById("contact-info");
const backBtn = document.getElementById("back-btn");
const noResults = document.getElementById("no-results");
const noResultsText = document.getElementById("no-results-text");
const errorMessage = document.getElementById("error-message");
const errorText = document.getElementById("error-text");

const openDashboardBtn = document.getElementById("open-dashboard-btn");
const logoutBtn = document.getElementById("logout-btn");

let currentLinkedInUrl = null;

async function getApiBaseUrl() {
  const result = await chrome.storage.local.get(["apiBaseUrl"]);
  return result.apiBaseUrl || API_BASE_URL;
}

async function getAuthToken() {
  const result = await chrome.storage.local.get(["authToken"]);
  return result.authToken;
}

async function setAuthToken(token) {
  await chrome.storage.local.set({ authToken: token });
}

async function clearAuthToken() {
  await chrome.storage.local.remove(["authToken"]);
}

function showView(viewId) {
  loadingView.classList.add("hidden");
  loginView.classList.add("hidden");
  mainView.classList.add("hidden");

  if (viewId === "loading") loadingView.classList.remove("hidden");
  else if (viewId === "login") loginView.classList.remove("hidden");
  else if (viewId === "main") mainView.classList.remove("hidden");
}

function showError(message) {
  errorMessage.classList.remove("hidden");
  errorText.textContent = message;
  setTimeout(() => {
    errorMessage.classList.add("hidden");
  }, 5000);
}

function hideAllResults() {
  resultsSection.classList.add("hidden");
  contactDetail.classList.add("hidden");
  noResults.classList.add("hidden");
  errorMessage.classList.add("hidden");
}

function updateUsage(used, limit) {
  usageCount.textContent = `${used} / ${limit}`;
  const percentage = Math.min(100, (used / limit) * 100);
  usageProgress.style.width = `${percentage}%`;

  if (percentage >= 90) {
    usageProgress.style.background = "linear-gradient(90deg, #ef4444, #dc2626)";
  } else if (percentage >= 70) {
    usageProgress.style.background = "linear-gradient(90deg, #f59e0b, #d97706)";
  } else {
    usageProgress.style.background = "linear-gradient(90deg, #3b82f6, #2563eb)";
  }
}

async function validateSession() {
  const token = await getAuthToken();
  if (!token) {
    showView("login");
    return null;
  }

  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/extension/validate`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const data = await response.json();

    if (data.valid) {
      return data;
    } else {
      await clearAuthToken();
      showView("login");
      return null;
    }
  } catch (error) {
    console.error("Validation error:", error);
    showView("login");
    return null;
  }
}

async function lookupLinkedIn(url) {
  const token = await getAuthToken();
  if (!token) {
    showView("login");
    return;
  }

  hideAllResults();
  lookupBtn.disabled = true;
  lookupBtn.textContent = "Looking up...";

  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/extension/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ linkedinUrl: url }),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearAuthToken();
      showView("login");
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Lookup limit reached");
      if (data.usage) {
        updateUsage(data.usage.limit - data.usage.remaining, data.usage.limit);
      }
      return;
    }

    if (data.usage) {
      updateUsage(data.usage.limit - data.usage.remaining, data.usage.limit);
    }

    if (data.success && data.found) {
      showContactDetail(data.contact);
    } else {
      noResults.classList.remove("hidden");
      noResultsText.textContent = "No contact found for this LinkedIn profile";
    }
  } catch (error) {
    console.error("Lookup error:", error);
    showError("Failed to look up profile");
  } finally {
    lookupBtn.disabled = false;
    lookupBtn.textContent = "Look Up Profile";
  }
}

async function searchContacts(query) {
  const token = await getAuthToken();
  if (!token) {
    showView("login");
    return;
  }

  hideAllResults();
  searchBtn.disabled = true;

  try {
    const baseUrl = await getApiBaseUrl();
    const response = await fetch(`${baseUrl}/api/extension/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, limit: 10 }),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearAuthToken();
      showView("login");
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Lookup limit reached");
      if (data.usage) {
        updateUsage(data.usage.limit - data.usage.remaining, data.usage.limit);
      }
      return;
    }

    if (data.usage) {
      updateUsage(data.usage.limit - data.usage.remaining, data.usage.limit);
    }

    if (data.success && data.contacts && data.contacts.length > 0) {
      showResults(data.contacts);
    } else {
      noResults.classList.remove("hidden");
      noResultsText.textContent = "No contacts found";
    }
  } catch (error) {
    console.error("Search error:", error);
    showError("Search failed");
  } finally {
    searchBtn.disabled = false;
  }
}

function showResults(contacts) {
  resultsList.innerHTML = "";

  contacts.forEach((contact) => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.innerHTML = `
      <div class="result-name">${contact.fullName || "Unknown"}</div>
      <div class="result-meta">${contact.title || ""} ${contact.company ? "at " + contact.company : ""}</div>
    `;
    item.addEventListener("click", () => showContactDetail(contact));
    resultsList.appendChild(item);
  });

  resultsSection.classList.remove("hidden");
}

function showContactDetail(contact) {
  hideAllResults();

  const fields = [
    { label: "Name", value: contact.fullName },
    { label: "Email", value: contact.email, copyable: true, link: contact.email ? `mailto:${contact.email}` : null },
    { label: "Phone", value: contact.mobilePhone, copyable: true },
    { label: "Title", value: contact.title },
    { label: "Company", value: contact.company },
    { label: "Industry", value: contact.industry },
    { label: "Location", value: [contact.city, contact.state, contact.country].filter(Boolean).join(", ") },
    { label: "LinkedIn", value: contact.personLinkedIn, link: contact.personLinkedIn },
    { label: "Website", value: contact.website, link: contact.website },
    { label: "Lead Score", value: contact.leadScore },
  ];

  contactInfo.innerHTML = fields
    .filter((f) => f.value)
    .map(
      (f) => `
      <div class="info-row">
        <span class="info-label">${f.label}</span>
        <span class="info-value">
          ${f.link ? `<a href="${f.link}" target="_blank">${f.value}</a>` : f.value}
          ${f.copyable ? `<button class="copy-btn" data-value="${f.value}" title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
            </svg>
          </button>` : ""}
        </span>
      </div>
    `
    )
    .join("");

  contactInfo.querySelectorAll(".copy-btn").forEach((btn) => {
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      const value = btn.dataset.value;
      navigator.clipboard.writeText(value);
      btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="2"><polyline points="20,6 9,17 4,12"/></svg>`;
      setTimeout(() => {
        btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`;
      }, 1500);
    });
  });

  contactDetail.classList.remove("hidden");
}

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab && tab.url && tab.url.includes("linkedin.com/in/")) {
      currentLinkedInUrl = tab.url;
      linkedinLookup.classList.remove("hidden");
    } else {
      linkedinLookup.classList.add("hidden");
    }
  } catch (error) {
    console.error("Tab check error:", error);
  }
}

async function init() {
  showView("loading");

  const sessionData = await validateSession();

  if (sessionData) {
    userName.textContent = sessionData.user.name || sessionData.user.email;
    planBadge.textContent = sessionData.plan?.displayName || "Free";
    updateUsage(sessionData.usage.used, sessionData.usage.limit);

    await checkCurrentTab();
    showView("main");
  }
}

searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    searchContacts(query);
  }
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) {
      searchContacts(query);
    }
  }
});

lookupBtn.addEventListener("click", () => {
  if (currentLinkedInUrl) {
    lookupLinkedIn(currentLinkedInUrl);
  }
});

backBtn.addEventListener("click", () => {
  hideAllResults();
});

openDashboardBtn.addEventListener("click", async () => {
  const baseUrl = await getApiBaseUrl();
  chrome.tabs.create({ url: baseUrl || "https://your-app-url.replit.app" });
});

logoutBtn.addEventListener("click", async () => {
  await clearAuthToken();
  showView("login");
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_TOKEN") {
    setAuthToken(message.token).then(() => {
      init();
    });
  }
});

init();
