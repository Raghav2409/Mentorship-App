# Deployment Guide

This document provides instructions for deploying the Professional Development Platform.

## Prerequisites

- Node.js 18+ and npm
- PostgreSQL database
- Environment variables (see `.env.example`)

## Deployment Options

### Option 1: Standard Node.js Deployment

1. **Clone the repository**

   ```bash
   git clone [repository-url]
   cd [repository-directory]
   ```

2. **Install dependencies**

   ```bash
   npm install
   ```

3. **Build the application**

   ```bash
   npm run build
   ```

4. **Set up environment variables**

   Copy `.env.example` to `.env` and fill in the required values:

   ```bash
   cp .env.example .env
   # Edit .env with your environment-specific values
   ```

5. **Run database migrations**

   ```bash
   npm run db:push
   ```

6. **Start the production server**

   ```bash
   npm start
   ```

### Option 2: Docker Deployment

1. **Build the Docker image**

   ```bash
   docker build -t mentorship-platform .
   ```

2. **Run the container**

   ```bash
   docker run -d --name mentorship-platform \
     -p 5000:5000 \
     --env-file .env \
     mentorship-platform
   ```

### Option 3: Docker Compose

Create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  app:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - JWT_SECRET=${JWT_SECRET}
      - SESSION_SECRET=${SESSION_SECRET}
      - MICROSOFT_CLIENT_ID=${MICROSOFT_CLIENT_ID}
      - MICROSOFT_CLIENT_SECRET=${MICROSOFT_CLIENT_SECRET}
      - MICROSOFT_TENANT_ID=${MICROSOFT_TENANT_ID}
      - AZURE_COMMUNICATION_CONNECTION_STRING=${AZURE_COMMUNICATION_CONNECTION_STRING}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ALLOWED_ORIGINS=${ALLOWED_ORIGINS}
    volumes:
      - ./uploads:/app/uploads
    restart: unless-stopped
```

Then run:

```bash
docker-compose up -d
```

## Environment Variables

| Variable | Description | Required |
|----------|-------------|:--------:|
| DATABASE_URL | PostgreSQL connection string | Yes |
| JWT_SECRET | Secret for JWT token generation | Yes |
| SESSION_SECRET | Secret for session management | Yes |
| MICROSOFT_CLIENT_ID | Microsoft OAuth client ID | Yes |
| MICROSOFT_CLIENT_SECRET | Microsoft OAuth client secret | Yes |
| MICROSOFT_TENANT_ID | Microsoft OAuth tenant ID | Yes |
| AZURE_COMMUNICATION_CONNECTION_STRING | Azure Communication Services connection string | Yes |
| OPENAI_API_KEY | OpenAI API key for AI features | Yes |
| ALLOWED_ORIGINS | Comma-separated list of allowed CORS origins | No |
| PORT | Server port (defaults to 5000) | No |

## Health Checks

The application provides a health endpoint at `/api/health` that returns a 200 status code if the server is running and can connect to the database.

## Database Backups

It's recommended to set up regular database backups:

```bash
# Example PostgreSQL backup command
pg_dump -U [username] -d [database] > backup_$(date +%Y%m%d).sql
```

## Monitoring

For production deployments, consider adding:

- Application monitoring (e.g., New Relic, Datadog)
- Error tracking (e.g., Sentry)
- Log aggregation (e.g., ELK stack)

## Security Considerations

- Keep all environment variables secure
- Regularly update dependencies
- Set up a firewall to only allow necessary connections
- Use HTTPS in production with a valid certificate