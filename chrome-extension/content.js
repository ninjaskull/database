(function() {
  const CRM_BASE_URL = "https://crm.fallowl.com";
  
  let autoLookupPerformed = {};
  let lastUrl = location.href;
  let isDragging = false;
  let dragOffset = { x: 0, y: 0 };
  let buttonPosition = { right: 24, bottom: 24 };
  let popupOpen = false;
  let salesNavObserver = null;
  let extractionAttempts = 0;
  const MAX_EXTRACTION_ATTEMPTS = 10;

  function isProfilePage() {
    return window.location.href.includes("linkedin.com/in/");
  }

  function isSalesNavigatorPage() {
    return window.location.href.includes("linkedin.com/sales/lead/");
  }

  function extractSalesNavLeadId() {
    const match = window.location.href.match(/linkedin\.com\/sales\/lead\/(\d+)/);
    return match ? match[1] : null;
  }

  function getProfileKey() {
    if (isProfilePage()) {
      const match = window.location.href.match(/linkedin\.com\/in\/([^/?]+)/);
      return match ? match[1] : null;
    }
    if (isSalesNavigatorPage()) {
      const match = window.location.href.match(/linkedin\.com\/sales\/(?:lead|people)\/([^,/?]+)/);
      return match ? `sales_${match[1]}` : null;
    }
    return null;
  }

  function extractPublicLinkedInUrl() {
    const selectors = [
      'a[href*="linkedin.com/in/"]',
      '.profile-topcard a[href*="/in/"]',
      '.artdeco-entity-lockup a[href*="/in/"]',
      '[data-anonymize="person-name"] a[href*="/in/"]',
      '.profile-topcard__identity a[href*="/in/"]',
      '.topcard-identity a[href*="/in/"]',
      'a.topcard__link[href*="/in/"]',
      '.profile-topcard-person-entity__name a',
      'a[data-control-name="view_linkedin"]',
      '.artdeco-hoverable-trigger a[href*="/in/"]',
      '.profile-topcard-person-entity a[href*="/in/"]',
      '.mn-person-info a[href*="/in/"]',
      'section.artdeco-card a[href*="/in/"]'
    ];

    for (const selector of selectors) {
      const links = document.querySelectorAll(selector);
      for (const link of links) {
        const href = link.getAttribute('href');
        if (href && href.includes('/in/')) {
          const match = href.match(/linkedin\.com\/in\/([^/?]+)/);
          if (match) {
            return `https://www.linkedin.com/in/${match[1]}/`;
          }
          if (href.startsWith('/in/')) {
            const pathMatch = href.match(/\/in\/([^/?]+)/);
            if (pathMatch) {
              return `https://www.linkedin.com/in/${pathMatch[1]}/`;
            }
          }
        }
      }
    }

    const allLinks = document.querySelectorAll('a[href]');
    for (const link of allLinks) {
      const href = link.getAttribute('href') || '';
      if (href.includes('/in/') && !href.includes('/sales/')) {
        const match = href.match(/\/in\/([^/?]+)/);
        if (match && match[1].length > 2) {
          return `https://www.linkedin.com/in/${match[1]}/`;
        }
      }
    }

    return null;
  }

  function extractProfileName() {
    const nameSelectors = [
      '.profile-topcard-person-entity__name',
      '.artdeco-entity-lockup__title',
      '[data-anonymize="person-name"]',
      '.topcard-identity__name',
      '.profile-topcard__identity h1',
      '.mn-person-info__name'
    ];

    for (const selector of nameSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        const name = element.textContent?.trim();
        if (name && name.length > 0) {
          return name;
        }
      }
    }
    return null;
  }

  function notifyBackground() {
    chrome.runtime.sendMessage({ type: "LINKEDIN_PROFILE" });
  }

  function saveButtonPosition() {
    chrome.storage.local.set({ buttonPosition });
  }

  async function loadButtonPosition() {
    const result = await chrome.storage.local.get(['buttonPosition']);
    if (result.buttonPosition) {
      buttonPosition = result.buttonPosition;
    }
  }

  function createLookupButton(isSalesNav = false) {
    if (document.getElementById("prospect-lookup-btn")) return;
    if (popupOpen) return;

    const btn = document.createElement("button");
    btn.id = "prospect-lookup-btn";
    btn.className = isSalesNav ? "prospect-sales-nav-btn" : "";
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    `;

    btn.style.right = buttonPosition.right + 'px';
    btn.style.bottom = buttonPosition.bottom + 'px';

    btn.addEventListener("mousedown", startDrag);
    btn.addEventListener("click", handleClick);

    document.body.appendChild(btn);

    requestAnimationFrame(() => {
      btn.classList.add("prospect-btn-visible");
    });
  }

  function startDrag(e) {
    if (e.button !== 0) return;
    
    const btn = document.getElementById("prospect-lookup-btn");
    if (!btn) return;

    const rect = btn.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left;
    dragOffset.y = e.clientY - rect.top;
    
    isDragging = false;
    
    document.addEventListener("mousemove", onDrag);
    document.addEventListener("mouseup", stopDrag);
    
    e.preventDefault();
  }

  function onDrag(e) {
    isDragging = true;
    
    const btn = document.getElementById("prospect-lookup-btn");
    if (!btn) return;

    btn.classList.add("prospect-dragging");

    const newRight = window.innerWidth - e.clientX - (btn.offsetWidth - dragOffset.x);
    const newBottom = window.innerHeight - e.clientY - (btn.offsetHeight - dragOffset.y);

    buttonPosition.right = Math.max(10, Math.min(window.innerWidth - btn.offsetWidth - 10, newRight));
    buttonPosition.bottom = Math.max(10, Math.min(window.innerHeight - btn.offsetHeight - 10, newBottom));

    btn.style.right = buttonPosition.right + 'px';
    btn.style.bottom = buttonPosition.bottom + 'px';
  }

  function stopDrag(e) {
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.classList.remove("prospect-dragging");
    }

    document.removeEventListener("mousemove", onDrag);
    document.removeEventListener("mouseup", stopDrag);

    if (isDragging) {
      saveButtonPosition();
      e.preventDefault();
      e.stopPropagation();
    }
  }

  async function handleClick(e) {
    if (isDragging) {
      isDragging = false;
      return;
    }
    await performLookup();
  }

  function hideButton() {
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.classList.remove("prospect-btn-visible");
      btn.classList.add("prospect-btn-hidden");
    }
  }

  function showButton() {
    if (popupOpen) return;
    
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.classList.remove("prospect-btn-hidden");
      btn.classList.add("prospect-btn-visible");
    }
  }

  function removeButton() {
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.classList.add("prospect-btn-hidden");
      setTimeout(() => btn.remove(), 300);
    }
  }

  function getLinkedInUrlForLookup() {
    if (isProfilePage()) {
      return window.location.href;
    }
    return null;
  }

  function getSalesNavigatorUrl() {
    if (isSalesNavigatorPage()) {
      return window.location.href;
    }
    return null;
  }

  async function performLookup() {
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<div class="prospect-spinner"></div>`;
    }

    try {
      const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);

      if (!result.authToken) {
        const authUrl = CRM_BASE_URL + "/extension-auth";
        chrome.runtime.sendMessage({ type: "OPEN_AUTH", url: authUrl });
        resetButton();
        return;
      }

      const apiBaseUrl = result.apiBaseUrl || CRM_BASE_URL;
      
      let linkedinUrl = getLinkedInUrlForLookup();
      let salesNavigatorUrl = getSalesNavigatorUrl();

      const lookupPayload = {};
      if (linkedinUrl) lookupPayload.linkedinUrl = linkedinUrl;
      if (salesNavigatorUrl) lookupPayload.salesNavigatorUrl = salesNavigatorUrl;

      const response = await fetch(`${apiBaseUrl}/api/extension/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${result.authToken}`,
        },
        body: JSON.stringify(lookupPayload),
      });

      const data = await response.json();

      if (response.status === 401) {
        showNotification("Session expired. Redirecting to sign in...", "warning");
        chrome.storage.local.remove(["authToken", "apiBaseUrl"]);
        setTimeout(() => {
          const authUrl = CRM_BASE_URL + "/extension-auth";
          chrome.runtime.sendMessage({ type: "OPEN_AUTH", url: authUrl });
        }, 1500);
        resetButton();
      } else if (response.status === 403) {
        showNotification(data.message || "Lookup limit reached", "warning");
        resetButton();
      } else if (data.success && data.found) {
        // Profile found - show contact card with disabled save button
        showContactCard(data.contact, data.usage, true);
      } else if (data.success) {
        // Profile NOT found - show it as a new card that can be saved
        // Create a minimal contact object from the page data
        const newContact = {
          fullName: extractProfileName() || "Unknown",
          firstName: "",
          lastName: "",
          email: "",
          mobilePhone: "",
          title: "",
          company: "",
          city: "",
          state: "",
          country: "",
          leadScore: null,
          personLinkedIn: linkedinUrl,
          salesNavigatorUrl: salesNavigatorUrl,
        };
        // Show contact card with enabled save button
        showContactCard(newContact, data.usage, false);
      } else {
        showNotification("No contact found for this profile", "info");
        resetButton();
      }
    } catch (error) {
      console.error("Lookup error:", error);
      showNotification("Failed to look up profile", "error");
      resetButton();
    }
  }

  function resetButton() {
    const btn = document.getElementById("prospect-lookup-btn");
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="11" cy="11" r="8"/>
          <path d="m21 21-4.35-4.35"/>
        </svg>
      `;
    }
  }

  async function autoLookup() {
    const profileKey = getProfileKey();
    if (!profileKey) return;

    if (autoLookupPerformed[profileKey]) {
      return;
    }

    try {
      const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
      
      if (!result.authToken) {
        return;
      }

      let linkedinUrl;
      
      if (isProfilePage()) {
        linkedinUrl = window.location.href;
      } else if (isSalesNavigatorPage()) {
        linkedinUrl = extractPublicLinkedInUrl();
        if (!linkedinUrl) {
          return;
        }
      } else {
        return;
      }

      autoLookupPerformed[profileKey] = true;

      showAutoLookupIndicator();

      const apiBaseUrl = result.apiBaseUrl || CRM_BASE_URL;

      const response = await fetch(`${apiBaseUrl}/api/extension/lookup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${result.authToken}`,
        },
        body: JSON.stringify({ linkedinUrl }),
      });

      const data = await response.json();

      hideAutoLookupIndicator();

      if (response.status === 401) {
        chrome.storage.local.remove(["authToken", "apiBaseUrl"]);
        return;
      }

      if (response.status === 403) {
        showNotification(data.message || "Lookup limit reached", "warning");
        return;
      }

      if (data.success && data.found) {
        showContactCard(data.contact, data.usage);
      }
    } catch (error) {
      console.error("Auto-lookup error:", error);
      hideAutoLookupIndicator();
    }
  }

  function waitForSalesNavProfile() {
    extractionAttempts = 0;
    
    if (salesNavObserver) {
      salesNavObserver.disconnect();
    }

    function tryExtraction() {
      extractionAttempts++;
      
      const publicUrl = extractPublicLinkedInUrl();
      
      if (publicUrl) {
        if (salesNavObserver) {
          salesNavObserver.disconnect();
        }
        showSalesNavIndicator(publicUrl);
        createLookupButton(true);
        setTimeout(() => autoLookup(), 500);
        return true;
      }
      
      if (extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) {
        if (salesNavObserver) {
          salesNavObserver.disconnect();
        }
        createLookupButton(true);
        return false;
      }
      
      return false;
    }

    if (tryExtraction()) return;

    setTimeout(() => {
      if (tryExtraction()) return;

      salesNavObserver = new MutationObserver(() => {
        tryExtraction();
      });

      salesNavObserver.observe(document.body, { 
        subtree: true, 
        childList: true,
        attributes: true
      });

      const checkInterval = setInterval(() => {
        if (tryExtraction() || extractionAttempts >= MAX_EXTRACTION_ATTEMPTS) {
          clearInterval(checkInterval);
        }
      }, 500);

      setTimeout(() => {
        clearInterval(checkInterval);
        if (salesNavObserver) {
          salesNavObserver.disconnect();
        }
      }, 10000);
    }, 1000);
  }

  function showSalesNavIndicator(publicUrl) {
    const existing = document.getElementById("prospect-sales-nav-indicator");
    if (existing) existing.remove();

    const profileMatch = publicUrl.match(/linkedin\.com\/in\/([^/?]+)/);
    const profileSlug = profileMatch ? profileMatch[1] : "Profile";

    const indicator = document.createElement("div");
    indicator.id = "prospect-sales-nav-indicator";
    indicator.innerHTML = `
      <div class="prospect-sales-nav-badge">
        <div class="prospect-sales-nav-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </div>
        <div class="prospect-sales-nav-content">
          <span class="prospect-sales-nav-label">PUBLIC PROFILE DETECTED</span>
          <a href="${publicUrl}" target="_blank" class="prospect-sales-nav-link">
            linkedin.com/in/${profileSlug}
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
              <polyline points="15 3 21 3 21 9"/>
              <line x1="10" y1="14" x2="21" y2="3"/>
            </svg>
          </a>
        </div>
        <button class="prospect-sales-nav-close">&times;</button>
      </div>
    `;

    document.body.appendChild(indicator);

    requestAnimationFrame(() => {
      indicator.classList.add("prospect-indicator-visible");
    });

    indicator.querySelector(".prospect-sales-nav-close").addEventListener("click", () => {
      indicator.classList.remove("prospect-indicator-visible");
      indicator.classList.add("prospect-indicator-hidden");
      setTimeout(() => indicator.remove(), 300);
    });
  }

  function showAutoLookupIndicator() {
    if (document.getElementById("prospect-auto-lookup-indicator")) return;

    const indicator = document.createElement("div");
    indicator.id = "prospect-auto-lookup-indicator";
    indicator.innerHTML = `
      <div class="prospect-auto-lookup-spinner"></div>
      <span>Looking up profile...</span>
    `;
    document.body.appendChild(indicator);

    requestAnimationFrame(() => {
      indicator.classList.add("prospect-indicator-visible");
    });
  }

  function hideAutoLookupIndicator() {
    const indicator = document.getElementById("prospect-auto-lookup-indicator");
    if (indicator) {
      indicator.classList.remove("prospect-indicator-visible");
      indicator.classList.add("prospect-indicator-hidden");
      setTimeout(() => indicator.remove(), 300);
    }
  }

  function showNotification(message, type = "info") {
    const existing = document.querySelector(".prospect-notification");
    if (existing) {
      existing.classList.add("prospect-notification-hidden");
      setTimeout(() => existing.remove(), 300);
    }

    const notification = document.createElement("div");
    notification.className = `prospect-notification prospect-notification-${type}`;
    notification.innerHTML = `
      <div class="prospect-notification-icon">
        ${type === "success" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>' : ''}
        ${type === "error" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="m15 9-6 6"/><path d="m9 9 6 6"/></svg>' : ''}
        ${type === "warning" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>' : ''}
        ${type === "info" ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>' : ''}
      </div>
      <span>${message}</span>
    `;
    document.body.appendChild(notification);

    requestAnimationFrame(() => {
      notification.classList.add("prospect-notification-visible");
    });

    setTimeout(() => {
      notification.classList.remove("prospect-notification-visible");
      notification.classList.add("prospect-notification-hidden");
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }

  function copyToClipboard(text, fieldName) {
    navigator.clipboard.writeText(text).then(() => {
      showNotification(`${fieldName} copied!`, "success");
    }).catch(() => {
      showNotification("Failed to copy", "error");
    });
  }

  function createCopyableField(iconSvg, label, value, linkType = null) {
    const linkHref = linkType === 'email' ? `mailto:${value}` : linkType === 'phone' ? `tel:${value}` : null;
    
    return `
      <div class="prospect-card-field" data-copy-value="${value}" data-copy-label="${label}">
        <div class="prospect-field-icon">${iconSvg}</div>
        <div class="prospect-field-content">
          <div class="prospect-field-label">${label}</div>
          <div class="prospect-field-value">${linkHref ? `<a href="${linkHref}">${value}</a>` : value}</div>
        </div>
        <button class="prospect-copy-btn" title="Copy">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
        </button>
      </div>
    `;
  }

  function showContactCard(contact, usage, isFound = true) {
    const existing = document.getElementById("prospect-contact-card");
    if (existing) {
      existing.classList.add("prospect-card-hidden");
      setTimeout(() => existing.remove(), 300);
    }

    hideButton();

    const salesNavIndicator = document.getElementById("prospect-sales-nav-indicator");
    if (salesNavIndicator) {
      salesNavIndicator.classList.add("prospect-indicator-hidden");
      setTimeout(() => salesNavIndicator.remove(), 300);
    }

    const usageHtml = usage ? `
      <div class="prospect-usage-bar">
        <span class="prospect-usage-label">DAILY LOOKUPS</span>
        <span class="prospect-usage-count">${usage.remaining} / ${usage.limit}</span>
      </div>
    ` : '';

    const location = [contact.city, contact.state, contact.country].filter(Boolean).join(", ");

    const emailIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>`;
    const phoneIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/></svg>`;
    const locationIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const scoreIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>`;
    const linkedinIcon = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>`;

    const titleText = contact.title ? (contact.company ? `${contact.title} at ${contact.company}` : contact.title) : contact.company || '';

    const isSalesNav = isSalesNavigatorPage();
    const publicUrl = isSalesNav ? extractPublicLinkedInUrl() : contact.personLinkedIn;

    const card = document.createElement("div");
    card.id = "prospect-contact-card";
    card.className = isSalesNav ? "prospect-card-sales-nav" : "";
    card.innerHTML = `
      <div class="prospect-card-header">
        <div class="prospect-card-header-left">
          <div class="prospect-card-header-dot"></div>
          <h3>LINKEDOUT</h3>
          ${isSalesNav ? '<span class="prospect-sales-nav-tag">Sales Navigator</span>' : ''}
        </div>
        <button class="prospect-card-close">&times;</button>
      </div>
      ${usageHtml}
      <div class="prospect-card-body">
        <div class="prospect-profile-card">
          <div class="prospect-avatar">${contact.fullName.charAt(0).toUpperCase()}</div>
          <div class="prospect-profile-info">
            <div class="prospect-card-name">${contact.fullName}</div>
            ${titleText ? `<div class="prospect-card-title">${titleText.substring(0, 35)}${titleText.length > 35 ? '...' : ''}</div>` : ''}
          </div>
        </div>
        
        <div class="prospect-fields-container">
          ${contact.email ? createCopyableField(emailIcon, 'EMAIL', contact.email, 'email') : ''}
          ${contact.mobilePhone ? createCopyableField(phoneIcon, 'MOBILE', contact.mobilePhone, 'phone') : ''}
          ${location ? createCopyableField(locationIcon, 'LOCATION', location.substring(0, 30) + (location.length > 30 ? '...' : '')) : ''}
          ${contact.leadScore ? createCopyableField(scoreIcon, 'LEAD SCORE', contact.leadScore) : ''}
          ${publicUrl ? `
            <div class="prospect-card-field prospect-linkedin-field">
              <div class="prospect-field-icon prospect-linkedin-icon">${linkedinIcon}</div>
              <div class="prospect-field-content">
                <div class="prospect-field-label">LINKEDIN PROFILE</div>
                <a href="${publicUrl}" target="_blank" class="prospect-field-value">${publicUrl.replace('https://www.', '').replace(/\/$/, '')}</a>
              </div>
            </div>
          ` : ''}
        </div>
      </div>
      
      <div class="prospect-card-actions">
        ${contact.email ? `
          <a href="mailto:${contact.email}" class="prospect-btn prospect-btn-primary">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
            Email
          </a>
        ` : '<div></div>'}
        <button class="prospect-btn prospect-btn-secondary" id="prospect-sync-crm-btn" ${isFound ? 'disabled title="Profile already in CRM"' : ''}>Sync CRM</button>
      </div>
    `;

    document.body.appendChild(card);

    requestAnimationFrame(() => {
      card.classList.add("prospect-card-visible");
    });

    card.querySelector(".prospect-card-close").addEventListener("click", () => {
      card.classList.remove("prospect-card-visible");
      card.classList.add("prospect-card-hidden");
      setTimeout(() => {
        card.remove();
        showButton();
        resetButton();
      }, 300);
    });
    
    card.querySelectorAll(".prospect-card-field").forEach(field => {
      const copyBtn = field.querySelector(".prospect-copy-btn");
      const value = field.dataset.copyValue;
      const label = field.dataset.copyLabel;
      
      if (copyBtn && value) {
        copyBtn.addEventListener("click", (e) => {
          e.stopPropagation();
          copyToClipboard(value, label);
        });
        
        field.addEventListener("click", () => copyToClipboard(value, label));
      }
    });

    const syncBtn = card.querySelector("#prospect-sync-crm-btn");
    if (syncBtn && !isFound) {
      syncBtn.addEventListener("click", async () => {
        syncBtn.disabled = true;
        const originalText = syncBtn.textContent;
        syncBtn.textContent = "Saving...";
        
        try {
          const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
          const apiBaseUrl = result.apiBaseUrl || CRM_BASE_URL;

          const response = await fetch(`${apiBaseUrl}/api/extension/save-profile`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${result.authToken}`,
            },
            body: JSON.stringify({
              linkedinUrl: publicUrl || window.location.href,
              fullName: contact.fullName,
              title: contact.title || undefined,
              company: contact.company || undefined,
              email: contact.email || undefined,
            }),
          });

          const data = await response.json();

          if (response.ok && data.success) {
            showNotification("Contact saved to CRM!", "success");
            syncBtn.textContent = "✓ Saved";
          } else {
            showNotification(data.message || "Failed to save contact", "error");
            syncBtn.disabled = false;
            syncBtn.textContent = originalText;
          }
        } catch (error) {
          console.error("Save error:", error);
          showNotification("Failed to save contact", "error");
          syncBtn.disabled = false;
          syncBtn.textContent = originalText;
        }
      });
    }
  }

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "POPUP_OPENED") {
      popupOpen = true;
      removeButton();
      sendResponse({ success: true });
    } else if (message.type === "POPUP_CLOSED") {
      popupOpen = false;
      if (isProfilePage() || isSalesNavigatorPage()) {
        createLookupButton(isSalesNavigatorPage());
      }
      sendResponse({ success: true });
    }
    return true;
  });

  async function initialize() {
    await loadButtonPosition();
    
    if (isProfilePage()) {
      notifyBackground();
      createLookupButton();
      setTimeout(() => autoLookup(), 1500);
    } else if (isSalesNavigatorPage()) {
      notifyBackground();
      waitForSalesNavProfile();
    }
  }

  initialize();

  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      
      const existingCard = document.getElementById("prospect-contact-card");
      if (existingCard) {
        existingCard.classList.add("prospect-card-hidden");
        setTimeout(() => existingCard.remove(), 300);
      }

      const existingSalesNavIndicator = document.getElementById("prospect-sales-nav-indicator");
      if (existingSalesNavIndicator) {
        existingSalesNavIndicator.remove();
      }

      if (salesNavObserver) {
        salesNavObserver.disconnect();
        salesNavObserver = null;
      }
      
      if (isProfilePage()) {
        notifyBackground();
        setTimeout(() => {
          if (!popupOpen) {
            createLookupButton();
          }
          autoLookup();
        }, 1000);
      } else if (isSalesNavigatorPage()) {
        notifyBackground();
        removeButton();
        setTimeout(() => waitForSalesNavProfile(), 1000);
      } else {
        removeButton();
      }
    }
  }).observe(document.body, { subtree: true, childList: true });
})();
