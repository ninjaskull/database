(function() {
  const PROFILE_URL_PATTERN = /linkedin\.com\/in\/[^\/]+/;

  function isProfilePage() {
    return PROFILE_URL_PATTERN.test(window.location.href);
  }

  function notifyBackground() {
    if (isProfilePage()) {
      chrome.runtime.sendMessage({ 
        type: "LINKEDIN_PROFILE_DETECTED",
        url: window.location.href 
      });
    }
  }

  function extractProfileData() {
    const data = {
      url: window.location.href,
      name: null,
      title: null,
      company: null,
    };

    const nameElement = document.querySelector("h1.text-heading-xlarge");
    if (nameElement) {
      data.name = nameElement.textContent.trim();
    }

    const titleElement = document.querySelector("div.text-body-medium");
    if (titleElement) {
      data.title = titleElement.textContent.trim();
    }

    const companyElement = document.querySelector("button[aria-label*='Current company']");
    if (companyElement) {
      data.company = companyElement.textContent.trim();
    }

    return data;
  }

  function createFloatingButton() {
    if (document.getElementById("prospect-lookup-btn")) return;

    const btn = document.createElement("button");
    btn.id = "prospect-lookup-btn";
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
      <span>Look Up</span>
    `;
    btn.title = "Look up this profile in your CRM";

    btn.addEventListener("click", async () => {
      const profileData = extractProfileData();
      
      btn.disabled = true;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" class="spinning">
          <circle cx="12" cy="12" r="10"/>
        </svg>
        <span>Looking up...</span>
      `;

      try {
        const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
        
        if (!result.authToken || !result.apiBaseUrl) {
          showNotification("Please sign in to use this feature", "warning");
          btn.disabled = false;
          resetButton();
          return;
        }

        const response = await fetch(`${result.apiBaseUrl}/api/extension/lookup`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${result.authToken}`,
          },
          body: JSON.stringify({ linkedinUrl: window.location.href }),
        });

        const data = await response.json();

        if (response.status === 401) {
          showNotification("Session expired. Please sign in again.", "error");
          chrome.storage.local.remove(["authToken"]);
        } else if (response.status === 403) {
          showNotification(data.message || "Lookup limit reached", "warning");
        } else if (data.success && data.found) {
          showContactCard(data.contact);
        } else {
          showNotification("No contact found for this profile", "info");
        }
      } catch (error) {
        console.error("Lookup error:", error);
        showNotification("Failed to look up profile", "error");
      }

      btn.disabled = false;
      resetButton();
    });

    function resetButton() {
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
        <span>Look Up</span>
      `;
    }

    document.body.appendChild(btn);
  }

  function showNotification(message, type = "info") {
    const existing = document.getElementById("prospect-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.id = "prospect-notification";
    notification.className = `prospect-notification prospect-notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add("prospect-notification-hide");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function showContactCard(contact) {
    const existing = document.getElementById("prospect-contact-card");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.id = "prospect-contact-card";
    card.className = "prospect-contact-card";

    card.innerHTML = `
      <div class="prospect-card-header">
        <h3>Contact Found</h3>
        <button id="prospect-card-close" class="prospect-card-close">&times;</button>
      </div>
      <div class="prospect-card-body">
        <div class="prospect-card-name">${contact.fullName || "Unknown"}</div>
        <div class="prospect-card-title">${contact.title || ""} ${contact.company ? "at " + contact.company : ""}</div>
        ${contact.email ? `
          <div class="prospect-card-row">
            <span class="prospect-card-label">Email</span>
            <a href="mailto:${contact.email}" class="prospect-card-value">${contact.email}</a>
            <button class="prospect-copy-btn" data-value="${contact.email}">Copy</button>
          </div>
        ` : ""}
        ${contact.mobilePhone ? `
          <div class="prospect-card-row">
            <span class="prospect-card-label">Phone</span>
            <span class="prospect-card-value">${contact.mobilePhone}</span>
            <button class="prospect-copy-btn" data-value="${contact.mobilePhone}">Copy</button>
          </div>
        ` : ""}
        ${contact.industry ? `
          <div class="prospect-card-row">
            <span class="prospect-card-label">Industry</span>
            <span class="prospect-card-value">${contact.industry}</span>
          </div>
        ` : ""}
      </div>
    `;

    document.body.appendChild(card);

    document.getElementById("prospect-card-close").addEventListener("click", () => {
      card.classList.add("prospect-card-hide");
      setTimeout(() => card.remove(), 300);
    });

    card.querySelectorAll(".prospect-copy-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(btn.dataset.value);
        btn.textContent = "Copied!";
        setTimeout(() => (btn.textContent = "Copy"), 1500);
      });
    });
  }

  function init() {
    if (isProfilePage()) {
      notifyBackground();
      createFloatingButton();
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      setTimeout(init, 500);
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
