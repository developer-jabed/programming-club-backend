# Programming Club Management System

A modern, scalable backend for college programming clubs with **Sectors**, **Project Rooms**, **Tasks**, **MCQ Tests**, **Real-time Chat**, and **Analytics**.

## Tech Stack

- **Runtime**: Node.js + TypeScript
- **Framework**: Fastify 5
- **Database**: PostgreSQL + Prisma
- **Auth**: JWT + HTTP-only Cookies
- **Real-time**: Socket.io
- **File Upload**: Cloudinary
- **Queue**: BullMQ + Redis

---

## Database Schema Overview

### High Level Architecture

```mermaid
erDiagram
    User ||--o{ Project : owns
    User ||--o{ ProjectMember : joins
    User ||--o{ SectorMember : joins
    User ||--o{ Task : creates
    User ||--o{ TaskAssignment : assigned
    User ||--o{ Test : creates
    User ||--o{ TestAttempt : attempts
    User ||--o{ ChatMessage : sends
    User ||--o{ Notification : receives
    User ||--o| Portfolio : has
    User ||--o{ UserBadge : earns

    Sector ||--o{ SectorMember : has
    Sector ||--o{ Project : contains
    Sector ||--o{ Task : contains
    Sector ||--o{ Test : contains

    Project ||--o{ ProjectMember : has
    Project ||--o{ Task : has
    Project ||--o{ Test : has
    Project ||--o{ ChatMessage : has
    Project ||--o{ ProjectSubmission : has

    Task ||--o{ TaskAssignment : has
    Task ||--o{ TaskSubmission : has
    Task ||--o{ TaskTargetGroup : has

    Test ||--o{ Question : has
    Test ||--o{ TestAssignment : has
    Test ||--o{ TestAttempt : has
    Test ||--o{ TestTargetGroup : has

    Question ||--o{ QuestionOption : has
    TestAttempt ||--o{ TestAnswer : has
```

---

### Core Entities

```mermaid
erDiagram
    User {
        string id PK
        string email UK
        string passwordHash
        enum role
        enum status
        string name
        string profilePicture
        string phone
        string roll
        int semester
        enum shift
        string group
        string registration UK
        string bloodGroup
        string presentAddress
        datetime lastLoginAt
    }

    Sector {
        string id PK
        string name UK
        string slug UK
        string description
        string icon
        string color
        boolean isActive
        int order
    }

    Project {
        string id PK
        string title
        string description
        enum status
        boolean isPublic
        int maxMembers
        string ownerId FK
        string sectorId FK
        string[] tags
    }

    Task {
        string id PK
        string title
        string description
        enum status
        enum priority
        datetime dueDate
        int maxScore
        string createdById FK
        string projectId FK
        string sectorId FK
        enum targetType
    }

    Test {
        string id PK
        string title
        string description
        enum status
        int durationMinutes
        int totalMarks
        int passingMarks
        string createdById FK
        string projectId FK
        string sectorId FK
        enum targetType
    }
```

---

### Membership & Assignment Flow

```mermaid
erDiagram
    User ||--o{ SectorMember : "joins sector"
    Sector ||--o{ SectorMember : "has members"

    User ||--o{ ProjectMember : "joins project"
    Project ||--o{ ProjectMember : "has members"

    User ||--o{ TaskAssignment : "receives task"
    Task ||--o{ TaskAssignment : "assigned to"

    User ||--o{ TestAssignment : "receives test"
    Test ||--o{ TestAssignment : "assigned to"
```

---

### Task & Submission Flow

```mermaid
flowchart TD
    A[Admin/Moderator Creates Task] --> B{Target Type?}
    B -->|SPECIFIC_MEMBERS| C[Select Users]
    B -->|SPECIFIC_GROUPS| D[Select Groups]
    B -->|SECTOR_MEMBERS| E[Select Sector]
    B -->|PROJECT_MEMBERS| F[Select Project]
    B -->|ALL_MEMBERS| G[All Active Users]

    C --> H[Create TaskAssignments]
    D --> H
    E --> H
    F --> H
    G --> H

    H --> I[Students Submit Work]
    I --> J[TaskSubmission Created]
    J --> K[Admin Reviews]
    K --> L{Decision}
    L -->|Accepted| M[Mark Completed + Score]
    L -->|Changes Requested| N[Student Resubmits]
    L -->|Rejected| O[End]
```

---

### Test (MCQ) Flow

```mermaid
flowchart TD
    A[Create Test + Questions] --> B[Add Options]
    B --> C[Set Target Type]
    C --> D[Publish Test]
    D --> E[Student Starts Attempt]
    E --> F[Student Submits Answers]
    F --> G[Auto Grading]
    G --> H[Calculate Score + Percentage]
    H --> I[Show Result]
```

---

## Modules Overview

| Module          | Prefix                    | Description                              |
|-----------------|---------------------------|------------------------------------------|
| Auth            | `/api/v1/auth`            | Login, Logout, Refresh, Change Password  |
| User            | `/api/v1/users`           | CRUD + Profile Picture                   |
| Sector          | `/api/v1/sectors`         | Web Dev, App Dev, Cyber Security etc.    |
| Project         | `/api/v1/projects`        | Project Rooms + Contribution Requests    |
| Task            | `/api/v1/tasks`           | Flexible Task Assignment                 |
| Test            | `/api/v1/tests`           | MCQ System with Auto Grading             |
| Submission      | `/api/v1/submissions`     | Task & Project Submissions               |
| Chat            | `/api/v1/chat`            | Real-time Project Chat (Socket.io)       |
| Notification    | `/api/v1/notifications`   | In-app Notifications                     |
| Analytics       | `/api/v1/analytics`       | Dashboard, Leaderboard, Sector Stats     |

---

## Role Hierarchy

```mermaid
graph TD
    A[ADMIN] --> B[Full System Access]
    C[MODERATOR] --> D[Manage Projects, Tasks, Tests]
    E[MEMBER] --> F[Join Sectors/Projects]
    E --> G[Submit Tasks & Tests]
    E --> H[Chat + View Leaderboard]
```

---

## Key Features

- **Multi-Sector Support** (Web, App, Cyber, AI, CP...)
- **Flexible Task Targeting** (Members / Groups / Sector / Project / All)
- **Real-time Chat** per Project Room
- **MCQ System** with auto grading
- **Contribution Request** workflow
- **Leaderboard & Badges**
- **Analytics Dashboard**
- **Notification System**

---

## Getting Started

```bash
# Install dependencies
pnpm install

# Setup environment
cp .env.example .env

# Generate Prisma Client
pnpm db:generate

# Run migrations
pnpm db:migrate

# Seed admin + default sectors
pnpm db:seed

# Start development server
pnpm dev
```

---

## License

MIT