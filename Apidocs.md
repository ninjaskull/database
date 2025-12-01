# CRM API Documentation

Complete API documentation for integrating your CRM with external applications.

## Table of Contents

1. [Overview](#overview)
2. [Authentication](#authentication)
   - [API Key Authentication](#api-key-authentication)
   - [Session-Based Authentication](#session-based-authentication)
3. [Getting Started](#getting-started)
4. [Rate Limiting](#rate-limiting)
5. [Response Format](#response-format)
6. [Error Handling](#error-handling)
7. [API Scopes](#api-scopes)
8. [API v1 Endpoints (API Key Auth)](#api-v1-endpoints-api-key-auth)
   - [Contact Management](#contact-management)
   - [Bulk Operations](#bulk-operations)
   - [Tags](#tags)
   - [Activities](#activities)
   - [Enrichment](#enrichment)
   - [Statistics](#statistics)
   - [Schema](#schema)
9. [Public API Endpoints (API Key Auth)](#public-api-endpoints-api-key-auth)
10. [Session-Based Endpoints](#session-based-endpoints)
    - [Authentication](#session-authentication-endpoints)
    - [User Settings](#user-settings-endpoints)
    - [Import/Export](#importexport-endpoints)
    - [Internal Enrichment](#internal-enrichment-endpoints)
    - [API Key Management](#api-key-management-endpoints)
11. [Integration Examples](#integration-examples)
12. [Webhooks & External Integrations](#webhooks--external-integrations)
13. [Best Practices](#best-practices)
14. [Troubleshooting](#troubleshooting)

---

## Overview

The CRM API provides a RESTful interface for managing contacts, tags, activities, and analytics data. It supports:

- **Full CRUD operations** for contacts
- **Bulk operations** for efficient data management
- **Data enrichment** via LinkedIn integration
- **Tagging and categorization**
- **Activity tracking and audit logs**
- **Comprehensive analytics**

**Base URL:** `https://your-domain.com/api/v1`

**API Version:** `1.0.0`

---

## Authentication

The CRM provides two authentication methods:

1. **API Key Authentication** - For external integrations and automation (recommended for most use cases)
2. **Session-Based Authentication** - For browser-based interactions and admin operations

### API Key Authentication

API key authentication is recommended for external integrations. API keys are prefixed with `crm_` and can be provided in two ways:

#### Option 1: Authorization Header (Recommended)

```http
Authorization: Bearer crm_your_api_key_here
```

#### Option 2: X-API-Key Header

```http
X-API-Key: crm_your_api_key_here
```

### Generating API Keys

1. Log into the CRM application
2. Navigate to **Settings** > **API Keys**
3. Click **Create New API Key**
4. Enter a descriptive label (e.g., "Zapier Integration", "Marketing Automation")
5. Select the required scopes (permissions)
6. Set the rate limit (requests per minute)
7. **Important:** Copy and securely store the API key immediately - it will only be shown once!

### API Key Management Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/api-keys` | List all your API keys |
| POST | `/api/api-keys` | Create a new API key |
| DELETE | `/api/api-keys/:id` | Revoke an API key |

#### Create API Key Request

```bash
curl -X POST "https://your-domain.com/api/api-keys" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=your_session_cookie" \
  -d '{
    "label": "My Integration",
    "rateLimitPerMinute": 60,
    "scopes": ["contacts:read", "contacts:write"]
  }'
```

#### Response

```json
{
  "success": true,
  "message": "API key created successfully. Copy the key now - it won't be shown again.",
  "key": "crm_a1b2c3d4e5f6...",
  "apiKey": {
    "id": "uuid",
    "label": "My Integration",
    "scopes": ["contacts:read", "contacts:write"],
    "rateLimitPerMinute": 60,
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

---

### Session-Based Authentication

Session authentication is used for browser-based interactions and admin operations. It uses cookies to maintain session state.

#### Login Flow

1. **Login** - POST credentials to `/api/login`
2. **Receive Session** - Server sets a session cookie
3. **Make Requests** - Include the cookie in subsequent requests
4. **Logout** - POST to `/api/logout` to invalidate session

#### Login Request

```bash
curl -X POST "https://your-domain.com/api/login" \
  -H "Content-Type: application/json" \
  -c cookies.txt \
  -d '{
    "email": "user@example.com",
    "password": "your_password"
  }'
```

#### Login Response

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "session_token_here"
}
```

#### Using Session Cookie

```bash
# Use the saved cookie for authenticated requests
curl -X GET "https://your-domain.com/api/auth/user" \
  -b cookies.txt
```

#### Session Endpoints vs API Key Endpoints

| Use Case | Authentication Method |
|----------|----------------------|
| External integrations (Zapier, Make) | API Key |
| Bulk data sync | API Key |
| Automated workflows | API Key |
| Admin settings changes | Session |
| Managing API keys | Session |
| CSV import/export | Session |
| User profile updates | Session |

---

## Getting Started

### Quick Start Example

```bash
# List all contacts
curl -X GET "https://your-domain.com/api/v1/contacts" \
  -H "Authorization: Bearer crm_your_api_key_here"

# Create a new contact
curl -X POST "https://your-domain.com/api/v1/contacts" \
  -H "Authorization: Bearer crm_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@example.com",
    "company": "Acme Inc",
    "title": "CEO"
  }'
```

### Node.js Example

```javascript
const API_BASE = 'https://your-domain.com/api/v1';
const API_KEY = 'crm_your_api_key_here';

async function getContacts() {
  const response = await fetch(`${API_BASE}/contacts`, {
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    }
  });
  return response.json();
}

async function createContact(contact) {
  const response = await fetch(`${API_BASE}/contacts`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(contact)
  });
  return response.json();
}
```

### Python Example

```python
import requests

API_BASE = 'https://your-domain.com/api/v1'
API_KEY = 'crm_your_api_key_here'

headers = {
    'Authorization': f'Bearer {API_KEY}',
    'Content-Type': 'application/json'
}

# Get all contacts
response = requests.get(f'{API_BASE}/contacts', headers=headers)
contacts = response.json()

# Create a contact
new_contact = {
    'firstName': 'Jane',
    'lastName': 'Smith',
    'email': 'jane.smith@example.com',
    'company': 'Tech Corp'
}
response = requests.post(f'{API_BASE}/contacts', headers=headers, json=new_contact)
```

---

## Rate Limiting

API requests are rate-limited to prevent abuse. Rate limit information is included in response headers:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Maximum requests allowed per minute |
| `X-RateLimit-Remaining` | Remaining requests in current window |
| `X-RateLimit-Reset` | Seconds until rate limit resets |

### Default Limits

- **60 requests per minute** (configurable per API key)
- Burst allowance: up to 3x the limit for short bursts

### Rate Limit Exceeded Response

```json
{
  "success": false,
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Rate limit exceeded. Limit: 60 requests/minute. Retry after 45 seconds.",
    "details": {
      "retryAfter": 45,
      "limit": 60
    },
    "traceId": "trace_1234567890_abcdef"
  }
}
```

---

## Response Format

All API responses follow a consistent structure:

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data here
  },
  "meta": {
    "page": 1,
    "pageSize": 20,
    "totalItems": 150,
    "totalPages": 8,
    "apiVersion": "1.0.0"
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "traceId": "trace_1234567890_abcdef"
  }
}
```

### Response Headers

Every API response includes:

| Header | Description |
|--------|-------------|
| `X-Trace-Id` | Unique request identifier for debugging |
| `X-API-Version` | Current API version |

---

## Error Handling

### Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHORIZED` | 401 | Missing or invalid API key |
| `FORBIDDEN` | 403 | Valid API key but insufficient permissions |
| `INSUFFICIENT_SCOPE` | 403 | API key lacks required scope |
| `NOT_FOUND` | 404 | Requested resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request data |
| `BAD_REQUEST` | 400 | Malformed request |
| `DUPLICATE_RESOURCE` | 409 | Resource already exists (e.g., duplicate email) |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_ERROR` | 500 | Server error |

### Validation Error Example

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request validation failed.",
    "details": [
      {
        "field": "email",
        "message": "Invalid email format",
        "code": "invalid_string"
      }
    ],
    "traceId": "trace_1234567890_abcdef"
  }
}
```

---

## API Scopes

API keys are granted specific permissions (scopes) that control access:

| Scope | Description |
|-------|-------------|
| `contacts:read` | Read contact information |
| `contacts:write` | Create and update contacts |
| `contacts:delete` | Delete contacts |
| `contacts:bulk` | Perform bulk operations on contacts |
| `enrichment:run` | Execute data enrichment jobs |
| `enrichment:read` | View enrichment job status and history |
| `stats:read` | Access analytics and statistics |
| `tags:read` | Read tags |
| `tags:write` | Create and manage tags |
| `activities:read` | View activity logs and audit trail |

### Scope Groups

| Group | Scopes |
|-------|--------|
| Contacts | `contacts:read`, `contacts:write`, `contacts:delete`, `contacts:bulk` |
| Enrichment | `enrichment:run`, `enrichment:read` |
| Analytics | `stats:read` |
| Tags | `tags:read`, `tags:write` |
| Activities | `activities:read` |

---

## API v1 Endpoints (API Key Auth)

All `/api/v1/*` endpoints require API key authentication and appropriate scopes.

### Contact Management

#### List Contacts

Retrieve a paginated list of contacts with optional filtering and sorting.

```
GET /api/v1/contacts
```

**Required Scope:** `contacts:read`

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `page` | integer | 1 | Page number |
| `pageSize` | integer | 20 | Items per page (max 100) |
| `search` | string | - | Search by name, email, or company |
| `industry` | string | - | Filter by industry |
| `employeeSizeBracket` | string | - | Filter by company size |
| `country` | string | - | Filter by country |
| `sortBy` | string | createdAt | Sort field |
| `sortOrder` | string | desc | Sort order (asc/desc) |
| `leadScoreMin` | number | - | Minimum lead score |
| `leadScoreMax` | number | - | Maximum lead score |
| `updatedSince` | ISO date | - | Filter by update date |
| `createdSince` | ISO date | - | Filter by creation date |
| `hasEmail` | boolean | - | Filter contacts with email |
| `hasPhone` | boolean | - | Filter contacts with phone |
| `hasLinkedIn` | boolean | - | Filter contacts with LinkedIn |

**Example Request:**

```bash
curl -X GET "https://your-domain.com/api/v1/contacts?page=1&pageSize=50&industry=Technology&sortBy=leadScore&sortOrder=desc" \
  -H "Authorization: Bearer crm_your_api_key_here"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "contacts": [
      {
        "id": "uuid-1234",
        "fullName": "John Doe",
        "firstName": "John",
        "lastName": "Doe",
        "email": "john@acme.com",
        "title": "CEO",
        "company": "Acme Inc",
        "mobilePhone": "+1-555-123-4567",
        "industry": "Technology",
        "employees": 500,
        "employeeSizeBracket": "201-500",
        "website": "https://acme.com",
        "personLinkedIn": "https://linkedin.com/in/johndoe",
        "city": "San Francisco",
        "state": "CA",
        "country": "United States",
        "leadScore": "8.5",
        "createdAt": "2024-01-15T10:30:00Z",
        "updatedAt": "2024-01-20T14:45:00Z"
      }
    ]
  },
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 150,
    "totalPages": 3,
    "apiVersion": "1.0.0"
  }
}
```

---

#### Get Single Contact

Retrieve a specific contact by ID.

```
GET /api/v1/contacts/:id
```

**Required Scope:** `contacts:read`

**Example Request:**

```bash
curl -X GET "https://your-domain.com/api/v1/contacts/uuid-1234" \
  -H "Authorization: Bearer crm_your_api_key_here"
```

---

#### Create Contact

Create a new contact with automatic data enrichment.

```
POST /api/v1/contacts
```

**Required Scope:** `contacts:write`

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullName` | string | * | Full name (or provide firstName/lastName) |
| `firstName` | string | * | First name |
| `lastName` | string | * | Last name |
| `email` | string | * | Email address (* at least one identifier required) |
| `title` | string | No | Job title |
| `company` | string | No | Company name |
| `mobilePhone` | string | No | Mobile phone |
| `otherPhone` | string | No | Other phone |
| `homePhone` | string | No | Home phone |
| `corporatePhone` | string | No | Corporate phone |
| `employees` | integer | No | Number of employees |
| `employeeSizeBracket` | string | No | Size bracket (1-10, 11-50, etc.) |
| `industry` | string | No | Industry sector |
| `website` | string | No | Company website URL |
| `companyLinkedIn` | string | No | Company LinkedIn URL |
| `personLinkedIn` | string | No | Personal LinkedIn URL |
| `technologies` | array | No | Technologies used |
| `annualRevenue` | string | No | Annual revenue |
| `city` | string | No | City |
| `state` | string | No | State/Province |
| `country` | string | No | Country |
| `companyAddress` | string | No | Company address |
| `companyCity` | string | No | Company city |
| `companyState` | string | No | Company state |
| `companyCountry` | string | No | Company country |

**Example Request:**

```bash
curl -X POST "https://your-domain.com/api/v1/contacts" \
  -H "Authorization: Bearer crm_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane.smith@techcorp.com",
    "title": "VP of Engineering",
    "company": "TechCorp",
    "industry": "Technology",
    "personLinkedIn": "https://linkedin.com/in/janesmith"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "contact": {
      "id": "uuid-5678",
      "fullName": "Jane Smith",
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane.smith@techcorp.com",
      "title": "VP of Engineering",
      "company": "TechCorp",
      "industry": "Technology",
      "personLinkedIn": "https://linkedin.com/in/janesmith",
      "emailDomain": "techcorp.com",
      "leadScore": "7.2",
      "createdAt": "2024-01-21T09:15:00Z",
      "updatedAt": "2024-01-21T09:15:00Z"
    }
  },
  "meta": {
    "apiVersion": "1.0.0"
  }
}
```

---

#### Update Contact

Update an existing contact.

```
PATCH /api/v1/contacts/:id
```

**Required Scope:** `contacts:write`

**Example Request:**

```bash
curl -X PATCH "https://your-domain.com/api/v1/contacts/uuid-5678" \
  -H "Authorization: Bearer crm_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Chief Technology Officer",
    "mobilePhone": "+1-555-987-6543"
  }'
```

---

#### Delete Contact

Soft-delete a contact (can be recovered).

```
DELETE /api/v1/contacts/:id
```

**Required Scope:** `contacts:delete`

**Example Request:**

```bash
curl -X DELETE "https://your-domain.com/api/v1/contacts/uuid-5678" \
  -H "Authorization: Bearer crm_your_api_key_here"
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "message": "Contact deleted successfully",
    "deletedId": "uuid-5678"
  }
}
```

---

### Bulk Operations

#### Bulk Create Contacts

Create multiple contacts in a single request (up to 500).

```
POST /api/v1/contacts/bulk
```

**Required Scope:** `contacts:bulk`

**Request Body:**

```json
{
  "contacts": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com",
      "company": "Example Inc"
    },
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com",
      "company": "Sample Corp"
    }
  ]
}
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 2,
      "created": 2,
      "failed": 0
    },
    "results": [
      {
        "index": 0,
        "success": true,
        "contact": {
          "id": "uuid-001",
          "fullName": "John Doe",
          "email": "john@example.com"
        }
      },
      {
        "index": 1,
        "success": true,
        "contact": {
          "id": "uuid-002",
          "fullName": "Jane Smith",
          "email": "jane@example.com"
        }
      }
    ]
  }
}
```

---

#### Bulk Update Contacts

Update multiple contacts in a single request.

```
PATCH /api/v1/contacts/bulk
```

**Required Scope:** `contacts:bulk`

**Request Body:**

```json
{
  "contacts": [
    {
      "id": "uuid-001",
      "updates": {
        "title": "Senior Developer"
      }
    },
    {
      "id": "uuid-002",
      "updates": {
        "industry": "Healthcare"
      }
    }
  ]
}
```

---

#### Bulk Delete Contacts

Delete multiple contacts in a single request.

```
DELETE /api/v1/contacts/bulk
```

**Required Scopes:** `contacts:bulk`, `contacts:delete`

**Request Body:**

```json
{
  "ids": ["uuid-001", "uuid-002", "uuid-003"]
}
```

---

### Tags

#### List Tags

Get all available tags.

```
GET /api/v1/tags
```

**Required Scope:** `tags:read`

---

#### Create Tag

Create a new tag.

```
POST /api/v1/tags
```

**Required Scope:** `tags:write`

**Request Body:**

```json
{
  "name": "Hot Lead",
  "color": "#FF5733",
  "description": "High-priority prospect"
}
```

---

#### Delete Tag

Delete a tag.

```
DELETE /api/v1/tags/:id
```

**Required Scope:** `tags:write`

---

#### Get Contact Tags

Get all tags assigned to a contact.

```
GET /api/v1/contacts/:id/tags
```

**Required Scope:** `tags:read`

---

#### Add Tag to Contact

Assign a tag to a contact.

```
POST /api/v1/contacts/:id/tags
```

**Required Scope:** `tags:write`

**Request Body:**

```json
{
  "tagId": "tag-uuid"
}
```

---

#### Remove Tag from Contact

Remove a tag from a contact.

```
DELETE /api/v1/contacts/:id/tags/:tagId
```

**Required Scope:** `tags:write`

---

### Activities

#### List Activities

Get activity logs with optional filtering.

```
GET /api/v1/activities
```

**Required Scope:** `activities:read`

**Query Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `page` | integer | Page number |
| `pageSize` | integer | Items per page |
| `activityType` | string | Filter by type (created, updated, deleted, enriched) |
| `contactId` | string | Filter by contact |

**Example Response:**

```json
{
  "success": true,
  "data": {
    "activities": [
      {
        "id": "activity-001",
        "contactId": "uuid-1234",
        "activityType": "updated",
        "description": "Contact information updated",
        "changes": {
          "title": "CTO"
        },
        "createdAt": "2024-01-20T14:30:00Z"
      }
    ]
  }
}
```

---

#### Get Contact Activities

Get all activities for a specific contact.

```
GET /api/v1/contacts/:id/activities
```

**Required Scope:** `activities:read`

---

### Enrichment

#### Search LinkedIn

Search for contacts by LinkedIn URL.

```
POST /api/v1/enrichment/search
```

**Required Scope:** `enrichment:read`

**Request Body:**

```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Example Response:**

```json
{
  "success": true,
  "data": {
    "linkedinUrl": "https://linkedin.com/in/johndoe",
    "matchingContacts": [
      {
        "id": "uuid-1234",
        "fullName": "John Doe",
        "email": "john@acme.com",
        "company": "Acme Inc",
        "title": "CEO",
        "personLinkedIn": "https://linkedin.com/in/johndoe"
      }
    ],
    "matchCount": 1
  }
}
```

---

#### Create Enrichment Job

Start a LinkedIn enrichment job.

```
POST /api/v1/enrichment/jobs
```

**Required Scope:** `enrichment:run`

**Request Body:**

```json
{
  "linkedinUrl": "https://linkedin.com/in/janedoe",
  "contactId": "uuid-optional"
}
```

---

#### List Enrichment Jobs

Get recent enrichment jobs.

```
GET /api/v1/enrichment/jobs
```

**Required Scope:** `enrichment:read`

---

#### Get Enrichment Job

Get a specific enrichment job status.

```
GET /api/v1/enrichment/jobs/:id
```

**Required Scope:** `enrichment:read`

---

#### Bulk Enrichment

Start multiple enrichment jobs (up to 100).

```
POST /api/v1/enrichment/jobs/bulk
```

**Required Scope:** `enrichment:run`

**Request Body:**

```json
{
  "jobs": [
    { "linkedinUrl": "https://linkedin.com/in/user1" },
    { "linkedinUrl": "https://linkedin.com/in/user2", "contactId": "uuid-existing" }
  ]
}
```

---

### Statistics

#### Get Overview Stats

Get basic statistics.

```
GET /api/v1/stats
```

**Required Scope:** `stats:read`

**Example Response:**

```json
{
  "success": true,
  "data": {
    "stats": {
      "totalContacts": 1250,
      "totalCompanies": 340,
      "validEmails": 1180,
      "averageLeadScore": 6.8
    }
  }
}
```

---

#### Get Comprehensive Analytics

Get detailed analytics data.

```
GET /api/v1/stats/comprehensive
```

**Required Scope:** `stats:read`

---

### Schema

#### Get Contact Schema

Get the complete contact field schema.

```
GET /api/v1/schema/contacts
```

No authentication required.

---

#### Get Available Scopes

Get all available API scopes.

```
GET /api/v1/schema/scopes
```

No authentication required.

---

## Public API Endpoints (API Key Auth)

These endpoints use the `/api/public/*` prefix and require API key authentication via the `X-API-Key` header.

### Search Prospects by LinkedIn

Search for contacts in your database by LinkedIn URL.

```
GET /api/public/prospects?linkedinUrl=<linkedin_url>
```

**Authentication:** `X-API-Key` header

**Query Parameters:**

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `linkedinUrl` | string | Yes | LinkedIn profile URL |

**Example Request:**

```bash
curl -X GET "https://your-domain.com/api/public/prospects?linkedinUrl=https://linkedin.com/in/johndoe" \
  -H "X-API-Key: crm_your_api_key_here"
```

**Example Response:**

```json
{
  "success": true,
  "count": 1,
  "prospects": [
    {
      "id": "uuid-1234",
      "fullName": "John Doe",
      "firstName": "John",
      "lastName": "Doe",
      "title": "CEO",
      "email": "john@acme.com",
      "mobilePhone": "+1-555-123-4567",
      "company": "Acme Inc",
      "employees": 500,
      "employeeSizeBracket": "201-500",
      "industry": "Technology",
      "website": "https://acme.com",
      "personLinkedIn": "https://linkedin.com/in/johndoe",
      "city": "San Francisco",
      "state": "CA",
      "country": "United States",
      "leadScore": "8.5"
    }
  ]
}
```

---

### Create Contact (Public API)

Create a new contact via the public API.

```
POST /api/public/contacts
```

**Authentication:** `X-API-Key` header

**Request Body:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `fullName` | string | * | Full name |
| `firstName` | string | * | First name |
| `lastName` | string | * | Last name |
| `email` | string | * | Email address (* at least one required) |
| `title` | string | No | Job title |
| `company` | string | No | Company name |
| `mobilePhone` | string | No | Mobile phone |
| `personLinkedIn` | string | No | LinkedIn URL |
| `industry` | string | No | Industry |
| ... | ... | ... | (all standard contact fields) |

**Example Request:**

```bash
curl -X POST "https://your-domain.com/api/public/contacts" \
  -H "X-API-Key: crm_your_api_key_here" \
  -H "Content-Type: application/json" \
  -d '{
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "company": "Tech Corp",
    "title": "CTO"
  }'
```

**Example Response:**

```json
{
  "success": true,
  "message": "Contact created successfully",
  "contact": {
    "id": "uuid-5678",
    "fullName": "Jane Smith",
    "firstName": "Jane",
    "lastName": "Smith",
    "email": "jane@example.com",
    "company": "Tech Corp",
    "title": "CTO",
    "createdAt": "2024-01-21T10:00:00Z"
  }
}
```

---

### Bulk Create Contacts (Public API)

Create multiple contacts in a single request (up to 100).

```
POST /api/public/contacts/bulk
```

**Authentication:** `X-API-Key` header

**Request Body:**

```json
{
  "contacts": [
    {
      "firstName": "John",
      "lastName": "Doe",
      "email": "john@example.com"
    },
    {
      "firstName": "Jane",
      "lastName": "Smith",
      "email": "jane@example.com"
    }
  ]
}
```

**Example Response:**

```json
{
  "success": true,
  "message": "Created 2 contacts, 0 failed",
  "summary": {
    "total": 2,
    "created": 2,
    "failed": 0
  },
  "results": [
    {
      "success": true,
      "index": 0,
      "contact": {
        "id": "uuid-001",
        "fullName": "John Doe",
        "email": "john@example.com"
      }
    },
    {
      "success": true,
      "index": 1,
      "contact": {
        "id": "uuid-002",
        "fullName": "Jane Smith",
        "email": "jane@example.com"
      }
    }
  ]
}
```

---

## Session-Based Endpoints

These endpoints require session authentication (login with cookies). They are used for admin operations, settings management, and internal features.

### Session Authentication Endpoints

#### Login

Authenticate a user and start a session.

```
POST /api/login
```

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "your_password"
}
```

**Response:**

```json
{
  "success": true,
  "user": {
    "id": "user-uuid",
    "email": "user@example.com",
    "name": "User Name"
  },
  "token": "session_token"
}
```

**Note:** The server sets a session cookie that should be included in subsequent requests.

---

#### Logout

End the current session.

```
POST /api/logout
```

**Headers:** Include session cookie

**Response:**

```json
{
  "success": true
}
```

---

#### Get Current User

Get the currently authenticated user's information.

```
GET /api/auth/user
```

**Headers:** Include session cookie

**Response:**

```json
{
  "id": "user-uuid",
  "email": "user@example.com",
  "name": "User Name"
}
```

---

### User Settings Endpoints

#### Update Profile

Update the user's profile information.

```
PUT /api/settings/profile
```

**Headers:** Include session cookie

**Request Body:**

```json
{
  "name": "New Name",
  "email": "newemail@example.com",
  "phone": "+1-555-123-4567",
  "timezone": "America/New_York",
  "language": "en"
}
```

---

#### Update Password

Change the user's password.

```
PUT /api/settings/password
```

**Headers:** Include session cookie

**Request Body:**

```json
{
  "currentPassword": "old_password",
  "newPassword": "new_password"
}
```

---

#### Update Notification Settings

```
PUT /api/settings/notifications
```

**Headers:** Include session cookie

---

#### Update System Settings

```
PUT /api/settings/system
```

**Headers:** Include session cookie

---

#### Update Appearance Settings

```
PUT /api/settings/appearance
```

**Headers:** Include session cookie

---

#### Delete Account

Permanently delete the user's account.

```
DELETE /api/settings/delete-account
```

**Headers:** Include session cookie

---

### Import/Export Endpoints

#### Export Contacts (CSV)

Export all contacts as a CSV file.

```
GET /api/export
```

**Headers:** Include session cookie

**Response:** CSV file download

**CSV Columns:**
- Full Name, First Name, Last Name, Title, Company, Email
- Mobile Phone, Other Phone, Home Phone, Corporate Phone
- Employees, Employee Size Bracket, Industry
- Person LinkedIn, Website, Company LinkedIn
- City, State, Country
- Company Address, Company City, Company State, Company Country
- Technologies, Annual Revenue, Lead Score, Created At

---

#### Export All Contacts

Export all contacts with all fields.

```
GET /api/export/all
```

**Headers:** Include session cookie

**Response:** CSV file download

---

#### Auto-Map CSV Headers

Analyze a CSV file and automatically map headers to contact fields.

```
POST /api/import/auto-map
```

**Headers:** Include session cookie

**Request:** Multipart form data with CSV file

**Response:**

```json
{
  "success": true,
  "fieldMapping": {
    "Name": "fullName",
    "Email Address": "email",
    "Company Name": "company"
  },
  "unmappedHeaders": ["Custom Field 1"],
  "sampleData": [...]
}
```

---

#### Import Contacts

Import contacts from a CSV file.

```
POST /api/import
```

**Headers:** Include session cookie

**Request:** Multipart form data with:
- `csv`: CSV file
- `fieldMapping`: JSON mapping of CSV headers to contact fields
- `options`: JSON import options

**Options:**
```json
{
  "skipDuplicates": true,
  "updateExisting": true,
  "autoEnrich": true
}
```

**Response:**

```json
{
  "jobId": "import-job-uuid",
  "message": "Ultra-fast import started - processing with streaming, batching, and parallel operations",
  "estimatedTime": "~5 seconds"
}
```

---

#### Get Import Job Status

Check the status of an import job.

```
GET /api/import/:jobId
```

**Headers:** Include session cookie

**Response:**

```json
{
  "id": "import-job-uuid",
  "filename": "contacts.csv",
  "status": "completed",
  "totalRows": 1000,
  "processedRows": 1000,
  "successfulRows": 985,
  "errorRows": 15,
  "duplicateRows": 50,
  "createdAt": "2024-01-21T10:00:00Z",
  "completedAt": "2024-01-21T10:00:05Z"
}
```

---

### Internal Enrichment Endpoints

#### Check Enrichment Status

Check if LinkedIn enrichment is configured.

```
GET /api/enrichment/status
```

**Headers:** Include session cookie

**Response:**

```json
{
  "configured": true,
  "provider": "proxycurl",
  "message": "LinkedIn enrichment is ready to use"
}
```

---

#### Search LinkedIn Profile

Search for contact details by LinkedIn URL (uses enrichment credits).

```
POST /api/enrichment/search
```

**Headers:** Include session cookie

**Request Body:**

```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

**Response:**

```json
{
  "success": true,
  "data": {
    "fullName": "John Doe",
    "firstName": "John",
    "lastName": "Doe",
    "email": "john@example.com",
    "phone": "+1-555-123-4567",
    "title": "CEO",
    "company": "Acme Inc"
  },
  "creditsUsed": 1,
  "message": "Contact details found successfully"
}
```

---

#### Enrich Existing Contact

Enrich an existing contact with LinkedIn data.

```
POST /api/contacts/:id/enrich-linkedin
```

**Headers:** Include session cookie

**Request Body (optional):**

```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

If `linkedinUrl` is not provided, uses the contact's existing LinkedIn URL.

---

#### Create Contact from LinkedIn

Create a new contact from LinkedIn profile data.

```
POST /api/enrichment/create-from-linkedin
```

**Headers:** Include session cookie

**Request Body:**

```json
{
  "linkedinUrl": "https://linkedin.com/in/johndoe"
}
```

---

#### Get Enrichment Job History

Get recent enrichment jobs.

```
GET /api/enrichment/jobs
```

**Headers:** Include session cookie

**Query Parameters:**

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `limit` | integer | 20 | Number of jobs to return |

---

#### Get Contact Enrichment Jobs

Get enrichment jobs for a specific contact.

```
GET /api/contacts/:id/enrichment-jobs
```

**Headers:** Include session cookie

---

### API Key Management Endpoints

#### List API Keys

Get all API keys for the current user.

```
GET /api/api-keys
```

**Headers:** Include session cookie

**Response:**

```json
{
  "success": true,
  "keys": [
    {
      "id": "key-uuid",
      "label": "My Integration",
      "scopes": ["contacts:read", "contacts:write"],
      "rateLimitPerMinute": 60,
      "requestCount": 1523,
      "lastUsedAt": "2024-01-21T14:30:00Z",
      "createdAt": "2024-01-01T00:00:00Z",
      "revokedAt": null,
      "isActive": true
    }
  ]
}
```

---

#### Create API Key

Create a new API key.

```
POST /api/api-keys
```

**Headers:** Include session cookie

**Request Body:**

```json
{
  "label": "My Integration",
  "rateLimitPerMinute": 60,
  "scopes": [
    "contacts:read",
    "contacts:write",
    "contacts:delete",
    "contacts:bulk",
    "enrichment:run",
    "enrichment:read",
    "stats:read",
    "tags:read",
    "tags:write",
    "activities:read"
  ]
}
```

**Response:**

```json
{
  "success": true,
  "message": "API key created successfully. Copy the key now - it won't be shown again.",
  "key": "crm_a1b2c3d4e5f6...",
  "apiKey": {
    "id": "key-uuid",
    "label": "My Integration",
    "scopes": ["contacts:read", "contacts:write"],
    "rateLimitPerMinute": 60,
    "createdAt": "2024-01-21T10:00:00Z"
  }
}
```

**Important:** The `key` value is only shown once. Store it securely.

---

#### Revoke API Key

Revoke an API key.

```
DELETE /api/api-keys/:id
```

**Headers:** Include session cookie

**Response:**

```json
{
  "success": true,
  "message": "API key revoked successfully"
}
```

---

### Other Internal Endpoints

#### Get Contacts (Internal)

```
GET /api/contacts
```

**Headers:** Session cookie (optional)

**Query Parameters:** Same as API v1 contacts endpoint

---

#### Search Contacts by LinkedIn URL

```
GET /api/contacts/linkedin-search?url=<linkedin_url>
```

**Headers:** Include session cookie

---

#### Get Company Template

Get company details for auto-fill.

```
GET /api/companies/:companyName/template
```

**Headers:** Include session cookie

---

#### Bulk Auto-Fill Company Details

Auto-fill company details for all contacts.

```
POST /api/contacts/bulk-autofill
```

**Headers:** Include session cookie

---

#### Fix Full Names

Fix contacts with missing or incorrect full names.

```
POST /api/fix-fullnames
```

**Headers:** Include session cookie

---

## Integration Examples

### Zapier Integration

Use webhooks to connect with Zapier:

```javascript
// In your Zapier app configuration
const triggerNewContact = {
  key: 'new_contact',
  noun: 'Contact',
  display: {
    label: 'New Contact',
    description: 'Triggers when a new contact is created.'
  },
  operation: {
    perform: async (z, bundle) => {
      const response = await z.request({
        url: 'https://your-domain.com/api/v1/contacts',
        headers: {
          'Authorization': `Bearer ${bundle.authData.api_key}`,
        },
        params: {
          sortBy: 'createdAt',
          sortOrder: 'desc',
          pageSize: 10
        }
      });
      return response.data.data.contacts;
    }
  }
};
```

### Make (Integromat) Integration

Configure an HTTP module:

1. **URL:** `https://your-domain.com/api/v1/contacts`
2. **Method:** GET/POST/PATCH/DELETE
3. **Headers:**
   - `Authorization: Bearer crm_your_api_key`
   - `Content-Type: application/json`

### n8n Integration

```javascript
// HTTP Request Node Configuration
{
  "method": "GET",
  "url": "https://your-domain.com/api/v1/contacts",
  "authentication": "genericCredentialType",
  "genericAuthType": "httpHeaderAuth",
  "httpHeaderAuth": {
    "name": "Authorization",
    "value": "Bearer crm_your_api_key"
  }
}
```

### Salesforce Sync

Python script for bidirectional sync:

```python
import requests
from simple_salesforce import Salesforce

CRM_API = 'https://your-domain.com/api/v1'
CRM_KEY = 'crm_your_api_key'

# Connect to Salesforce
sf = Salesforce(username='user', password='pass', security_token='token')

def sync_crm_to_salesforce():
    # Get contacts from CRM
    response = requests.get(
        f'{CRM_API}/contacts',
        headers={'Authorization': f'Bearer {CRM_KEY}'}
    )
    contacts = response.json()['data']['contacts']
    
    for contact in contacts:
        # Check if contact exists in Salesforce
        query = f"SELECT Id FROM Contact WHERE Email = '{contact['email']}'"
        result = sf.query(query)
        
        if result['totalSize'] == 0:
            # Create new contact in Salesforce
            sf.Contact.create({
                'FirstName': contact['firstName'],
                'LastName': contact['lastName'],
                'Email': contact['email'],
                'Title': contact['title'],
                'Company': contact['company']
            })

def sync_salesforce_to_crm():
    # Get contacts from Salesforce
    sf_contacts = sf.query_all("SELECT FirstName, LastName, Email, Title FROM Contact")
    
    for record in sf_contacts['records']:
        requests.post(
            f'{CRM_API}/contacts',
            headers={
                'Authorization': f'Bearer {CRM_KEY}',
                'Content-Type': 'application/json'
            },
            json={
                'firstName': record['FirstName'],
                'lastName': record['LastName'],
                'email': record['Email'],
                'title': record['Title']
            }
        )
```

### HubSpot Integration

```python
import requests

HUBSPOT_KEY = 'your_hubspot_api_key'
CRM_KEY = 'crm_your_api_key'
CRM_API = 'https://your-domain.com/api/v1'

def import_from_hubspot():
    # Get contacts from HubSpot
    hubspot_response = requests.get(
        'https://api.hubapi.com/crm/v3/objects/contacts',
        headers={'Authorization': f'Bearer {HUBSPOT_KEY}'}
    )
    
    hubspot_contacts = hubspot_response.json()['results']
    
    # Bulk create in CRM
    crm_contacts = []
    for contact in hubspot_contacts:
        props = contact['properties']
        crm_contacts.append({
            'firstName': props.get('firstname'),
            'lastName': props.get('lastname'),
            'email': props.get('email'),
            'company': props.get('company')
        })
    
    response = requests.post(
        f'{CRM_API}/contacts/bulk',
        headers={
            'Authorization': f'Bearer {CRM_KEY}',
            'Content-Type': 'application/json'
        },
        json={'contacts': crm_contacts}
    )
    
    return response.json()
```

### Google Sheets Integration

Apps Script for syncing with Google Sheets:

```javascript
const CRM_API = 'https://your-domain.com/api/v1';
const CRM_KEY = 'crm_your_api_key';

function importContactsToSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': 'Bearer ' + CRM_KEY
    }
  };
  
  const response = UrlFetchApp.fetch(CRM_API + '/contacts?pageSize=100', options);
  const data = JSON.parse(response.getContentText());
  
  // Clear existing data
  sheet.clear();
  
  // Add headers
  const headers = ['ID', 'Name', 'Email', 'Company', 'Title', 'Phone', 'Industry'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  
  // Add contacts
  const contacts = data.data.contacts.map(c => [
    c.id,
    c.fullName,
    c.email,
    c.company,
    c.title,
    c.mobilePhone,
    c.industry
  ]);
  
  if (contacts.length > 0) {
    sheet.getRange(2, 1, contacts.length, headers.length).setValues(contacts);
  }
}

function exportContactsFromSheet() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const data = sheet.getDataRange().getValues();
  
  // Skip header row
  const contacts = data.slice(1).map(row => ({
    fullName: row[1],
    email: row[2],
    company: row[3],
    title: row[4],
    mobilePhone: row[5],
    industry: row[6]
  }));
  
  const options = {
    method: 'post',
    contentType: 'application/json',
    headers: {
      'Authorization': 'Bearer ' + CRM_KEY
    },
    payload: JSON.stringify({ contacts: contacts })
  };
  
  const response = UrlFetchApp.fetch(CRM_API + '/contacts/bulk', options);
  Logger.log(response.getContentText());
}
```

---

## Webhooks & External Integrations

### Setting Up Webhooks (Custom Implementation)

While the CRM doesn't have built-in webhook support, you can implement polling-based integrations:

```python
import time
import requests
from datetime import datetime, timedelta

CRM_API = 'https://your-domain.com/api/v1'
CRM_KEY = 'crm_your_api_key'

def poll_for_changes():
    last_check = datetime.utcnow() - timedelta(minutes=5)
    
    while True:
        response = requests.get(
            f'{CRM_API}/contacts',
            headers={'Authorization': f'Bearer {CRM_KEY}'},
            params={
                'updatedSince': last_check.isoformat() + 'Z',
                'pageSize': 100
            }
        )
        
        changes = response.json()['data']['contacts']
        
        for contact in changes:
            # Trigger your webhook/integration
            process_contact_change(contact)
        
        last_check = datetime.utcnow()
        time.sleep(300)  # Poll every 5 minutes

def process_contact_change(contact):
    # Send to your webhook endpoint
    requests.post(
        'https://your-webhook-endpoint.com/crm-update',
        json=contact
    )
```

---

## Best Practices

### 1. Use Bulk Operations

For large data operations, always use bulk endpoints to reduce API calls:

```python
# BAD: Multiple individual requests
for contact in contacts:
    requests.post(f'{API}/contacts', json=contact)

# GOOD: Single bulk request
requests.post(f'{API}/contacts/bulk', json={'contacts': contacts})
```

### 2. Implement Retry Logic

Handle rate limits and transient errors gracefully:

```python
import time
import requests

def api_request_with_retry(method, url, **kwargs):
    max_retries = 3
    
    for attempt in range(max_retries):
        response = requests.request(method, url, **kwargs)
        
        if response.status_code == 429:
            retry_after = int(response.headers.get('Retry-After', 60))
            time.sleep(retry_after)
            continue
        
        if response.status_code >= 500:
            time.sleep(2 ** attempt)
            continue
        
        return response
    
    raise Exception('Max retries exceeded')
```

### 3. Use Pagination

Always paginate through large result sets:

```python
def get_all_contacts():
    all_contacts = []
    page = 1
    
    while True:
        response = requests.get(
            f'{API}/contacts',
            headers=headers,
            params={'page': page, 'pageSize': 100}
        )
        
        data = response.json()['data']
        all_contacts.extend(data['contacts'])
        
        if page >= response.json()['meta']['totalPages']:
            break
        
        page += 1
    
    return all_contacts
```

### 4. Use Appropriate Scopes

Request only the scopes you need:

```json
{
  "label": "Read-Only Integration",
  "scopes": ["contacts:read", "stats:read"]
}
```

### 5. Store Keys Securely

- Never commit API keys to version control
- Use environment variables or secret managers
- Rotate keys periodically
- Revoke unused keys immediately

---

## Troubleshooting

### Common Issues

#### 401 Unauthorized

- Verify API key is correct and starts with `crm_`
- Check if API key has been revoked
- Ensure proper header format (`Authorization: Bearer key` or `X-API-Key: key`)

#### 403 Forbidden / Insufficient Scope

- Check the required scopes for the endpoint
- Verify your API key has the necessary scopes
- Create a new key with proper scopes if needed

#### 429 Rate Limit Exceeded

- Wait for the time specified in `Retry-After` header
- Implement exponential backoff
- Consider requesting a higher rate limit

#### 404 Not Found

- Verify the resource ID exists
- Check if the contact was deleted
- Ensure the endpoint URL is correct

### Debug Mode

Include the `X-Trace-Id` from responses when contacting support:

```json
{
  "error": {
    "traceId": "trace_1705412345_abc123def456"
  }
}
```

### Support

For API-related issues:
- Check this documentation first
- Include your trace ID in support requests
- Provide example requests and responses

---

## Changelog

### Version 1.0.0

- Initial API release
- Contact CRUD operations
- Bulk operations (create, update, delete)
- Tag management
- Activity logging
- LinkedIn enrichment integration
- Statistics and analytics endpoints
- Scope-based permissions
- Rate limiting

---

*Last updated: December 2024*
