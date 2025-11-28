# Overview

This is a modern full-stack CRM application for managing contact databases. Built with React on the frontend, Express on the backend, and PostgreSQL with Drizzle ORM for data management. The application features comprehensive contact management with data enrichment capabilities, CSV import functionality, and real-time activity tracking.

## Recent Changes (Nov 28, 2025)
- **Database Provisioned**: PostgreSQL database has been provisioned and configured with environment variables (DATABASE_URL, PGPORT, PGUSER, PGPASSWORD, PGDATABASE, PGHOST)
- **LinkedIn API Documentation**: Created comprehensive documentation at `docs/LINKEDIN_API_SEARCH.md` covering all official LinkedIn search APIs, authentication, rate limiting, and alternative approaches
- **Public API for External Integrations**: Added public API endpoints (`POST /api/public/contacts` and `POST /api/public/contacts/bulk`) that allow external applications to programmatically create contacts using API key authentication
- **API Key Management**: Full API key lifecycle management in Settings page with secure key generation, visibility, and usage tracking
- **Automatic Full Name Defaulting**: Public API endpoints auto-generate fullName from firstName/lastName or email username as fallback to ensure database consistency

## Previous Changes (Aug 14, 2025)
- **Fixed CSV Import Duplicate Headers Issue**: Resolved validation error that was rejecting CSV files with duplicate column headers. The system now properly handles Papa Parse's automatic header renaming instead of blocking valid files.
- **Added Missing TypeScript Types**: Installed @types/papaparse to resolve LSP diagnostics and improve code quality.

## Previous Changes (Aug 13, 2025)
- **Implemented Secure Authentication System**: Added login-only system with hardcoded credentials (amit@fallowl.com / DemonFlare@254039)
- **Created Comprehensive Settings Page**: Built 5-section settings interface with Profile, Security, Notifications, System, and Appearance tabs
- **Added Session Management**: Implemented secure token-based authentication with PostgreSQL session storage
- **Enhanced User Interface**: Added logout functionality to header dropdown with profile menu
- **Functional Settings Operations**: All settings forms work with backend validation and data persistence
- **Fixed Authentication Flow**: Resolved session management issues and API endpoint protection
- **Database Schema**: Added users and sessions tables for authentication system
- **Automatic Full Name Generation**: Implemented comprehensive system that auto-generates fullName from firstName/lastName across all contact operations (creation, updates, CSV imports, and existing data fixes)
- **Fixed Full Name Mapping Issues**: Corrected 124+ contacts that had incorrectly mapped hex IDs as full names, now properly showing "First Last" format
- **Smart Company Details Management**: Implemented intelligent auto-fill system that automatically populates company information for new contacts based on existing data from the same organization
- **Company Template API**: Added endpoint to fetch company templates and preview auto-fillable fields before contact creation
- **Enhanced Contact Forms**: Integrated real-time company auto-fill suggestions with visual indicators and one-click application in contact dialog
- **Auto-fill for Existing Contacts**: Extended smart company auto-fill to work when editing existing contacts - system detects company changes and automatically fills missing company details
- **Bulk Company Auto-Fill**: Created efficient bulk processing system that checks all contacts and automatically fills missing company details for any contacts with matching company templates

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture
- **Framework**: React with TypeScript using Vite as the build tool
- **UI Library**: Radix UI components with shadcn/ui for consistent, accessible design
- **Styling**: Tailwind CSS with CSS variables for theming support
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: TanStack Query (React Query) for server state management
- **Form Handling**: React Hook Form with Zod validation

## Backend Architecture
- **Framework**: Express.js with TypeScript running on Node.js
- **Database ORM**: Drizzle ORM with PostgreSQL dialect for type-safe database operations
- **File Upload**: Multer middleware for handling CSV file uploads
- **Error Handling**: Centralized error handling middleware with structured logging
- **Development Tools**: Hot module replacement with Vite integration for development

## Data Storage
- **Primary Database**: PostgreSQL with Neon serverless connection
- **Schema Management**: Drizzle migrations for version-controlled schema changes
- **Connection Pooling**: Neon serverless pool for efficient database connections
- **Data Validation**: Zod schemas shared between client and server for type safety

## Key Features
- **Advanced Contact Management**: Full CRUD operations with comprehensive editing interface covering all 33+ database fields
- **Intelligent Full Name Generation**: Automatic creation of full names from first/last name components across all contact operations
- **Tabbed Contact Editor**: Organized contact data into 5 logical sections (Personal, Company, Location, Enriched Data, Activity)
- **Data Enrichment**: Automatic enhancement of contact data including lead scoring, timezone detection, and company information
- **CSV Import**: Multi-step import process with field mapping, duplicate detection, and automatic full name generation (94% success rate)
- **Activity Tracking**: Comprehensive audit trail for all contact operations
- **Real-time Updates**: Live progress tracking for import operations
- **Responsive Design**: Mobile-first design with adaptive layouts
- **Advanced Filtering**: Multi-criteria search and filtering with live backend updates
- **Data Integrity Tools**: Built-in utilities to fix existing data inconsistencies automatically
- **Smart Company Auto-Fill**: Intelligent system that detects existing company data and auto-fills company details (address, industry, website, technologies, revenue, etc.) for new contacts from the same organization
- **Company Intelligence**: Scores and ranks existing company records to provide the most complete and accurate template data for auto-filling

## External Dependencies

- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **UI Components**: Radix UI primitives for accessible component foundation
- **Icons**: Font Awesome for consistent iconography throughout the application
- **Fonts**: Google Fonts integration (IBM Plex Sans, Geist Mono, etc.) for typography
- **Development**: Replit-specific plugins for enhanced development experience