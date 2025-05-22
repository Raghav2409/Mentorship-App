import { pgTable, text, serial, integer, boolean, timestamp, json, unique, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// User roles
export const UserRole = {
  ADMIN: "admin",
  MENTOR: "mentor",
  MENTEE: "mentee",
  NEW_MOTHER: "new_mother",
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

// Session status
export const SessionStatus = {
  PENDING: "pending",
  PROPOSED: "proposed",   // Mentor proposed a session
  REQUESTED: "requested", // Mentee requested a session  
  CONFIRMED: "confirmed", // Both parties confirmed
  RESCHEDULED: "rescheduled", // Session was rescheduled
  REJECTED: "rejected",   // Session was rejected
  COMPLETED: "completed",
  CANCELLED: "cancelled",
} as const;

export type SessionStatusType = typeof SessionStatus[keyof typeof SessionStatus];

// User schema
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  email: text("email").notNull().unique(),
  fullName: text("full_name").notNull(),
  role: text("role").$type<UserRoleType>().notNull(),
  securityQuestion: text("security_question"),
  securityAnswer: text("security_answer"),
  active: boolean("active").notNull().default(true),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Onboarding status type
export const OnboardingStatus = {
  NOT_STARTED: "not_started",
  IN_PROGRESS: "in_progress",
  COMPLETED: "completed",
} as const;

export type OnboardingStatusType = typeof OnboardingStatus[keyof typeof OnboardingStatus];

// Profile schema
export const profiles = pgTable("profiles", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  department: text("department"),
  position: text("position"),
  organization: text("organization"),
  bio: text("bio"),
  skills: json("skills").$type<string[]>(),
  interests: json("interests").$type<string[]>(),
  goals: text("goals"),
  availability: json("availability").$type<{day: string, slots: string[]}[]>(),
  // Additional mentor fields
  yearsOfExperience: text("years_of_experience"),
  areaOfExpertise: text("area_of_expertise"),
  mentorshipStyle: text("mentorship_style"),
  preferredCommunication: text("preferred_communication"),
  // Mentor capacity settings
  maxMenteeCapacity: integer("max_mentee_capacity").default(5),
  currentMenteeCount: integer("current_mentee_count").default(0),
  acceptingNewMentees: boolean("accepting_new_mentees").default(true),
  // New mother support option for mentors
  supportsNewMothers: boolean("supports_new_mothers").default(false),
  // Onboarding tracking
  onboardingStatus: text("onboarding_status").$type<OnboardingStatusType>().default("not_started"),
  onboardingStep: integer("onboarding_step").default(0),
  onboardingCompletedAt: timestamp("onboarding_completed_at"),
});

// Sessions schema
export const sessions = pgTable("sessions", {
  id: serial("id").primaryKey(),
  mentorId: integer("mentor_id").notNull().references(() => users.id),
  menteeId: integer("mentee_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  agenda: text("agenda"),
  date: timestamp("date").notNull(),
  duration: integer("duration").notNull(), // in minutes
  status: text("status").notNull().default("pending"),
  meetingLink: text("meeting_link"),
  proposedDate: timestamp("proposed_date"), // For rescheduling proposals
  proposedBy: integer("proposed_by").references(() => users.id), // User who proposed the reschedule
  responseMessage: text("response_message"), // Message explaining response or change
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Feedback schema
export const feedback = pgTable("feedback", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  fromUserId: integer("from_user_id").notNull().references(() => users.id),
  rating: integer("rating").notNull(),
  comments: text("comments"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Mentorship matches schema
export const matches = pgTable("matches", {
  id: serial("id").primaryKey(),
  mentorId: integer("mentor_id").notNull().references(() => users.id),
  menteeId: integer("mentee_id").notNull().references(() => users.id),
  goal: text("goal").notNull(),
  status: text("status").notNull().default("pending"), // pending, approved, rejected
  adminId: integer("admin_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Learning paths schema
export const learningPaths = pgTable("learning_paths", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  category: text("category").notNull(),
  description: text("description"),
  modules: json("modules").$type<{id: number, title: string, content: string}[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User learning progress schema
export const userLearningProgress = pgTable("user_learning_progress", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  pathId: integer("path_id").notNull().references(() => learningPaths.id),
  completedModules: json("completed_modules").$type<number[]>(),
  progress: integer("progress").notNull().default(0), // Percentage
  startedAt: timestamp("started_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

// Milestone logs for new mothers
export const milestoneLogs = pgTable("milestone_logs", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // feeding, milestone, etc.
  title: text("title").notNull(),
  notes: text("notes"),
  date: timestamp("date").defaultNow().notNull(),
});

// Support groups for new mothers
export const supportGroups = pgTable("support_groups", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  memberCount: integer("member_count").default(0),
  lastActive: timestamp("last_active").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Group memberships
export const groupMemberships = pgTable("group_memberships", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  groupId: integer("group_id").notNull().references(() => supportGroups.id),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
});

// Microsoft integration tokens
export const microsoftTokens = pgTable("microsoft_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  microsoftEmail: text("microsoft_email").notNull(),
  accessToken: text("access_token").notNull(),
  refreshToken: text("refresh_token").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Reported issues
export const reportedIssues = pgTable("reported_issues", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description").notNull(),
  status: text("status").notNull().default("open"), // open, in_progress, resolved, closed
  assignedToId: integer("assigned_to_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Issue messages for communication between users and admins
export const issueMessages = pgTable("issue_messages", {
  id: serial("id").primaryKey(),
  issueId: integer("issue_id").notNull().references(() => reportedIssues.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Connection status types
export const ConnectionStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
} as const;

export type ConnectionStatusType = typeof ConnectionStatus[keyof typeof ConnectionStatus];

// User connections (for community channels)
export const userConnections = pgTable("user_connections", {
  id: serial("id").primaryKey(),
  requesterId: integer("requester_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  status: text("status").$type<ConnectionStatusType>().notNull().default("pending"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => {
  return {
    // Ensure unique relationships
    uniqueConnection: unique().on(table.requesterId, table.receiverId),
  };
});

// Direct messages between users
export const directMessages = pgTable("direct_messages", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull().references(() => users.id),
  receiverId: integer("receiver_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Proxy request status types
export const ProxyRequestStatus = {
  PENDING: "pending",
  ACCEPTED: "accepted",
  REJECTED: "rejected",
  COMPLETED: "completed",
} as const;

export type ProxyRequestStatusType = typeof ProxyRequestStatus[keyof typeof ProxyRequestStatus];

// Proxy requests for new mothers going on maternity leave
export const proxyRequests = pgTable("proxy_requests", {
  id: serial("id").primaryKey(),
  motherId: integer("mother_id").notNull().references(() => users.id),
  proxyId: integer("proxy_id").notNull().references(() => users.id),
  status: text("status").$type<ProxyRequestStatusType>().notNull().default("pending"),
  startDate: timestamp("start_date").notNull(),
  expectedEndDate: timestamp("expected_end_date").notNull(),
  actualEndDate: timestamp("actual_end_date"),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Proxy logs for documenting transition
export const proxyLogs = pgTable("proxy_logs", {
  id: serial("id").primaryKey(),
  requestId: integer("request_id").notNull().references(() => proxyRequests.id),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  content: text("content").notNull(),
  priority: text("priority").notNull().default("medium"), // low, medium, high
  category: text("category").notNull(), // tasks, updates, questions, etc.
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Resource types for the resources page
export const ResourceType = {
  MEDITATION: "meditation",
  GUIDEBOOK: "guidebook",
  STORY: "story",
  COURSE: "course",
  VIRTUAL_SESSION: "virtual_session",
} as const;

export type ResourceTypeType = typeof ResourceType[keyof typeof ResourceType];

// Resources for the new mother resources page
export const resources = pgTable("resources", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  type: text("type").$type<ResourceTypeType>().notNull(),
  uploadedById: integer("uploaded_by_id").notNull().references(() => users.id),
  url: text("url"),
  filePath: text("file_path"),
  isPublished: boolean("is_published").notNull().default(true),
  category: text("category").notNull(), // meditation, guidebook, story, learning, hr_collaboration, mental_health
  tags: json("tags").$type<string[]>(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Comments on resources
export const resourceComments = pgTable("resource_comments", {
  id: serial("id").primaryKey(),
  resourceId: integer("resource_id").notNull().references(() => resources.id),
  userId: integer("user_id").notNull().references(() => users.id),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Session Notes schema
export const sessionNotes = pgTable("session_notes", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  notes: text("notes").notNull(),
  isPrivate: boolean("is_private").default(false), // If true, only visible to mentor
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Action Items schema
export const actionItems = pgTable("action_items", {
  id: serial("id").primaryKey(),
  sessionId: integer("session_id").notNull().references(() => sessions.id),
  assignedToId: integer("assigned_to_id").notNull().references(() => users.id),
  createdById: integer("created_by_id").notNull().references(() => users.id),
  title: text("title").notNull(),
  description: text("description"),
  dueDate: timestamp("due_date"),
  status: text("status").notNull().default("pending"), // pending, in_progress, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Mental health chat logs
export const mentalHealthChats = pgTable("mental_health_chats", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => users.id),
  message: text("message").notNull(),
  isFromUser: boolean("is_from_user").notNull(),
  sentiment: text("sentiment"), // positive, negative, neutral (analyzed by AI)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertProfileSchema = createInsertSchema(profiles).omit({
  id: true,
  onboardingStatus: true,
  onboardingStep: true,
  onboardingCompletedAt: true,
});

export const insertSessionSchema = createInsertSchema(sessions)
  .omit({
    id: true,
    createdAt: true,
  })
  .extend({
    // Override the date field type to accept either string or Date
    date: z.union([z.string(), z.date()]).transform((val) => {
      if (typeof val === 'string') {
        return new Date(val);
      }
      return val;
    })
  });

export const insertFeedbackSchema = createInsertSchema(feedback).omit({
  id: true,
  createdAt: true,
});

export const insertMatchSchema = createInsertSchema(matches).omit({
  id: true,
  status: true,
  adminId: true,
  createdAt: true,
});

export const insertLearningPathSchema = createInsertSchema(learningPaths).omit({
  id: true,
  createdAt: true,
});

export const insertUserLearningProgressSchema = createInsertSchema(userLearningProgress).omit({
  id: true,
  progress: true,
  startedAt: true,
  completedAt: true,
});

export const insertMilestoneLogSchema = createInsertSchema(milestoneLogs).omit({
  id: true,
  date: true,
  userId: true,
});

export const insertSupportGroupSchema = createInsertSchema(supportGroups).omit({
  id: true,
  memberCount: true,
  lastActive: true,
  createdAt: true,
});

export const insertGroupMembershipSchema = createInsertSchema(groupMemberships).omit({
  id: true,
  joinedAt: true,
});

export const insertMicrosoftTokensSchema = createInsertSchema(microsoftTokens).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertReportedIssueSchema = createInsertSchema(reportedIssues).omit({
  id: true,
  status: true,
  assignedToId: true,
  createdAt: true,
  updatedAt: true,
});

export const insertIssueMessageSchema = createInsertSchema(issueMessages).omit({
  id: true,
  createdAt: true,
});

export const insertUserConnectionSchema = createInsertSchema(userConnections).omit({
  id: true,
  status: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDirectMessageSchema = createInsertSchema(directMessages).omit({
  id: true,
  read: true,
  createdAt: true,
});

export const insertProxyRequestSchema = createInsertSchema(proxyRequests).omit({
  id: true,
  status: true,
  actualEndDate: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  startDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  }),
  expectedEndDate: z.union([z.string(), z.date()]).transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  })
});

export const insertProxyLogSchema = createInsertSchema(proxyLogs).omit({
  id: true,
  createdAt: true,
});

export const insertResourceSchema = createInsertSchema(resources).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  isPublished: true,
});

export const insertResourceCommentSchema = createInsertSchema(resourceComments).omit({
  id: true,
  createdAt: true,
});

export const insertSessionNoteSchema = createInsertSchema(sessionNotes).omit({
  id: true, 
  createdAt: true,
  updatedAt: true,
});

export const insertActionItemSchema = createInsertSchema(actionItems).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
}).extend({
  dueDate: z.union([z.string(), z.date()]).optional().transform((val) => {
    if (typeof val === 'string') {
      return new Date(val);
    }
    return val;
  })
});

export const insertMentalHealthChatSchema = createInsertSchema(mentalHealthChats).omit({
  id: true,
  createdAt: true,
});

// Types
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

export type InsertSessionNote = z.infer<typeof insertSessionNoteSchema>;
export type SessionNote = typeof sessionNotes.$inferSelect;

export type InsertActionItem = z.infer<typeof insertActionItemSchema>;
export type ActionItem = typeof actionItems.$inferSelect;

export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profiles.$inferSelect;

export type InsertSession = z.infer<typeof insertSessionSchema>;
export type Session = typeof sessions.$inferSelect;

export type InsertFeedback = z.infer<typeof insertFeedbackSchema>;
export type Feedback = typeof feedback.$inferSelect;

export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type Match = typeof matches.$inferSelect;

export type InsertLearningPath = z.infer<typeof insertLearningPathSchema>;
export type LearningPath = typeof learningPaths.$inferSelect;

export type InsertUserLearningProgress = z.infer<typeof insertUserLearningProgressSchema>;
export type UserLearningProgress = typeof userLearningProgress.$inferSelect;

export type InsertMilestoneLog = z.infer<typeof insertMilestoneLogSchema>;
export type MilestoneLog = typeof milestoneLogs.$inferSelect;

export type InsertSupportGroup = z.infer<typeof insertSupportGroupSchema>;
export type SupportGroup = typeof supportGroups.$inferSelect;

export type InsertGroupMembership = z.infer<typeof insertGroupMembershipSchema>;
export type GroupMembership = typeof groupMemberships.$inferSelect;

export type InsertMicrosoftTokens = z.infer<typeof insertMicrosoftTokensSchema>;
export type MicrosoftTokens = typeof microsoftTokens.$inferSelect;

export type InsertReportedIssue = z.infer<typeof insertReportedIssueSchema>;
export type ReportedIssue = typeof reportedIssues.$inferSelect;

export type InsertIssueMessage = z.infer<typeof insertIssueMessageSchema>;
export type IssueMessage = typeof issueMessages.$inferSelect;

export type InsertUserConnection = z.infer<typeof insertUserConnectionSchema>;
export type UserConnection = typeof userConnections.$inferSelect;

export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessages.$inferSelect;

export type InsertProxyRequest = z.infer<typeof insertProxyRequestSchema>;
export type ProxyRequest = typeof proxyRequests.$inferSelect;

export type InsertProxyLog = z.infer<typeof insertProxyLogSchema>;
export type ProxyLog = typeof proxyLogs.$inferSelect;

export type InsertResource = z.infer<typeof insertResourceSchema>;
export type Resource = typeof resources.$inferSelect;

export type InsertResourceComment = z.infer<typeof insertResourceCommentSchema>;
export type ResourceComment = typeof resourceComments.$inferSelect;

export type InsertMentalHealthChat = z.infer<typeof insertMentalHealthChatSchema>;
export type MentalHealthChat = typeof mentalHealthChats.$inferSelect;
