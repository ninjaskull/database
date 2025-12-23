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

## 2. Sales Navigator URL Flow

### User Journey: Opening a Sales Navigator Profile (salesnavigator.linkedin.com/...)

```
┌──────────────────────────────────────────────────────────────┐
│    USER OPENS SALES NAVIGATOR PROFILE PAGE                   │
│    (e.g., salesnavigator.linkedin.com/profile/...)          │
└─────────────────────────┬──────────────────────────────────┘
                          │
                          ▼
        ┌──────────────────────────────────────────┐
        │ Extension Content Script Activates       │
        │ - Detects Sales Navigator URL            │
        │ - Checks for public LinkedIn profile     │
        │   link (may be hidden/not visible)       │
        │ - Checks for auth token                  │
        └───────────────┬──────────────────────────┘
                        │
                        ▼
        ┌──────────────────────────────────┐
        │ Is Public LinkedIn URL Found?    │
        │ (Extracted from page DOM)        │
        └────┬──────────────────────────┬──┘
             │ NO                       │ YES
             │                          │
             ▼                          ▼
    ┌──────────────────────┐  ┌──────────────────────┐
    │ Show Warning         │  │ Proceed with        │
    │ "Waiting for page... │  │ LinkedIn URL        │
    │ Could not find       │  │ (same as regular    │
    │ public profile"      │  │ profile flow)       │
    │                      │  │                     │
    │ [Continue to button] │  │ Display Sales Nav   │
    │ or [Retry]           │  │ Indicator           │
    └──────────────────────┘  │ "Sales Navigator"   │
                              │                     │
                              │ Button:             │
                              │ "Look Up"           │
                              └──────────┬──────────┘
                                         │
                                         │ User clicks "Look Up"
                                         ▼
                        ┌──────────────────────────────┐
                        │ Extract Public LinkedIn URL  │
                        │ from Sales Navigator DOM     │
                        └────────────┬─────────────────┘
                                     │
                                     ▼
                        ┌──────────────────────────────┐
                        │ Send Lookup Request          │
                        │ POST /api/extension/lookup   │
                        │ - Extracted LinkedIn URL     │
                        │   (from Sales Nav page)      │
                        │ - Authorization token       │
                        └───────────┬──────────────────┘
                                    │
                     ┌──────────────┴──────────────┐
                     │ Check Usage Limits          │
                     │ (Plan-based daily lookups)  │
                     └──────┬────────────┬─────────┘
                            │            │
               ┌────────────┘            └──────────────┐
               │ LIMIT EXCEEDED                        │ WITHIN LIMIT
               ▼                                       ▼
       ┌───────────────┐            ┌──────────────────────────┐
       │ Return 403    │            │ Search Database by       │
       │ Error         │            │ Public LinkedIn URL      │
       │ "Limit reached"           │ Query: findContactBy     │
       └───────────────┘            │ LinkedInUrl()            │
                                    └──────────┬───────────────┘
                                              │
                                ┌─────────────┴──────────────┐
                                │ PROFILE FOUND?             │
                                └──────┬─────────────────┬───┘
                                 YES   │                 │   NO
                                       │                 │
                                       ▼                 ▼
                        ┌──────────────────────┐  ┌──────────────────┐
                        │ SALES NAV CARD:      │  │ SALES NAV CARD:  │
                        │ (with indicator tag) │  │ NOT FOUND        │
                        │                      │  │ (with indicator) │
                        │ - Full Name          │  │                  │
                        │ - Title @ Company    │  │ - Extracted Name │
                        │ - Email              │  │ - Sales Nav tag  │
                        │ - Phone              │  │ - LinkedIn URL   │
                        │ - Location           │  │   (public link)  │
                        │ - Lead Score         │  │                  │
                        │ - LinkedIn URL       │  │ Action Button:   │
                        │ - SALES NAV BADGE    │  │ "Sync CRM"       │
                        │                      │  │ (ENABLED)        │
                        │ Action Buttons:      │  │                  │
                        │ - Email              │  │ "Save to CRM"    │
                        │ - "Sync CRM"         │  │ message          │
                        │   (DISABLED)         │  │                  │
                        │   Tooltip:           │  └──────────┬───────┘
                        │   "Profile already   │             │
                        │    in CRM"           │             │
                        └──────────────────────┘             │
                                                            │ User clicks "Sync CRM"
                                                            ▼
                                              ┌──────────────────────┐
                                              │ POST /api/extension/ │
                                              │ save-profile         │
                                              │                      │
                                              │ Body:                │
                                              │ {                    │
                                              │   linkedinUrl:       │
                                              │   (public URL),       │
                                              │   fullName: "...",    │
                                              │   title: "...",       │
                                              │   company: "...",     │
                                              │   email: "..."        │
                                              │ }                     │
                                              └──────────┬───────────┘
                                                         │
                                           ┌─────────────▼──────────┐
                                           │ Create Contact in DB   │
                                           │ INSERT prospect        │
                                           │ with LinkedIn URL      │
                                           │ from Sales Navigator   │
                                           └──────────┬──────────────┘
                                                      │
                                                      ▼
                                            ┌──────────────────────┐
                                            │ Show Success Message │
                                            │ "Contact saved       │
                                            │ to CRM!"             │
                                            │                      │
                                            │ Button: "✓ Saved"    │
                                            └──────────────────────┘
```

---

## 3. Key Decision Points Comparison

| Scenario | Regular LinkedIn | Sales Navigator | Outcome |
|----------|------------------|-----------------|---------|
| **User Opens Profile** | linkedin.com/in/... | salesnavigator.linkedin.com/... | Extension activates |
| **URL Extraction** | Direct from page URL | Must find public LinkedIn link from DOM | Different extraction method |
| **Visual Indicator** | None | "Sales Navigator" badge shown | Helps user identify source |
| **Profile Lookup** | Uses direct LinkedIn URL | Uses extracted public LinkedIn URL | Same lookup endpoint, different URL source |
| **Found in CRM** | Shows contact + disabled button | Shows contact + disabled button | User can't save (already exists) |
| **Not in CRM** | Shows new contact + enabled button | Shows new contact + enabled button | User can save to CRM |
| **Save to CRM** | Stores LinkedIn URL | Stores public LinkedIn URL | Both save successfully |

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
         ├─→ PUBLIC LINKEDIN URL NOT FOUND
         │   └─→ Show: "Could not find public profile"
         │       └─→ Message: "Please wait for page to load"
         │       └─→ Suggest retry or manual lookup
         │
         ├─→ NO TOKEN
         │   └─→ Show "Sign in to use" CTA
         │
         ├─→ LOOKUP FAILED
         │   └─→ Show: "Failed to look up profile"
         │
         └─→ DAILY LIMIT EXCEEDED
             └─→ Show: "Lookup limit reached"
```

---

## 5. Backend Processing Flow

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
