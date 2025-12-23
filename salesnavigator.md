# Sales Navigator URL Resolution Implementation Plan

## Overview
This document outlines all tasks required to implement the new Sales Navigator profile resolution workflow. The system will:
1. Intercept Sales Navigator URLs (https://www.linkedin.com/sales/lead/{LEAD_ID})
2. Resolve them to canonical LinkedIn profile URLs via background tab redirection
3. Search the database with the resolved LinkedIn profile URL
4. Display existing contact or save new contact with both URLs

---

## Phase 1: Database Schema Updates

### Task 1.1: Review Current Contact Schema
- **File**: `shared/schema.ts` (contacts table)
- **Action**: Examine existing LinkedIn-related columns
  - Check for `personLinkedIn` field
  - Check for any existing `salesNavigatorUrl` field
  - Verify data types and constraints
- **Outcome**: Understand current structure before adding new fields

### Task 1.2: Add Sales Navigator URL Field to Contacts Schema
- **File**: `shared/schema.ts`
- **Action**: Add new column to contacts table
  ```typescript
  salesNavigatorUrl: text("sales_navigator_url"),
  ```
- **Details**:
  - Add after `personLinkedIn` field for logical grouping
  - Make it nullable (some contacts may not have Sales Navigator link)
  - Do NOT add unique constraint (multiple contacts could share)
  - Do NOT add index yet (can optimize later)
- **Outcome**: Schema updated to support storing both LinkedIn URLs

### Task 1.3: Add Sales Navigator URL Field to Insert Schema
- **File**: `shared/schema.ts`
- **Action**: Update Zod insert schema for contacts
  - Use `createInsertSchema` from `drizzle-zod`
  - Include the new `salesNavigatorUrl` field in the insert type
- **Outcome**: Type safety for insert operations with new field

### Task 1.4: Run Database Migration
- **Command**: `npm run db:push`
- **Fallback**: If migration fails, use `npm run db:push --force`
- **Outcome**: New column exists in PostgreSQL database

---

## Phase 2: Storage Layer Updates

### Task 2.1: Add New Query Method to IStorage Interface
- **File**: `server/storage.ts` (IStorage interface)
- **Action**: Add method to search by Sales Navigator URL
  ```typescript
  findContactBySalesNavigatorUrl(salesNavigatorUrl: string): Promise<Contact | undefined>;
  ```
- **Outcome**: Interface defines new storage capability

### Task 2.2: Add New Query Method to IStorage Interface (Part 2)
- **File**: `server/storage.ts` (IStorage interface)
- **Action**: Add method to search by either LinkedIn or Sales Navigator URL
  ```typescript
  findContactByLinkedInUrls(linkedinUrl?: string, salesNavigatorUrl?: string): Promise<Contact | undefined>;
  ```
- **Details**: This method will:
  - Accept either or both URLs
  - Search for matches with either URL
  - Return first match or undefined
- **Outcome**: Interface supports flexible LinkedIn URL matching

### Task 2.3: Implement findContactBySalesNavigatorUrl in DatabaseStorage
- **File**: `server/storage.ts` (DatabaseStorage class)
- **Action**: Implement the new method
  ```typescript
  async findContactBySalesNavigatorUrl(salesNavigatorUrl: string): Promise<Contact | undefined> {
    const [contact] = await db
      .select()
      .from(contacts)
      .where(and(
        eq(contacts.salesNavigatorUrl, salesNavigatorUrl),
        eq(contacts.isDeleted, false)
      ))
      .limit(1);
    return contact || undefined;
  }
  ```
- **Outcome**: Can query contacts by Sales Navigator URL

### Task 2.4: Implement findContactByLinkedInUrls in DatabaseStorage
- **File**: `server/storage.ts` (DatabaseStorage class)
- **Action**: Implement flexible URL matching
  ```typescript
  async findContactByLinkedInUrls(
    linkedinUrl?: string,
    salesNavigatorUrl?: string
  ): Promise<Contact | undefined> {
    const conditions = [eq(contacts.isDeleted, false)];
    
    if (linkedinUrl) {
      conditions.push(eq(contacts.personLinkedIn, linkedinUrl));
    }
    
    if (salesNavigatorUrl) {
      conditions.push(eq(contacts.salesNavigatorUrl, salesNavigatorUrl));
    }
    
    const [contact] = await db
      .select()
      .from(contacts)
      .where(or(...conditions))
      .limit(1);
    
    return contact || undefined;
  }
  ```
- **Details**: Uses OR logic to find by either URL
- **Outcome**: Flexible contact lookup

### Task 2.5: Update createContact Method to Handle Sales Navigator URL
- **File**: `server/storage.ts` (DatabaseStorage class)
- **Action**: Ensure createContact saves salesNavigatorUrl when provided
  - Should already work if field is in InsertContact type
  - Verify insert operation includes the new field
- **Outcome**: Creating contacts with Sales Navigator URL works

### Task 2.6: Update updateContact Method to Handle Sales Navigator URL
- **File**: `server/storage.ts` (DatabaseStorage class)
- **Action**: Ensure updateContact can modify salesNavigatorUrl
  - Should work automatically via Partial<InsertContact>
  - Test with updates including salesNavigatorUrl
- **Outcome**: Updating contacts with Sales Navigator URL works

---

## Phase 3: Backend API Endpoint Updates

### Task 3.1: Review Current `/api/extension/lookup` Endpoint
- **File**: `server/routes.ts` (or appropriate route file)
- **Action**: Understand current lookup logic
  - Current: Accepts `linkedinUrl` parameter
  - Current: Searches database by LinkedIn URL
  - Current: Returns 404 or contact data
- **Outcome**: Understand baseline implementation

### Task 3.2: Update `/api/extension/lookup` Endpoint
- **File**: `server/routes.ts`
- **Action**: Enhance to accept both URL types
  - Accept optional `linkedinUrl` query parameter (existing)
  - Accept optional `salesNavigatorUrl` query parameter (new)
  - At least one must be provided
  - Search using new `findContactByLinkedInUrls` method
  ```typescript
  app.post('/api/extension/lookup', async (req, res) => {
    const { linkedinUrl, salesNavigatorUrl } = req.body;
    
    if (!linkedinUrl && !salesNavigatorUrl) {
      return res.status(400).json({ error: 'At least one URL required' });
    }
    
    // ... usage limit checks ...
    
    const contact = await storage.findContactByLinkedInUrls(
      linkedinUrl,
      salesNavigatorUrl
    );
    
    // ... return response ...
  });
  ```
- **Outcome**: Endpoint can now search by either LinkedIn URL type

### Task 3.3: Review Current `/api/extension/save-profile` Endpoint
- **File**: `server/routes.ts`
- **Action**: Understand current save logic
  - Current: Accepts profile data including `linkedinUrl`
  - Current: Prevents duplicates
  - Current: Creates new contact if not found
- **Outcome**: Understand baseline

### Task 3.4: Update `/api/extension/save-profile` Endpoint
- **File**: `server/routes.ts`
- **Action**: Enhance to accept and save both URL types
  - Accept new optional `salesNavigatorUrl` field in request body
  - When saving contact, include both URLs
  ```typescript
  app.post('/api/extension/save-profile', async (req, res) => {
    const { 
      linkedinUrl, 
      salesNavigatorUrl,
      fullName,
      title,
      company,
      email 
    } = req.body;
    
    // Check if already exists (by either URL)
    const existing = await storage.findContactByLinkedInUrls(
      linkedinUrl,
      salesNavigatorUrl
    );
    
    if (existing) {
      return res.status(409).json({ error: 'Contact already exists' });
    }
    
    // Create new contact with both URLs
    const contact = await storage.createContact({
      fullName,
      title,
      company,
      email,
      personLinkedIn: linkedinUrl,
      salesNavigatorUrl: salesNavigatorUrl,
      // ... other fields ...
    });
    
    return res.json({ success: true, contact });
  });
  ```
- **Outcome**: Endpoint can save both URLs

---

## Phase 4: Chrome Extension - Content Script Updates

### Task 4.1: Review Current Content Script
- **File**: `chrome-extension/content.js` (or similar)
- **Action**: Understand current flow
  - How it detects LinkedIn vs Sales Navigator URLs
  - How it extracts profile information
  - How it communicates with background script
  - Current DOM extraction logic for Sales Navigator
- **Outcome**: Understand current implementation

### Task 4.2: Update URL Detection in Content Script
- **File**: `chrome-extension/content.js`
- **Action**: Enhance Sales Navigator URL detection
  - Detect pattern: `https://www.linkedin.com/sales/lead/{LEAD_ID}`
  - Extract LEAD_ID using regex
  - Store for later background script communication
  ```javascript
  const salesNavLeadMatch = window.location.href.match(
    /https:\/\/www\.linkedin\.com\/sales\/lead\/(\d+)/
  );
  
  if (salesNavLeadMatch) {
    const leadId = salesNavLeadMatch[1];
    // Send to background script for processing
  }
  ```
- **Outcome**: Can detect and extract Sales Navigator lead IDs

### Task 4.3: Remove Existing DOM Extraction Logic
- **File**: `chrome-extension/content.js`
- **Action**: Remove or disable
  - Current code that tries to extract public LinkedIn URL from Sales Navigator DOM
  - Comments mentioning "Extract Public LinkedIn URL from Sales Navigator DOM"
  - Any DOM selectors targeting Sales Navigator page elements for URL extraction
- **Details**: This logic is being replaced by background tab redirection
- **Outcome**: Clean up old implementation

### Task 4.4: Communicate Lead ID to Background Script
- **File**: `chrome-extension/content.js`
- **Action**: Send detected Sales Navigator lead ID to background script
  ```javascript
  if (salesNavLeadMatch) {
    const leadId = salesNavLeadMatch[1];
    chrome.runtime.sendMessage({
      type: 'RESOLVE_SALES_NAV_LEAD',
      leadId: leadId,
      salesNavigatorUrl: window.location.href
    });
  }
  ```
- **Outcome**: Content script communicates Sales Navigator URLs to background

### Task 4.5: Update UI Display Logic
- **File**: `chrome-extension/content.js` or `chrome-extension/popup.js`
- **Action**: Update UI to reflect new workflow
  - When Sales Navigator URL detected, show: "Resolving LinkedIn profile..."
  - While background script resolves URL, show loading state
  - After resolution, proceed with normal lookup flow
- **Outcome**: User sees appropriate status messages

---

## Phase 5: Chrome Extension - Background Script Updates

### Task 5.1: Review Current Background Script
- **File**: `chrome-extension/background.js` or service worker
- **Action**: Understand current message handling
  - How it receives requests from content script
  - How it communicates with backend
  - Current session management
- **Outcome**: Understand baseline

### Task 5.2: Add Handler for RESOLVE_SALES_NAV_LEAD Message
- **File**: `chrome-extension/background.js`
- **Action**: Add new message handler
  ```javascript
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'RESOLVE_SALES_NAV_LEAD') {
      resolveSalesNavLeadToLinkedIn(
        request.leadId,
        request.salesNavigatorUrl,
        sendResponse
      );
      return true; // Keep channel open for async response
    }
  });
  ```
- **Outcome**: Background script can handle Sales Navigator lead resolution

### Task 5.3: Implement resolveSalesNavLeadToLinkedIn Function
- **File**: `chrome-extension/background.js`
- **Action**: Implement the core resolution logic
  ```javascript
  async function resolveSalesNavLeadToLinkedIn(
    leadId,
    salesNavigatorUrl,
    sendResponse
  ) {
    try {
      // Step 1: Construct standard LinkedIn profile URL
      const linkedinUrl = `https://www.linkedin.com/in/${leadId}`;
      
      // Step 2: Open in background tab
      chrome.tabs.create({ 
        url: linkedinUrl, 
        active: false // Silent background tab
      }, async (tab) => {
        // Step 3: Wait for page load and capture redirects
        const resolvedUrl = await waitForLinkedInRedirect(tab.id);
        
        // Step 4: Close background tab
        chrome.tabs.remove(tab.id);
        
        // Step 5: Send resolved URL back to content script
        sendResponse({
          success: true,
          linkedinUrl: resolvedUrl,
          salesNavigatorUrl: salesNavigatorUrl
        });
      });
    } catch (error) {
      sendResponse({
        success: false,
        error: error.message
      });
    }
  }
  ```
- **Details**:
  - Uses leadId to construct standard profile URL
  - Opens tab in background (not active)
  - Reuses current session cookies (automatic via chrome.tabs.create)
  - Waits for LinkedIn redirect to resolve actual profile
- **Outcome**: Can resolve Sales Navigator URL to LinkedIn profile

### Task 5.4: Implement waitForLinkedInRedirect Function
- **File**: `chrome-extension/background.js`
- **Action**: Implement redirect capture logic
  ```javascript
  function waitForLinkedInRedirect(tabId) {
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => {
        reject(new Error('Redirect timeout'));
      }, 10000); // 10 second timeout
      
      // Listen for tab updates
      function onTabUpdated(updatedTabId, changeInfo, tab) {
        if (updatedTabId === tabId && changeInfo.status === 'complete') {
          clearTimeout(timeout);
          chrome.tabs.onUpdated.removeListener(onTabUpdated);
          
          // Extract final URL from tab
          const finalUrl = tab.url;
          
          // Verify it's a LinkedIn profile URL
          if (finalUrl.includes('linkedin.com/in/')) {
            resolve(finalUrl);
          } else {
            reject(new Error('Invalid redirect target'));
          }
        }
      }
      
      chrome.tabs.onUpdated.addListener(onTabUpdated);
    });
  }
  ```
- **Details**:
  - Monitors tab URL changes
  - Captures final resolved URL
  - 10-second timeout to prevent hanging
  - Validates result is a LinkedIn profile
- **Outcome**: Can capture final LinkedIn profile URL

### Task 5.5: Handle Resolution Failures
- **File**: `chrome-extension/background.js`
- **Action**: Add error handling
  - If redirect times out: return error state
  - If redirect leads to non-profile page: return error state
  - Log errors for debugging
  ```javascript
  // In resolveSalesNavLeadToLinkedIn
  try {
    // ... resolution logic ...
  } catch (error) {
    console.error('Sales Navigator resolution failed:', error);
    sendResponse({
      success: false,
      error: 'Could not resolve LinkedIn profile',
      originalSalesNavUrl: salesNavigatorUrl
    });
  }
  ```
- **Outcome**: Graceful error handling

### Task 5.6: Update Session Cookie Management
- **File**: `chrome-extension/background.js`
- **Action**: Verify authentication cookie handling
  - Confirm that background tabs inherit session cookies from current context
  - No special configuration needed (should be automatic)
  - Document assumption about session reuse
- **Outcome**: Background tabs can access authenticated LinkedIn

---

## Phase 6: Chrome Extension - Popup/UI Updates

### Task 6.1: Review Current Popup UI
- **File**: `chrome-extension/popup.html` and `chrome-extension/popup.js`
- **Action**: Understand current UI flow
  - How "Look Up" button works
  - How results are displayed
  - How "Sync CRM" button works
- **Outcome**: Understand UI structure

### Task 6.2: Add Loading State for Sales Navigator Resolution
- **File**: `chrome-extension/popup.js`
- **Action**: Add UI state for URL resolution
  ```javascript
  // When Sales Navigator URL detected
  showResolving: function() {
    popupUI.innerHTML = `
      <div class="resolving-state">
        <div class="spinner"></div>
        <p>Resolving LinkedIn profile...</p>
        <p class="subtitle">This may take a few seconds</p>
      </div>
    `;
  }
  ```
- **Outcome**: User sees appropriate status while URL resolves

### Task 6.3: Handle Resolution Success in Popup
- **File**: `chrome-extension/popup.js`
- **Action**: Handle resolved LinkedIn URL
  ```javascript
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'SALES_NAV_RESOLVED') {
      const { linkedinUrl, salesNavigatorUrl } = request;
      
      // Now perform normal lookup with resolved URL
      performLookup({
        linkedinUrl: linkedinUrl,
        salesNavigatorUrl: salesNavigatorUrl
      });
    }
  });
  ```
- **Outcome**: Popup automatically proceeds with lookup after resolution

### Task 6.4: Update Contact Card Display
- **File**: `chrome-extension/popup.html` and popup display logic
- **Action**: Update display to show both URLs when available
  - Display regular LinkedIn URL if present
  - Display Sales Navigator URL if present
  - Show source indicator (e.g., "From Sales Navigator")
- **Details**:
  ```html
  <div class="linkedin-urls">
    <a href="{linkedinUrl}" class="linkedin-link">
      LinkedIn Profile
    </a>
    {if salesNavigatorUrl}
    <a href="{salesNavigatorUrl}" class="sales-nav-link">
      Sales Navigator
    </a>
    {/if}
  </div>
  ```
- **Outcome**: Both URLs visible in contact card

### Task 6.5: Update Save Logic in Popup
- **File**: `chrome-extension/popup.js`
- **Action**: Ensure save operation sends both URLs
  ```javascript
  async function saveToDatabase(contactData) {
    const payload = {
      linkedinUrl: contactData.linkedinUrl,
      salesNavigatorUrl: contactData.salesNavigatorUrl,
      fullName: contactData.fullName,
      title: contactData.title,
      company: contactData.company,
      email: contactData.email
    };
    
    const response = await fetch('/api/extension/save-profile', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify(payload)
    });
    
    return response.json();
  }
  ```
- **Outcome**: Both URLs saved when creating contact

---

## Phase 7: Integration & Workflow Updates

### Task 7.1: Update Lookup Request
- **File**: `chrome-extension/popup.js`
- **Action**: Modify lookup to send both URLs when available
  ```javascript
  async function performLookup(urlData) {
    const response = await fetch('/api/extension/lookup', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        linkedinUrl: urlData.linkedinUrl,
        salesNavigatorUrl: urlData.salesNavigatorUrl
      })
    });
    
    const result = await response.json();
    displayResult(result);
  }
  ```
- **Outcome**: Lookup uses both URLs for flexible matching

### Task 7.2: Update Display Logic for Found vs Not Found
- **File**: `chrome-extension/popup.js`
- **Action**: Update what happens based on lookup result
  - If found: Show existing contact info + disabled sync button
  - If not found: Show new contact form + enabled save button
  - In both cases, display both URLs
- **Outcome**: Correct UI state after lookup

### Task 7.3: Verify Manifest Permissions
- **File**: `chrome-extension/manifest.json`
- **Action**: Ensure manifest has required permissions
  - `"tabs"` - to create background tabs
  - `"storage"` - for auth token storage
  - `"activeTab"` - for current tab
  - Access to `*.linkedin.com`
  - Access to `/api/extension/*`
- **Outcome**: Extension has proper permissions

### Task 7.4: Test Sales Navigator Resolution Flow
- **Action**: Manual testing checklist
  1. Open Sales Navigator profile page
  2. Wait for extension to load
  3. Verify popup shows "Resolving LinkedIn profile..."
  4. Wait for resolution to complete
  5. Verify final LinkedIn URL is captured
  6. Verify lookup finds or creates contact correctly
  7. Verify both URLs are stored/displayed
- **Outcome**: End-to-end flow works

---

## Phase 8: Testing & Validation

### Task 8.1: Unit Test Database Methods
- **Action**: Test new storage methods
  - `findContactBySalesNavigatorUrl()` returns correct contact
  - `findContactByLinkedInUrls()` finds by either URL
  - Returns undefined for non-existent URLs
- **Outcome**: Storage layer works correctly

### Task 8.2: Integration Test API Endpoints
- **Action**: Test backend endpoints
  - `/api/extension/lookup` with only LinkedIn URL
  - `/api/extension/lookup` with only Sales Navigator URL
  - `/api/extension/lookup` with both URLs
  - `/api/extension/save-profile` saves both URLs
- **Outcome**: API endpoints work correctly

### Task 8.3: End-to-End Chrome Extension Testing
- **Action**: Test complete flow
  - Regular LinkedIn profile: existing lookup still works
  - Sales Navigator profile: resolves to LinkedIn profile
  - Sales Navigator -> lookup -> found: shows contact
  - Sales Navigator -> lookup -> not found: saves contact with both URLs
  - No infinite redirects or browser crashes
- **Outcome**: Extension works for all scenarios

### Task 8.4: Session Persistence Testing
- **Action**: Verify session handling
  - Background tabs use same session as main browser
  - No new login required in background tabs
  - Authenticated requests work from resolved URLs
- **Outcome**: Session cookies properly reused

### Task 8.5: Error Scenario Testing
- **Action**: Test error cases
  - Sales Navigator URL with invalid lead ID: graceful failure
  - LinkedIn profile redirect timeout: show error
  - Network errors during resolution: retry or show error
  - Duplicate contact on save: show appropriate message
- **Outcome**: All error paths handled

### Task 8.6: Performance Testing
- **Action**: Monitor performance impact
  - Background tab resolution time (target: <10 seconds)
  - UI responsiveness while resolving
  - Memory usage with multiple background tabs
  - No memory leaks after multiple resolutions
- **Outcome**: Performance acceptable

---

## Phase 9: Cleanup & Documentation

### Task 9.1: Remove Deprecated Code
- **File**: `chrome-extension/content.js`
- **Action**: Clean up any commented code or old logic
  - Remove old DOM extraction code
  - Remove backup fallback logic
  - Remove debugging statements
- **Outcome**: Clean codebase

### Task 9.2: Update Extension Documentation
- **File**: `CHROME_EXTENSION_DOCUMENTATION.md`
- **Action**: Update documentation with new flow
  - Describe Sales Navigator URL resolution
  - Document background tab behavior
  - Explain both URL types stored in database
- **Outcome**: Documentation current

### Task 9.3: Update docfig.md
- **File**: `docfig.md`
- **Action**: Update flowchart documentation
  - Replace old Sales Navigator flow with new resolution logic
  - Show background tab redirection step
  - Show database lookup with both URL types
  - Document success and error paths
- **Outcome**: Flowchart reflects new implementation

### Task 9.4: Create Migration Notes
- **File**: New file or update CHROME_EXTENSION_UPDATES.md
- **Action**: Document changes for deployment
  - Database schema changes (new column)
  - API endpoint updates
  - Extension version requirement
  - Backward compatibility notes
- **Outcome**: Clear deployment guide

---

## Summary of Changes by Component

### Database (`shared/schema.ts`)
- [x] Add `salesNavigatorUrl: text("sales_navigator_url")` to contacts table
- [x] Update insert schema to include new field

### Backend (`server/storage.ts`)
- [x] Add `findContactBySalesNavigatorUrl()` to IStorage interface
- [x] Add `findContactByLinkedInUrls()` to IStorage interface
- [x] Implement both methods in DatabaseStorage class

### Backend API (`server/routes.ts`)
- [ ] Update POST `/api/extension/lookup` to accept both URL types
- [ ] Update POST `/api/extension/save-profile` to save both URL types

### Chrome Extension Content Script
- [ ] Detect Sales Navigator URL pattern
- [ ] Extract lead ID from URL
- [ ] Remove old DOM extraction logic
- [ ] Send lead ID to background script

### Chrome Extension Background Script
- [ ] Add handler for RESOLVE_SALES_NAV_LEAD message
- [ ] Implement `resolveSalesNavLeadToLinkedIn()` function
- [ ] Implement `waitForLinkedInRedirect()` function
- [ ] Handle errors and timeouts
- [ ] Clean up background tabs after resolution

### Chrome Extension Popup/UI
- [ ] Show "Resolving LinkedIn profile..." state
- [ ] Handle resolved URL response
- [ ] Update contact card to display both URLs
- [ ] Update lookup to send both URLs
- [ ] Update save to include both URLs

### Documentation
- [ ] Update `docfig.md` with new flow
- [ ] Update `CHROME_EXTENSION_DOCUMENTATION.md`
- [ ] Create/update migration notes
- [ ] Update this file with completion status

---

## Execution Order

1. **Database & Backend First** (Phases 1-3)
   - Schema changes
   - Storage layer updates
   - API endpoint updates
   - Run database migration

2. **Chrome Extension Core Logic** (Phase 5)
   - Background script resolution logic
   - URL detection and communication

3. **Chrome Extension UI** (Phases 4, 6)
   - Content script updates
   - Popup UI and flow updates

4. **Integration & Testing** (Phases 7-8)
   - End-to-end flow verification
   - Error handling validation
   - Performance optimization

5. **Cleanup & Documentation** (Phase 9)
   - Remove old code
   - Update documentation
   - Prepare deployment notes

---

## Dependencies & Blockers

- None: All changes are additive and don't break existing functionality
- Backward compatible: Regular LinkedIn URL flow unchanged
- Extension version: May need version bump after all changes
- Database: Migration must complete before deploy

---

## Estimated Effort

- Database: 30 minutes
- Backend API: 45 minutes
- Chrome Extension: 90 minutes
- Testing: 45 minutes
- Documentation: 30 minutes
- **Total: ~4 hours**

---

## Success Criteria

✅ Sales Navigator URLs automatically resolve to LinkedIn profiles
✅ Background tab opens silently without user interaction
✅ Resolved URL used for database lookup
✅ Both URLs stored when creating new contact
✅ Existing LinkedIn flow unchanged
✅ No errors or console warnings
✅ Performance acceptable (<10 sec for resolution)
✅ Documentation updated
