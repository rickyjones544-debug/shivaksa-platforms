# Shivaksa Platform

Production-grade multi-tenant BPO, AI Calling, VoIP, CRM, and Software Development platform for Shivaksa Technologies LLC.

## Overview

This platform provides:
- **Multi-tenant architecture** for independent client organizations
- **BPO services** with agent management, teams, and queues
- **AI voice calling** with configurable AI agents
- **VoIP integration** with external providers (Telnyx, Twilio)
- **CRM** for leads, contacts, campaigns, and call history
- **QA module** for call review and quality scoring
- **Reporting** for calls, agents, campaigns, and performance
- **Development module** for website and mobile app projects
- **Billing** for invoices and account management
- **Strict tenant isolation** enforced at database level
- **Role-based access control (RBAC)** with granular permissions

## Tech Stack

- **Frontend**: Next.js 16.3.3 with TypeScript
- **Styling**: Tailwind CSS v4
- **Database**: PostgreSQL (with Prisma ORM)
- **Authentication**: Session-based with secure HttpOnly cookies
- **AI Integration**: OpenAI, Deepgram (via abstraction layer)
- **VoIP Integration**: Telnyx, Twilio (via abstraction layer)
- **Storage**: AWS S3 / Cloudflare R2 (via abstraction layer)
- **Email**: SMTP (Namecheap Private Email)

## Project Structure

```
shivaksa-platform/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Authentication pages
│   ├── (admin)/             # Admin dashboard
│   ├── (client)/            # Client portal
│   ├── (agent)/             # Agent portal
│   ├── api/                 # API routes
│   ├── components/          # React components
│   └── middleware.ts         # Authentication & tenant middleware
├── lib/                     # Business logic
│   ├── auth/                # Authentication logic
│   ├── rbac/                # Role-based access control
│   ├── tenant/              # Tenant isolation
│   ├── crm/                 # CRM operations
│   ├── ai/                  # AI agent operations
│   ├── voip/                # VoIP operations
│   ├── bpo/                 # BPO operations
│   ├── qa/                  # QA operations
│   ├── reports/             # Reporting logic
│   ├── development/         # Development project operations
│   ├── billing/             # Billing operations
│   ├── audit/               # Audit logging
│   ├── utils/               # Utility functions
│   └── db/                  # Database utilities
├── services/                # External integrations
│   ├── ai/                  # AI provider wrappers
│   ├── voip/                # VoIP provider wrappers
│   ├── storage/             # Storage provider wrappers
│   └── email/               # Email service wrapper
├── types/                   # TypeScript type definitions
├── prisma/                  # Prisma schema and migrations
└── public/                  # Static assets
```

## Getting Started

### Prerequisites

- Node.js 18+ installed
- PostgreSQL database running locally or accessible
- Git

### Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd shivaksa-platform
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env.local
```

Edit `.env.local` with your actual values:
- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret key (minimum 32 characters)
- `NEXTAUTH_URL`: http://localhost:3000
- AI provider API keys (OpenAI, Deepgram)
- VoIP provider credentials (Telnyx, Twilio)
- Storage credentials (AWS S3 or Cloudflare R2)
- SMTP settings for email

4. Set up the database:
```bash
npx prisma generate
npx prisma db push
# Or run migrations: npx prisma migrate dev
```

5. Run the development server:
```bash
npm run dev
```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## Environment Variables

### Required

- `DATABASE_URL`: PostgreSQL connection string
- `NEXTAUTH_SECRET`: Random secret for session encryption
- `NEXTAUTH_URL`: Application URL

### Optional (for integrations)

- `OPENAI_API_KEY`: OpenAI API key for AI agents
- `DEEPGRAM_API_KEY`: Deepgram API key for voice processing
- `TELNYX_API_KEY`: Telnyx API key
- `TELNYX_API_SECRET`: Telnyx API secret
- `TWILIO_ACCOUNT_SID`: Twilio account SID
- `TWILIO_AUTH_TOKEN`: Twilio auth token
- `AWS_ACCESS_KEY_ID`: AWS access key for S3
- `AWS_SECRET_ACCESS_KEY`: AWS secret key for S3
- `AWS_REGION`: AWS region (e.g., us-east-1)
- `AWS_S3_BUCKET`: S3 bucket name
- `SMTP_HOST`: SMTP server host
- `SMTP_PORT`: SMTP port (usually 587)
- `SMTP_USER`: SMTP username
- `SMTP_PASS`: SMTP password
- `SMTP_FROM`: From email address

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm run format` - Format code with Prettier

## API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `POST /api/auth/register` - User registration
- `POST /api/auth/reset-password` - Password reset

### Admin
- `GET/POST /api/admin/organizations` - Manage organizations
- `GET/POST /api/admin/users` - Manage users
- `GET /api/admin/dashboard` - Admin dashboard stats

### Client
- `GET /api/client/dashboard` - Client dashboard stats
- `GET/POST /api/client/campaigns` - Manage campaigns
- `GET/POST /api/client/leads` - Manage leads
- `GET /api/client/calls` - Call history

### Agent
- `GET /api/agent/dashboard` - Agent dashboard stats
- `GET /api/agent/calls` - Agent's calls
- `GET /api/agent/performance` - Agent performance

### CRM
- `GET/POST /api/crm/leads` - Lead management
- `GET/POST /api/crm/contacts` - Contact management
- `GET/POST /api/crm/campaigns` - Campaign management
- `GET/POST /api/crm/notes` - Note management

### AI
- `GET/POST /api/ai/agents` - AI agent management
- `POST /api/ai/calls` - Trigger AI call

### VoIP
- `GET/POST /api/voip/numbers` - Phone number management
- `GET /api/voip/calls` - VoIP call logs

### BPO
- `GET/POST /api/bpo/agents` - BPO agent management
- `GET/POST /api/bpo/teams` - Team management
- `GET/POST /api/bpo/queues` - Queue management

### QA
- `GET/POST /api/qa/reviews` - QA review management
- `GET/POST /api/qa/forms` - QA form management

### Reports
- `GET /api/reports/calls` - Call reports
- `GET /api/reports/agents` - Agent performance reports
- `GET /api/reports/campaigns` - Campaign performance reports

### Development
- `GET/POST /api/development/projects` - Project management
- `GET/POST /api/development/tasks` - Task management

### Billing
- `GET/POST /api/billing/invoices` - Invoice management
- `GET/POST /api/billing/accounts` - Billing account management

### Settings
- `GET/PUT /api/settings/organization` - Organization settings
- `GET/POST /api/settings/users` - User management
- `GET/POST /api/settings/integrations` - Integration configuration

## Security

### Multi-Tenant Isolation

- All business entities are scoped to organizations
- Database queries automatically include `organization_id`
- Organization ID is never trusted from browser
- Tenant isolation enforced at database level

### Authentication

- Secure session-based authentication
- HttpOnly, Secure, SameSite cookies
- Password hashing with bcrypt
- Brute-force protection with rate limiting
- Account lockout after failed attempts

### Authorization

- Role-based access control (RBAC)
- Granular permissions per resource and action
- Server-side authorization checks
- Resource-level authorization (e.g., recording access)

### Data Security

- Sensitive data encrypted at rest
- API keys stored in environment variables
- File access requires authorization
- Audit logging for sensitive operations

## Development Phases

1. **Phase 1**: Project foundation (current)
2. **Phase 2**: Authentication
3. **Phase 3**: Multi-tenant architecture
4. **Phase 4**: Admin dashboard
5. **Phase 5**: Client portal
6. **Phase 6**: Agent portal
7. **Phase 7**: CRM module
8. **Phase 8**: AI module
9. **Phase 9**: VoIP integration
10. **Phase 10**: BPO module
11. **Phase 11**: QA module
12. **Phase 12**: Reports
13. **Phase 13**: Development module
14. **Phase 14**: Billing
15. **Phase 15**: Production security hardening
16. **Phase 16**: Production deployment

## Production Deployment

### Recommended Setup

- **VPS**: Hetzner Cloud (Ubuntu 22.04 LTS)
- **Database**: Managed PostgreSQL (Supabase, Neon, or RDS)
- **Storage**: AWS S3 or Cloudflare R2
- **Domain**: app.shivaksatechnology.com
- **SSL**: Let's Encrypt (certbot)
- **Process Manager**: PM2
- **Reverse Proxy**: Nginx

### Deployment Steps

1. Build the application:
```bash
npm run build
```

2. Set environment variables on the server

3. Start with PM2:
```bash
pm2 start npm --name "shivaksa-platform" -- start
```

4. Configure Nginx reverse proxy with SSL

5. Set up automated database backups

## License

Copyright © 2026 Shivaksa Technologies LLC. All rights reserved.
