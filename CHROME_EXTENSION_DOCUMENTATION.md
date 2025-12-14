# Chrome Extension Technical Documentation

## Complete Implementation Guide for Prospect Lookup Chrome Extension

**Version:** 1.0.0  
**Last Updated:** December 14, 2025  
**Status:** Production Ready

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [Authentication System](#3-authentication-system)
4. [Chrome Extension Structure](#4-chrome-extension-structure)
5. [API Endpoints Reference](#5-api-endpoints-reference)
6. [Security Implementation](#6-security-implementation)
7. [Multi-User & Plan System](#7-multi-user--plan-system)
8. [File-by-File Implementation Guide](#8-file-by-file-implementation-guide)
9. [Error Handling & Edge Cases](#9-error-handling--edge-cases)
10. [Deployment & Distribution](#10-deployment--distribution)
11. [Testing Guidelines](#11-testing-guidelines)
12. [Troubleshooting Guide](#12-troubleshooting-guide)

---

## 1. Executive Summary

### Purpose

The Chrome Extension enables users to look up prospect/contact details directly from LinkedIn profile pages using the existing CRM database. It provides seamless authentication with the dashboard application and enforces plan-based usage limits.

### Key Capabilities

| Feature | Description |
|---------|-------------|
| **LinkedIn Profile Lookup** | Automatically detect and search contacts by LinkedIn URL |
| **Session Sharing** | Shares authentication with dashboard (no separate login) |
| **Plan-Based Limits** | Enforces daily lookup limits per subscription plan |
| **Real-time Sync** | Automatically syncs authentication state with dashboard |
| **Contact Search** | Search contacts by name, company, or other criteria |
| **Usage Tracking** | Tracks and displays remaining daily lookups |

### Technology Stack

- **Manifest Version:** 3 (Chrome's latest extension format)
- **Background Script:** Service Worker (persistent storage management)
- **Content Scripts:** LinkedIn page integration + Dashboard sync
- **Storage:** `chrome.storage.local` (encrypted at rest)
- **Authentication:** Bearer token (shared with dashboard)

---

## 2. System Architecture Overview

### High-Level Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              USER'S BROWSER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────┐        ┌──────────────────┐                          │
│   │   Dashboard Tab  │        │   LinkedIn Tab   │                          │
│   │                  │        │                  │                          │
│   │  ┌────────────┐  │        │  ┌────────────┐  │      ┌──────────────┐   │
│   │  │ React App  │  │        │  │ Profile    │  │      │  Extension   │   │
│   │  │            │  │        │  │ Page       │  │      │  Popup       │   │
│   │  │ authToken  │  │        │  │            │  │      │              │   │
│   │  │ in localStorage       │  │ ┌────────┐ │  │      │  - Status    │   │
│   │  └─────┬──────┘  │        │  │ │Look Up │ │  │      │  - Search    │   │
│   │        │         │        │  │ │Button  │ │  │      │  - Settings  │   │
│   │        ▼         │        │  │ └────────┘ │  │      └──────────────┘   │
│   │  ┌────────────┐  │        │  └────────────┘  │             │            │
│   │  │ dashboard- │  │        │        │         │             │            │
│   │  │ content.js │◀─┼────────┼────────┼─────────┼─────────────┘            │
│   │  └─────┬──────┘  │        │        │         │                          │
│   │        │         │        │        ▼         │                          │
│   └────────┼─────────┘        │  ┌────────────┐  │                          │
│            │                  │  │ content.js │  │                          │
│            │                  │  └─────┬──────┘  │                          │
│            │                  └────────┼─────────┘                          │
│            │                           │                                     │
│            ▼                           ▼                                     │
│   ┌─────────────────────────────────────────────────────────────────┐       │
│   │                    Background Service Worker                     │       │
│   │                      (background.js)                            │       │
│   │  ┌─────────────────────────────────────────────────────────┐   │       │
│   │  │               chrome.storage.local                       │   │       │
│   │  │  - authToken: "eyJhbGciOiJIUzI1NiIsInR5cCI6..."        │   │       │
│   │  │  - apiBaseUrl: "https://your-app.replit.app"            │   │       │
│   │  └─────────────────────────────────────────────────────────┘   │       │
│   └──────────────────────────────┬──────────────────────────────────┘       │
│                                  │                                           │
└──────────────────────────────────┼───────────────────────────────────────────┘
                                   │
                                   │ HTTPS API Calls
                                   │ Authorization: Bearer <token>
                                   ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                              BACKEND SERVER                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                       Extension API Routes                            │  │
│   │                    (server/extension-routes.ts)                       │  │
│   │                                                                       │  │
│   │   GET  /api/extension/validate  - Validate session token             │  │
│   │   POST /api/extension/lookup    - Lookup contact by LinkedIn URL     │  │
│   │   POST /api/extension/search    - Search contacts by query           │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│                                   ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                          Storage Layer                                │  │
│   │                         (server/storage.ts)                           │  │
│   │                                                                       │  │
│   │   - getUserById()               - findContactsByLinkedInUrl()        │  │
│   │   - getSubscriptionPlan()       - getContacts()                      │  │
│   │   - updateUser()                - Session management                  │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                   │                                          │
│                                   ▼                                          │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                       PostgreSQL Database                             │  │
│   │                                                                       │  │
│   │   Tables: users, sessions, contacts, companies, subscription_plans   │  │
│   └──────────────────────────────────────────────────────────────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Interaction Flow

```
┌───────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ Dashboard │────▶│ dashboard-  │────▶│ background │────▶│ chrome.  │
│   Login   │     │ content.js  │     │    .js     │     │ storage  │
└───────────┘     └─────────────┘     └────────────┘     └──────────┘
                        │                    ▲
                        │  STORE_AUTH        │
                        └────────────────────┘

┌───────────┐     ┌─────────────┐     ┌────────────┐     ┌──────────┐
│ LinkedIn  │────▶│  content.js │────▶│ background │────▶│   API    │
│  Profile  │     │ (Look Up)   │     │ (get token)│     │ /lookup  │
└───────────┘     └─────────────┘     └────────────┘     └──────────┘
```

---

## 3. Authentication System

### Authentication Flow Overview

The extension uses a **token-sharing architecture** where the dashboard issues authentication tokens that are automatically synchronized with the extension.

### Detailed Authentication Flow

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                           AUTHENTICATION FLOW                                 │
└──────────────────────────────────────────────────────────────────────────────┘

Step 1: User logs into Dashboard
─────────────────────────────────
User ──▶ Dashboard Login Page ──▶ POST /api/login
                                       │
                                       ▼
                              ┌─────────────────┐
                              │ Backend Server  │
                              │                 │
                              │ 1. Validate     │
                              │    credentials  │
                              │ 2. Create       │
                              │    session      │
                              │ 3. Generate     │
                              │    token        │
                              └────────┬────────┘
                                       │
                                       ▼
                              Response: { token, user }
                                       │
                                       ▼
                              localStorage.setItem('authToken', token)

Step 2: Dashboard syncs token to Extension
──────────────────────────────────────────
dashboard-content.js detects token in localStorage
         │
         │  window.postMessage / chrome.runtime.sendMessage
         ▼
┌─────────────────────────────────────────┐
│       background.js (Service Worker)    │
│                                         │
│  chrome.storage.local.set({            │
│    authToken: token,                   │
│    apiBaseUrl: "https://..."           │
│  })                                    │
└─────────────────────────────────────────┘

Step 3: Extension uses token for API calls
──────────────────────────────────────────
content.js / popup.js
         │
         │  chrome.storage.local.get(['authToken'])
         ▼
┌─────────────────────────────────────────┐
│          API Request                    │
│                                         │
│  fetch('/api/extension/lookup', {      │
│    headers: {                          │
│      'Authorization': 'Bearer <token>' │
│    }                                   │
│  })                                    │
└─────────────────────────────────────────┘
```

### Token Lifecycle

| Event | Action | Storage |
|-------|--------|---------|
| User Login | Generate 24-hour token | Session table + localStorage |
| Dashboard Open | Sync to extension | chrome.storage.local |
| API Request | Validate token | Check session expiry |
| Token Expired | Return 401 | Clear chrome.storage.local |
| User Logout | Invalidate session | Clear all storage |

### Session Validation

```typescript
// Backend validation (server/auth.ts)
async function validateSession(token: string): Promise<{
  valid: boolean;
  user?: { id: string; email: string; name: string };
}> {
  // 1. Find session by token
  const session = await storage.getSessionByToken(token);
  
  // 2. Check if session exists
  if (!session) {
    return { valid: false };
  }
  
  // 3. Check if session is expired
  if (new Date(session.expiresAt) < new Date()) {
    await storage.deleteSession(token);
    return { valid: false };
  }
  
  // 4. Get user details
  const user = await storage.getUserById(session.userId);
  if (!user || !user.isActive) {
    return { valid: false };
  }
  
  return { 
    valid: true, 
    user: { id: user.id, email: user.email, name: user.name } 
  };
}
```

---

## 4. Chrome Extension Structure

### File Structure

```
chrome-extension/
├── manifest.json           # Extension configuration
├── background.js           # Service Worker (token management)
├── popup.html              # Extension popup UI
├── popup.js                # Popup logic (search, status)
├── popup.css               # Popup styles
├── content.js              # LinkedIn page integration
├── content-styles.css      # LinkedIn overlay styles
├── dashboard-content.js    # Dashboard auth sync
└── icons/
    ├── icon16.png          # Toolbar icon
    ├── icon48.png          # Extension page icon
    └── icon128.png         # Chrome Web Store icon
```

### Manifest Configuration (manifest.json)

```json
{
  "manifest_version": 3,
  "name": "Prospect Lookup",
  "version": "1.0.0",
  "description": "Look up prospect details from LinkedIn profiles using your CRM database",
  
  "permissions": [
    "storage",           // Access chrome.storage.local
    "activeTab"          // Access current tab information
  ],
  
  "host_permissions": [
    "https://www.linkedin.com/*",    // LinkedIn profile pages
    "https://linkedin.com/*",        // LinkedIn alternative URL
    "https://*.replit.app/*",        // Dashboard domain (production)
    "https://*.replit.dev/*"         // Dashboard domain (development)
  ],
  
  "action": {
    "default_popup": "popup.html",
    "default_icon": {
      "16": "icons/icon16.png",
      "48": "icons/icon48.png",
      "128": "icons/icon128.png"
    }
  },
  
  "icons": {
    "16": "icons/icon16.png",
    "48": "icons/icon48.png",
    "128": "icons/icon128.png"
  },
  
  "content_scripts": [
    {
      "matches": ["https://www.linkedin.com/*", "https://linkedin.com/*"],
      "js": ["content.js"],
      "css": ["content-styles.css"]
    },
    {
      "matches": ["https://*.replit.app/*", "https://*.replit.dev/*"],
      "js": ["dashboard-content.js"],
      "run_at": "document_idle"
    }
  ],
  
  "background": {
    "service_worker": "background.js"
  },
  
  "externally_connectable": {
    "matches": ["https://*.replit.app/*", "https://*.replit.dev/*"]
  }
}
```

### Key Manifest Sections Explained

| Section | Purpose |
|---------|---------|
| `permissions` | Core Chrome APIs needed (storage, activeTab) |
| `host_permissions` | Domains where extension can make requests |
| `content_scripts` | Scripts injected into specific pages |
| `background.service_worker` | Persistent background script (Manifest V3) |
| `externally_connectable` | Domains that can send messages to extension |

---

## 5. API Endpoints Reference

### Extension-Specific Endpoints

All extension endpoints are prefixed with `/api/extension/`.

---

#### 5.1 Validate Session

**Endpoint:** `GET /api/extension/validate`

**Purpose:** Validate the current session token and get user/plan details.

**Request Headers:**
```
Authorization: Bearer <session_token>
```

**Success Response (200):**
```json
{
  "valid": true,
  "user": {
    "id": "uuid-string",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "plan": {
    "name": "professional",
    "displayName": "Professional",
    "canUseChromeExtension": true,
    "extensionLookupLimit": 200
  },
  "usage": {
    "remaining": 185,
    "limit": 200,
    "used": 15
  }
}
```

**Error Responses:**

| Status | Body | Reason |
|--------|------|--------|
| 401 | `{ "valid": false, "message": "No token provided" }` | Missing Authorization header |
| 401 | `{ "valid": false, "message": "Invalid or expired token" }` | Token invalid or expired |
| 500 | `{ "valid": false, "message": "Internal server error" }` | Server error |

---

#### 5.2 LinkedIn Profile Lookup

**Endpoint:** `POST /api/extension/lookup`

**Purpose:** Search for a contact by their LinkedIn profile URL.

**Request Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "linkedinUrl": "https://www.linkedin.com/in/johndoe"
}
```

**Success Response - Contact Found (200):**
```json
{
  "success": true,
  "found": true,
  "contact": {
    "id": "uuid-string",
    "fullName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@company.com",
    "mobilePhone": "+1-555-123-4567",
    "title": "Senior Software Engineer",
    "company": "Tech Corp Inc.",
    "industry": "Technology",
    "website": "https://techcorp.com",
    "personLinkedIn": "https://www.linkedin.com/in/johndoe",
    "companyLinkedIn": "https://www.linkedin.com/company/techcorp",
    "city": "San Francisco",
    "state": "California",
    "country": "United States",
    "leadScore": "85.5"
  },
  "usage": {
    "remaining": 184,
    "limit": 200
  }
}
```

**Success Response - No Contact Found (200):**
```json
{
  "success": true,
  "found": false,
  "message": "No contact found for this LinkedIn profile",
  "usage": {
    "remaining": 184,
    "limit": 200
  }
}
```

**Error Responses:**

| Status | Body | Reason |
|--------|------|--------|
| 400 | `{ "success": false, "message": "Invalid LinkedIn URL" }` | Malformed URL |
| 401 | `{ "success": false, "message": "Authentication required" }` | Missing token |
| 401 | `{ "success": false, "message": "Invalid or expired token" }` | Bad token |
| 403 | `{ "success": false, "message": "Daily extension lookup limit reached", "usage": {...} }` | Limit exceeded |
| 403 | `{ "success": false, "message": "Chrome extension not available on your plan" }` | Plan restriction |

---

#### 5.3 Contact Search

**Endpoint:** `POST /api/extension/search`

**Purpose:** Search contacts by name, company, or other criteria.

**Request Headers:**
```
Authorization: Bearer <session_token>
Content-Type: application/json
```

**Request Body:**
```json
{
  "query": "John Doe",
  "limit": 10
}
```

**Success Response (200):**
```json
{
  "success": true,
  "contacts": [
    {
      "id": "uuid-1",
      "fullName": "John Doe",
      "email": "john.doe@company.com",
      "title": "Senior Engineer",
      "company": "Tech Corp",
      "personLinkedIn": "https://linkedin.com/in/johndoe"
    },
    {
      "id": "uuid-2",
      "fullName": "John Smith",
      "email": "john.smith@other.com",
      "title": "Product Manager",
      "company": "Other Inc",
      "personLinkedIn": null
    }
  ],
  "count": 2,
  "usage": {
    "remaining": 183,
    "limit": 200
  }
}
```

**Error Responses:**

| Status | Body | Reason |
|--------|------|--------|
| 400 | `{ "success": false, "message": "Search query is required" }` | Missing query |
| 401 | `{ "success": false, "message": "Authentication required" }` | Missing token |
| 403 | `{ "success": false, "message": "Daily extension lookup limit reached" }` | Limit exceeded |

---

### Request/Response Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API REQUEST FLOW                                   │
└─────────────────────────────────────────────────────────────────────────────┘

Request arrives at /api/extension/*
              │
              ▼
┌─────────────────────────────┐
│ 1. Extract Bearer Token     │
│    from Authorization header│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐     ┌──────────────────────┐
│ 2. Validate Session         │────▶│ Token exists?        │
│    validateSession(token)   │     │ Session not expired? │
└─────────────┬───────────────┘     │ User is active?      │
              │                     └──────────────────────┘
              │ Valid
              ▼
┌─────────────────────────────┐     ┌──────────────────────┐
│ 3. Check Usage Limits       │────▶│ Get user's plan      │
│    checkExtensionUsage()    │     │ Get daily usage      │
└─────────────┬───────────────┘     │ Compare to limit     │
              │                     └──────────────────────┘
              │ Within limits
              ▼
┌─────────────────────────────┐
│ 4. Execute Business Logic   │
│    (lookup/search contacts) │
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 5. Increment Usage Counter  │
│    incrementExtensionUsage()│
└─────────────┬───────────────┘
              │
              ▼
┌─────────────────────────────┐
│ 6. Return Response with     │
│    updated usage info       │
└─────────────────────────────┘
```

---

## 6. Security Implementation

### Token Security

#### Token Storage Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                          TOKEN STORAGE LOCATIONS                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   DASHBOARD (React App)                                                      │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  localStorage.authToken                                              │   │
│   │  - Accessible only by dashboard domain                              │   │
│   │  - Cleared on logout                                                │   │
│   │  - Used for dashboard API calls                                     │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   CHROME EXTENSION                                                           │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  chrome.storage.local.authToken                                      │   │
│   │  - Encrypted at rest by Chrome                                      │   │
│   │  - Accessible only by extension code                                │   │
│   │  - Synced from dashboard via content script                         │   │
│   │  - Persistent across browser sessions                               │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│   BACKEND SERVER                                                             │
│   ┌─────────────────────────────────────────────────────────────────────┐   │
│   │  sessions table (PostgreSQL)                                         │   │
│   │  - Token stored with expiry timestamp                               │   │
│   │  - Linked to user via userId                                        │   │
│   │  - Deleted on logout or expiry                                      │   │
│   └─────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Security Checklist

| Security Measure | Implementation |
|-----------------|----------------|
| HTTPS Only | All API calls use HTTPS |
| Token Expiry | Sessions expire after 24 hours |
| Secure Storage | chrome.storage.local (encrypted at rest) |
| CORS Protection | host_permissions restrict domains |
| Input Validation | Zod schemas validate all inputs |
| Rate Limiting | Per-user daily limits enforced |
| Session Invalidation | Logout clears all tokens |
| No Credential Storage | Extension never stores passwords |

### CORS Configuration

The extension's `manifest.json` defines allowed domains:

```json
{
  "host_permissions": [
    "https://www.linkedin.com/*",
    "https://linkedin.com/*",
    "https://*.replit.app/*",
    "https://*.replit.dev/*"
  ]
}
```

### Message Validation

```javascript
// background.js - Validate message sources
chrome.runtime.onMessageExternal.addListener((message, sender, sendResponse) => {
  // Only accept messages from allowed origins
  const allowedOrigins = [
    /^https:\/\/.*\.replit\.app$/,
    /^https:\/\/.*\.replit\.dev$/
  ];
  
  const isAllowed = allowedOrigins.some(pattern => pattern.test(sender.origin));
  
  if (!isAllowed) {
    console.warn("Rejected message from unauthorized origin:", sender.origin);
    return;
  }
  
  // Process message...
});
```

---

## 7. Multi-User & Plan System

### User Roles

| Role | Permissions |
|------|------------|
| `admin` | Full access, manage users/plans, view all data |
| `member` | Standard access, use extension, view assigned data |
| `readonly` | View-only access, limited extension usage |

### Subscription Plans

```sql
-- Subscription Plans Table Structure
CREATE TABLE subscription_plans (
  id VARCHAR PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,          -- 'free', 'starter', 'professional', 'enterprise'
  display_name TEXT NOT NULL,
  description TEXT,
  
  -- API Limits
  daily_api_limit INTEGER DEFAULT 100,
  monthly_api_limit INTEGER DEFAULT 1000,
  
  -- Feature Toggles
  can_export_data BOOLEAN DEFAULT false,
  can_bulk_import BOOLEAN DEFAULT false,
  can_use_enrichment BOOLEAN DEFAULT false,
  can_access_advanced_search BOOLEAN DEFAULT false,
  can_create_api_keys BOOLEAN DEFAULT false,
  max_api_keys INTEGER DEFAULT 1,
  
  -- Chrome Extension Specific
  can_use_chrome_extension BOOLEAN DEFAULT true,
  extension_lookup_limit INTEGER DEFAULT 50,  -- per day
  
  -- Pricing
  price_monthly DECIMAL(10,2) DEFAULT 0,
  price_currency TEXT DEFAULT 'USD',
  
  -- Status
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);
```

### Plan Comparison

| Feature | Free | Starter | Professional | Enterprise |
|---------|------|---------|--------------|------------|
| Extension Access | Yes | Yes | Yes | Yes |
| Daily Lookups | 25 | 100 | 200 | Unlimited |
| Contact Search | Yes | Yes | Yes | Yes |
| Export Data | No | Yes | Yes | Yes |
| API Keys | No | 1 | 5 | Unlimited |
| Advanced Search | No | No | Yes | Yes |
| Price/Month | $0 | $19 | $49 | Custom |

### Usage Tracking System

```typescript
// User usage fields (from schema)
interface UserUsage {
  dailyApiUsage: number;        // General API calls
  monthlyApiUsage: number;      // Monthly API calls
  dailyExtensionUsage: number;  // Extension lookups today
  usageResetDate: Date;         // When daily counters reset
  monthlyResetDate: Date;       // When monthly counters reset
}

// Usage check flow
async function checkExtensionUsage(userId: string) {
  const user = await storage.getUserById(userId);
  const plan = await storage.getSubscriptionPlan(user.planId);
  
  // Check if extension is available on plan
  if (!plan?.canUseChromeExtension) {
    return { allowed: false, message: "Chrome extension not available on your plan" };
  }
  
  // Check daily limit
  const limit = plan.extensionLookupLimit || 50;
  const used = user.dailyExtensionUsage || 0;
  const remaining = Math.max(0, limit - used);
  
  if (remaining === 0) {
    return { allowed: false, message: "Daily extension lookup limit reached" };
  }
  
  return { allowed: true, remaining, limit };
}
```

### Daily Usage Reset Logic

```typescript
async function incrementExtensionUsage(userId: string) {
  const user = await storage.getUserById(userId);
  const today = new Date();
  const resetDate = user.usageResetDate ? new Date(user.usageResetDate) : null;
  
  // Check if it's a new day
  if (!resetDate || resetDate.toDateString() !== today.toDateString()) {
    // Reset counter for new day
    await storage.updateUser(userId, {
      dailyExtensionUsage: 1,
      usageResetDate: today,
    });
  } else {
    // Increment existing counter
    await storage.updateUser(userId, {
      dailyExtensionUsage: (user.dailyExtensionUsage || 0) + 1,
    });
  }
}
```

---

## 8. File-by-File Implementation Guide

### 8.1 background.js (Service Worker)

**Purpose:** Central message handler and token storage manager.

```javascript
// Complete background.js implementation

// Message handler for all extension components
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  
  // Store authentication from dashboard
  if (message.type === "STORE_AUTH") {
    chrome.storage.local.set({ 
      authToken: message.token,
      apiBaseUrl: message.apiBaseUrl 
    }, () => {
      console.log("Auth stored from dashboard");
      sendResponse({ success: true });
    });
    return true; // Keep channel open for async response
  }

  // Store token only
  if (message.type === "STORE_TOKEN") {
    chrome.storage.local.set({ authToken: message.token }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Store API base URL
  if (message.type === "STORE_API_URL") {
    chrome.storage.local.set({ apiBaseUrl: message.url }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // Get stored token
  if (message.type === "GET_TOKEN") {
    chrome.storage.local.get(["authToken"], (result) => {
      sendResponse({ token: result.authToken });
    });
    return true;
  }

  // Clear authentication
  if (message.type === "CLEAR_TOKEN" || message.type === "CLEAR_AUTH") {
    chrome.storage.local.remove(["authToken"], () => {
      sendResponse({ success: true });
    });
    return true;
  }

  // LinkedIn profile detected - show badge
  if (message.type === "LINKEDIN_PROFILE_DETECTED") {
    chrome.action.setBadgeText({ text: "1", tabId: sender.tab?.id });
    chrome.action.setBadgeBackgroundColor({ color: "#3b82f6", tabId: sender.tab?.id });
  }

  // Handle auth token from external sources
  if (message.type === "AUTH_TOKEN") {
    chrome.storage.local.set({ 
      authToken: message.token,
      apiBaseUrl: message.apiBaseUrl 
    }, () => {
      console.log("Auth stored via external message");
      sendResponse({ success: true });
    });
    return true;
  }
});

// Handle messages from external sources (dashboard)
chrome.runtime.onMessageExternal.addListener((request, sender, sendResponse) => {
  if (request.type === "STORE_AUTH" && request.token) {
    chrome.storage.local.set({ 
      authToken: request.token,
      apiBaseUrl: request.apiBaseUrl 
    }, () => {
      sendResponse({ success: true });
    });
    return true;
  }
});
```

### 8.2 content.js (LinkedIn Integration)

**Purpose:** Detects LinkedIn profiles, injects lookup button, handles lookup flow.

```javascript
// Profile detection
(function() {
  const PROFILE_URL_PATTERN = /linkedin\.com\/in\/[^\/]+/;

  function isProfilePage() {
    return PROFILE_URL_PATTERN.test(window.location.href);
  }

  // Notify background when profile detected
  function notifyBackground() {
    if (isProfilePage()) {
      chrome.runtime.sendMessage({ 
        type: "LINKEDIN_PROFILE_DETECTED",
        url: window.location.href 
      });
    }
  }

  // Extract profile data from page
  function extractProfileData() {
    const data = {
      url: window.location.href,
      name: null,
      title: null,
      company: null,
    };

    // Get name from LinkedIn's heading
    const nameElement = document.querySelector("h1.text-heading-xlarge");
    if (nameElement) {
      data.name = nameElement.textContent.trim();
    }

    // Get title/headline
    const titleElement = document.querySelector("div.text-body-medium");
    if (titleElement) {
      data.title = titleElement.textContent.trim();
    }

    // Get current company
    const companyElement = document.querySelector("button[aria-label*='Current company']");
    if (companyElement) {
      data.company = companyElement.textContent.trim();
    }

    return data;
  }

  // Create and inject the lookup button
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
    btn.title = "Look up this profile in your CRM";

    btn.addEventListener("click", async () => {
      const profileData = extractProfileData();
      
      btn.disabled = true;
      btn.innerHTML = `<span>Looking up...</span>`;

      try {
        const result = await chrome.storage.local.get(["authToken", "apiBaseUrl"]);
        
        if (!result.authToken) {
          showNotification("Please sign in to use this feature", "warning");
          btn.disabled = false;
          resetButton();
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

  // Show notification toast
  function showNotification(message, type = "info") {
    const notification = document.createElement("div");
    notification.className = `prospect-notification prospect-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);
    
    setTimeout(() => notification.remove(), 4000);
  }

  // Show contact card overlay
  function showContactCard(contact) {
    // Remove existing card
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
        ${contact.email ? `<div class="prospect-card-field"><strong>Email:</strong> ${contact.email}</div>` : ""}
        ${contact.mobilePhone ? `<div class="prospect-card-field"><strong>Phone:</strong> ${contact.mobilePhone}</div>` : ""}
        ${contact.city || contact.country ? `<div class="prospect-card-field"><strong>Location:</strong> ${[contact.city, contact.state, contact.country].filter(Boolean).join(", ")}</div>` : ""}
      </div>
    `;

    card.querySelector(".prospect-card-close").addEventListener("click", () => card.remove());
    document.body.appendChild(card);
  }

  // Initialize on load
  if (isProfilePage()) {
    notifyBackground();
    createLookupButton();
  }

  // Watch for navigation (LinkedIn is a SPA)
  let lastUrl = location.href;
  new MutationObserver(() => {
    if (location.href !== lastUrl) {
      lastUrl = location.href;
      if (isProfilePage()) {
        notifyBackground();
        setTimeout(createLookupButton, 1000);
      }
    }
  }).observe(document.body, { subtree: true, childList: true });

})();
```

### 8.3 dashboard-content.js (Auth Sync)

**Purpose:** Syncs authentication from dashboard to extension.

```javascript
(function() {
  const apiBaseUrl = window.location.origin;

  // Sync token to extension storage
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

  // Check for pending auth and sync
  function checkAndSyncAuth() {
    const token = localStorage.getItem("extension_auth_token");
    const storedUrl = localStorage.getItem("extension_api_base_url");
    const timestamp = localStorage.getItem("extension_auth_timestamp");

    if (token) {
      const authTime = parseInt(timestamp || "0", 10);
      const now = Date.now();
      
      // Only sync if auth is recent (within 2 minutes)
      if (now - authTime < 120000) {
        chrome.runtime.sendMessage({
          type: "STORE_AUTH",
          token: token,
          apiBaseUrl: storedUrl || apiBaseUrl,
        });

        // Clear temporary storage
        localStorage.removeItem("extension_auth_token");
        localStorage.removeItem("extension_api_base_url");
        localStorage.removeItem("extension_auth_timestamp");
      }
    }
  }

  // Listen for auth messages from React app
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

  // Sync current session to extension
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

  // Initialize
  checkAndSyncAuth();
  listenForAuthMessages();
  
  // Delayed sync for page load
  setTimeout(syncCurrentSession, 500);
  
  // Periodic sync check (every 2 seconds)
  setInterval(() => {
    const currentToken = localStorage.getItem("authToken");
    chrome.storage.local.get(["authToken"], (result) => {
      if (result.authToken !== currentToken) {
        syncAuthToExtension(currentToken);
      }
    });
  }, 2000);

  // Listen for storage changes (logout detection)
  window.addEventListener("storage", (event) => {
    if (event.key === "authToken") {
      syncAuthToExtension(event.newValue);
    }
  });
})();
```

### 8.4 popup.js (Extension Popup)

**Purpose:** Main popup interface logic - status, search, lookup.

```javascript
// DOM Elements
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
const logoutBtn = document.getElementById("logout-btn");

let currentLinkedInUrl = null;

// Storage helpers
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
  await chrome.storage.local.remove(["authToken"]);
}

// View management
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

// Validate session and load user data
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
      // Update UI with user data
      userName.textContent = data.user.name || data.user.email;
      planBadge.textContent = data.plan?.displayName || "Free";
      usageCount.textContent = `${data.usage.used}/${data.usage.limit}`;
      
      const usagePercent = (data.usage.used / data.usage.limit) * 100;
      usageProgress.style.width = `${usagePercent}%`;
      
      showView("main");
      
      // Check for LinkedIn tab
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

// Check current tab for LinkedIn profile
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

// Search contacts
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
      updateUsage(data.usage);
    } else {
      showError(data.message || "Search failed");
    }
  } catch (error) {
    console.error("Search error:", error);
    showError("Failed to search contacts");
  }
}

// Lookup LinkedIn profile
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

// Display search results
function displayResults(contacts) {
  resultsList.innerHTML = "";
  
  if (contacts.length === 0) {
    resultsList.innerHTML = "<p class='no-results'>No contacts found</p>";
    return;
  }

  contacts.forEach(contact => {
    const item = document.createElement("div");
    item.className = "result-item";
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

// Show contact detail view
function showContactDetail(contact) {
  contactDetail.innerHTML = `
    <h3>${contact.fullName}</h3>
    ${contact.title ? `<p class="detail-title">${contact.title}</p>` : ""}
    ${contact.company ? `<p class="detail-company">${contact.company}</p>` : ""}
    <div class="detail-fields">
      ${contact.email ? `<div class="detail-field"><strong>Email:</strong> <a href="mailto:${contact.email}">${contact.email}</a></div>` : ""}
      ${contact.mobilePhone ? `<div class="detail-field"><strong>Phone:</strong> <a href="tel:${contact.mobilePhone}">${contact.mobilePhone}</a></div>` : ""}
      ${contact.personLinkedIn ? `<div class="detail-field"><strong>LinkedIn:</strong> <a href="${contact.personLinkedIn}" target="_blank">View Profile</a></div>` : ""}
    </div>
  `;
  contactDetail.classList.remove("hidden");
}

// Update usage display
function updateUsage(usage) {
  if (usage) {
    usageCount.textContent = `${usage.limit - usage.remaining}/${usage.limit}`;
    const usagePercent = ((usage.limit - usage.remaining) / usage.limit) * 100;
    usageProgress.style.width = `${usagePercent}%`;
  }
}

// Event Listeners
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

logoutBtn.addEventListener("click", async () => {
  await clearStoredAuth();
  showView("login");
});

// Initialize popup
validateSession();
```

### 8.5 popup.html (Popup UI)

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Prospect Lookup</title>
  <link rel="stylesheet" href="popup.css">
</head>
<body>
  <!-- Loading View -->
  <div id="loading-view" class="view">
    <div class="loading-spinner"></div>
    <p>Loading...</p>
  </div>

  <!-- Login View -->
  <div id="login-view" class="view hidden">
    <div class="logo">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="11" cy="11" r="8"/>
        <path d="m21 21-4.35-4.35"/>
      </svg>
    </div>
    <h2>Prospect Lookup</h2>
    <p class="description">Connect to your CRM dashboard to start looking up prospects.</p>
    
    <div class="form-group">
      <label for="dashboard-url">Dashboard URL</label>
      <input type="url" id="dashboard-url" placeholder="https://your-app.replit.app">
    </div>
    
    <button id="connect-btn" class="btn-primary">Connect to Dashboard</button>
    
    <div id="open-dashboard-btn" class="link-btn">
      Already logged in? Open dashboard
    </div>
  </div>

  <!-- Main View -->
  <div id="main-view" class="view hidden">
    <div class="header">
      <div class="user-info">
        <span id="user-name">User</span>
        <span id="plan-badge" class="badge">Free</span>
      </div>
      <button id="logout-btn" class="btn-icon" title="Sign out">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
          <polyline points="16 17 21 12 16 7"/>
          <line x1="21" y1="12" x2="9" y2="12"/>
        </svg>
      </button>
    </div>

    <div class="usage-bar">
      <span>Lookups: <span id="usage-count">0/50</span></span>
      <div class="progress">
        <div id="usage-progress" class="progress-fill" style="width: 0%"></div>
      </div>
    </div>

    <div class="search-section">
      <div class="search-input-wrapper">
        <input type="text" id="search-input" placeholder="Search contacts...">
        <button id="search-btn" class="btn-icon">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/>
            <path d="m21 21-4.35-4.35"/>
          </svg>
        </button>
      </div>
    </div>

    <div id="linkedin-lookup" class="linkedin-section">
      <button id="lookup-btn" class="btn-secondary" disabled>
        Open a LinkedIn profile
      </button>
    </div>

    <div id="error-message" class="error hidden"></div>

    <div id="results-section" class="results-section">
      <div id="results-list"></div>
    </div>

    <div id="contact-detail" class="contact-detail hidden"></div>
  </div>

  <script src="popup.js"></script>
</body>
</html>
```

### 8.6 popup.css (Popup Styles)

```css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  width: 360px;
  min-height: 400px;
  background: #ffffff;
  color: #1a1a2e;
}

.view {
  padding: 20px;
}

.hidden {
  display: none !important;
}

/* Loading View */
#loading-view {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 300px;
}

.loading-spinner {
  width: 40px;
  height: 40px;
  border: 3px solid #e0e0e0;
  border-top-color: #3b82f6;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Login View */
#login-view {
  text-align: center;
}

.logo {
  color: #3b82f6;
  margin-bottom: 16px;
}

#login-view h2 {
  font-size: 20px;
  margin-bottom: 8px;
}

.description {
  color: #666;
  font-size: 14px;
  margin-bottom: 24px;
}

.form-group {
  text-align: left;
  margin-bottom: 16px;
}

.form-group label {
  display: block;
  font-size: 12px;
  font-weight: 500;
  margin-bottom: 6px;
  color: #444;
}

.form-group input {
  width: 100%;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.form-group input:focus {
  outline: none;
  border-color: #3b82f6;
}

.btn-primary {
  width: 100%;
  padding: 12px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}

.btn-primary:hover {
  background: #2563eb;
}

.link-btn {
  margin-top: 16px;
  color: #3b82f6;
  font-size: 13px;
  cursor: pointer;
}

.link-btn:hover {
  text-decoration: underline;
}

/* Main View */
.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

#user-name {
  font-weight: 500;
}

.badge {
  background: #e0f2fe;
  color: #0369a1;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: 500;
}

.btn-icon {
  background: none;
  border: none;
  padding: 8px;
  cursor: pointer;
  color: #666;
  border-radius: 6px;
}

.btn-icon:hover {
  background: #f5f5f5;
}

.usage-bar {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 8px;
  margin-bottom: 16px;
}

.usage-bar span {
  font-size: 12px;
  color: #666;
}

.progress {
  height: 4px;
  background: #e0e0e0;
  border-radius: 2px;
  margin-top: 8px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #3b82f6;
  transition: width 0.3s ease;
}

.search-section {
  margin-bottom: 12px;
}

.search-input-wrapper {
  display: flex;
  gap: 8px;
}

.search-input-wrapper input {
  flex: 1;
  padding: 10px 12px;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 14px;
}

.search-input-wrapper input:focus {
  outline: none;
  border-color: #3b82f6;
}

.linkedin-section {
  margin-bottom: 16px;
}

.btn-secondary {
  width: 100%;
  padding: 10px;
  background: #f8f9fa;
  color: #333;
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  font-size: 13px;
  cursor: pointer;
}

.btn-secondary:hover:not(:disabled) {
  background: #f0f0f0;
}

.btn-secondary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  background: #fee2e2;
  color: #dc2626;
  padding: 10px;
  border-radius: 8px;
  font-size: 13px;
  margin-bottom: 12px;
}

.results-section {
  max-height: 200px;
  overflow-y: auto;
}

.result-item {
  padding: 12px;
  border-bottom: 1px solid #f0f0f0;
  cursor: pointer;
}

.result-item:hover {
  background: #f8f9fa;
}

.result-name {
  font-weight: 500;
  margin-bottom: 4px;
}

.result-details {
  font-size: 12px;
  color: #666;
}

.result-details span:not(:last-child)::after {
  content: " • ";
}

.contact-detail {
  background: #f8f9fa;
  padding: 16px;
  border-radius: 8px;
}

.contact-detail h3 {
  font-size: 16px;
  margin-bottom: 4px;
}

.detail-title {
  color: #666;
  font-size: 14px;
}

.detail-company {
  color: #3b82f6;
  font-size: 14px;
  margin-bottom: 12px;
}

.detail-fields {
  font-size: 13px;
}

.detail-field {
  margin-bottom: 8px;
}

.detail-field a {
  color: #3b82f6;
  text-decoration: none;
}

.detail-field a:hover {
  text-decoration: underline;
}

.no-results {
  text-align: center;
  color: #666;
  padding: 24px;
  font-size: 14px;
}
```

### 8.7 content-styles.css (LinkedIn Overlay Styles)

```css
/* Floating lookup button */
#prospect-lookup-btn {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 99999;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  background: #3b82f6;
  color: white;
  border: none;
  border-radius: 24px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(59, 130, 246, 0.4);
  transition: all 0.2s ease;
}

#prospect-lookup-btn:hover {
  background: #2563eb;
  transform: translateY(-2px);
  box-shadow: 0 6px 16px rgba(59, 130, 246, 0.5);
}

#prospect-lookup-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

#prospect-lookup-btn .spinning {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* Notification toast */
.prospect-notification {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: 99999;
  padding: 12px 20px;
  background: #1a1a2e;
  color: white;
  border-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  font-size: 14px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  animation: slideIn 0.3s ease;
}

.prospect-notification-warning {
  background: #f59e0b;
}

.prospect-notification-error {
  background: #ef4444;
}

.prospect-notification-info {
  background: #3b82f6;
}

@keyframes slideIn {
  from {
    opacity: 0;
    transform: translateX(20px);
  }
  to {
    opacity: 1;
    transform: translateX(0);
  }
}

/* Contact card overlay */
#prospect-contact-card {
  position: fixed;
  bottom: 80px;
  right: 24px;
  z-index: 99999;
  width: 320px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  animation: slideUp 0.3s ease;
}

@keyframes slideUp {
  from {
    opacity: 0;
    transform: translateY(20px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.prospect-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px;
  border-bottom: 1px solid #f0f0f0;
}

.prospect-card-header h3 {
  font-size: 14px;
  font-weight: 600;
  color: #3b82f6;
}

.prospect-card-close {
  background: none;
  border: none;
  font-size: 20px;
  color: #999;
  cursor: pointer;
  padding: 0;
  line-height: 1;
}

.prospect-card-close:hover {
  color: #333;
}

.prospect-card-body {
  padding: 16px;
}

.prospect-card-name {
  font-size: 18px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 4px;
}

.prospect-card-title {
  font-size: 14px;
  color: #666;
  margin-bottom: 2px;
}

.prospect-card-company {
  font-size: 14px;
  color: #3b82f6;
  margin-bottom: 16px;
}

.prospect-card-field {
  font-size: 13px;
  color: #444;
  margin-bottom: 8px;
}

.prospect-card-field strong {
  color: #666;
}
```

---

## 9. Error Handling & Edge Cases

### Error Response Handling Matrix

| Error Code | Cause | Extension Action |
|------------|-------|-----------------|
| 400 | Invalid request (bad URL, missing query) | Show error message to user |
| 401 | Token missing or expired | Clear token, show login view |
| 403 | Usage limit exceeded or plan restriction | Show limit warning |
| 404 | Contact not found | Show "not found" message |
| 429 | Rate limit exceeded | Show retry message |
| 500 | Server error | Show generic error, log for debugging |

### Token Expiration Handling

```javascript
// Centralized response handler
async function handleApiResponse(response, fallbackAction) {
  if (response.status === 401) {
    // Token expired - clear and show login
    await chrome.storage.local.remove(["authToken"]);
    showView("login");
    return null;
  }
  
  if (response.status === 403) {
    const data = await response.json();
    showError(data.message || "Access denied");
    return null;
  }
  
  if (!response.ok) {
    showError("Something went wrong. Please try again.");
    return null;
  }
  
  return response.json();
}
```

### Network Failure Handling

```javascript
// Wrap all API calls with error handling
async function safeApiCall(apiFunction) {
  try {
    return await apiFunction();
  } catch (error) {
    if (error.name === "TypeError" && error.message.includes("fetch")) {
      showError("Network error. Please check your connection.");
    } else {
      console.error("API Error:", error);
      showError("An unexpected error occurred.");
    }
    return null;
  }
}
```

### Edge Cases Checklist

| Scenario | Handling |
|----------|----------|
| User logged out from dashboard | Periodic sync clears extension token |
| LinkedIn page navigation (SPA) | MutationObserver detects URL changes |
| Multiple tabs open | Each tab gets independent lookup button |
| Popup opened on non-LinkedIn page | Disable lookup button, enable search only |
| API server unreachable | Show connection error |
| Token expires during popup session | Graceful redirect to login |
| User upgrades/downgrades plan | Next validation fetches new limits |

---

## 10. Deployment & Distribution

### Building for Production

1. **Prepare Icons:**
   ```
   icons/
   ├── icon16.png   (16x16 pixels)
   ├── icon48.png   (48x48 pixels)
   └── icon128.png  (128x128 pixels)
   ```

2. **Update manifest.json:**
   - Set correct `host_permissions` for production domain
   - Remove development URLs
   - Update version number

3. **Create ZIP Package:**
   ```bash
   cd chrome-extension
   zip -r extension.zip . -x "*.git*" -x "*.DS_Store" -x "*.md"
   ```

### Chrome Web Store Submission

1. **Developer Account:**
   - Create Chrome Web Store developer account ($5 one-time fee)
   - Enable 2-factor authentication

2. **Required Assets:**
   - Extension icon (128x128)
   - Screenshots (1280x800 or 640x400)
   - Promotional images (optional)
   - Detailed description

3. **Privacy Policy:**
   - Must disclose data collection
   - Explain token storage
   - Describe API communication

4. **Permissions Justification:**
   - `storage`: "Stores authentication token for API access"
   - `activeTab`: "Detects LinkedIn profile pages"
   - `host_permissions`: "Communicates with dashboard and LinkedIn"

### Enterprise Distribution

For private distribution to organization users:

1. **Self-Hosted:**
   - Host extension on company server
   - Users install via URL
   - Chrome policy can force-install

2. **Group Policy:**
   ```json
   {
     "ExtensionInstallForcelist": [
       "extension_id;https://your-server.com/updates.xml"
     ]
   }
   ```

### Updating the Extension

```javascript
// manifest.json - increment version
{
  "version": "1.0.1"  // was "1.0.0"
}
```

Upload new ZIP to Chrome Web Store. Updates propagate automatically.

---

## 11. Testing Guidelines

### Manual Testing Checklist

#### Authentication Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Fresh Install | Install extension, open popup | Shows login view |
| Dashboard Login Sync | Log into dashboard, open extension | Shows main view with user info |
| Session Expiry | Wait for session to expire, use extension | Returns to login view |
| Logout Sync | Log out from dashboard | Extension shows login view |

#### LinkedIn Integration Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Profile Detection | Navigate to LinkedIn profile | Lookup button appears |
| Lookup - Found | Click lookup on profile in database | Contact card shows |
| Lookup - Not Found | Click lookup on unknown profile | "Not found" message |
| Limit Reached | Use up daily limit, try lookup | Limit warning shown |

#### Search Tests

| Test | Steps | Expected Result |
|------|-------|-----------------|
| Search by Name | Enter name in search | Results list shows matches |
| Search by Company | Enter company name | Results list shows matches |
| Empty Search | Search with empty query | No action / validation error |
| No Results | Search for nonexistent contact | "No results" message |

### Automated Testing Setup

```javascript
// tests/extension.test.js
describe('Chrome Extension', () => {
  describe('Background Script', () => {
    test('should store auth token', async () => {
      const response = await sendMessage({ 
        type: 'STORE_AUTH', 
        token: 'test-token',
        apiBaseUrl: 'https://test.com'
      });
      expect(response.success).toBe(true);
      
      const stored = await chrome.storage.local.get(['authToken']);
      expect(stored.authToken).toBe('test-token');
    });
    
    test('should clear auth token', async () => {
      await sendMessage({ type: 'CLEAR_AUTH' });
      const stored = await chrome.storage.local.get(['authToken']);
      expect(stored.authToken).toBeUndefined();
    });
  });
  
  describe('API Integration', () => {
    test('should validate session', async () => {
      // Mock API response
      const response = await fetch('/api/extension/validate', {
        headers: { Authorization: 'Bearer valid-token' }
      });
      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data.valid).toBe(true);
      expect(data.user).toBeDefined();
    });
  });
});
```

---

## 12. Troubleshooting Guide

### Common Issues and Solutions

#### Issue: Extension popup shows login even though user is logged in

**Cause:** Token not synced from dashboard

**Solution:**
1. Check if `dashboard-content.js` is injected on dashboard page
2. Verify `host_permissions` includes dashboard domain
3. Open dashboard and wait 2 seconds for sync
4. Check Chrome DevTools > Application > Storage for token

#### Issue: "Session expired" message after every action

**Cause:** Token mismatch or server session deleted

**Solution:**
1. Log out from extension
2. Log out from dashboard
3. Log back into dashboard
4. Open extension popup to re-sync

#### Issue: Lookup button not appearing on LinkedIn

**Cause:** Content script not loaded or CSS conflict

**Solution:**
1. Check if extension is enabled for linkedin.com
2. Verify `content_scripts` matches in manifest
3. Check for JavaScript errors in LinkedIn console
4. Try hard refresh (Ctrl+Shift+R)

#### Issue: "Network error" when looking up profiles

**Cause:** CORS issue or server unreachable

**Solution:**
1. Verify backend server is running
2. Check `host_permissions` includes API domain
3. Ensure HTTPS is used for all requests
4. Check backend CORS configuration

#### Issue: Usage counter not updating

**Cause:** API response not including usage data

**Solution:**
1. Check server logs for errors
2. Verify `incrementExtensionUsage` is called
3. Check database for user usage values
4. Refresh extension popup

### Debug Mode

Enable debug logging in extension:

```javascript
// Add to background.js
const DEBUG = true;

function debugLog(...args) {
  if (DEBUG) {
    console.log('[Extension Debug]', ...args);
  }
}

// Use throughout code
debugLog('Token stored:', token.substring(0, 10) + '...');
```

### Viewing Extension Logs

1. **Background Script:** `chrome://extensions/` > Details > Inspect views: service worker
2. **Content Script:** LinkedIn tab > DevTools > Console
3. **Popup:** Right-click popup > Inspect
4. **Storage:** DevTools > Application > Storage > Local Storage (for extension)

---

## Appendix A: Database Schema Reference

### Users Table

```sql
CREATE TABLE users (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'member',
  plan_id VARCHAR REFERENCES subscription_plans(id),
  plan_expires_at TIMESTAMP,
  daily_api_usage INTEGER DEFAULT 0,
  monthly_api_usage INTEGER DEFAULT 0,
  daily_extension_usage INTEGER DEFAULT 0,
  usage_reset_date TIMESTAMP DEFAULT NOW(),
  monthly_reset_date TIMESTAMP DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

### Sessions Table

```sql
CREATE TABLE sessions (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id VARCHAR REFERENCES users(id) NOT NULL,
  token TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Contacts Table (Simplified)

```sql
CREATE TABLE contacts (
  id VARCHAR PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  mobile_phone TEXT,
  title TEXT,
  company TEXT,
  industry TEXT,
  website TEXT,
  person_linkedin TEXT,
  company_linkedin TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  lead_score DECIMAL(3,1),
  created_at TIMESTAMP DEFAULT NOW()
);
```

---

## Appendix B: Environment Variables

### Backend Environment

```env
# Database
DATABASE_URL=postgresql://user:pass@host:5432/dbname

# Session
SESSION_SECRET=your-secure-session-secret

# Server
NODE_ENV=production
PORT=5000
```

### Extension Configuration

The extension uses `chrome.storage.local` instead of environment variables:

```javascript
// Stored values
{
  authToken: "session-token-from-backend",
  apiBaseUrl: "https://your-app.replit.app"
}
```

---

## Appendix C: API Rate Limits

| Endpoint | Rate Limit | Reset Period |
|----------|------------|--------------|
| `/api/extension/validate` | 60/minute | Rolling |
| `/api/extension/lookup` | Plan-based daily limit | Midnight UTC |
| `/api/extension/search` | Plan-based daily limit | Midnight UTC |

---

## Appendix D: Changelog

### Version 1.0.0 (Initial Release)

- LinkedIn profile detection and lookup
- Session sharing with dashboard
- Plan-based usage limits
- Contact search functionality
- Floating lookup button on LinkedIn
- Contact card overlay display

---

## Document Revision History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0 | Dec 14, 2025 | System | Initial documentation |

---

**End of Documentation**
