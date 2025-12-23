# LinkedIn & Sales Navigator Extension Flowchart Documentation

## Overview
This document illustrates the behavior of the LinkedOut Chrome extension when users interact with LinkedIn profile pages and Sales Navigator URLs.

---

## 1. LinkedIn Regular Profile Flow

### User Journey: Opening a LinkedIn Profile (linkedin.com/in/...)

```
┌─────────────────────────────────────────────────────────────────┐
│         USER OPENS LINKEDIN PROFILE PAGE                        │
│    (e.g., linkedin.com/in/john-doe-123abc/)                    │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
        ┌────────────────────────────────────┐
        │ Extension Content Script Activates │
        │ - Detects LinkedIn URL             │
        │ - Extracts profile name            │
        │ - Checks for auth token            │
        └────────────┬───────────────────────┘
                     │
        ┌────────────▼───────────────────────┐
        │   Is User Authenticated?           │
        │   (Auth token in chrome.storage)   │
        └────┬───────────────────────────┬───┘
             │ NO                        │ YES
             │                           │
             ▼                           ▼
    ┌─────────────────┐        ┌──────────────────────┐
    │ Show Login CTA  │        │ Show "Look Up" Button│
    │ "Sign in to use"│        │ with profile info    │
    └─────────────────┘        └──────────┬───────────┘
                                          │
                                          │ User clicks "Look Up"
                                          ▼
                        ┌─────────────────────────────────┐
                        │ Send Lookup Request to Backend  │
                        │ POST /api/extension/lookup      │
                        │ - LinkedIn URL                  │
                        │ - Authorization Bearer token    │
                        └────────────┬────────────────────┘
                                     │
                      ┌──────────────┴──────────────┐
                      │ Check Usage Limits          │
                      │ (Plan-based daily lookups)  │
                      └──────────┬────────┬─────────┘
                                 │        │
                    ┌────────────┘        └──────────────┐
                    │ LIMIT EXCEEDED                     │ WITHIN LIMIT
                    ▼                                    ▼
        ┌─────────────────────────┐      ┌──────────────────────────┐
        │ Return 403 Error        │      │ Search Database by URL   │
        │ Show: "Daily limit      │      │ Query: findContactBy     │
        │ reached"                │      │ LinkedInUrl()            │
        └─────────────────────────┘      └──────────┬───────────────┘
                                                    │
                                  ┌─────────────────┴──────────────┐
                                  │ PROFILE FOUND?                 │
                                  └──────┬─────────────────┬───────┘
                                   YES   │                 │   NO
                                         │                 │
                                         ▼                 ▼
                        ┌────────────────────────┐  ┌───────────────────────┐
                        │ PROFILE FOUND RESPONSE │  │ PROFILE NOT FOUND     │
                        │                        │  │ RESPONSE              │
                        │ Return:                │  │                       │
                        │ {                      │  │ Return:               │
                        │   success: true,       │  │ {                     │
                        │   found: true,         │  │   success: true,      │
                        │   contact: {...},      │  │   found: false        │
                        │   usage: {...}         │  │ }                     │
                        │ }                      │  └───────────┬───────────┘
                        └──────────┬─────────────┘              │
                                   │                           │
                        ┌──────────┘                           │
                        │                                      │
                        ▼                                      ▼
            ┌────────────────────────┐         ┌──────────────────────────┐
            │ DISPLAY CONTACT CARD   │         │ DISPLAY NEW CONTACT CARD │
            │                        │         │                          │
            │ - Full Name            │         │ - Extracted Name from    │
            │ - Title @ Company      │         │   LinkedIn Profile       │
            │ - Email                │         │ - LinkedIn URL           │
            │ - Phone                │         │ - Limited info           │
            │ - Location             │         │                          │
            │ - Lead Score           │         │ Action Button:           │
            │ - LinkedIn URL (link)  │         │ "Sync CRM" (ENABLED)     │
            │                        │         │                          │
            │ Action Buttons:        │         │ Message:                 │
            │ - Email                │         │ "Save to CRM"            │
            │ - "Sync CRM" (DISABLED)│         └──────────┬───────────────┘
            │   (tooltip: "Profile   │                    │
            │    already in CRM")    │                    │ User clicks "Sync CRM"
            └────────────────────────┘                    │
                                                          ▼
                                              ┌───────────────────────────┐
                                              │ POST /api/extension/       │
                                              │ save-profile              │
                                              │                           │
                                              │ Body:                     │
                                              │ {                         │
                                              │   linkedinUrl: "...",     │
                                              │   fullName: "John Doe",   │
                                              │   title: "...",           │
                                              │   company: "...",         │
                                              │   email: "..."            │
                                              │ }                         │
                                              └───────────┬───────────────┘
                                                          │
                                              ┌───────────▼───────────┐
                                              │ Check if URL already  │
                                              │ exists in database    │
                                              └───────┬───────────┬──┘
                                                      │           │
                                        ┌─────────────┘           │
                                        │ ALREADY EXISTS          │ NEW PROFILE
                                        ▼                         ▼
                                    ┌────────┐         ┌──────────────────┐
                                    │ Error: │         │ Create Contact   │
                                    │ "Profile          │ INSERT prospect  │
                                    │ already           │ {firstName, ...} │
                                    │ saved"  │         │                  │
                                    └────────┘         │ Return:          │
                                                       │ {                │
                                                       │   success: true, │
                                                       │   contact: {...} │
                                                       │ }                │
                                                       └──────────┬───────┘
                                                                  │
                                                                  ▼
                                                       ┌──────────────────┐
                                                       │ Show Success     │
                                                       │ Message:         │
                                                       │ "Contact saved   │
                                                       │ to CRM!"         │
                                                       │                  │
                                                       │ Button changes:  │
                                                       │ "✓ Saved"        │
                                                       └──────────────────┘
```

---

## 2. Sales Navigator Lead URL Flow (Updated Implementation)

### User Journey: Opening a Sales Navigator Lead Profile (linkedin.com/sales/lead/...)

**Key Change:** The new implementation uses direct URL detection instead of DOM scraping, making it more reliable and faster.

```
┌──────────────────────────────────────────────────────────────┐
│    USER OPENS SALES NAVIGATOR LEAD PAGE                      │
│    (e.g., linkedin.com/sales/lead/123456789/)                │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────────┐
        │ Extension Content Script Activates       │
        │ - Detects /sales/lead/ URL pattern      │
        │ - Extracts current tab URL              │
        │ - Notifies background script            │
        │ - Checks for auth token                 │
        └───────────────┬──────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────┐
        │ Background Script Updates Badge  │
        │ - Sets badge text: "S"           │
        │ - Sets badge color: Amber        │
        │ (indicates Sales Navigator page) │
        └───────────────┬──────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────┐
        │ Is User Authenticated?           │
        │ (Auth token in chrome.storage)   │
        └────┬──────────────────────────┬──┘
             │ NO                       │ YES
             │                          │
             ▼                          ▼
    ┌─────────────────┐        ┌──────────────────────┐
    │ Show Login CTA  │        │ Show Popup with:     │
    │ "Sign in to use"│        │ - "Sales Navigator"  │
    │                 │        │   label              │
    │ Redirect to     │        │ - "Look Up" Button   │
    │ /extension-auth │        │ - Loading state      │
    └─────────────────┘        └──────────┬───────────┘
                                          │
                        ┌─────────────────┘ (Auto-lookup or manual click)
                        │
                        ▼
                ┌──────────────────────────────────┐
                │ Auto-Lookup Triggered (Optional) │
                │ or Manual Lookup on Button Click │
                │                                  │
                │ Extract URLs:                    │
                │ - salesNavigatorUrl:             │
                │   linkedin.com/sales/lead/...    │
                │ - linkedinUrl: null (or extracted│
                │   if available on page)          │
                └────────────┬─────────────────────┘
                             │
                             ▼
                ┌──────────────────────────────────┐
                │ Send Lookup Request to Backend   │
                │ POST /api/extension/lookup       │
                │ {                                │
                │   salesNavigatorUrl: "https://..│
                │   linkedinUrl: (optional)        │
                │ }                                │
                └────────────┬─────────────────────┘
                             │
                  ┌──────────┴──────────┐
                  │ Check Usage Limits  │
                  │ (Plan-based daily)  │
                  └──────┬────────┬─────┘
                         │        │
            ┌────────────┘        └──────────────┐
            │ LIMIT EXCEEDED                    │ WITHIN LIMIT
            ▼                                   ▼
    ┌───────────────┐      ┌──────────────────────────┐
    │ Return 403    │      │ Search Database using    │
    │ Error         │      │ findContactByLinkedInUrls│
    │ "Limit        │      │ (flexible matching)      │
    │  reached"     │      │ - Try salesNavigatorUrl  │
    └───────────────┘      │ - OR try linkedinUrl     │
                           └──────────┬───────────────┘
                                      │
                           ┌──────────┴──────────┐
                           │ CONTACT FOUND?      │
                           └──────┬──────────┬───┘
                            YES   │          │   NO
                                  │          │
                                  ▼          ▼
                    ┌────────────────────┐  ┌────────────────┐
                    │ DISPLAY CONTACT    │  │ DISPLAY NEW    │
                    │ FOUND CARD         │  │ CONTACT CARD   │
                    │                    │  │ (NOT FOUND)    │
                    │ - Full Name        │  │                │
                    │ - Title @ Company  │  │ - Name         │
                    │ - Email            │  │ - Sales Nav    │
                    │ - Phone            │  │   URL          │
                    │ - Location         │  │ - Linked In    │
                    │ - Lead Score       │  │   URL (if any) │
                    │ - LinkedIn Profile │  │                │
                    │   URL (link)       │  │ Action Button: │
                    │ - Sales Navigator  │  │ "Save" (ENABLED)
                    │   URL (link) ★     │  │                │
                    │                    │  │ Message:       │
                    │ Action Buttons:    │  │ "Save to CRM"  │
                    │ - Email            │  │                │
                    │ - "Look Up" button │  └────────┬───────┘
                    │   (DISABLED -      │           │
                    │    already saved)  │           │ User clicks "Save"
                    │                    │           │
                    └────────────────────┘           ▼
                                        ┌────────────────────────┐
                                        │ POST /api/extension/   │
                                        │ save-profile           │
                                        │                        │
                                        │ Body:                  │
                                        │ {                      │
                                        │   salesNavigatorUrl:   │
                                        │   "linkedin.com/sales/"│
                                        │   linkedinUrl:         │
                                        │   (optional),          │
                                        │   fullName: "...",     │
                                        │   title: "...",        │
                                        │   company: "...",      │
                                        │   email: "..."         │
                                        │ }                      │
                                        └────────────┬───────────┘
                                                     │
                                      ┌──────────────▼──────────┐
                                      │ Check if URL exists     │
                                      │ (by either URL type)    │
                                      └──────┬───────────┬──────┘
                                             │           │
                                  ┌──────────┘           │
                                  │ ALREADY EXISTS       │ NEW
                                  ▼                      ▼
                              ┌────────┐      ┌──────────────────┐
                              │ Error: │      │ Create Contact   │
                              │ Duplicate│     │ INSERT prospect  │
                              │ saved" │      │ with BOTH URLs:  │
                              └────────┘      │ - personLinkedIn │
                                             │ - salesNavigatorUrl
                                             │                  │
                                             │ Return:          │
                                             │ {                │
                                             │   success: true, │
                                             │   contact: {...} │
                                             │ }                │
                                             └──────────┬───────┘
                                                        │
                                                        ▼
                                              ┌──────────────────┐
                                              │ Show Success     │
                                              │ Message:         │
                                              │ "Contact saved   │
                                              │ to CRM!"         │
                                              │                  │
                                              │ Button: "✓ Saved"│
                                              └──────────────────┘
```

**Key Improvements (★):**
- Direct URL detection (no DOM scraping needed)
- Both URL types stored and displayed
- Flexible backend matching (OR logic)
- Badge shows "S" for Sales Navigator pages
- Faster, more reliable execution

---

## 3. Key Decision Points Comparison

| Scenario | Regular LinkedIn | Sales Navigator | Outcome |
|----------|------------------|-----------------|---------|
| **User Opens Profile** | linkedin.com/in/... | linkedin.com/sales/lead/... | Extension activates |
| **URL Detection** | Direct from page URL (/in/) | Direct from page URL (/sales/lead/) | Both use pattern matching |
| **URL Extraction Method** | Current tab URL | Current tab URL | No DOM scraping needed |
| **Visual Indicator** | Badge: "!" (blue) | Badge: "S" (amber) | User identifies page type |
| **Profile Lookup** | Uses LinkedIn URL | Uses Sales Navigator URL + optional LinkedIn URL | Flexible backend matching (OR logic) |
| **Database Search** | Query: personLinkedIn | Query: salesNavigatorUrl OR personLinkedIn | Unified method: findContactByLinkedInUrls() |
| **Found in CRM** | Shows contact + disabled button | Shows contact + disabled button | User can't save (already exists) |
| **Not in CRM** | Shows new contact + enabled button | Shows new contact + enabled button | User can save to CRM |
| **Save to CRM** | Stores: personLinkedIn | Stores: BOTH URLs (personLinkedIn + salesNavigatorUrl) | Dual URL tracking for future lookups |
| **Contact Display** | Shows LinkedIn URL link | Shows LinkedIn URL + Sales Nav URL (both clickable) | Complete URL references |

---

## 3.5 Chrome Extension Architecture Overview

### Core Components

```
┌─────────────────────────────────────────────────────────────┐
│              CHROME EXTENSION ARCHITECTURE                  │
└─────────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  manifest.json                                           │
│  ─────────────────────────────────────────────────────── │
│  - Manifest v3 (latest Chrome standard)                  │
│  - Permissions: storage, activeTab, scripting            │
│  - Host permissions: *.linkedin.com, *.replit.dev, etc.  │
│  - Background service worker: background.js             │
│  - Content scripts for LinkedIn & Dashboard              │
│  - Popup UI: popup.html, popup.js, popup.css             │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Content Script (content.js)                             │
│  ─────────────────────────────────────────────────────── │
│  Injected on all LinkedIn pages                          │
│  ✅ Detects profile type (/in/ vs /sales/lead/)          │
│  ✅ Extracts current tab URL                             │
│  ✅ Notifies background script of page type              │
│  ✅ Injects "Look Up" button on profiles                 │
│  ✅ Handles lookup button clicks                         │
│  ✅ Communicates with backend API                        │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Background Service Worker (background.js)               │
│  ─────────────────────────────────────────────────────── │
│  ✅ Manages auth token storage                           │
│  ✅ Updates extension badge based on page type           │
│  ✅ Handles message communication                        │
│  ✅ Coordinates between content and popup                │
│  ✅ Stores/retrieves authentication state                │
└──────────────────────────────────────────────────────────┘

┌──────────────────────────────────────────────────────────┐
│  Popup UI (popup.html + popup.js)                        │
│  ─────────────────────────────────────────────────────── │
│  ✅ Shows auth status                                    │
│  ✅ Displays profile info from current tab               │
│  ✅ Handles lookup/search operations                     │
│  ✅ Shows contact results (found/not found)              │
│  ✅ Displays both URL types for matched contacts         │
│  ✅ Save functionality with error handling               │
└──────────────────────────────────────────────────────────┘
```

### Message Flow Between Components

```
┌─────────────────┐
│  Content Script │ ──detects page type──> Background Script
│  (LinkedIn)     │                                │
└─────────────────┘                                │
                                                    ▼
                                        ┌─────────────────────┐
                                        │ Background Service  │
                                        │ - Updates badge     │
                                        │ - Stores page type  │
                                        │ - Manages auth      │
                                        └─────────┬───────────┘
                                                  │
                                    ┌─────────────┴──────────┐
                                    │                        │
                                    ▼                        ▼
                        ┌──────────────────┐    ┌──────────────────┐
                        │  Popup UI Opens  │    │ Content Script   │
                        │  Shows page info │    │ Injects button   │
                        │  Awaits user     │    │ Handles clicks   │
                        │  action          │    │ Makes API calls  │
                        └──────────────────┘    └──────────────────┘
```

### Data Flow: URL Detection to Backend

```
LinkedIn Page Load
        │
        ▼
Content Script Detects URL Pattern
        │
        ├─→ /in/ → LinkedIn Profile
        │        └─→ currentLinkedInUrl set
        │        └─→ LINKEDIN_PROFILE message to background
        │
        └─→ /sales/lead/ → Sales Navigator Lead
                 └─→ currentSalesNavigatorUrl set
                 └─→ SALES_NAV_DETECTED message to background
                                │
                                ▼
                    Background Script Updates Badge
                    ├─→ LinkedIn: "!" (blue)
                    └─→ Sales Nav: "S" (amber)
                                │
                                ▼
                    Popup Opened (User clicks extension)
                                │
                                ▼
                    Auto-Lookup or Manual Click
                                │
                                ▼
        Send lookup request to backend
        {
          "linkedinUrl": "optional",
          "salesNavigatorUrl": "optional"
        }
                                │
                                ▼
        Backend searches using findContactByLinkedInUrls()
        (OR logic - matches either URL type)
                                │
                    ┌───────────┴──────────┐
                    │                      │
                    ▼                      ▼
            Contact Found          Contact Not Found
                    │                      │
                    ▼                      ▼
            Display Card          Display Form
            - Both URLs          with both URLs
            - Full info          - Save button
            - Disabled save      - Save prompts
                                  for both URLs
```

---

## 4. Error Handling Paths

### LinkedIn Profile Errors

```
User Opens LinkedIn Profile
         │
         ├─→ NO TOKEN
         │   └─→ Show "Sign in to use" CTA
         │       └─→ Redirect to /extension-auth
         │
         ├─→ LOOKUP FAILED (Network Error)
         │   └─→ Show: "Failed to look up profile"
         │       └─→ Button resets, user can retry
         │
         └─→ DAILY LIMIT EXCEEDED
             └─→ Show: "Lookup limit reached"
                 └─→ Button resets, user can't lookup until next day
```

### Sales Navigator Errors

```
User Opens Sales Navigator Profile
         │
         ├─→ INVALID SALES NAV URL
         │   └─→ Show: "Not a valid Sales Navigator lead URL"
         │       └─→ Message: "Visit a /sales/lead/ page"
         │
         ├─→ NO TOKEN
         │   └─→ Show "Sign in to use" CTA
         │       └─→ Redirect to /extension-auth
         │
         ├─→ LOOKUP FAILED (Network)
         │   └─→ Show: "Failed to look up profile"
         │       └─→ Button resets, user can retry
         │
         ├─→ DAILY LIMIT EXCEEDED
         │   └─→ Show: "Lookup limit reached"
         │       └─→ Try again tomorrow
         │
         └─→ SAVE FAILED (Duplicate)
             └─→ Show: "This profile is already saved"
                 └─→ Display existing contact instead
```

---

## 5. Dual URL Lookup System (NEW)

### How the Backend Handles Multiple URL Types

```
API Request: POST /api/extension/lookup
Body: {
  "linkedinUrl": "https://www.linkedin.com/in/john-doe/",
  "salesNavigatorUrl": "https://www.linkedin.com/sales/lead/123456789/"
}

        │
        ▼
┌──────────────────────────────────────┐
│ Input Validation                     │
│ ✅ At least one URL required         │
│ ✅ URLs must be valid format         │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Query Database                       │
│ Method: findContactByLinkedInUrls()  │
│ ────────────────────────────────────│
│ SELECT * FROM contacts               │
│ WHERE (                              │
│   personLinkedIn = $1                │
│   OR salesNavigatorUrl = $2          │
│ )                                    │
│ AND isDeleted = false                │
│ LIMIT 1                              │
└────────────┬─────────────────────────┘
             │
       ┌─────┴──────┐
       │             │
       ▼             ▼
   FOUND         NOT FOUND
       │             │
       ├─→ Return contact with both URLs
       │   - personLinkedIn (if exists)
       │   - salesNavigatorUrl (if exists)
       │
       └─→ Return { found: false }


API Request: POST /api/extension/save-profile
Body: {
  "linkedinUrl": "https://www.linkedin.com/in/john-doe/",
  "salesNavigatorUrl": "https://www.linkedin.com/sales/lead/123456789/",
  "fullName": "John Doe",
  "title": "Sales Manager",
  "company": "Acme Corp"
}

        │
        ▼
┌──────────────────────────────────────┐
│ Validation                           │
│ ✅ fullName required                 │
│ ✅ At least one URL required         │
│ ✅ Check for duplicates by either URL│
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Check Existing (Duplicate Prevention)│
│ Method: findContactByLinkedInUrls()  │
│ ────────────────────────────────────│
│ If existing contact found:           │
│ └─→ Return 409 (Duplicate)           │
│                                      │
│ If no existing contact:              │
│ └─→ Continue to create               │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Create Contact with BOTH URLs        │
│ INSERT INTO contacts (                │
│   firstName, lastName,                │
│   personLinkedIn,     ← Store LinkedIn│
│   salesNavigatorUrl,  ← Store SalesNav
│   title, company,                    │
│   ...                                │
│ )                                    │
└────────────┬─────────────────────────┘
             │
             ▼
┌──────────────────────────────────────┐
│ Return Success Response              │
│ {                                    │
│   "success": true,                   │
│   "contact": {                       │
│     "id": "...",                     │
│     "fullName": "John Doe",          │
│     "personLinkedIn": "...",         │
│     "salesNavigatorUrl": "..."       │
│   }                                  │
│ }                                    │
└──────────────────────────────────────┘
```

---

## 6. Backend Processing Flow

```
┌─────────────────────────────────────┐
│ Extension API Request Received       │
│ POST /api/extension/lookup           │
│ POST /api/extension/save-profile     │
└────────────┬────────────────────────┘
             │
             ▼
┌─────────────────────────────────────┐
│ 1. VALIDATE SESSION                 │
│    - Check Bearer token             │
│    - Verify token not expired       │
│    - Get user from session          │
└────────────┬────────────────────────┘
             │
       ┌─────┴─────┐
       │ INVALID   │ VALID
       ▼           ▼
  ┌────────┐   ┌──────────────────────────┐
  │Return  │   │ 2. CHECK USAGE LIMITS    │
  │401     │   │    - Get user plan      │
  │Error   │   │    - Check daily quota   │
  └────────┘   │    - Increment counter  │
               └────────┬─────────────────┘
                        │
                  ┌─────┴──────┐
                  │ EXCEEDED   │ OK
                  ▼            ▼
              ┌────────┐   ┌──────────────┐
              │Return  │   │ 3. LOOKUP    │
              │403     │   │ Search DB    │
              │Error   │   │ by URL       │
              └────────┘   └──────┬───────┘
                                  │
                          ┌───────┴────────┐
                          │ FOUND      NOT FOUND
                          ▼                ▼
                     ┌────────┐      ┌──────────┐
                     │Return  │      │Return    │
                     │Contact │      │Success   │
                     │Info    │      │but false │
                     └────────┘      └──────────┘
```

---

## 6. State Machine: Extension UI States

```
                    ┌──────────────────┐
                    │  INITIAL STATE   │
                    │  Not Signed In   │
                    └────────┬─────────┘
                             │
            ┌────────────────┼────────────────┐
            │                │                │
            ▼                ▼                ▼
    ┌───────────────┐  ┌──────────────┐  ┌────────────┐
    │ ON DASHBOARD  │  │ ON LINKEDIN  │  │ ON SALES   │
    │              │  │ (No auth)    │  │ NAV        │
    │ User signs   │  │              │  │ (No auth)  │
    │ in          │  │ Show:        │  │            │
    │              │  │ "Sign in..."  │  │ Show:      │
    │ Token stored │  │              │  │ "Sign in..."│
    │ in dashboard │  │              │  │            │
    └───────┬──────┘  └──────────────┘  └────────────┘
            │
            │ (Dashboard syncs token to extension)
            │
            ▼
    ┌──────────────────────────────────┐
    │  SIGNED IN STATE                 │
    │  (Token in chrome.storage.local) │
    └────────┬───────────────┬─────────┘
             │               │
    ┌────────▼──────┐  ┌─────▼──────────┐
    │ ON DASHBOARD  │  │ ON LINKEDIN    │
    │              │  │ PAGE           │
    │ User checks  │  │                │
    │ status       │  │ Show:          │
    │              │  │ "Look Up" btn  │
    │ Usage card   │  │ + Profile card │
    │ Search       │  │ (if found)     │
    │              │  │                │
    │ Can logout   │  │                │
    └──────────────┘  │                │
                      │                │
                      ├────────┬───────┤
                      │        │       │
            ┌─────────▼┐  ┌───▼────┐  │
            │ LOADING  │  │ FOUND  │  │
            │ STATE    │  │        │  │
            │          │  │ Show:  │  │
            │ Looking  │  │ Contact│  │
            │ up...    │  │ Card   │  │
            │          │  │ Btn:   │  │
            │          │  │Disabled│  │
            └────┬─────┘  │        │  │
                 │        └───┬────┘  │
            ┌────┴────┐       │       │
            │         │       │       │
    ┌───────▼─┐  ┌────▼────┐  │  ┌────▼──┐
    │ ERROR   │  │ NOT     │  │  │PROFILE│
    │ STATE   │  │ FOUND   │  │  │LINKED │
    │         │  │         │  │  │TO SALE│
    │Show:    │  │ Show:   │  │  │S NAV  │
    │Error msg│  │ New     │  │  │       │
    │Retry btn│  │ Contact │  │  │Same as│
    │         │  │ Card    │  │  │FOUND  │
    │         │  │ Btn:    │  │  │but    │
    │         │  │Enabled  │  │  │with   │
    │         │  │         │  │  │badge  │
    └─────────┘  └─────────┘  │  └───────┘
                               │
                ┌──────────────┘
                │
        ┌───────▼────────┐
        │ SAVED STATE    │
        │ (Profile saved)│
        │                │
        │ Show:          │
        │ Success msg    │
        │ "✓ Saved"      │
        └────────────────┘
```

---

## 7. Summary: LinkedIn vs Sales Navigator

### Regular LinkedIn Profile (linkedin.com/in/...)
- **URL Source**: Direct from browser address bar
- **Profile Name**: Extracted from URL slug
- **Public Indicator**: None needed
- **Save Behavior**: 
  - If found → Show with disabled save button
  - If not found → Show with enabled save button

### Sales Navigator (salesnavigator.linkedin.com/...)
- **URL Source**: Extracted from DOM (not browser address bar)
- **Profile Name**: Extracted from Sales Navigator page content
- **Public Indicator**: "Sales Navigator" badge displayed
- **Save Behavior**: 
  - If found → Show with disabled save button (same as LinkedIn)
  - If not found → Show with enabled save button (same as LinkedIn)

**Key Difference**: Sales Navigator requires finding and extracting the public LinkedIn profile URL from the page DOM, while regular LinkedIn profiles use the URL directly.
