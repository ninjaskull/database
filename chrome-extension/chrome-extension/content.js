(function() {
  function isProfilePage() {
    return window.location.href.includes("linkedin.com/in/");
  }

  function notifyBackground() {
    chrome.runtime.sendMessage({ type: "LINKEDIN_PROFILE" });
  }

  function createLookupButton() {
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

    btn.addEventListener("click", async () => {
      btn.disabled = true;
      btn.innerHTML = `
        <div class="prospect-spinner"></div>
        <span>Looking up...</span>
      `;

      try {
        const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);

        if (!result.authToken) {
          showNotification("Please sign in via the extension popup", "warning");
          resetButton();
          btn.disabled = false;
          return;
        }

        const response = await fetch(`${result.apiBaseUrl || ""}/api/extension/lookup`, {
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
          chrome.storage.local.remove(["authToken", "apiBaseUrl"]);
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
    const existing = document.querySelector(".prospect-notification");
    if (existing) existing.remove();

    const notification = document.createElement("div");
    notification.className = `prospect-notification prospect-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => notification.remove(), 4000);
  }

  function showContactCard(contact) {
    const existing = document.getElementById("prospect-contact-card");
    if (existing) existing.remove();

    const card = document.createElement("div");
    card.id = "prospect-contact-card";
    card.innerHTML = `
      <div class="prospect-card-header">
        <h3>Contact Found</h3>
        <button class="prospect-card-close">&times;</button>
      </div>
      <div class="prospect-card-body">
        <div class="prospect-card-name">${contact.fullName}</div>
        ${contact.title ? `<div class="prospect-card-title">${contact.title}</div>` : ""}
        ${contact.company ? `<div class="prospect-card-company">${contact.company}</div>` : ""}
        ${contact.email ? `<div class="prospect-card-field"><strong>Email:</strong> <a href="mailto:${contact.email}">${contact.email}</a></div>` : ""}
        ${contact.mobilePhone ? `<div class="prospect-card-field"><strong>Phone:</strong> <a href="tel:${contact.mobilePhone}">${contact.mobilePhone}</a></div>` : ""}
        ${contact.city || contact.country ? `<div class="prospect-card-field"><strong>Location:</strong> ${[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}</div>` : ""}
      </div>
    `;

    card.querySelector(".prospect-card-close").addEventListener("click", () => card.remove());
    document.body.appendChild(card);
  }

  if (isProfilePage()) {
    notifyBackground();
    createLookupButton();
  }

  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (isProfilePage()) {
        notifyBackground();
        setTimeout(createLookupButton, 1000);
      } else {
        const btn = document.getElementById("prospect-lookup-btn");
        if (btn) btn.remove();
      }
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
