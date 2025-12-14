const loadingView = document.getElementById("loading-view");
const loginView = document.getElementById("login-view");
const mainView = document.getElementById("main-view");

const userName = document.getElementById("user-name");
const planBadge = document.getElementById("plan-badge");
const usageCount = document.getElementById("usage-count");
const usageProgress = document.getElementById("usage-progress");

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const lookupBtn = document.getElementById("lookup-btn");

const resultsList = document.getElementById("results-list");
const contactDetail = document.getElementById("contact-detail");
const errorMessage = document.getElementById("error-message");

const dashboardUrlInput = document.getElementById("dashboard-url");
const connectBtn = document.getElementById("connect-btn");
const openDashboardBtn = document.getElementById("open-dashboard-btn");
const logoutBtn = document.getElementById("logout-btn");

let currentLinkedInUrl = null;

async function getStoredAuth() {
  const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
  return {
    token: result.authToken,
    apiBaseUrl: result.apiBaseUrl || "",
  };
}

async function setStoredAuth(token, apiBaseUrl) {
  await chrome.storage.local.set({ authToken: token, apiBaseUrl: apiBaseUrl });
}

async function clearStoredAuth() {
  await chrome.storage.local.remove(["authToken", "apiBaseUrl"]);
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
  errorMessage.textContent = message;
  setTimeout(() => errorMessage.classList.add("hidden"), 5000);
}

async function validateSession() {
  showView("loading");

  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    if (!token) {
      showView("login");
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/extension/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      await clearStoredAuth();
      showView("login");
      return;
    }

    const data = await response.json();

    if (data.valid) {
      userName.textContent = data.user.name || data.user.email;
      planBadge.textContent = data.plan?.displayName || "Free";
      usageCount.textContent = `${data.usage.used}/${data.usage.limit}`;

      const usagePercent = (data.usage.used / data.usage.limit) * 100;
      usageProgress.style.width = `${usagePercent}%`;

      showView("main");
      checkCurrentTab();
    } else {
      await clearStoredAuth();
      showView("login");
    }
  } catch (error) {
    console.error("Validation error:", error);
    showView("login");
  }
}

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (tab?.url?.includes("linkedin.com/in/")) {
      currentLinkedInUrl = tab.url;
      lookupBtn.disabled = false;
      lookupBtn.textContent = "Look Up Current Profile";
    } else {
      lookupBtn.disabled = true;
      lookupBtn.textContent = "Open a LinkedIn profile";
    }
  } catch (error) {
    console.error("Tab query error:", error);
  }
}

async function searchContacts(query) {
  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    const response = await fetch(`${apiBaseUrl}/api/extension/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query, limit: 10 }),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearStoredAuth();
      showView("login");
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Search limit reached");
      return;
    }

    if (data.success) {
      displayResults(data.contacts);
      if (data.usage) updateUsage(data.usage);
    } else {
      showError(data.message || "Search failed");
    }
  } catch (error) {
    console.error("Search error:", error);
    showError("Failed to search contacts");
  }
}

async function lookupProfile(linkedinUrl) {
  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    const response = await fetch(`${apiBaseUrl}/api/extension/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ linkedinUrl }),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearStoredAuth();
      showView("login");
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Lookup limit reached");
      return;
    }

    if (data.success && data.found) {
      showContactDetail(data.contact);
      updateUsage(data.usage);
    } else if (data.success) {
      showError("No contact found for this profile");
      updateUsage(data.usage);
    } else {
      showError(data.message || "Lookup failed");
    }
  } catch (error) {
    console.error("Lookup error:", error);
    showError("Failed to look up profile");
  }
}

function displayResults(contacts) {
  resultsList.innerHTML = "";

  if (contacts.length === 0) {
    resultsList.innerHTML = "<p class='no-results'>No contacts found</p>";
    return;
  }

  contacts.forEach(contact => {
    const item = document.createElement("div");
    item.className = "result-item";
    item.setAttribute("data-testid", `result-item-${contact.id}`);
    item.innerHTML = `
      <div class="result-name">${contact.fullName}</div>
      <div class="result-details">
        ${contact.title ? `<span>${contact.title}</span>` : ""}
        ${contact.company ? `<span>at ${contact.company}</span>` : ""}
      </div>
    `;
    item.addEventListener("click", () => showContactDetail(contact));
    resultsList.appendChild(item);
  });
}

function showContactDetail(contact) {
  contactDetail.innerHTML = `
    <button class="detail-close" id="close-detail">&times;</button>
    <h3>${contact.fullName}</h3>
    ${contact.title ? `<p class="detail-title">${contact.title}</p>` : ""}
    ${contact.company ? `<p class="detail-company">${contact.company}</p>` : ""}
    <div class="detail-fields">
      ${contact.email ? `<div class="detail-field"><strong>Email:</strong> <a href="mailto:${contact.email}">${contact.email}</a></div>` : ""}
      ${contact.mobilePhone ? `<div class="detail-field"><strong>Phone:</strong> <a href="tel:${contact.mobilePhone}">${contact.mobilePhone}</a></div>` : ""}
      ${contact.personLinkedIn ? `<div class="detail-field"><strong>LinkedIn:</strong> <a href="${contact.personLinkedIn}" target="_blank">View Profile</a></div>` : ""}
      ${contact.city || contact.country ? `<div class="detail-field"><strong>Location:</strong> ${[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}</div>` : ""}
    </div>
  `;
  contactDetail.classList.remove("hidden");
  
  document.getElementById("close-detail").addEventListener("click", () => {
    contactDetail.classList.add("hidden");
  });
}

function updateUsage(usage) {
  if (usage) {
    usageCount.textContent = `${usage.limit - usage.remaining}/${usage.limit}`;
    const usagePercent = ((usage.limit - usage.remaining) / usage.limit) * 100;
    usageProgress.style.width = `${usagePercent}%`;
  }
}

searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) searchContacts(query);
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) searchContacts(query);
  }
});

lookupBtn.addEventListener("click", () => {
  if (currentLinkedInUrl) lookupProfile(currentLinkedInUrl);
});

connectBtn.addEventListener("click", () => {
  const url = dashboardUrlInput.value.trim();
  if (url) {
    chrome.tabs.create({ url: `${url}/extension-auth` });
  }
});

openDashboardBtn.addEventListener("click", async () => {
  const { apiBaseUrl } = await getStoredAuth();
  if (apiBaseUrl) {
    chrome.tabs.create({ url: apiBaseUrl });
  }
});

logoutBtn.addEventListener("click", async () => {
  await clearStoredAuth();
  showView("login");
});

validateSession();
