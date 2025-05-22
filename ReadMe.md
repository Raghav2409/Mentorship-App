# 👩‍💼 Mentorship Platform – Backend API

This repository contains the backend API for the **Professional Development Platform** – a mentorship system supporting working mothers, skill development, and employee growth through intelligent matching, real-time communication, and adaptive learning.

---

## 🌐 Platform Overview

A full-stack-ready backend system that enables:

- 🔗 Mentorship matching between mentors and mentees
- 📅 Session scheduling and Microsoft calendar sync
- 📚 Personalized learning paths with progress tracking
- 🤱 Specialized features for working mothers
- 💬 Real-time messaging and notifications

---

## 📁 Key Files Overview

### 🔧 Core Server Files
| File | Description |
|------|-------------|
| `server/index.ts` | Main server entry (Express, middleware, CORS) |
| `server/routes.ts` | API endpoints + WebSocket server |
| `server/auth.ts` | Auth logic: JWT generation & user sessions |
| `server/db.ts` | Database config (Drizzle + PostgreSQL) |

### 📦 Data Models
| File | Description |
|------|-------------|
| `shared/schema.ts` | Schema for users, sessions, learning paths, etc. |

### 🔌 Integrations
| File | Description |
|------|-------------|
| `server/microsoft-auth.ts` | Microsoft Graph API (calendar) |
| `server/azure-email.ts` | Azure Communication Service (email) |
| `server/sendgrid.ts` | Alternate email service (SendGrid) |

### 🗂 File Uploads
| File | Description |
|------|-------------|
| `server/upload.ts` | File uploads (images/resources) using `multer` |

### 🗃 Database Operations
| File | Description |
|------|-------------|
| `server/storage.ts` | Interface for DB operations |
| `server/storage-db.ts` | Drizzle ORM-based DB operations |

---

## 🎯 Platform Functionality

### 👥 User Roles
- **Mentors**: Provide guidance
- **Mentees**: Seek mentorship
- **New Mothers**: Get targeted support
- **Admins**: Manage platform

### 🔄 Matching System
- Skill & goal-based intelligent pairing
- Admin-verified mentorship matches

### 📅 Session Management
- Schedule sessions
- Record notes & feedback
- Sync with Microsoft Calendar

### 📚 Learning Paths
- Curated resources by role/goal
- Track skill progress

### 🤱 Support for Working Mothers
- Mentorship by other mothers
- Maternal milestone tracker
- Support groups & mental wellness
- Proxy during maternity leave

### 💬 Community Features
- DM/chat between users
- Support group discussions
- Resource sharing & comments

### ⚡ Real-time Communication
- WebSocket-based messaging
- Live updates/notifications

---

## 🧱 Technical Architecture

- **Backend**: Node.js + Express + TypeScript
- **DB**: PostgreSQL + Drizzle ORM
- **Auth**: JWT tokens + role-based access
- **Real-time**: WebSocket
- **Integrations**: Microsoft Graph, Azure Email, SendGrid, OpenAI

---

## 🚀 Quick Start Guide

### 🔑 Prerequisites

- Node.js 18+
- PostgreSQL
- Docker (optional)

### ⚙️ Setup Instructions

```bash
git clone https://github.com/Raghav2409/Mentorship-App.git
cd Mentorship-App
npm install
cp .env.example .env

🔐 Fill in the .env:
DATABASE_URL=postgres://<your-db-url>
JWT_SECRET=your_jwt_secret
SESSION_SECRET=your_session_secret
MICROSOFT_CLIENT_ID=...
SENDGRID_API_KEY=...
🧱 Run Database Migrations
npm run db:push
▶️ Start the Server
# Development
npm run dev

# Production
npm run build
npm start
Visit: http://localhost:5000

📘 API Documentation

Endpoints & auth: API_DOCUMENTATION.md
Schema & entities: DATA_MODEL.md
Deployment setup: DEPLOYMENT.md
Postman tests: postman_collection.json
🧩 Frontend Integration

🔐 Login: /api/login returns JWT
🧾 Use JWT in Authorization header
🌐 WebSocket: connect to /ws
🧪 Test API: Import Postman collection
💡 Key Features

✅ Secure JWT Auth
🧠 Intelligent Matching
📅 Microsoft Graph Sync
💬 WebSocket Chat
🤱 Working Mother Features
📈 Progress Tracking
🔧 Environment Variables

Variable	Description
PORT	Server port (default: 5000)
DATABASE_URL	PostgreSQL connection string
JWT_SECRET	JWT signing key
SESSION_SECRET	Session security key
ALLOWED_ORIGINS	CORS allowed origins
🔒 Security Highlights

Passwords securely hashed
JWT tokens with expiration
Secure file uploads (Multer)
CORS setup for safe origins
🤝 Contributing

Follow existing API contracts
Add tests for new features
Ensure migrations are backward-compatible
Update documentation for changes
❓ Need Help?

Read API_DOCUMENTATION.md
Check Postman examples
Contact internal dev team
Empowering growth through mentorship, learning, and support – for every professional, especially working mothers.
