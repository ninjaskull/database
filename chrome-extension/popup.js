const CRM_BASE_URL = "https://crm.fallowl.com";

const loadingView = document.getElementById("loading-view");
const redirectingView = document.getElementById("redirecting-view");
const mainView = document.getElementById("main-view");

const userAvatar = document.getElementById("user-avatar");
const userName = document.getElementById("user-name");
const planBadge = document.getElementById("plan-badge");
const usageCount = document.getElementById("usage-count");
const usageProgress = document.getElementById("usage-progress");
const autoLookupStatus = document.getElementById("auto-lookup-status");

const linkedinLookupSection = document.getElementById("linkedin-lookup-section");
const linkedinProfileName = document.getElementById("linkedin-profile-name");
const lookupBtn = document.getElementById("lookup-btn");
const autoLookupLoading = document.getElementById("auto-lookup-loading");

const contactResult = document.getElementById("contact-result");
const contactAvatar = document.getElementById("contact-avatar");
const contactName = document.getElementById("contact-name");
const contactTitle = document.getElementById("contact-title");
const contactCompany = document.getElementById("contact-company");
const contactFields = document.getElementById("contact-fields");
const contactEmailBtn = document.getElementById("contact-email-btn");
const contactPhoneBtn = document.getElementById("contact-phone-btn");

const noProfileSection = document.getElementById("no-profile-section");
const notFoundSection = document.getElementById("not-found-section");

const searchInput = document.getElementById("search-input");
const searchBtn = document.getElementById("search-btn");
const resultsList = document.getElementById("results-list");
const contactDetail = document.getElementById("contact-detail");
const errorMessage = document.getElementById("error-message");

const logoutBtn = document.getElementById("logout-btn");
const saveNotFoundBtn = document.getElementById("save-not-found-btn");

let currentLinkedInUrl = null;
let currentSalesNavigatorUrl = null;
let isAutoLooking = false;
let currentProfile = null;

async function getStoredAuth() {
  const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
  return {
    token: result.authToken,
    apiBaseUrl: result.apiBaseUrl || CRM_BASE_URL,
  };
}

async function setStoredAuth(token, apiBaseUrl) {
  await chrome.storage.local.set({ authToken: token, apiBaseUrl: apiBaseUrl || CRM_BASE_URL });
}

async function clearStoredAuth() {
  await chrome.storage.local.remove(["authToken", "apiBaseUrl"]);
}

function showView(viewId) {
  loadingView.classList.add("hidden");
  loadingView.classList.remove("fade-in");
  redirectingView.classList.add("hidden");
  redirectingView.classList.remove("fade-in");
  mainView.classList.add("hidden");
  mainView.classList.remove("fade-in");

  if (viewId === "loading") {
    loadingView.classList.remove("hidden");
    loadingView.classList.add("fade-in");
  } else if (viewId === "redirecting") {
    redirectingView.classList.remove("hidden");
    redirectingView.classList.add("fade-in");
  } else if (viewId === "main") {
    mainView.classList.remove("hidden");
    mainView.classList.add("fade-in");
  }
}

function showError(message) {
  errorMessage.classList.remove("hidden");
  errorMessage.classList.add("shake");
  errorMessage.textContent = message;
  setTimeout(() => {
    errorMessage.classList.remove("shake");
  }, 500);
  setTimeout(() => {
    errorMessage.classList.add("fade-out");
    setTimeout(() => {
      errorMessage.classList.add("hidden");
      errorMessage.classList.remove("fade-out");
    }, 300);
  }, 5000);
}

function redirectToAuth() {
  showView("redirecting");
  const authUrl = CRM_BASE_URL + "/extension-auth";
  setTimeout(() => {
    chrome.tabs.create({ url: authUrl });
  }, 800);
}

async function validateSession() {
  showView("loading");

  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    if (!token) {
      redirectToAuth();
      return;
    }

    const response = await fetch(`${apiBaseUrl}/api/extension/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      await clearStoredAuth();
      redirectToAuth();
      return;
    }

    const data = await response.json();

    if (data.valid) {
      showView("main");
      updateUserInfo(data);
      checkCurrentTab();
      if (autoLookupStatus) {
        autoLookupStatus.classList.remove("hidden");
        autoLookupStatus.classList.add("slide-in");
      }
    } else {
      await clearStoredAuth();
      redirectToAuth();
    }
  } catch (error) {
    console.error("Validation error:", error);
    redirectToAuth();
  }
}

function updateUserInfo(data) {
  if (data.user) {
    userName.textContent = data.user.name;
    if (userAvatar) {
      userAvatar.textContent = data.user.name.charAt(0).toUpperCase();
    }
  }
  if (data.plan) {
    planBadge.textContent = data.plan.displayName;
  }
  if (data.usage) {
    const { remaining, limit } = data.usage;
    usageCount.textContent = `${remaining} / ${limit}`;
    const percent = Math.max(0, ((limit - remaining) / limit) * 100);
    usageProgress.style.width = `${percent}%`;
  }
}

function isProfilePage(url) {
  return url?.includes("linkedin.com/in/");
}

function isSalesNavigatorPage(url) {
  return url?.includes("linkedin.com/sales/lead/") || url?.includes("linkedin.com/sales/people/");
}

async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    
    noProfileSection.classList.add("hidden");
    notFoundSection.classList.add("hidden");
    contactResult.classList.add("hidden");
    linkedinLookupSection.classList.add("hidden");
    autoLookupLoading.classList.add("hidden");
    
    if (isProfilePage(tab?.url)) {
      currentLinkedInUrl = tab.url;
      
      const profileMatch = tab.url.match(/linkedin\.com\/in\/([^/?]+)/);
      const profileSlug = profileMatch ? profileMatch[1].replace(/-/g, " ") : "Profile";
      linkedinProfileName.textContent = formatProfileName(profileSlug);
      
      linkedinLookupSection.classList.remove("hidden");
      linkedinLookupSection.classList.add("slide-in");
      
      await performAutoLookup();
    } else if (isSalesNavigatorPage(tab?.url)) {
      linkedinProfileName.textContent = "Sales Navigator Profile";
      linkedinLookupSection.classList.remove("hidden");
      linkedinLookupSection.classList.add("slide-in");
      
      await extractAndLookupSalesNav(tab.id);
    } else {
      currentLinkedInUrl = null;
      noProfileSection.classList.remove("hidden");
      noProfileSection.classList.add("fade-in");
    }
  } catch (error) {
    console.error("Tab check error:", error);
  }
}

async function extractAndLookupSalesNav(tabId) {
  autoLookupLoading.classList.remove("hidden");
  autoLookupLoading.classList.add("fade-in");
  linkedinLookupSection.classList.add("hidden");
  
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    const salesNavUrl = tab.url;
    
    if (salesNavUrl && salesNavUrl.includes("linkedin.com/sales/lead/")) {
      currentLinkedInUrl = null;
      currentSalesNavigatorUrl = salesNavUrl;
      linkedinProfileName.textContent = "Sales Navigator Profile";
      await performAutoLookup();
    } else {
      autoLookupLoading.classList.add("hidden");
      linkedinLookupSection.classList.remove("hidden");
      linkedinProfileName.textContent = "Sales Navigator Profile";
      showError("Could not detect Sales Navigator URL.");
    }
  } catch (error) {
    console.error("Sales Nav detection error:", error);
    autoLookupLoading.classList.add("hidden");
    linkedinLookupSection.classList.remove("hidden");
    linkedinProfileName.textContent = "Sales Navigator Profile";
  }
}

function formatProfileName(slug) {
  return slug
    .split(" ")
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function performAutoLookup() {
  if ((!currentLinkedInUrl && !currentSalesNavigatorUrl) || isAutoLooking) return;
  
  isAutoLooking = true;
  
  linkedinLookupSection.classList.add("hidden");
  autoLookupLoading.classList.remove("hidden");
  autoLookupLoading.classList.add("fade-in");
  
  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    const lookupPayload = {};
    if (currentLinkedInUrl) lookupPayload.linkedinUrl = currentLinkedInUrl;
    if (currentSalesNavigatorUrl) lookupPayload.salesNavigatorUrl = currentSalesNavigatorUrl;

    const response = await fetch(`${apiBaseUrl}/api/extension/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(lookupPayload),
    });

    const data = await response.json();

    autoLookupLoading.classList.add("hidden");

    if (response.status === 401) {
      await clearStoredAuth();
      redirectToAuth();
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Daily lookup limit reached");
      linkedinLookupSection.classList.remove("hidden");
      isAutoLooking = false;
      return;
    }

    if (data.success && data.found) {
      showContactResult(data.contact);
      if (data.usage) {
        updateUserInfo({ usage: data.usage });
      }
    } else {
      notFoundSection.classList.remove("hidden");
      notFoundSection.classList.add("fade-in");
    }
  } catch (error) {
    console.error("Auto-lookup error:", error);
    autoLookupLoading.classList.add("hidden");
    linkedinLookupSection.classList.remove("hidden");
    showError("Failed to look up profile");
  }
  
  isAutoLooking = false;
}

async function performManualLookup() {
  if (!currentLinkedInUrl && !currentSalesNavigatorUrl) return;
  
  const btnContent = lookupBtn.querySelector(".btn-lookup-content");
  const btnLoading = lookupBtn.querySelector(".btn-lookup-loading");
  
  lookupBtn.disabled = true;
  btnContent.classList.add("hidden");
  btnLoading.classList.remove("hidden");

  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    const lookupPayload = {};
    if (currentLinkedInUrl) lookupPayload.linkedinUrl = currentLinkedInUrl;
    if (currentSalesNavigatorUrl) lookupPayload.salesNavigatorUrl = currentSalesNavigatorUrl;

    const response = await fetch(`${apiBaseUrl}/api/extension/lookup`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(lookupPayload),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearStoredAuth();
      redirectToAuth();
      return;
    }

    if (response.status === 403) {
      showError(data.message || "Daily lookup limit reached");
      resetLookupButton();
      return;
    }

    if (data.success && data.found) {
      linkedinLookupSection.classList.add("hidden");
      showContactResult(data.contact);
      if (data.usage) {
        updateUserInfo({ usage: data.usage });
      }
    } else {
      linkedinLookupSection.classList.add("hidden");
      notFoundSection.classList.remove("hidden");
      notFoundSection.classList.add("fade-in");
      currentProfile = null;
    }
  } catch (error) {
    console.error("Lookup error:", error);
    showError("Failed to look up profile");
    resetLookupButton();
  }
}

function resetLookupButton() {
  const btnContent = lookupBtn.querySelector(".btn-lookup-content");
  const btnLoading = lookupBtn.querySelector(".btn-lookup-loading");
  
  lookupBtn.disabled = false;
  btnContent.classList.remove("hidden");
  btnLoading.classList.add("hidden");
}

function showContactResult(contact) {
  contactResult.classList.remove("hidden");
  contactResult.classList.add("scale-in");
  
  contactAvatar.textContent = contact.fullName.charAt(0).toUpperCase();
  contactName.textContent = contact.fullName;
  
  if (contact.title) {
    contactTitle.textContent = contact.title;
    contactTitle.classList.remove("hidden");
  } else {
    contactTitle.classList.add("hidden");
  }
  
  if (contact.company) {
    contactCompany.textContent = contact.company;
    contactCompany.classList.remove("hidden");
  } else {
    contactCompany.classList.add("hidden");
  }
  
  let fieldsHtml = "";
  
  if (contact.email) {
    fieldsHtml += createFieldHtml("email", "Email", contact.email, `mailto:${contact.email}`);
    contactEmailBtn.href = `mailto:${contact.email}`;
    contactEmailBtn.classList.remove("hidden");
  } else {
    contactEmailBtn.classList.add("hidden");
  }
  
  if (contact.mobilePhone) {
    fieldsHtml += createFieldHtml("phone", "Mobile", contact.mobilePhone, `tel:${contact.mobilePhone}`);
    contactPhoneBtn.href = `tel:${contact.mobilePhone}`;
    contactPhoneBtn.classList.remove("hidden");
  } else {
    contactPhoneBtn.classList.add("hidden");
  }
  
  if (contact.otherPhone) {
    fieldsHtml += createFieldHtml("phone", "Phone", contact.otherPhone, `tel:${contact.otherPhone}`);
  }
  
  const location = [contact.city, contact.state, contact.country].filter(Boolean).join(", ");
  if (location) {
    fieldsHtml += createFieldHtml("location", "Location", location);
  }
  
  if (contact.leadScore) {
    fieldsHtml += createFieldHtml("score", "Lead Score", contact.leadScore);
  }

  if (contact.personLinkedIn) {
    fieldsHtml += `
      <div class="contact-field slide-in-stagger">
        <div class="field-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
            <rect x="2" y="9" width="4" height="12"/>
            <circle cx="4" cy="4" r="2"/>
          </svg>
        </div>
        <div class="field-content">
          <span class="field-label">LinkedIn Profile</span>
          <a href="${contact.personLinkedIn}" target="_blank" class="field-value">View Profile</a>
        </div>
      </div>
    `;
  }

  if (contact.salesNavigatorUrl) {
    fieldsHtml += `
      <div class="contact-field slide-in-stagger">
        <div class="field-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </div>
        <div class="field-content">
          <span class="field-label">Sales Navigator</span>
          <a href="${contact.salesNavigatorUrl}" target="_blank" class="field-value">View Lead</a>
        </div>
      </div>
    `;
  }
  
  contactFields.innerHTML = fieldsHtml;
  
  contactFields.querySelectorAll(".field-copy-btn").forEach(btn => {
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const value = btn.dataset.value;
      navigator.clipboard.writeText(value).then(() => {
        btn.classList.add("copied");
        setTimeout(() => btn.classList.remove("copied"), 1500);
      });
    });
  });
}

function createFieldHtml(type, label, value, link = null) {
  const icons = {
    email: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`,
    phone: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`,
    location: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`,
    score: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`
  };
  
  return `
    <div class="contact-field slide-in-stagger">
      <div class="field-icon">${icons[type]}</div>
      <div class="field-content">
        <span class="field-label">${label}</span>
        ${link ? `<a href="${link}" class="field-value">${value}</a>` : `<span class="field-value">${value}</span>`}
      </div>
      <button class="field-copy-btn" data-value="${value}" title="Copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <rect x="9" y="9" width="13" height="13" rx="2"/>
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
        </svg>
        <svg class="check-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <polyline points="20 6 9 17 4 12"/>
        </svg>
      </button>
    </div>
  `;
}

async function performSearch(query) {
  try {
    const { token, apiBaseUrl } = await getStoredAuth();

    searchBtn.disabled = true;
    searchBtn.classList.add("searching");

    const response = await fetch(`${apiBaseUrl}/api/extension/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ query }),
    });

    const data = await response.json();

    if (response.status === 401) {
      await clearStoredAuth();
      redirectToAuth();
      return;
    }

    searchBtn.disabled = false;
    searchBtn.classList.remove("searching");

    if (data.success && data.contacts?.length > 0) {
      showSearchResults(data.contacts);
    } else {
      resultsList.innerHTML = `
        <div class="no-results fade-in">
          <div class="no-results-icon">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="11" cy="11" r="8"/>
              <path d="m21 21-4.35-4.35"/>
            </svg>
          </div>
          No contacts found for "${query}"
        </div>
      `;
    }
  } catch (error) {
    console.error("Search error:", error);
    showError("Search failed");
    searchBtn.disabled = false;
    searchBtn.classList.remove("searching");
  }
}

function showSearchResults(contacts) {
  contactDetail.classList.add("hidden");
  resultsList.innerHTML = contacts
    .map(
      (contact, index) => `
    <div class="result-item slide-in-stagger" style="animation-delay: ${index * 50}ms" data-contact='${JSON.stringify(contact).replace(/'/g, "&#39;")}'>
      <div class="result-avatar">${contact.fullName.charAt(0).toUpperCase()}</div>
      <div class="result-content">
        <div class="result-name">${contact.fullName}</div>
        <div class="result-details">
          ${contact.title ? `<span class="result-tag">${contact.title}</span>` : ""}
          ${contact.company ? `<span class="result-tag">${contact.company}</span>` : ""}
        </div>
      </div>
      <svg class="result-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
    </div>
  `
    )
    .join("");

  resultsList.querySelectorAll(".result-item").forEach((item) => {
    item.addEventListener("click", () => {
      const contact = JSON.parse(item.dataset.contact);
      showContactDetail(contact);
    });
  });
}

function showContactDetail(contact) {
  resultsList.innerHTML = "";
  contactDetail.classList.remove("hidden");
  contactDetail.classList.add("scale-in");

  const initial = contact.fullName.charAt(0).toUpperCase();
  const location = [contact.city, contact.state, contact.country].filter(Boolean).join(", ");

  contactDetail.innerHTML = `
    <button class="detail-close">&times;</button>
    <div class="detail-header">
      <div class="detail-avatar">${initial}</div>
      <div class="detail-info">
        <h3>${contact.fullName}</h3>
        ${contact.title ? `<div class="detail-title">${contact.title}</div>` : ""}
        ${contact.company ? `<div class="detail-company">${contact.company}</div>` : ""}
      </div>
    </div>
    <div class="detail-fields">
      ${contact.email ? `
        <div class="detail-field slide-in-stagger">
          <div class="detail-field-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <rect x="2" y="4" width="20" height="16" rx="2"/>
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
            </svg>
          </div>
          <a href="mailto:${contact.email}">${contact.email}</a>
        </div>
      ` : ""}
      ${contact.mobilePhone ? `
        <div class="detail-field slide-in-stagger">
          <div class="detail-field-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
            </svg>
          </div>
          <a href="tel:${contact.mobilePhone}">${contact.mobilePhone}</a>
        </div>
      ` : ""}
      ${location ? `
        <div class="detail-field slide-in-stagger">
          <div class="detail-field-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <span>${location}</span>
        </div>
      ` : ""}
      ${contact.personLinkedIn ? `
        <div class="detail-field slide-in-stagger">
          <div class="detail-field-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"/>
              <rect x="2" y="9" width="4" height="12"/>
              <circle cx="4" cy="4" r="2"/>
            </svg>
          </div>
          <a href="${contact.personLinkedIn}" target="_blank">View LinkedIn</a>
        </div>
      ` : ""}
      ${contact.leadScore ? `
        <div class="detail-field slide-in-stagger">
          <div class="detail-field-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span>Lead Score: ${contact.leadScore}</span>
        </div>
      ` : ""}
    </div>
  `;

  contactDetail.querySelector(".detail-close").addEventListener("click", () => {
    contactDetail.classList.add("scale-out");
    setTimeout(() => {
      contactDetail.classList.add("hidden");
      contactDetail.classList.remove("scale-out");
    }, 200);
  });
}

logoutBtn.addEventListener("click", async () => {
  await clearStoredAuth();
  redirectToAuth();
});

if (saveNotFoundBtn) {
  saveNotFoundBtn.addEventListener("click", async () => {
    if (!currentLinkedInUrl && !currentSalesNavigatorUrl) {
      showError("No profile URL found");
      return;
    }

    saveNotFoundBtn.disabled = true;
    const originalText = saveNotFoundBtn.textContent;
    saveNotFoundBtn.textContent = "Saving...";

    try {
      const { token, apiBaseUrl } = await getStoredAuth();

      const savePayload = {
        fullName: currentProfile?.fullName || "Unknown",
        title: currentProfile?.title || undefined,
        company: currentProfile?.company || undefined,
        email: currentProfile?.email || undefined,
      };

      if (currentLinkedInUrl) savePayload.linkedinUrl = currentLinkedInUrl;
      if (currentSalesNavigatorUrl) savePayload.salesNavigatorUrl = currentSalesNavigatorUrl;

      const response = await fetch(`${apiBaseUrl}/api/extension/save-profile`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(savePayload),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        notFoundSection.classList.add("hidden");
        const savedContact = document.createElement("div");
        savedContact.className = "saved-confirmation fade-in";
        savedContact.innerHTML = `
          <div class="saved-icon">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <polyline points="20 6 9 17 4 12"/>
            </svg>
          </div>
          <h3>Profile Saved!</h3>
          <p>Successfully saved to your CRM.</p>
        `;
        mainView.querySelector(".search-section").parentElement.insertBefore(savedContact, mainView.querySelector(".search-section"));
        setTimeout(() => {
          savedContact.classList.add("hidden");
        }, 3000);
      } else {
        showError(data.message || "Failed to save profile");
        saveNotFoundBtn.disabled = false;
        saveNotFoundBtn.textContent = originalText;
      }
    } catch (error) {
      console.error("Save error:", error);
      showError("Failed to save profile");
      saveNotFoundBtn.disabled = false;
      saveNotFoundBtn.textContent = originalText;
    }
  });
}

lookupBtn.addEventListener("click", () => {
  if (currentLinkedInUrl) {
    performManualLookup();
  }
});

searchBtn.addEventListener("click", () => {
  const query = searchInput.value.trim();
  if (query) {
    performSearch(query);
  }
});

searchInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    const query = searchInput.value.trim();
    if (query) {
      performSearch(query);
    }
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "AUTH_SUCCESS") {
    validateSession();
  }
});

const popupPort = chrome.runtime.connect({ name: "popup" });

validateSession();
