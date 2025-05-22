import { 
  users, profiles, sessions, feedback, matches, learningPaths, userLearningProgress,
  milestoneLogs, supportGroups, groupMemberships, microsoftTokens, reportedIssues, issueMessages,
  userConnections, directMessages, mentalHealthChats, sessionNotes, actionItems,
  type User, type InsertUser, 
  type Profile, type InsertProfile,
  type Session, type InsertSession,
  type Feedback, type InsertFeedback,
  type Match, type InsertMatch,
  type LearningPath, type InsertLearningPath,
  type UserLearningProgress, type InsertUserLearningProgress,
  type MilestoneLog, type InsertMilestoneLog,
  type SupportGroup, type InsertSupportGroup,
  type GroupMembership, type InsertGroupMembership,
  type MicrosoftTokens, type InsertMicrosoftTokens,
  type ReportedIssue, type InsertReportedIssue,
  type IssueMessage, type InsertIssueMessage,
  type UserConnection, type InsertUserConnection,
  type DirectMessage, type InsertDirectMessage,
  type MentalHealthChat, type InsertMentalHealthChat,
  type SessionNote, type InsertSessionNote,
  type ActionItem, type InsertActionItem,
  ConnectionStatus
} from "@shared/schema";

import { db } from "./db";
import { eq, and, gt, or, sql } from "drizzle-orm";

// For session storage
import session from "express-session";
import connectPg from "connect-pg-simple";
import { pool } from "./db";

const PostgresSessionStore = connectPg(session);

import { IStorage } from "./storage";

export class DatabaseStorage implements IStorage {
  sessionStore: session.Store;
  
  constructor() {
    this.sessionStore = new PostgresSessionStore({ 
      pool,
      createTableIfMissing: true 
    });
  }
  
  // User methods
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  
  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user;
  }
  
  async getUserByEmail(email: string, includeInactive: boolean = false): Promise<User | undefined> {
    if (includeInactive) {
      // Return any user with this email, including inactive ones
      const [user] = await db.select().from(users).where(eq(users.email, email));
      return user;
    } else {
      // Return only active users with this email
      const [user] = await db.select().from(users).where(
        and(
          eq(users.email, email),
          eq(users.active, true)
        )
      );
      return user;
    }
  }
  
  async createUser(insertUser: InsertUser): Promise<User> {
    // Make sure we're inserting with the correct types
    const [user] = await db.insert(users).values({
      username: insertUser.username,
      password: insertUser.password,
      email: insertUser.email,
      fullName: insertUser.fullName,
      role: insertUser.role as any // Cast to any to avoid type issues
    }).returning();
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const [updatedUser] = await db
      .update(users)
      .set(data)
      .where(eq(users.id, id))
      .returning();
    return updatedUser;
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    try {
      console.log(`Fetching users with role: ${role}`);
      // Cast role to string to fix type issue
      const result = await db.select().from(users).where(sql`${users.role} = ${role}`);
      console.log(`Found ${result.length} users with role ${role}`);
      return result;
    } catch (error) {
      console.error("Error in getUsersByRole:", error);
      throw error;
    }
  }
  
  // Profile methods
  async getProfile(userId: number): Promise<Profile | undefined> {
    try {
      const [profile] = await db.select({
        id: profiles.id,
        userId: profiles.userId,
        department: profiles.department,
        position: profiles.position,
        organization: profiles.organization,
        bio: profiles.bio,
        skills: profiles.skills,
        interests: profiles.interests,
        goals: profiles.goals,
        availability: profiles.availability,
        yearsOfExperience: profiles.yearsOfExperience,
        areaOfExpertise: profiles.areaOfExpertise,
        mentorshipStyle: profiles.mentorshipStyle,
        preferredCommunication: profiles.preferredCommunication,
        supportsNewMothers: profiles.supportsNewMothers,
        onboardingStatus: sql<string>`profiles.onboarding_status`.as('onboardingStatus'),
        onboardingStep: sql<number>`profiles.onboarding_step`.as('onboardingStep'),
        onboardingCompletedAt: sql<Date | null>`profiles.onboarding_completed_at`.as('onboardingCompletedAt')
      })
      .from(profiles)
      .where(eq(profiles.userId, userId));
      
      return profile;
    } catch (error) {
      console.error(`Error fetching profile for user ${userId}:`, error);
      return undefined;
    }
  }
  
  async createProfile(profile: InsertProfile): Promise<Profile> {
    try {
      const [createdProfile] = await db.insert(profiles).values({
        userId: profile.userId,
        department: profile.department || null,
        position: profile.position || null,
        organization: profile.organization || null,
        bio: profile.bio || null,
        skills: profile.skills || [],
        interests: profile.interests || [],
        goals: profile.goals || null,
        availability: profile.availability || [],
        yearsOfExperience: profile.yearsOfExperience || null,
        areaOfExpertise: profile.areaOfExpertise || null,
        mentorshipStyle: profile.mentorshipStyle || null,
        preferredCommunication: profile.preferredCommunication || null,
        supportsNewMothers: profile.supportsNewMothers || false
      }).returning();
      return createdProfile;
    } catch (error) {
      console.error("Error in createProfile:", error);
      throw error;
    }
  }
  
  async updateProfile(userId: number, data: Partial<Profile>): Promise<Profile | undefined> {
    try {
      // First get the profile
      const [profile] = await db
        .select()
        .from(profiles)
        .where(eq(profiles.userId, userId));
      
      if (!profile) return undefined;
      
      // Directly use Drizzle ORM for the update
      const [updatedProfile] = await db
        .update(profiles)
        .set({
          department: data.department !== undefined ? data.department : undefined,
          position: data.position !== undefined ? data.position : undefined,
          bio: data.bio !== undefined ? data.bio : undefined,
          skills: data.skills !== undefined ? data.skills : undefined,
          interests: data.interests !== undefined ? data.interests : undefined,
          goals: data.goals !== undefined ? data.goals : undefined,
          availability: data.availability !== undefined ? data.availability : undefined,
          yearsOfExperience: data.yearsOfExperience !== undefined ? data.yearsOfExperience : undefined,
          areaOfExpertise: data.areaOfExpertise !== undefined ? data.areaOfExpertise : undefined,
          mentorshipStyle: data.mentorshipStyle !== undefined ? data.mentorshipStyle : undefined,
          preferredCommunication: data.preferredCommunication !== undefined ? data.preferredCommunication : undefined,
          supportsNewMothers: data.supportsNewMothers !== undefined ? data.supportsNewMothers : undefined,
          onboardingStatus: data.onboardingStatus !== undefined ? data.onboardingStatus as any : undefined,
          onboardingStep: data.onboardingStep !== undefined ? data.onboardingStep : undefined,
          onboardingCompletedAt: data.onboardingCompletedAt !== undefined ? data.onboardingCompletedAt : undefined,
        })
        .where(eq(profiles.userId, userId))
        .returning();
      
      return updatedProfile;
    } catch (error) {
      console.error(`Error updating profile for user ${userId}:`, error);
      return undefined;
    }
  }
  
  // Session methods
  async getSession(id: number): Promise<Session | undefined> {
    const [session] = await db.select().from(sessions).where(eq(sessions.id, id));
    return session;
  }
  
  async createSession(sessionData: InsertSession): Promise<Session> {
    const [createdSession] = await db.insert(sessions).values(sessionData).returning();
    return createdSession;
  }
  
  async updateSession(id: number, data: Partial<Session>): Promise<Session | undefined> {
    const [updatedSession] = await db
      .update(sessions)
      .set(data)
      .where(eq(sessions.id, id))
      .returning();
    return updatedSession;
  }
  
  async getSessionsByMentor(mentorId: number): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.mentorId, mentorId));
  }
  
  async getSessionsByMentee(menteeId: number): Promise<Session[]> {
    return await db.select().from(sessions).where(eq(sessions.menteeId, menteeId));
  }
  
  async getUpcomingSessions(userId: number): Promise<Session[]> {
    const now = new Date();
    return await db
      .select()
      .from(sessions)
      .where(
        and(
          gt(sessions.date, now),
          or(
            eq(sessions.mentorId, userId),
            eq(sessions.menteeId, userId)
          )
        )
      )
      .orderBy(sessions.date);
  }
  
  // Feedback methods
  async getFeedback(id: number): Promise<Feedback | undefined> {
    const [feedbackItem] = await db.select().from(feedback).where(eq(feedback.id, id));
    return feedbackItem;
  }
  
  async createFeedback(feedbackData: InsertFeedback): Promise<Feedback> {
    const [createdFeedback] = await db.insert(feedback).values(feedbackData).returning();
    return createdFeedback;
  }
  
  async getFeedbackBySession(sessionId: number): Promise<Feedback[]> {
    return await db.select().from(feedback).where(eq(feedback.sessionId, sessionId));
  }
  
  // Match methods
  async getMatch(id: number): Promise<Match | undefined> {
    const [match] = await db.select().from(matches).where(eq(matches.id, id));
    return match;
  }
  
  async createMatch(matchData: InsertMatch): Promise<Match> {
    const [createdMatch] = await db.insert(matches).values({
      ...matchData,
      status: "pending"
    }).returning();
    return createdMatch;
  }
  
  async updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined> {
    const [updatedMatch] = await db
      .update(matches)
      .set(data)
      .where(eq(matches.id, id))
      .returning();
    return updatedMatch;
  }
  
  async getPendingMatches(): Promise<Match[]> {
    return await db.select().from(matches).where(eq(matches.status, "pending"));
  }
  
  async getMatchesByMentor(mentorId: number, status?: string): Promise<Match[]> {
    if (status) {
      return await db.select().from(matches).where(
        and(
          eq(matches.mentorId, mentorId),
          eq(matches.status, status)
        )
      );
    }
    return await db.select().from(matches).where(eq(matches.mentorId, mentorId));
  }
  
  async getMatchesByMentee(menteeId: number): Promise<Match[]> {
    return await db.select().from(matches).where(eq(matches.menteeId, menteeId));
  }
  
  // Learning path methods
  async getLearningPath(id: number): Promise<LearningPath | undefined> {
    const [path] = await db.select().from(learningPaths).where(eq(learningPaths.id, id));
    return path;
  }
  
  async createLearningPath(pathData: InsertLearningPath): Promise<LearningPath> {
    try {
      // Explicitly convert to an array with a single element
      const [createdPath] = await db.insert(learningPaths).values([pathData]).returning();
      return createdPath;
    } catch (error) {
      console.error("Error in createLearningPath:", error);
      throw error;
    }
  }
  
  async getAllLearningPaths(): Promise<LearningPath[]> {
    return await db.select().from(learningPaths);
  }
  
  async getLearningPathsByCategory(category: string): Promise<LearningPath[]> {
    return await db.select().from(learningPaths).where(eq(learningPaths.category, category));
  }
  
  // User learning progress methods
  async getUserLearningProgress(userId: number, pathId: number): Promise<UserLearningProgress | undefined> {
    const [progress] = await db
      .select()
      .from(userLearningProgress)
      .where(
        and(
          eq(userLearningProgress.userId, userId),
          eq(userLearningProgress.pathId, pathId)
        )
      );
    return progress;
  }
  
  async createUserLearningProgress(progressData: InsertUserLearningProgress): Promise<UserLearningProgress> {
    const [createdProgress] = await db
      .insert(userLearningProgress)
      .values({
        ...progressData,
        progress: 0
      })
      .returning();
    return createdProgress;
  }
  
  async updateUserLearningProgress(
    userId: number, 
    pathId: number, 
    data: Partial<UserLearningProgress>
  ): Promise<UserLearningProgress | undefined> {
    const [updatedProgress] = await db
      .update(userLearningProgress)
      .set(data)
      .where(
        and(
          eq(userLearningProgress.userId, userId),
          eq(userLearningProgress.pathId, pathId)
        )
      )
      .returning();
    return updatedProgress;
  }
  
  async getAllUserLearningProgress(userId: number): Promise<UserLearningProgress[]> {
    return await db
      .select()
      .from(userLearningProgress)
      .where(eq(userLearningProgress.userId, userId));
  }
  
  // Milestone log methods
  async getMilestoneLog(id: number): Promise<MilestoneLog | undefined> {
    const [log] = await db.select().from(milestoneLogs).where(eq(milestoneLogs.id, id));
    return log;
  }
  
  async createMilestoneLog(logData: InsertMilestoneLog): Promise<MilestoneLog> {
    const [createdLog] = await db.insert(milestoneLogs).values(logData).returning();
    return createdLog;
  }
  
  async getMilestoneLogsByUser(userId: number): Promise<MilestoneLog[]> {
    return await db.select().from(milestoneLogs).where(eq(milestoneLogs.userId, userId));
  }
  
  async getMilestoneLogsByType(userId: number, type: string): Promise<MilestoneLog[]> {
    return await db
      .select()
      .from(milestoneLogs)
      .where(
        and(
          eq(milestoneLogs.userId, userId),
          eq(milestoneLogs.type, type)
        )
      );
  }
  
  // Support group methods
  async getSupportGroup(id: number): Promise<SupportGroup | undefined> {
    const [group] = await db.select().from(supportGroups).where(eq(supportGroups.id, id));
    return group;
  }
  
  async createSupportGroup(groupData: InsertSupportGroup): Promise<SupportGroup> {
    const [createdGroup] = await db
      .insert(supportGroups)
      .values({
        ...groupData,
        memberCount: 0
      })
      .returning();
    return createdGroup;
  }
  
  async getAllSupportGroups(): Promise<SupportGroup[]> {
    // Make sure we're getting unique groups
    return await db
      .select({
        id: supportGroups.id,
        name: supportGroups.name,
        description: supportGroups.description,
        memberCount: supportGroups.memberCount,
        lastActive: supportGroups.lastActive,
        createdAt: supportGroups.createdAt
      })
      .from(supportGroups)
      .orderBy(supportGroups.id);
  }
  
  // Group membership methods
  async createGroupMembership(membershipData: InsertGroupMembership): Promise<GroupMembership> {
    // Create membership
    const [createdMembership] = await db
      .insert(groupMemberships)
      .values(membershipData)
      .returning();
    
    // Update member count
    const [group] = await db
      .select()
      .from(supportGroups)
      .where(eq(supportGroups.id, membershipData.groupId));
    
    if (group) {
      await db
        .update(supportGroups)
        .set({ memberCount: (group.memberCount || 0) + 1 })
        .where(eq(supportGroups.id, group.id));
    }
    
    return createdMembership;
  }
  
  async getUserGroups(userId: number): Promise<SupportGroup[]> {
    const memberships = await db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.userId, userId));
    
    const groupIds = memberships.map(m => m.groupId);
    
    if (groupIds.length === 0) {
      return [];
    }
    
    // Using a more efficient method with an in-clause
    // We're explicitly selecting fields to ensure consistency
    const groups = await db
      .select({
        id: supportGroups.id,
        name: supportGroups.name,
        description: supportGroups.description,
        memberCount: supportGroups.memberCount,
        lastActive: supportGroups.lastActive,
        createdAt: supportGroups.createdAt
      })
      .from(supportGroups)
      .where(sql`${supportGroups.id} IN ${groupIds}`)
      .orderBy(supportGroups.id);
    
    return groups;
  }
  
  async getGroupMembers(groupId: number): Promise<User[]> {
    const memberships = await db
      .select()
      .from(groupMemberships)
      .where(eq(groupMemberships.groupId, groupId));
    
    const userIds = memberships.map(m => m.userId);
    
    if (userIds.length === 0) {
      return [];
    }
    
    // This is a simplification - in a real app, we'd use a join
    const members: User[] = [];
    for (const userId of userIds) {
      const [user] = await db
        .select()
        .from(users)
        .where(eq(users.id, userId));
      
      if (user) {
        members.push(user);
      }
    }
    
    return members;
  }
  
  // Microsoft integration methods
  async getMicrosoftTokens(userId: number): Promise<MicrosoftTokens | undefined> {
    try {
      const [tokens] = await db
        .select()
        .from(microsoftTokens)
        .where(eq(microsoftTokens.userId, userId));
      return tokens;
    } catch (error) {
      console.error(`Error getting Microsoft tokens for user ${userId}:`, error);
      return undefined;
    }
  }

  async saveMicrosoftTokens(
    userId: number, 
    microsoftEmail: string, 
    accessToken: string, 
    refreshToken: string, 
    expiresAt: Date
  ): Promise<MicrosoftTokens> {
    try {
      // Check if tokens already exist for this user
      const existingTokens = await this.getMicrosoftTokens(userId);
      
      if (existingTokens) {
        // Update existing tokens
        const [updatedTokens] = await db
          .update(microsoftTokens)
          .set({
            microsoftEmail,
            accessToken,
            refreshToken,
            expiresAt,
            updatedAt: new Date()
          })
          .where(eq(microsoftTokens.id, existingTokens.id))
          .returning();
        
        return updatedTokens;
      } else {
        // Create new tokens
        const [newTokens] = await db
          .insert(microsoftTokens)
          .values({
            userId,
            microsoftEmail,
            accessToken,
            refreshToken,
            expiresAt
          })
          .returning();
        
        return newTokens;
      }
    } catch (error) {
      console.error(`Error saving Microsoft tokens for user ${userId}:`, error);
      throw error;
    }
  }

  async deleteMicrosoftTokens(userId: number): Promise<boolean> {
    try {
      const result = await db
        .delete(microsoftTokens)
        .where(eq(microsoftTokens.userId, userId));
      
      // In Drizzle, delete doesn't return the deleted rows directly
      // We can check if any rows were affected
      return true; // We assume the deletion was successful
    } catch (error) {
      console.error(`Error deleting Microsoft tokens for user ${userId}:`, error);
      return false;
    }
  }

  // Reported issues methods
  async getReportedIssue(id: number): Promise<ReportedIssue | undefined> {
    try {
      const [issue] = await db
        .select()
        .from(reportedIssues)
        .where(eq(reportedIssues.id, id));
      return issue;
    } catch (error) {
      console.error(`Error getting reported issue ${id}:`, error);
      return undefined;
    }
  }

  async createReportedIssue(issueData: InsertReportedIssue): Promise<ReportedIssue> {
    try {
      const data = {
        title: issueData.title,
        description: issueData.description,
        userId: issueData.userId,
        status: "open",
        assignedToId: null,
      };

      const [createdIssue] = await db
        .insert(reportedIssues)
        .values(data)
        .returning();
      
      return createdIssue;
    } catch (error) {
      console.error("Error creating reported issue:", error);
      throw error;
    }
  }

  async updateReportedIssue(id: number, data: Partial<ReportedIssue>): Promise<ReportedIssue | undefined> {
    try {
      const [updatedIssue] = await db
        .update(reportedIssues)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(reportedIssues.id, id))
        .returning();
      
      return updatedIssue;
    } catch (error) {
      console.error(`Error updating reported issue ${id}:`, error);
      return undefined;
    }
  }

  async getReportedIssuesByUser(userId: number): Promise<ReportedIssue[]> {
    try {
      return await db
        .select()
        .from(reportedIssues)
        .where(eq(reportedIssues.userId, userId))
        .orderBy(sql`${reportedIssues.updatedAt} DESC`);
    } catch (error) {
      console.error(`Error getting reported issues for user ${userId}:`, error);
      return [];
    }
  }

  async getReportedIssuesByAssignee(assigneeId: number): Promise<ReportedIssue[]> {
    try {
      return await db
        .select()
        .from(reportedIssues)
        .where(eq(reportedIssues.assignedToId, assigneeId))
        .orderBy(sql`${reportedIssues.updatedAt} DESC`);
    } catch (error) {
      console.error(`Error getting reported issues for assignee ${assigneeId}:`, error);
      return [];
    }
  }

  async getAllReportedIssues(): Promise<ReportedIssue[]> {
    try {
      return await db
        .select()
        .from(reportedIssues)
        .orderBy(sql`${reportedIssues.updatedAt} DESC`);
    } catch (error) {
      console.error("Error getting all reported issues:", error);
      return [];
    }
  }

  // Issue messages methods
  async getIssueMessage(id: number): Promise<IssueMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(issueMessages)
        .where(eq(issueMessages.id, id));
      return message;
    } catch (error) {
      console.error(`Error getting issue message ${id}:`, error);
      return undefined;
    }
  }

  async createIssueMessage(messageData: InsertIssueMessage): Promise<IssueMessage> {
    try {
      const [createdMessage] = await db
        .insert(issueMessages)
        .values(messageData)
        .returning();
      
      // Update the issue's updatedAt timestamp
      await db
        .update(reportedIssues)
        .set({ updatedAt: new Date() })
        .where(eq(reportedIssues.id, messageData.issueId));
      
      return createdMessage;
    } catch (error) {
      console.error("Error creating issue message:", error);
      throw error;
    }
  }

  async getIssueMessages(issueId: number): Promise<IssueMessage[]> {
    try {
      return await db
        .select()
        .from(issueMessages)
        .where(eq(issueMessages.issueId, issueId))
        .orderBy(issueMessages.createdAt);
    } catch (error) {
      console.error(`Error getting messages for issue ${issueId}:`, error);
      return [];
    }
  }

  // User connection methods
  async getUserConnectionByUsers(requesterId: number, receiverId: number): Promise<UserConnection | undefined> {
    try {
      const [connection] = await db
        .select()
        .from(userConnections)
        .where(
          and(
            eq(userConnections.requesterId, requesterId),
            eq(userConnections.receiverId, receiverId)
          )
        );
      
      if (connection) {
        return connection;
      }
      
      // Also check the reverse connection
      const [reverseConnection] = await db
        .select()
        .from(userConnections)
        .where(
          and(
            eq(userConnections.requesterId, receiverId),
            eq(userConnections.receiverId, requesterId)
          )
        );
      
      return reverseConnection;
    } catch (error) {
      console.error(`Error getting connection between users ${requesterId} and ${receiverId}:`, error);
      return undefined;
    }
  }
  
  async getUserConnection(id: number): Promise<UserConnection | undefined> {
    try {
      const [connection] = await db
        .select()
        .from(userConnections)
        .where(eq(userConnections.id, id));
      return connection;
    } catch (error) {
      console.error(`Error getting connection ${id}:`, error);
      return undefined;
    }
  }

  async createUserConnection(connectionData: InsertUserConnection): Promise<UserConnection> {
    try {
      // Set default status
      const [createdConnection] = await db
        .insert(userConnections)
        .values({
          ...connectionData,
          status: ConnectionStatus.PENDING
        })
        .returning();
      return createdConnection;
    } catch (error) {
      console.error("Error creating user connection:", error);
      throw error;
    }
  }

  async updateUserConnection(id: number, data: Partial<UserConnection>): Promise<UserConnection | undefined> {
    try {
      const [updatedConnection] = await db
        .update(userConnections)
        .set(data)
        .where(eq(userConnections.id, id))
        .returning();
      return updatedConnection;
    } catch (error) {
      console.error(`Error updating connection ${id}:`, error);
      return undefined;
    }
  }

  async getUserConnections(userId: number): Promise<UserConnection[]> {
    try {
      // Get connections where the user is either requester or receiver
      return await db
        .select()
        .from(userConnections)
        .where(
          and(
            or(
              eq(userConnections.requesterId, userId),
              eq(userConnections.receiverId, userId)
            ),
            eq(userConnections.status, ConnectionStatus.ACCEPTED)
          )
        );
    } catch (error) {
      console.error(`Error getting connections for user ${userId}:`, error);
      return [];
    }
  }

  async getPendingReceivedConnections(userId: number): Promise<UserConnection[]> {
    try {
      // Get pending connection requests received by this user
      return await db
        .select()
        .from(userConnections)
        .where(
          and(
            eq(userConnections.receiverId, userId),
            eq(userConnections.status, ConnectionStatus.PENDING)
          )
        );
    } catch (error) {
      console.error(`Error getting pending connections for user ${userId}:`, error);
      return [];
    }
  }

  async getConnectedUsers(userId: number): Promise<User[]> {
    try {
      const connections = await this.getUserConnections(userId);
      
      if (connections.length === 0) {
        return [];
      }
      
      const connectedUserIds = connections.map(connection => 
        connection.requesterId === userId ? connection.receiverId : connection.requesterId
      );
      
      // Fetch user details for all connected users
      const connectedUsers: User[] = [];
      for (const connectedUserId of connectedUserIds) {
        const user = await this.getUser(connectedUserId);
        if (user && user.active) {
          connectedUsers.push(user);
        }
      }
      
      return connectedUsers;
    } catch (error) {
      console.error(`Error getting connected users for user ${userId}:`, error);
      return [];
    }
  }

  // Direct message methods
  async createDirectMessage(messageData: InsertDirectMessage): Promise<DirectMessage> {
    try {
      const [createdMessage] = await db
        .insert(directMessages)
        .values(messageData)
        .returning();
      return createdMessage;
    } catch (error) {
      console.error("Error creating direct message:", error);
      throw error;
    }
  }

  async getConversation(user1Id: number, user2Id: number): Promise<DirectMessage[]> {
    try {
      return await db
        .select()
        .from(directMessages)
        .where(
          or(
            and(
              eq(directMessages.senderId, user1Id),
              eq(directMessages.receiverId, user2Id)
            ),
            and(
              eq(directMessages.senderId, user2Id),
              eq(directMessages.receiverId, user1Id)
            )
          )
        )
        .orderBy(directMessages.createdAt);
    } catch (error) {
      console.error(`Error getting conversation between users ${user1Id} and ${user2Id}:`, error);
      return [];
    }
  }

  async markMessagesAsRead(senderId: number, receiverId: number): Promise<void> {
    try {
      await db
        .update(directMessages)
        .set({ read: true })
        .where(
          and(
            eq(directMessages.senderId, senderId),
            eq(directMessages.receiverId, receiverId),
            eq(directMessages.read, false)
          )
        );
    } catch (error) {
      console.error(`Error marking messages as read from ${senderId} to ${receiverId}:`, error);
    }
  }

  async getUnreadMessageCount(userId: number): Promise<number> {
    try {
      const result = await db
        .select({ count: sql<number>`count(*)` })
        .from(directMessages)
        .where(
          and(
            eq(directMessages.receiverId, userId),
            eq(directMessages.read, false)
          )
        );
      
      return result[0].count;
    } catch (error) {
      console.error(`Error getting unread message count for user ${userId}:`, error);
      return 0;
    }
  }

  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    try {
      const [message] = await db
        .select()
        .from(directMessages)
        .where(eq(directMessages.id, id));
      return message;
    } catch (error) {
      console.error(`Error getting direct message ${id}:`, error);
      return undefined;
    }
  }

  async clearConversation(userId1: number, userId2: number): Promise<boolean> {
    try {
      // Delete all messages between these two users
      await db.delete(directMessages)
        .where(
          or(
            and(
              eq(directMessages.senderId, userId1),
              eq(directMessages.receiverId, userId2)
            ),
            and(
              eq(directMessages.senderId, userId2),
              eq(directMessages.receiverId, userId1)
            )
          )
        );
      return true;
    } catch (error) {
      console.error(`Error clearing conversation between users ${userId1} and ${userId2}:`, error);
      return false;
    }
  }

  // Mental health chat methods
  async createMentalHealthChat(chat: InsertMentalHealthChat): Promise<MentalHealthChat> {
    try {
      const [createdChat] = await db
        .insert(mentalHealthChats)
        .values({
          userId: chat.userId,
          message: chat.message,
          isFromUser: chat.isFromUser,
          sentiment: chat.sentiment || null
        })
        .returning();
      return createdChat;
    } catch (error) {
      console.error(`Error creating mental health chat:`, error);
      throw error;
    }
  }

  async getMentalHealthChatHistory(userId: number, limit: number = 50): Promise<MentalHealthChat[]> {
    try {
      const chatHistory = await db
        .select()
        .from(mentalHealthChats)
        .where(eq(mentalHealthChats.userId, userId))
        .orderBy(mentalHealthChats.createdAt);
      
      return chatHistory;
    } catch (error) {
      console.error(`Error getting mental health chat history for user ${userId}:`, error);
      return [];
    }
  }
  
  async clearMentalHealthChatHistory(userId: number): Promise<boolean> {
    try {
      console.log(`Clearing mental health chat history for user ${userId}`);
      
      // Execute the delete operation directly with SQL for maximum compatibility
      // Use the db.execute method for direct SQL execution
      await db.execute(sql`DELETE FROM mental_health_chats WHERE user_id = ${userId}`);
      
      console.log(`Mental health chat history deleted for user ${userId}`);
      
      // Verify the chats are deleted (for debugging)
      const remainingChats = await db
        .select()
        .from(mentalHealthChats)
        .where(eq(mentalHealthChats.userId, userId));
      
      console.log(`Remaining chats after deletion: ${remainingChats.length}`);
      
      return true;
    } catch (error) {
      console.error(`Error clearing mental health chat history for user ${userId}:`, error);
      return false;
    }
  }
  
  // Session Notes methods
  async getSessionNote(id: number): Promise<SessionNote | undefined> {
    try {
      const [note] = await db.select().from(sessionNotes).where(eq(sessionNotes.id, id));
      return note;
    } catch (error) {
      console.error(`Error fetching session note ${id}:`, error);
      return undefined;
    }
  }
  
  async getSessionNotesBySession(sessionId: number): Promise<SessionNote[]> {
    try {
      return await db
        .select()
        .from(sessionNotes)
        .where(eq(sessionNotes.sessionId, sessionId))
        .orderBy(sessionNotes.createdAt);
    } catch (error) {
      console.error(`Error fetching session notes for session ${sessionId}:`, error);
      return [];
    }
  }
  
  async createSessionNote(note: InsertSessionNote): Promise<SessionNote> {
    try {
      const now = new Date();
      const [createdNote] = await db
        .insert(sessionNotes)
        .values({
          ...note,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      return createdNote;
    } catch (error) {
      console.error("Error creating session note:", error);
      throw error;
    }
  }
  
  async updateSessionNote(id: number, data: Partial<SessionNote>): Promise<SessionNote | undefined> {
    try {
      const [updatedNote] = await db
        .update(sessionNotes)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(sessionNotes.id, id))
        .returning();
      return updatedNote;
    } catch (error) {
      console.error(`Error updating session note ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteSessionNote(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(sessionNotes)
        .where(eq(sessionNotes.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting session note ${id}:`, error);
      return false;
    }
  }
  
  // Action Items methods
  async getActionItem(id: number): Promise<ActionItem | undefined> {
    try {
      const [item] = await db.select().from(actionItems).where(eq(actionItems.id, id));
      return item;
    } catch (error) {
      console.error(`Error fetching action item ${id}:`, error);
      return undefined;
    }
  }
  
  async getActionItemsBySession(sessionId: number): Promise<ActionItem[]> {
    try {
      return await db
        .select()
        .from(actionItems)
        .where(eq(actionItems.sessionId, sessionId))
        .orderBy(actionItems.dueDate);
    } catch (error) {
      console.error(`Error fetching action items for session ${sessionId}:`, error);
      return [];
    }
  }
  
  async getActionItemsByAssignee(userId: number): Promise<ActionItem[]> {
    try {
      return await db
        .select()
        .from(actionItems)
        .where(eq(actionItems.assignedToId, userId))
        .orderBy(actionItems.dueDate);
    } catch (error) {
      console.error(`Error fetching action items for user ${userId}:`, error);
      return [];
    }
  }
  
  async createActionItem(item: InsertActionItem): Promise<ActionItem> {
    try {
      const now = new Date();
      const [createdItem] = await db
        .insert(actionItems)
        .values({
          ...item,
          createdAt: now,
          updatedAt: now
        })
        .returning();
      return createdItem;
    } catch (error) {
      console.error("Error creating action item:", error);
      throw error;
    }
  }
  
  async updateActionItem(id: number, data: Partial<ActionItem>): Promise<ActionItem | undefined> {
    try {
      const [updatedItem] = await db
        .update(actionItems)
        .set({
          ...data,
          updatedAt: new Date()
        })
        .where(eq(actionItems.id, id))
        .returning();
      return updatedItem;
    } catch (error) {
      console.error(`Error updating action item ${id}:`, error);
      return undefined;
    }
  }
  
  async deleteActionItem(id: number): Promise<boolean> {
    try {
      const result = await db
        .delete(actionItems)
        .where(eq(actionItems.id, id))
        .returning();
      return result.length > 0;
    } catch (error) {
      console.error(`Error deleting action item ${id}:`, error);
      return false;
    }
  }
}