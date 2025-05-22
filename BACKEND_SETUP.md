# Backend-Only Setup Guide

This guide is intended for internal teams who want to use the Professional Development Platform API with their own custom frontend.

## Repository Setup

### 1. Create a Backend-Only Repository

Clone the current repository and keep only the backend components:

```bash
# Clone the repository
git clone [original-repo-url] mentorship-platform-backend
cd mentorship-platform-backend

# Create a new git repository
rm -rf .git
git init

# Remove frontend-specific files and directories
rm -rf client/
```

### 2. Modify Package Configuration

Update the package.json to include only backend dependencies:

```bash
# Install required packages for backend only
npm install express drizzle-orm drizzle-zod zod jsonwebtoken cors @neondatabase/serverless ws multer
npm install -D drizzle-kit typescript @types/express @types/node @types/ws @types/multer @types/cors
```

Create a simplified package.json:

```json
{
  "name": "mentorship-platform-backend",
  "version": "1.0.0",
  "type": "module",
  "license": "MIT",
  "scripts": {
    "dev": "tsx server/index.ts",
    "build": "esbuild server/index.ts --platform=node --packages=external --bundle --format=esm --outdir=dist",
    "start": "NODE_ENV=production node dist/index.js",
    "db:push": "drizzle-kit push"
  }
}
```

### 3. Update the Server Configuration

Modify server/index.ts to:
- Use CORS for all routes
- Remove Vite integration
- Serve a simple API status page

```typescript
// server/index.ts
import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import path from "path";
import cors from "cors";
import { UPLOADS_URL } from "./upload";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Configure CORS for all routes
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  maxAge: 86400 // 24 hours
};

app.use(cors(corsOptions));

// Serve uploaded files
app.use(UPLOADS_URL, express.static(path.join(process.cwd(), 'uploads')));

// API status endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '1.0.0'
  });
});

// Register routes
(async () => {
  const server = await registerRoutes(app);

  // Error handling middleware
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    
    console.error(`Error: ${message}`);
    res.status(status).json({ message });
  });

  // Set port from environment variable or use default
  const port = process.env.PORT || 5000;
  
  server.listen({
    port,
    host: "0.0.0.0",
  }, () => {
    console.log(`API server running on port ${port}`);
  });
})();
```

## Testing the API

### 1. Using the Postman Collection

Import the provided `postman_collection.json` into Postman:

1. Open Postman
2. Click "Import" button
3. Select the `postman_collection.json` file
4. Create an environment with variable `baseUrl` set to your API endpoint (e.g., `http://localhost:5000`)
5. After login, set the `authToken` variable to the JWT token received

### 2. Using curl

Here are some example curl commands for basic API operations:

```bash
# Health check
curl http://localhost:5000/api/health

# Register a new user
curl -X POST http://localhost:5000/api/register \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","email":"test@example.com","password":"securepassword123","fullName":"Test User","role":"mentor"}'

# Login
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username":"testuser","password":"securepassword123"}'

# Get current user (with auth token)
curl http://localhost:5000/api/user \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

## WebSocket Integration

The backend provides WebSocket support for real-time messaging:

```javascript
// Example client-side implementation
const connectWebSocket = (userId, authToken) => {
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const wsUrl = `${protocol}//${apiHost}/ws`;
  
  const socket = new WebSocket(wsUrl);
  
  socket.onopen = () => {
    // Authenticate
    socket.send(JSON.stringify({
      type: 'auth',
      userId: userId
    }));
    console.log('WebSocket connected');
  };
  
  socket.onmessage = (event) => {
    const data = JSON.parse(event.data);
    // Handle message based on type
    switch(data.type) {
      case 'message':
        console.log(`New message from ${data.senderName}: ${data.content}`);
        break;
      case 'notification':
        console.log(`Notification: ${data.content}`);
        break;
      default:
        console.log('Unknown message type', data);
    }
  };
  
  socket.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
  
  socket.onclose = () => {
    console.log('WebSocket connection closed');
  };
  
  return socket;
};
```

## Database Setup

### 1. Create Required Tables

The database schema is defined in `shared/schema.ts`. Use Drizzle to push the schema to your database:

```bash
# Set your database URL in .env
echo "DATABASE_URL=postgres://username:password@host:5432/database" > .env

# Run database migrations
npm run db:push
```

### 2. Seeding the Database (Optional)

For testing, you may want to seed the database with sample data:

```typescript
// server/seed.ts
import { db } from './db';
import { users, profiles, UserRole } from '@shared/schema';
import { hashPassword } from './auth';

async function seed() {
  // Create admin user
  const [admin] = await db.insert(users).values({
    username: 'admin',
    password: await hashPassword('adminpassword'),
    email: 'admin@example.com',
    fullName: 'System Admin',
    role: UserRole.ADMIN,
    active: true
  }).returning();
  
  // Create admin profile
  await db.insert(profiles).values({
    userId: admin.id,
    department: 'IT',
    position: 'System Administrator',
    onboardingStatus: 'completed',
    onboardingStep: 3,
    onboardingCompletedAt: new Date()
  });
  
  console.log('Database seeded successfully');
}

seed().catch(console.error);
```

Run with:
```bash
tsx server/seed.ts
```

## Configuration Options

The backend supports several environment variables:

```
# .env configuration example
PORT=5000                           # Server port
DATABASE_URL=postgres://...         # PostgreSQL connection string
JWT_SECRET=your_jwt_secret          # Secret for JWT tokens
SESSION_SECRET=your_session_secret  # Secret for sessions
ALLOWED_ORIGINS=https://your-frontend.com,https://staging.your-frontend.com
OPENAI_API_KEY=your_openai_key      # For AI support features
AZURE_COMMUNICATION_CONNECTION_STRING=your_azure_connection # For email features
```

## Authentication

The API uses JWT (JSON Web Token) authentication:

1. Clients obtain a token via `/api/login`
2. Token must be included in all authenticated requests in the `Authorization` header:
   ```
   Authorization: Bearer <token>
   ```
3. Token expiration is set to 24 hours by default

## Additional Resources

For more detailed information, refer to:

- [API Documentation](API_DOCUMENTATION.md) - Complete API reference
- [Data Model](DATA_MODEL.md) - Database schema details
- [Deployment Guide](DEPLOYMENT.md) - Production deployment instructions