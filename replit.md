# Overview

This is a modern full-stack CRM application for managing contact databases. Built with React on the frontend, Express on the backend, and PostgreSQL with Drizzle ORM for data management. The application features comprehensive contact management with data enrichment capabilities, CSV import functionality, and real-time activity tracking.

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
- **Contact Management**: Full CRUD operations with advanced filtering and pagination
- **Data Enrichment**: Automatic enhancement of contact data including lead scoring, timezone detection, and company information
- **CSV Import**: Multi-step import process with field mapping and duplicate detection
- **Activity Tracking**: Comprehensive audit trail for all contact operations
- **Real-time Updates**: Live progress tracking for import operations
- **Responsive Design**: Mobile-first design with adaptive layouts

## External Dependencies

- **Database**: Neon PostgreSQL serverless database for scalable data storage
- **UI Components**: Radix UI primitives for accessible component foundation
- **Icons**: Font Awesome for consistent iconography throughout the application
- **Fonts**: Google Fonts integration (IBM Plex Sans, Geist Mono, etc.) for typography
- **Development**: Replit-specific plugins for enhanced development experience