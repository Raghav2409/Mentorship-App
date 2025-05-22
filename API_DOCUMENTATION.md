# API Documentation

This document provides a comprehensive reference for all API endpoints available in the Professional Development Platform.

## Authentication

All API endpoints (except for `/api/login`, `/api/register`) require authentication using JWT tokens.

### Authentication Headers

```
Authorization: Bearer <token>
```

### Authentication Endpoints

#### Register a New User

```
POST /api/register
```

**Request Body**:
```json
{
  "username": "string",
  "email": "string",
  "password": "string",
  "fullName": "string",
  "role": "mentor|mentee|new_mother|admin"
}
```

**Response**: User object with token

#### Login

```
POST /api/login
```

**Request Body**:
```json
{
  "username": "string",
  "password": "string"
}
```

**Response**: User object with token

#### Get Current User

```
GET /api/user
```

**Response**: Current user object

---

## User Profiles

### Get User Profile

```
GET /api/profile
```

**Response**: User profile object

### Update User Profile

```
PUT /api/profile
```

**Request Body**:
```json
{
  "bio": "string",
  "department": "string",
  "position": "string",
  "organization": "string",
  "yearsOfExperience": "string",
  "skills": ["string"],
  "interests": ["string"],
  "mentorshipStyle": "string",
  "careerGoals": "string",
  "specializations": ["string"],
  "availability": {
    "monday": ["morning", "afternoon", "evening"],
    "tuesday": ["morning", "afternoon", "evening"],
    // ...other days
  },
  "acceptingNewMentees": true,
  "maxMentees": 5,
  "supportsNewMothers": true
}
```

**Response**: Updated profile object

### Update Profile Picture

```
POST /api/profile/picture
```

**Request**: Form data with "profilePicture" file

**Response**: Updated profile with picture URL

---

## Mentorship

### Get All Mentors

```
GET /api/mentors
```

**Query Parameters**:
- `supportsNewMothers` (boolean): Filter for mentors who support new mothers
- `department` (string): Filter by department
- `specialization` (string): Filter by specialization

**Response**: Array of mentor objects

### Get Mentor Capacity

```
GET /api/mentors/:id/capacity
```

**Response**:
```json
{
  "currentMentees": 3,
  "maxMentees": 5,
  "isAccepting": true
}
```

### Update Mentor Capacity

```
PUT /api/mentors/:id/capacity
```

**Request Body**:
```json
{
  "maxMentees": 5,
  "acceptingNewMentees": true
}
```

**Response**: Updated mentor capacity settings

---

## Mentorship Matches

### Create Match Request

```
POST /api/matches
```

**Request Body**:
```json
{
  "mentorId": 123,
  "goals": "string",
  "message": "string"
}
```

**Response**: Created match object

### Get Pending Matches (Admin Only)

```
GET /api/matches/pending
```

**Response**: Array of pending match requests

### Update Match Status

```
PUT /api/matches/:id
```

**Request Body**:
```json
{
  "status": "approved|rejected",
  "message": "string"
}
```

**Response**: Updated match object

### Get Matches for Mentee

```
GET /api/matches/mentee/:id
```

**Response**: Array of match objects for the mentee

### Get Matches for Mentor

```
GET /api/matches/mentor/:id
```

**Response**: Array of match objects for the mentor

---

## Sessions

### Create Session

```
POST /api/sessions
```

**Request Body**:
```json
{
  "mentorId": 123,
  "date": "2025-05-20T14:00:00Z",
  "duration": 60,
  "title": "string",
  "description": "string",
  "type": "initial|followup|review"
}
```

**Response**: Created session object

### Get All Sessions

```
GET /api/sessions
```

**Query Parameters**:
- `upcoming` (boolean): Filter for upcoming sessions
- `mentorId` (number): Filter by mentor ID
- `menteeId` (number): Filter by mentee ID

**Response**: Array of session objects

### Get Upcoming Sessions

```
GET /api/sessions/upcoming
```

**Response**: Array of upcoming session objects

### Update Session

```
PUT /api/sessions/:id
```

**Request Body**:
```json
{
  "date": "2025-05-20T14:00:00Z",
  "duration": 60,
  "title": "string",
  "description": "string",
  "status": "scheduled|completed|cancelled"
}
```

**Response**: Updated session object

---

## Session Notes

### Get Session Notes

```
GET /api/session/:sessionId/notes
```

**Response**: Array of note objects for the session

### Create Session Note

```
POST /api/session/notes
```

**Request Body**:
```json
{
  "sessionId": 123,
  "content": "string",
  "isPrivate": false
}
```

**Response**: Created note object

### Update Session Note

```
PUT /api/session/notes/:noteId
```

**Request Body**:
```json
{
  "content": "string",
  "isPrivate": false
}
```

**Response**: Updated note object

### Delete Session Note

```
DELETE /api/session/notes/:noteId
```

**Response**: Success message

---

## Action Items

### Get Session Action Items

```
GET /api/session/:sessionId/action-items
```

**Response**: Array of action item objects for the session

### Get Assigned Action Items

```
GET /api/action-items/assigned
```

**Response**: Array of action items assigned to the current user

### Create Action Item

```
POST /api/session/action-items
```

**Request Body**:
```json
{
  "sessionId": 123,
  "title": "string",
  "description": "string",
  "dueDate": "2025-05-30T00:00:00Z",
  "assignedToId": 456
}
```

**Response**: Created action item object

### Update Action Item

```
PUT /api/action-items/:itemId
```

**Request Body**:
```json
{
  "title": "string",
  "description": "string",
  "dueDate": "2025-05-30T00:00:00Z",
  "status": "pending|completed|cancelled"
}
```

**Response**: Updated action item object

### Delete Action Item

```
DELETE /api/action-items/:itemId
```

**Response**: Success message

---

## Feedback

### Submit Session Feedback

```
POST /api/feedback
```

**Request Body**:
```json
{
  "sessionId": 123,
  "rating": 5,
  "comments": "string",
  "areas": ["knowledge", "communication", "helpfulness"]
}
```

**Response**: Created feedback object

### Get Session Feedback

```
GET /api/feedback/session/:sessionId
```

**Response**: Feedback object for the session

---

## Messaging

### Send Message

```
POST /api/messages
```

**Request Body**:
```json
{
  "recipientId": 123,
  "content": "string"
}
```

**Response**: Created message object

### Get Conversation

```
GET /api/messages/conversation/:userId
```

**Response**: Array of message objects in the conversation

### Get Unread Message Count

```
GET /api/messages/unread
```

**Response**: 
```json
{
  "count": 5
}
```

### Mark Conversation as Read

```
POST /api/messages/clear/:userId
```

**Response**: Success message

---

## WebSocket Communication

The platform uses WebSockets for real-time messaging. Connect to `/ws` and authenticate:

```javascript
const socket = new WebSocket(`${protocol}//${host}/ws`);

// Authenticate after connection
socket.onopen = () => {
  socket.send(JSON.stringify({
    type: 'auth',
    userId: userId
  }));
};

// Receive messages
socket.onmessage = (event) => {
  const data = JSON.parse(event.data);
  // Handle message
};

// Send a message
function sendMessage(recipientId, content) {
  socket.send(JSON.stringify({
    type: 'message',
    recipientId: recipientId,
    content: content
  }));
}
```

---

## Working Mother Support

### Log Milestones

```
POST /api/milestone-logs
```

**Request Body**:
```json
{
  "type": "string",
  "title": "string",
  "date": "2025-05-15",
  "notes": "string"
}
```

**Response**: Created milestone log

### Get Milestone Logs

```
GET /api/milestone-logs
```

**Response**: Array of milestone logs

### Get AI Mental Health Support

```
POST /api/mental-health/chat
```

**Request Body**:
```json
{
  "message": "string"
}
```

**Response**: AI response message

### Get Mental Health Chat History

```
GET /api/mental-health/chat-history
```

**Response**: Array of chat messages

### Clear Mental Health Chat

```
POST /api/mental-health/clear-chat
```

**Response**: Success message

---

## Community and Support Groups

### Create Support Group

```
POST /api/support-groups
```

**Request Body**:
```json
{
  "name": "string",
  "description": "string",
  "type": "string",
  "isPrivate": false
}
```

**Response**: Created support group object

### Get Support Groups

```
GET /api/support-groups
```

**Response**: Array of support group objects

### Join Support Group

```
POST /api/group-memberships
```

**Request Body**:
```json
{
  "groupId": 123
}
```

**Response**: Created membership object

### Get User Groups

```
GET /api/user-groups
```

**Response**: Array of groups the user is a member of

### Get Group Members

```
GET /api/group-members/:groupId
```

**Response**: Array of users in the group

---

## Microsoft Integration

### Get Microsoft Connection Status

```
GET /api/microsoft/connection-status
```

**Response**: 
```json
{
  "connected": true,
  "email": "user@example.com"
}
```

### Get Microsoft Auth URL

```
GET /api/microsoft/auth
```

**Query Parameters**:
- `redirectUri` (string): Redirect URI after authentication

**Response**: 
```json
{
  "authUrl": "https://login.microsoftonline.com/..."
}
```

### Microsoft Auth Callback

```
GET /api/microsoft/callback
```

**Query Parameters**:
- `code` (string): Authorization code
- `state` (string): State parameter
- `session_state` (string): Session state

**Response**: Redirect to frontend with success/failure message

### Get Calendar Events

```
GET /api/microsoft/calendar
```

**Query Parameters**:
- `start` (string): Start date (ISO format)
- `end` (string): End date (ISO format)

**Response**: Array of calendar events

### Disconnect Microsoft Account

```
POST /api/microsoft/disconnect
```

**Response**: Success message

---

## Admin Functions

### Get Platform Statistics

```
GET /api/stats
```

**Response**:
```json
{
  "activeMentorships": 45,
  "upcomingSessions": 23,
  "learningPathsProgress": 0.67,
  "mentorshipSatisfaction": 4.8,
  "newUsersThisMonth": 12,
  "sessionCompletionRate": 0.92
}
```

### Create Learning Path

```
POST /api/learning-paths
```

**Request Body**:
```json
{
  "title": "string",
  "description": "string",
  "modules": [
    {
      "title": "string",
      "description": "string",
      "resources": [
        {
          "title": "string",
          "type": "article|video|exercise",
          "url": "string"
        }
      ]
    }
  ],
  "targetRoles": ["mentor", "mentee", "new_mother"]
}
```

**Response**: Created learning path object

### Get Learning Paths

```
GET /api/learning-paths
```

**Response**: Array of learning path objects

---

## Error Handling

All API endpoints follow a consistent error format:

```json
{
  "message": "Error message describing what went wrong"
}
```

Common HTTP status codes:
- `200`: Success
- `201`: Resource created
- `400`: Bad request (invalid input)
- `401`: Unauthorized (authentication required)
- `403`: Forbidden (insufficient permissions)
- `404`: Resource not found
- `500`: Server error

---

## Rate Limiting

API requests are limited to 100 requests per minute per IP address. When the limit is exceeded, the API returns a `429 Too Many Requests` response.

---

## API Versioning

The current API version is v1. All endpoints are accessible without a version prefix for backward compatibility.