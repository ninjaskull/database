# LinkedIn API Search Documentation

## Overview

This document provides comprehensive documentation on how LinkedIn API search works, including official endpoints, authentication requirements, limitations, and alternative approaches.

---

## Table of Contents

1. [Official LinkedIn Search APIs](#official-linkedin-search-apis)
2. [Authentication & Headers](#authentication--headers)
3. [Company Search API](#1-company-search-api)
4. [Organization Lookup API](#2-organization-lookup-api)
5. [People Typeahead API](#3-people-typeahead-api)
6. [Vanity URL Lookup API](#4-vanity-url-lookup-api)
7. [Profile API](#5-profile-api)
8. [Handle Lookup API](#6-handle-lookup-api)
9. [Access Requirements & Limitations](#access-requirements--limitations)
10. [Alternative Approaches](#alternative-approaches)
11. [Rate Limiting](#rate-limiting)
12. [Best Practices](#best-practices)

---

## Official LinkedIn Search APIs

LinkedIn provides several search-related APIs through their Marketing and Consumer API products. Access to these APIs is **restricted** and requires partnership approval from LinkedIn.

### API Versioning

LinkedIn uses versioned APIs with the format `YYYYMM` (e.g., `202411` for November 2024). Always use the latest version in your requests.

---

## Authentication & Headers

All official LinkedIn API calls require the following headers:

```bash
-H 'Authorization: Bearer {ACCESS_TOKEN}'
-H 'X-Restli-Protocol-Version: 2.0.0'
-H 'Linkedin-Version: YYYYMM'  # e.g., 202411 for Nov 2024
-H 'Content-Type: application/json'
```

### OAuth 2.0 Scopes

Depending on the API endpoint, you'll need different OAuth scopes:

| Scope | Description |
|-------|-------------|
| `r_liteprofile` | Read basic profile data |
| `r_emailaddress` | Read email address |
| `r_organization_admin` | Read organization admin data |
| `rw_organization_admin` | Read/write organization data |
| `r_ads` | Read advertising data |

---

## 1. Company Search API

**Endpoint:** `https://api.linkedin.com/v2/companySearch?q=search`

Find companies using keywords, industry, location, and other criteria.

### Request Example

```bash
curl -X GET 'https://api.linkedin.com/v2/companySearch?q=search&query=LinkedIn Corporation' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-Restli-Protocol-Version: 2.0.0' \
  -H 'Linkedin-Version: 202411' \
  -H 'Content-Type: application/json'
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | string | Company keywords (e.g., "LinkedIn Corporation") |
| `filter.industry[0]` | string | Industry code filter (e.g., `6`) |
| `filter.companySize[0]` | string | Size filter (`A`=1-10, `B`=11-50, ..., `I`=10001+) |
| `filter.locations[0]` | string | Location URN filter |
| `projection` | string | Fields to return (e.g., `id`, `name`, `vanityName`, `logoV2`, `locations`) |
| `start` | integer | Pagination start index (default: 0) |
| `count` | integer | Number of results per page (default: 10, max: 25) |

### Company Size Codes

| Code | Size Range |
|------|------------|
| A | 1-10 employees |
| B | 11-50 employees |
| C | 51-200 employees |
| D | 201-500 employees |
| E | 501-1000 employees |
| F | 1001-5000 employees |
| G | 5001-10000 employees |
| H | 10001+ employees |

### Response Example

```json
{
  "elements": [
    {
      "entity": "urn:li:organization:1032984",
      "entity~": {
        "vanityName": "linkedin",
        "name": {
          "localized": {
            "en_US": "LinkedIn"
          }
        },
        "logoV2": {
          "original~": {
            "width": 200,
            "height": 200
          }
        }
      }
    }
  ],
  "paging": {
    "total": 12991,
    "count": 10,
    "start": 0,
    "links": [
      {
        "rel": "next",
        "href": "/v2/companySearch?start=10&count=10"
      }
    ]
  }
}
```

### Limitations

- No wildcards or Boolean logic (`*`, `?`, `AND`, `OR`)
- Search one company at a time
- Case insensitive matching
- Maximum 25 results per request

**Documentation:** https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/company-search

---

## 2. Organization Lookup API

**Endpoint:** `https://api.linkedin.com/rest/organization/{organization_id}`

Retrieve organization profiles by ID or vanity name.

### Request by Organization ID

```bash
curl -X GET 'https://api.linkedin.com/rest/organization/89758488' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'LinkedIn-Version: 202411' \
  -H 'X-Restli-Protocol-Version: 2.0.0'
```

### Request by Vanity Name

```bash
curl -X GET 'https://api.linkedin.com/rest/organizations?q=vanityName&vanityName=linkedin' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'LinkedIn-Version: 202411' \
  -H 'X-Restli-Protocol-Version: 2.0.0'
```

### Response Fields

| Field | Description |
|-------|-------------|
| `id` | Organization URN |
| `name` | Localized organization name |
| `vanityName` | URL-friendly name |
| `description` | Company description |
| `website` | Primary website URL |
| `industries` | Industry codes |
| `staffCountRange` | Employee count range |
| `locations` | Office locations |
| `logoV2` | Company logo |
| `primaryOrganizationType` | COMPANY or SCHOOL |

**Documentation:** https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/organization-lookup-api

---

## 3. People Typeahead API

**Endpoint:** `https://api.linkedin.com/rest/peopleTypeahead`

Search for members (people) who follow an organization page. Primarily used for @mentions in posts.

### Search Organization Followers

```bash
curl -X GET "https://api.linkedin.com/rest/peopleTypeahead?q=organizationFollowers&keywords=ann&organization=urn:li:organization:9510" \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-Restli-Protocol-Version: 2.0.0' \
  -H 'Linkedin-Version: 202411'
```

### Search Member Connections

```bash
curl -X GET "https://api.linkedin.com/rest/peopleTypeahead?q=memberConnections&keywords=john" \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-Restli-Protocol-Version: 2.0.0' \
  -H 'Linkedin-Version: 202411'
```

### Query Parameters

| Parameter | Type | Description |
|-----------|------|-------------|
| `q` | string | Query type: `organizationFollowers` or `memberConnections` |
| `keywords` | string | Name search keywords |
| `organization` | URN | Organization URN (required for `organizationFollowers`) |

### Response Example

```json
{
  "elements": [
    {
      "member": "urn:li:person:133",
      "firstName": "Annie",
      "lastName": "Victor",
      "headline": "Head of Marketing",
      "photo": "urn:li:image:C56",
      "profilePicture": {
        "displayImage~": {
          "elements": [...]
        }
      }
    }
  ],
  "paging": {
    "count": 10,
    "start": 0
  }
}
```

### Limitations

- Returns maximum 10 profiles per request
- Only searches first name and last name
- Requires organization admin access for `organizationFollowers`

**Documentation:** https://learn.microsoft.com/en-us/linkedin/marketing/community-management/shares/posts-atmention-search-api

---

## 4. Vanity URL Lookup API

**Endpoint:** `https://api.linkedin.com/rest/vanityUrl`

Get a person's URN from their LinkedIn vanity URL (e.g., linkedin.com/in/username).

### Request Example

```bash
curl -X GET "https://api.linkedin.com/rest/vanityUrl?q=vanityUrlAsOrganization&vanityUrl=https://www.linkedin.com/in/{vanityName}&organization=urn:li:organization:2414" \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-Restli-Protocol-Version: 2.0.0' \
  -H 'Linkedin-Version: 202411'
```

### Response Example

```json
{
  "elements": [
    {
      "member": "urn:li:person:abcdefg1h"
    }
  ]
}
```

### Use Cases

- Convert LinkedIn profile URLs to member URNs
- Verify if a user follows your organization
- Enable @mentions in posts

---

## 5. Profile API

**Endpoint:** `https://api.linkedin.com/v2/me` or `https://api.linkedin.com/v2/people/(id:{person_id})`

Retrieve member profile data for authenticated users.

### Get Current User Profile

```bash
curl -X GET 'https://api.linkedin.com/v2/me' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-RestLi-Protocol-Version: 2.0.0'
```

### Get Specific Profile with Projection

```bash
curl -X GET 'https://api.linkedin.com/v2/people/(id:{person_id})?projection=(id,firstName,lastName,headline,profilePicture)' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-RestLi-Protocol-Version: 2.0.0'
```

### Lite Profile Fields (Default)

| Field | Description |
|-------|-------------|
| `id` | Member URN |
| `firstName` | Localized first name |
| `lastName` | Localized last name |
| `profilePicture` | Profile photo |
| `headline` | Professional headline |

### Extended Profile Fields (Requires Partner Permissions)

| Field | Description |
|-------|-------------|
| `vanityName` | Profile URL slug |
| `industryId` | Industry code |
| `summary` | About section |
| `positions` | Work experience |
| `educations` | Education history |
| `skills` | Listed skills |

### Limitations

- Only returns data for authenticated member by default
- Extended fields require LinkedIn partner approval
- Members with "Off-LinkedIn Visibility" disabled won't return data

**Documentation:** https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api

---

## 6. Handle Lookup API

**Endpoint:** `https://api.linkedin.com/v2/clientAwareMemberHandles`

Find LinkedIn profiles by email address. **Restricted to approved partners only.**

### Request Example

```bash
curl -X GET 'https://api.linkedin.com/v2/clientAwareMemberHandles?q=handleStrings&handleStrings=user@example.com&handleStrings=user2@example.com' \
  -H 'Authorization: Bearer {TOKEN}' \
  -H 'X-RestLi-Protocol-Version: 2.0.0'
```

### Response Example

```json
{
  "elements": [
    {
      "handle": "urn:li:emailAddress:user@example.com",
      "member": "urn:li:person:abc123"
    }
  ]
}
```

### Limitations

- Requires special partnership agreement with LinkedIn
- Rate limited
- Only works for members who have that email associated with their profile

**Documentation:** https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/handle-lookup

---

## Access Requirements & Limitations

### API Access Tiers

| Tier | Access Level | Requirements |
|------|--------------|--------------|
| **Consumer API** | Basic profile, Sign In with LinkedIn | Any developer |
| **Marketing API** | Organization pages, advertising, analytics | LinkedIn Partner |
| **Sales Navigator API** | Advanced search, lead management | Enterprise license |
| **Talent Solutions API** | Recruiting, job posting | Enterprise partnership |

### Important Limitations (2024)

1. **No Public Search API** - General people/company search is not publicly available
2. **Partner Restrictions** - Most search APIs require LinkedIn partnership
3. **OAuth Required** - All endpoints require OAuth 2.0 authentication
4. **Profile Visibility** - Only returns data for members with proper visibility settings
5. **Rate Limits** - All endpoints are rate limited (varies by tier)

### What's Available Without Partnership

- Sign In with LinkedIn (basic authentication)
- Current user's own profile data
- Basic organization page management (if admin)
- Creating and managing posts on organization pages

---

## Alternative Approaches

Since official search APIs are restricted, developers often use alternative methods:

### 1. Unofficial Voyager API

LinkedIn's internal API used by the website itself.

**Base URL:** `https://www.linkedin.com/voyager/api`

**Common Endpoints:**
- `/search/cluster` - General search
- `/identity/profiles/{vanity}` - Profile lookup
- `/organization/companies` - Company data

**Requirements:**
- LinkedIn session cookies (li_at cookie)
- Not officially supported
- Risk of account restrictions

**Python Library:** [linkedin-api](https://pypi.org/project/linkedin-api/)

```python
from linkedin_api import Linkedin

# Authenticate with credentials
api = Linkedin('email@example.com', 'password')

# Search for people
results = api.search_people(
    keywords='software engineer',
    connection_of='john-doe',
    network_depth='F',
    regions=['us:0']
)

# Search for companies
companies = api.search_companies(keywords='startup')
```

### 2. Third-Party APIs

| Service | Features | Pricing |
|---------|----------|---------|
| **Proxycurl** | Profile/company enrichment, search | Per-request pricing |
| **Lix API** | Search, jobs, posts extraction | Subscription |
| **Unipile** | Sales Navigator automation | Enterprise |
| **ScrapIn** | Data extraction service | Per-credit |
| **RocketReach** | Contact finding, email lookup | Subscription |

### 3. Web Scraping

Direct scraping of LinkedIn is against their Terms of Service and may result in:
- Account suspension
- Legal action
- IP blocking

If you must scrape, consider:
- Using proxies and rate limiting
- Respecting robots.txt
- Limiting frequency and volume

---

## Rate Limiting

LinkedIn enforces rate limits on all API endpoints:

### Standard Rate Limits

| Endpoint Type | Limit | Window |
|--------------|-------|--------|
| Marketing API | 100 requests | Per minute |
| Consumer API | 100 requests | Per day |
| Search endpoints | 25 requests | Per minute |
| Bulk operations | 10 requests | Per minute |

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 99
X-RateLimit-Reset: 1640000000
```

### Best Practices

1. Implement exponential backoff
2. Cache responses when possible
3. Use batch endpoints when available
4. Monitor rate limit headers

---

## Best Practices

### 1. API Usage

```javascript
// Good: Use versioned API with proper headers
const response = await fetch('https://api.linkedin.com/rest/organization/12345', {
  headers: {
    'Authorization': `Bearer ${accessToken}`,
    'X-Restli-Protocol-Version': '2.0.0',
    'Linkedin-Version': '202411'
  }
});

// Bad: Hardcoded version or missing headers
const response = await fetch('https://api.linkedin.com/v2/organization/12345', {
  headers: {
    'Authorization': `Bearer ${accessToken}`
  }
});
```

### 2. Error Handling

```javascript
async function searchCompanies(query) {
  try {
    const response = await fetch(`https://api.linkedin.com/v2/companySearch?q=search&query=${encodeURIComponent(query)}`, {
      headers: getLinkedInHeaders()
    });
    
    if (response.status === 429) {
      // Rate limited - implement backoff
      const resetTime = response.headers.get('X-RateLimit-Reset');
      await sleep(calculateBackoff(resetTime));
      return searchCompanies(query);
    }
    
    if (!response.ok) {
      throw new Error(`LinkedIn API error: ${response.status}`);
    }
    
    return response.json();
  } catch (error) {
    console.error('Search failed:', error);
    throw error;
  }
}
```

### 3. Caching Strategy

```javascript
// Cache organization data for 24 hours
const CACHE_TTL = 24 * 60 * 60 * 1000;

async function getOrganization(orgId) {
  const cacheKey = `org:${orgId}`;
  const cached = cache.get(cacheKey);
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  
  const data = await fetchOrganization(orgId);
  cache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}
```

### 4. Pagination

```javascript
async function* paginateResults(endpoint, pageSize = 10) {
  let start = 0;
  let hasMore = true;
  
  while (hasMore) {
    const response = await fetch(`${endpoint}&start=${start}&count=${pageSize}`, {
      headers: getLinkedInHeaders()
    });
    
    const data = await response.json();
    yield* data.elements;
    
    start += pageSize;
    hasMore = data.paging.total > start;
  }
}

// Usage
for await (const company of paginateResults(searchUrl)) {
  processCompany(company);
}
```

---

## Summary

### Available Official APIs

| API | Access | Use Case |
|-----|--------|----------|
| Company Search | Partner | Find companies by criteria |
| Organization Lookup | Partner | Get company details |
| People Typeahead | Partner | Search followers |
| Profile API | Consumer | Authenticated user profile |
| Handle Lookup | Restricted Partner | Email to profile lookup |

### Key Takeaways

1. **LinkedIn's official search APIs are highly restricted** - most require partner status
2. **Consumer API is limited** - only provides basic profile access for authenticated users
3. **No general people search** - public people search is not available through official APIs
4. **Third-party alternatives exist** - but may violate ToS or require separate subscriptions
5. **Always implement rate limiting** - all endpoints have usage limits
6. **Use versioned APIs** - include `Linkedin-Version` header in all requests

---

## Resources

- [Official LinkedIn API Documentation](https://learn.microsoft.com/en-us/linkedin/)
- [LinkedIn Marketing API](https://learn.microsoft.com/en-us/linkedin/marketing/)
- [LinkedIn API Concepts](https://learn.microsoft.com/en-us/linkedin/shared/api-guide/concepts)
- [Company Search API](https://learn.microsoft.com/en-us/linkedin/marketing/community-management/organizations/company-search)
- [Profile API](https://learn.microsoft.com/en-us/linkedin/shared/integrations/people/profile-api)

---

*Last Updated: November 2024*
