# Data Model Documentation

This document provides an overview of the database schema for the Professional Development Platform.

## Overview

The platform's database is built around several core entities:
- Users and their profiles
- Mentorship relationships
- Session management
- Feedback and progress tracking
- Support for working mothers
- Microsoft integration

## Entity Relationship Diagram

```
┌─────────────┐       ┌─────────────┐       ┌─────────────┐
│    users    │       │   profiles  │       │   sessions  │
├─────────────┤       ├─────────────┤       ├─────────────┤
│ id          │       │ id          │       │ id          │
│ username    │       │ userId      │━━━━━━▶│ mentorId    │
│ password    │       │ department  │       │ menteeId    │
│ email       │       │ position    │       │ title       │
│ fullName    │       │ skills      │       │ description │
│ role        │       │ interests   │       │ date        │
│ active      │       │ onboarding  │       │ duration    │
└─────────────┘       │ ...         │       │ status      │
      ▲               └─────────────┘       └─────────────┘
      │                      ▲                     ▲
      │                      │                     │
      │               ┌─────────────┐       ┌─────────────┐
      │               │   matches   │       │ sessionNotes │
      │               ├─────────────┤       ├─────────────┤
      └━━━━━━━━━━━━━━▶│ id          │       │ id          │
                      │ mentorId    │       │ sessionId   │
                      │ menteeId    │       │ createdById │
                      │ goal        │       │ notes       │
                      │ status      │       │ isPrivate   │
                      └─────────────┘       └─────────────┘
```

## Tables

### Users

The `users` table stores core user information and authentication details.

| Column           | Type      | Description                              |
|------------------|-----------|------------------------------------------|
| id               | serial    | Primary key                              |
| username         | text      | Unique username                          |
| password         | text      | Hashed password                          |
| email            | text      | User email (unique)                      |
| fullName         | text      | User's full name                         |
| role             | text      | User role (admin, mentor, mentee, new_mother) |
| securityQuestion | text      | Optional security question for password recovery |
| securityAnswer   | text      | Answer to security question              |
| active           | boolean   | Whether the user account is active       |
| createdAt        | timestamp | When the user was created                |

### Profiles

The `profiles` table extends user information with professional details and preferences.

| Column               | Type      | Description                           |
|----------------------|-----------|---------------------------------------|
| id                   | serial    | Primary key                           |
| userId               | integer   | Foreign key to users.id               |
| department           | text      | User's department                     |
| position             | text      | Job position/title                    |
| organization         | text      | Company/organization                  |
| bio                  | text      | User biography                        |
| skills               | json      | Array of skills                       |
| interests            | json      | Array of interests                    |
| goals                | text      | Career or learning goals              |
| availability         | json      | Availability schedule                 |
| yearsOfExperience    | text      | Years of professional experience      |
| areaOfExpertise      | text      | Primary area of expertise             |
| mentorshipStyle      | text      | Preferred mentoring approach          |
| preferredCommunication | text    | Preferred communication method        |
| maxMenteeCapacity    | integer   | Maximum number of mentees             |
| currentMenteeCount   | integer   | Current number of mentees             |
| acceptingNewMentees  | boolean   | Whether accepting new mentees         |
| supportsNewMothers   | boolean   | Whether mentor supports new mothers   |
| onboardingStatus     | text      | Onboarding status                     |
| onboardingStep       | integer   | Current onboarding step               |
| onboardingCompletedAt | timestamp | When onboarding was completed        |

### Sessions

The `sessions` table manages mentorship meeting information.

| Column        | Type      | Description                               |
|---------------|-----------|-------------------------------------------|
| id            | serial    | Primary key                               |
| mentorId      | integer   | Foreign key to users.id (mentor)          |
| menteeId      | integer   | Foreign key to users.id (mentee)          |
| title         | text      | Session title                             |
| description   | text      | Session description                       |
| agenda        | text      | Session agenda                            |
| date          | timestamp | Scheduled date and time                   |
| duration      | integer   | Session duration in minutes               |
| status        | text      | Status (pending, confirmed, completed...) |
| meetingLink   | text      | Virtual meeting link if applicable        |
| proposedDate  | timestamp | Date proposed for rescheduling            |
| proposedBy    | integer   | User who proposed rescheduling            |
| responseMessage | text    | Message about response/change             |
| createdAt     | timestamp | When session was created                  |

### Feedback

The `feedback` table stores session feedback from participants.

| Column      | Type      | Description                         |
|-------------|-----------|-------------------------------------|
| id          | serial    | Primary key                         |
| sessionId   | integer   | Foreign key to sessions.id          |
| fromUserId  | integer   | Foreign key to users.id (reviewer)  |
| rating      | integer   | Numerical rating                    |
| comments    | text      | Feedback comments                   |
| createdAt   | timestamp | When feedback was submitted         |

### Matches

The `matches` table tracks mentor-mentee relationships.

| Column    | Type      | Description                               |
|-----------|-----------|-------------------------------------------|
| id        | serial    | Primary key                               |
| mentorId  | integer   | Foreign key to users.id (mentor)          |
| menteeId  | integer   | Foreign key to users.id (mentee)          |
| goal      | text      | Mentorship goal                           |
| status    | text      | Status (pending, approved, rejected)      |
| adminId   | integer   | Admin who approved/rejected the match     |
| createdAt | timestamp | When match was created                    |

### Session Notes

The `sessionNotes` table stores notes from mentorship sessions.

| Column      | Type      | Description                             |
|-------------|-----------|-----------------------------------------|
| id          | serial    | Primary key                             |
| sessionId   | integer   | Foreign key to sessions.id              |
| createdById | integer   | Foreign key to users.id (note creator)  |
| notes       | text      | Note content                            |
| isPrivate   | boolean   | Whether note is private to the creator  |
| createdAt   | timestamp | When note was created                   |
| updatedAt   | timestamp | When note was last updated              |

### Action Items

The `actionItems` table tracks follow-up tasks from sessions.

| Column       | Type      | Description                             |
|--------------|-----------|-----------------------------------------|
| id           | serial    | Primary key                             |
| sessionId    | integer   | Foreign key to sessions.id              |
| assignedToId | integer   | Foreign key to users.id (assignee)      |
| createdById  | integer   | Foreign key to users.id (creator)       |
| title        | text      | Action item title                       |
| description  | text      | Detailed description                    |
| dueDate      | timestamp | When action item is due                 |
| status       | text      | Status (pending, in_progress, completed)|
| createdAt    | timestamp | When action item was created            |
| updatedAt    | timestamp | When action item was last updated       |

### Learning Paths

The `learningPaths` table defines structured learning content.

| Column      | Type      | Description                              |
|-------------|-----------|------------------------------------------|
| id          | serial    | Primary key                              |
| title       | text      | Learning path title                      |
| category    | text      | Category (e.g., leadership, technical)   |
| description | text      | Learning path description                |
| modules     | json      | Array of learning modules                |
| createdAt   | timestamp | When learning path was created           |

### User Learning Progress

The `userLearningProgress` table tracks user progress through learning paths.

| Column           | Type      | Description                         |
|------------------|-----------|-------------------------------------|
| id               | serial    | Primary key                         |
| userId           | integer   | Foreign key to users.id             |
| pathId           | integer   | Foreign key to learningPaths.id     |
| completedModules | json      | Array of completed module IDs       |
| progress         | integer   | Overall progress percentage         |
| startedAt        | timestamp | When user started the path          |
| completedAt      | timestamp | When user completed the path        |

### Working Mother Support

#### Milestone Logs

The `milestoneLogs` table tracks important events for new mothers.

| Column    | Type      | Description                              |
|-----------|-----------|------------------------------------------|
| id        | serial    | Primary key                              |
| userId    | integer   | Foreign key to users.id                  |
| type      | text      | Milestone type                           |
| title     | text      | Milestone title                          |
| notes     | text      | Additional notes                         |
| date      | timestamp | Date of the milestone                    |

#### Support Groups

The `supportGroups` table manages community groups.

| Column      | Type      | Description                            |
|-------------|-----------|----------------------------------------|
| id          | serial    | Primary key                            |
| name        | text      | Group name                             |
| description | text      | Group description                      |
| memberCount | integer   | Number of members                      |
| lastActive  | timestamp | When group was last active             |
| createdAt   | timestamp | When group was created                 |

#### Group Memberships

The `groupMemberships` table tracks user participation in groups.

| Column    | Type      | Description                              |
|-----------|-----------|------------------------------------------|
| id        | serial    | Primary key                              |
| userId    | integer   | Foreign key to users.id                  |
| groupId   | integer   | Foreign key to supportGroups.id          |
| joinedAt  | timestamp | When user joined the group               |

#### Proxy Requests

The `proxyRequests` table manages maternity leave coverage.

| Column         | Type      | Description                            |
|----------------|-----------|----------------------------------------|
| id             | serial    | Primary key                            |
| motherId       | integer   | Foreign key to users.id (new mother)   |
| proxyId        | integer   | Foreign key to users.id (covering)     |
| status         | text      | Request status                         |
| startDate      | timestamp | Start date of leave                    |
| expectedEndDate| timestamp | Expected end date                      |
| actualEndDate  | timestamp | Actual end date when completed         |
| notes          | text      | Additional notes                       |
| createdAt      | timestamp | When request was created               |
| updatedAt      | timestamp | When request was last updated          |

#### Mental Health Chats

The `mentalHealthChats` table stores AI support conversations.

| Column     | Type      | Description                              |
|------------|-----------|------------------------------------------|
| id         | serial    | Primary key                              |
| userId     | integer   | Foreign key to users.id                  |
| message    | text      | Chat message                             |
| isFromUser | boolean   | Whether message is from user or AI       |
| sentiment  | text      | AI-analyzed sentiment                    |
| createdAt  | timestamp | When message was created                 |

### Messaging

#### Direct Messages

The `directMessages` table manages user-to-user messaging.

| Column     | Type      | Description                              |
|------------|-----------|------------------------------------------|
| id         | serial    | Primary key                              |
| senderId   | integer   | Foreign key to users.id (sender)         |
| receiverId | integer   | Foreign key to users.id (receiver)       |
| message    | text      | Message content                          |
| read       | boolean   | Whether message has been read            |
| createdAt  | timestamp | When message was sent                    |

#### User Connections

The `userConnections` table tracks relationships between users.

| Column      | Type      | Description                              |
|-------------|-----------|------------------------------------------|
| id          | serial    | Primary key                              |
| requesterId | integer   | Foreign key to users.id (requester)      |
| receiverId  | integer   | Foreign key to users.id (receiver)       |
| status      | text      | Connection status                        |
| createdAt   | timestamp | When connection was requested            |
| updatedAt   | timestamp | When connection was last updated         |

### Microsoft Integration

The `microsoftTokens` table stores Microsoft OAuth credentials.

| Column         | Type      | Description                            |
|----------------|-----------|----------------------------------------|
| id             | serial    | Primary key                            |
| userId         | integer   | Foreign key to users.id                |
| microsoftEmail | text      | Microsoft account email                |
| accessToken    | text      | OAuth access token                     |
| refreshToken   | text      | OAuth refresh token                    |
| expiresAt      | timestamp | When access token expires              |
| createdAt      | timestamp | When integration was created           |
| updatedAt      | timestamp | When integration was last updated      |

### Resources

The `resources` table manages learning and support materials.

| Column       | Type      | Description                              |
|--------------|-----------|------------------------------------------|
| id           | serial    | Primary key                              |
| title        | text      | Resource title                           |
| description  | text      | Resource description                     |
| type         | text      | Resource type                            |
| uploadedById | integer   | Foreign key to users.id (uploader)       |
| url          | text      | External URL if applicable               |
| filePath     | text      | Local file path if applicable            |
| isPublished  | boolean   | Whether resource is published            |
| category     | text      | Resource category                        |
| tags         | json      | Array of tags                            |
| createdAt    | timestamp | When resource was created                |
| updatedAt    | timestamp | When resource was last updated           |

#### Resource Comments

The `resourceComments` table stores user comments on resources.

| Column     | Type      | Description                               |
|------------|-----------|-------------------------------------------|
| id         | serial    | Primary key                               |
| resourceId | integer   | Foreign key to resources.id               |
| userId     | integer   | Foreign key to users.id (commenter)       |
| content    | text      | Comment content                           |
| createdAt  | timestamp | When comment was created                  |

### Admin Functions

#### Reported Issues

The `reportedIssues` table tracks user-reported problems.

| Column        | Type      | Description                               |
|---------------|-----------|-------------------------------------------|
| id            | serial    | Primary key                               |
| userId        | integer   | Foreign key to users.id (reporter)        |
| title         | text      | Issue title                               |
| description   | text      | Issue description                         |
| status        | text      | Status (open, in_progress, resolved)      |
| assignedToId  | integer   | Foreign key to users.id (assignee)        |
| createdAt     | timestamp | When issue was created                    |
| updatedAt     | timestamp | When issue was last updated               |

#### Issue Messages

The `issueMessages` table manages communication about issues.

| Column    | Type      | Description                                 |
|-----------|-----------|---------------------------------------------|
| id        | serial    | Primary key                                 |
| issueId   | integer   | Foreign key to reportedIssues.id            |
| userId    | integer   | Foreign key to users.id (message author)    |
| message   | text      | Message content                             |
| createdAt | timestamp | When message was created                    |

## Enumerations

The system uses several enumeration types:

### User Roles
- `admin`: Platform administrator
- `mentor`: Provides mentorship
- `mentee`: Receives mentorship
- `new_mother`: Working mother with specialized support needs

### Session Status
- `pending`: Initial state when created
- `proposed`: Mentor proposed a session
- `requested`: Mentee requested a session
- `confirmed`: Both parties confirmed
- `rescheduled`: Session was rescheduled
- `rejected`: Session was rejected
- `completed`: Session has completed
- `cancelled`: Session was cancelled

### Onboarding Status
- `not_started`: User has not begun onboarding
- `in_progress`: User is in the onboarding process
- `completed`: User has completed onboarding

### Connection Status
- `pending`: Connection request is pending
- `accepted`: Connection was accepted
- `rejected`: Connection was rejected

### Proxy Request Status
- `pending`: Request is pending approval
- `accepted`: Request was accepted
- `rejected`: Request was rejected
- `completed`: Proxy arrangement completed

### Resource Types
- `meditation`: Guided meditation
- `guidebook`: Informational guidebook
- `story`: Personal story/experience
- `course`: Educational course
- `virtual_session`: Recorded session

## Database Relationships

The schema includes several important relationships:

1. One-to-One:
   - Each user has one profile

2. One-to-Many:
   - A user can create many sessions (as mentor or mentee)
   - A user can provide feedback on many sessions
   - A user can create many action items
   - A user can log many milestones

3. Many-to-Many:
   - Users and support groups (via groupMemberships)
   - Mentors and mentees (via matches)
   - Users and learning paths (via userLearningProgress)

## Data Integrity

The schema maintains referential integrity through:
- Foreign key constraints
- Unique constraints (e.g., unique user connections)
- Default values for status fields
- Timestamps for auditing

## Extension Points

The schema is designed to be extensible in several areas:
- Additional profile fields can be added
- New session types can be introduced
- Learning paths can be expanded with more complex structures
- Support for additional external integrations beyond Microsoft