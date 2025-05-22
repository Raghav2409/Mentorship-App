import { 
  users, type User, type InsertUser,
  profiles, type Profile, type InsertProfile,
  sessions, type Session, type InsertSession,
  feedback, type Feedback, type InsertFeedback,
  matches, type Match, type InsertMatch,
  learningPaths, type LearningPath, type InsertLearningPath,
  userLearningProgress, type UserLearningProgress, type InsertUserLearningProgress,
  milestoneLogs, type MilestoneLog, type InsertMilestoneLog,
  supportGroups, type SupportGroup, type InsertSupportGroup,
  groupMemberships, type GroupMembership, type InsertGroupMembership,
  microsoftTokens, type MicrosoftTokens, type InsertMicrosoftTokens,
  reportedIssues, type ReportedIssue, type InsertReportedIssue,
  issueMessages, type IssueMessage, type InsertIssueMessage,
  userConnections, type UserConnection, type InsertUserConnection, type ConnectionStatusType,
  directMessages, type DirectMessage, type InsertDirectMessage,
  mentalHealthChats, type MentalHealthChat, type InsertMentalHealthChat,
  sessionNotes, type SessionNote, type InsertSessionNote,
  actionItems, type ActionItem, type InsertActionItem
} from "@shared/schema";
import session from "express-session";
import createMemoryStore from "memorystore";

const MemoryStore = createMemoryStore(session);

export interface IStorage {
  // User methods
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  getUserByEmail(email: string, includeInactive?: boolean): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: number, data: Partial<User>): Promise<User | undefined>;
  getUsersByRole(role: string): Promise<User[]>;
  
  // Profile methods
  getProfile(userId: number): Promise<Profile | undefined>;
  createProfile(profile: InsertProfile): Promise<Profile>;
  updateProfile(userId: number, data: Partial<Profile>): Promise<Profile | undefined>;
  
  // Session methods
  getSession(id: number): Promise<Session | undefined>;
  createSession(session: InsertSession): Promise<Session>;
  updateSession(id: number, data: Partial<Session>): Promise<Session | undefined>;
  getSessionsByMentor(mentorId: number): Promise<Session[]>;
  getSessionsByMentee(menteeId: number): Promise<Session[]>;
  getUpcomingSessions(userId: number): Promise<Session[]>;
  
  // Feedback methods
  getFeedback(id: number): Promise<Feedback | undefined>;
  createFeedback(feedback: InsertFeedback): Promise<Feedback>;
  getFeedbackBySession(sessionId: number): Promise<Feedback[]>;
  
  // Match methods
  getMatch(id: number): Promise<Match | undefined>;
  createMatch(match: InsertMatch): Promise<Match>;
  updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined>;
  getPendingMatches(): Promise<Match[]>;
  getMatchesByMentor(mentorId: number, status?: string): Promise<Match[]>;
  getMatchesByMentee(menteeId: number): Promise<Match[]>;
  
  // Learning path methods
  getLearningPath(id: number): Promise<LearningPath | undefined>;
  createLearningPath(path: InsertLearningPath): Promise<LearningPath>;
  getAllLearningPaths(): Promise<LearningPath[]>;
  getLearningPathsByCategory(category: string): Promise<LearningPath[]>;
  
  // User learning progress methods
  getUserLearningProgress(userId: number, pathId: number): Promise<UserLearningProgress | undefined>;
  createUserLearningProgress(progress: InsertUserLearningProgress): Promise<UserLearningProgress>;
  updateUserLearningProgress(userId: number, pathId: number, data: Partial<UserLearningProgress>): Promise<UserLearningProgress | undefined>;
  getAllUserLearningProgress(userId: number): Promise<UserLearningProgress[]>;
  
  // Milestone log methods
  getMilestoneLog(id: number): Promise<MilestoneLog | undefined>;
  createMilestoneLog(log: InsertMilestoneLog): Promise<MilestoneLog>;
  getMilestoneLogsByUser(userId: number): Promise<MilestoneLog[]>;
  getMilestoneLogsByType(userId: number, type: string): Promise<MilestoneLog[]>;
  
  // Support group methods
  getSupportGroup(id: number): Promise<SupportGroup | undefined>;
  createSupportGroup(group: InsertSupportGroup): Promise<SupportGroup>;
  getAllSupportGroups(): Promise<SupportGroup[]>;
  
  // Group membership methods
  createGroupMembership(membership: InsertGroupMembership): Promise<GroupMembership>;
  getUserGroups(userId: number): Promise<SupportGroup[]>;
  getGroupMembers(groupId: number): Promise<User[]>;
  
  // Microsoft integration methods
  getMicrosoftTokens(userId: number): Promise<MicrosoftTokens | undefined>;
  saveMicrosoftTokens(
    userId: number, 
    microsoftEmail: string, 
    accessToken: string, 
    refreshToken: string, 
    expiresAt: Date
  ): Promise<MicrosoftTokens>;
  deleteMicrosoftTokens(userId: number): Promise<boolean>;

  // Reported issues methods
  getReportedIssue(id: number): Promise<ReportedIssue | undefined>;
  createReportedIssue(issue: InsertReportedIssue): Promise<ReportedIssue>;
  updateReportedIssue(id: number, data: Partial<ReportedIssue>): Promise<ReportedIssue | undefined>;
  getReportedIssuesByUser(userId: number): Promise<ReportedIssue[]>;
  getReportedIssuesByAssignee(assigneeId: number): Promise<ReportedIssue[]>;
  getAllReportedIssues(): Promise<ReportedIssue[]>;
  
  // Issue messages methods
  getIssueMessage(id: number): Promise<IssueMessage | undefined>;
  createIssueMessage(message: InsertIssueMessage): Promise<IssueMessage>;
  getIssueMessages(issueId: number): Promise<IssueMessage[]>;
  
  // User connections methods (for community channels)
  getUserConnection(id: number): Promise<UserConnection | undefined>;
  createUserConnection(connection: InsertUserConnection): Promise<UserConnection>;
  updateUserConnection(id: number, data: Partial<UserConnection>): Promise<UserConnection | undefined>;
  getUserConnectionByUsers(userId1: number, userId2: number): Promise<UserConnection | undefined>;
  getUserConnections(userId: number): Promise<UserConnection[]>;
  getPendingReceivedConnections(userId: number): Promise<UserConnection[]>;
  getConnectedUsers(userId: number): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  
  // Direct messages methods
  getDirectMessage(id: number): Promise<DirectMessage | undefined>;
  createDirectMessage(message: InsertDirectMessage): Promise<DirectMessage>;
  getConversation(userId1: number, userId2: number): Promise<DirectMessage[]>;
  markMessagesAsRead(userId: number, otherUserId: number): Promise<void>;
  getUnreadMessageCount(userId: number): Promise<number>;
  clearConversation(userId1: number, userId2: number): Promise<boolean>;
  
  // Mental health chat methods
  createMentalHealthChat(chat: InsertMentalHealthChat): Promise<MentalHealthChat>;
  getMentalHealthChatHistory(userId: number, limit?: number): Promise<MentalHealthChat[]>;
  clearMentalHealthChatHistory(userId: number): Promise<boolean>;
  
  // Session store for Express
  sessionStore: session.Store;
  
  // Session notes methods
  getSessionNote(id: number): Promise<SessionNote | undefined>;
  getSessionNotesBySession(sessionId: number): Promise<SessionNote[]>;
  createSessionNote(note: InsertSessionNote): Promise<SessionNote>;
  updateSessionNote(id: number, data: Partial<SessionNote>): Promise<SessionNote | undefined>;
  deleteSessionNote(id: number): Promise<boolean>;
  
  // Action items methods
  getActionItem(id: number): Promise<ActionItem | undefined>;
  getActionItemsBySession(sessionId: number): Promise<ActionItem[]>;
  getActionItemsByAssignee(userId: number): Promise<ActionItem[]>;
  createActionItem(item: InsertActionItem): Promise<ActionItem>;
  updateActionItem(id: number, data: Partial<ActionItem>): Promise<ActionItem | undefined>;
  deleteActionItem(id: number): Promise<boolean>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private profiles: Map<number, Profile>;
  private sessionNotes: Map<number, SessionNote>;
  private actionItems: Map<number, ActionItem>;
  private sessionStorage: Map<number, Session>;
  private feedbacks: Map<number, Feedback>;
  private matchStorage: Map<number, Match>;
  private learningPaths: Map<number, LearningPath>;
  private learningProgresses: Map<string, UserLearningProgress>;
  private milestoneLogs: Map<number, MilestoneLog>;
  private supportGroups: Map<number, SupportGroup>;
  private groupMemberships: Map<number, GroupMembership>;
  private microsoftTokensMap: Map<number, MicrosoftTokens>;
  private reportedIssuesMap: Map<number, ReportedIssue>;
  private issueMessagesMap: Map<number, IssueMessage>;
  private userConnectionsMap: Map<number, UserConnection>;
  private directMessagesMap: Map<number, DirectMessage>;
  private mentalHealthChatsMap: Map<number, MentalHealthChat>;
  
  sessionStore: session.Store;
  
  private currentIds: {
    user: number;
    profile: number;
    session: number;
    feedback: number;
    match: number;
    learningPath: number;
    learningProgress: number;
    milestoneLog: number;
    supportGroup: number;
    groupMembership: number;
    reportedIssue: number;
    issueMessage: number;
    connection: number;
    directMessage: number;
    mentalHealthChat: number;
  };

  constructor() {
    this.users = new Map();
    this.profiles = new Map();
    this.sessionStorage = new Map();
    this.feedbacks = new Map();
    this.matchStorage = new Map();
    this.learningPaths = new Map();
    this.learningProgresses = new Map();
    this.milestoneLogs = new Map();
    this.supportGroups = new Map();
    this.groupMemberships = new Map();
    this.microsoftTokensMap = new Map();
    this.reportedIssuesMap = new Map();
    this.issueMessagesMap = new Map();
    this.userConnectionsMap = new Map();
    this.directMessagesMap = new Map();
    this.mentalHealthChatsMap = new Map();
    this.sessionNotes = new Map();
    this.actionItems = new Map();
    
    this.currentIds = {
      user: 1,
      profile: 1,
      session: 1,
      feedback: 1,
      match: 1,
      learningPath: 1,
      learningProgress: 1,
      milestoneLog: 1,
      supportGroup: 1,
      groupMembership: 1,
      reportedIssue: 1,
      issueMessage: 1,
      connection: 1,
      directMessage: 1,
      mentalHealthChat: 1,
      sessionNote: 1,
      actionItem: 1
    };
    
    this.sessionStore = new MemoryStore({
      checkPeriod: 86400000, // prune expired entries every 24h
    });
  }

  // User methods
  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.username === username,
    );
  }
  
  async getUserByEmail(email: string, includeInactive: boolean = false): Promise<User | undefined> {
    return Array.from(this.users.values()).find(
      (user) => user.email === email && (includeInactive || user.active !== false)
    );
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentIds.user++;
    const createdAt = new Date();
    const user: User = { ...insertUser, id, createdAt };
    this.users.set(id, user);
    return user;
  }
  
  async updateUser(id: number, data: Partial<User>): Promise<User | undefined> {
    const user = await this.getUser(id);
    if (!user) return undefined;
    
    const updatedUser = { ...user, ...data };
    this.users.set(id, updatedUser);
    return updatedUser;
  }
  
  async getUsersByRole(role: string): Promise<User[]> {
    return Array.from(this.users.values()).filter(user => user.role === role);
  }
  
  // Profile methods
  async getProfile(userId: number): Promise<Profile | undefined> {
    return Array.from(this.profiles.values()).find(
      profile => profile.userId === userId
    );
  }
  
  async createProfile(insertProfile: InsertProfile): Promise<Profile> {
    const id = this.currentIds.profile++;
    const profile: Profile = { ...insertProfile, id };
    this.profiles.set(id, profile);
    return profile;
  }
  
  async updateProfile(userId: number, data: Partial<Profile>): Promise<Profile | undefined> {
    const profile = await this.getProfile(userId);
    if (!profile) return undefined;
    
    const updatedProfile = { ...profile, ...data };
    this.profiles.set(profile.id, updatedProfile);
    return updatedProfile;
  }
  
  // Session methods
  async getSession(id: number): Promise<Session | undefined> {
    return this.sessionStorage.get(id);
  }
  
  async createSession(insertSession: InsertSession): Promise<Session> {
    const id = this.currentIds.session++;
    const createdAt = new Date();
    const session: Session = { ...insertSession, id, createdAt };
    this.sessionStorage.set(id, session);
    return session;
  }
  
  async updateSession(id: number, data: Partial<Session>): Promise<Session | undefined> {
    const session = await this.getSession(id);
    if (!session) return undefined;
    
    const updatedSession = { ...session, ...data };
    this.sessionStorage.set(id, updatedSession);
    return updatedSession;
  }
  
  async getSessionsByMentor(mentorId: number): Promise<Session[]> {
    return Array.from(this.sessionStorage.values()).filter(
      session => session.mentorId === mentorId
    );
  }
  
  async getSessionsByMentee(menteeId: number): Promise<Session[]> {
    return Array.from(this.sessionStorage.values()).filter(
      session => session.menteeId === menteeId
    );
  }
  
  async getUpcomingSessions(userId: number): Promise<Session[]> {
    const now = new Date();
    return Array.from(this.sessionStorage.values())
      .filter(session => 
        (session.mentorId === userId || session.menteeId === userId) && 
        new Date(session.date) > now
      )
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }
  
  // Feedback methods
  async getFeedback(id: number): Promise<Feedback | undefined> {
    return this.feedbacks.get(id);
  }
  
  async createFeedback(insertFeedback: InsertFeedback): Promise<Feedback> {
    const id = this.currentIds.feedback++;
    const createdAt = new Date();
    const feedback: Feedback = { ...insertFeedback, id, createdAt };
    this.feedbacks.set(id, feedback);
    return feedback;
  }
  
  async getFeedbackBySession(sessionId: number): Promise<Feedback[]> {
    return Array.from(this.feedbacks.values()).filter(
      feedback => feedback.sessionId === sessionId
    );
  }
  
  // Match methods
  async getMatch(id: number): Promise<Match | undefined> {
    return this.matchStorage.get(id);
  }
  
  async createMatch(insertMatch: InsertMatch): Promise<Match> {
    const id = this.currentIds.match++;
    const createdAt = new Date();
    const status = "pending";
    const match: Match = { ...insertMatch, id, status, createdAt };
    this.matchStorage.set(id, match);
    return match;
  }
  
  async updateMatch(id: number, data: Partial<Match>): Promise<Match | undefined> {
    const match = await this.getMatch(id);
    if (!match) return undefined;
    
    const updatedMatch = { ...match, ...data };
    this.matchStorage.set(id, updatedMatch);
    return updatedMatch;
  }
  
  async getPendingMatches(): Promise<Match[]> {
    return Array.from(this.matchStorage.values()).filter(
      match => match.status === "pending"
    );
  }
  
  async getMatchesByMentor(mentorId: number, status?: string): Promise<Match[]> {
    return Array.from(this.matchStorage.values()).filter(
      match => match.mentorId === mentorId && (status ? match.status === status : true)
    );
  }
  
  async getMatchesByMentee(menteeId: number): Promise<Match[]> {
    return Array.from(this.matchStorage.values()).filter(
      match => match.menteeId === menteeId
    );
  }
  
  // Learning path methods
  async getLearningPath(id: number): Promise<LearningPath | undefined> {
    return this.learningPaths.get(id);
  }
  
  async createLearningPath(insertPath: InsertLearningPath): Promise<LearningPath> {
    const id = this.currentIds.learningPath++;
    const createdAt = new Date();
    const learningPath: LearningPath = { ...insertPath, id, createdAt };
    this.learningPaths.set(id, learningPath);
    return learningPath;
  }
  
  async getAllLearningPaths(): Promise<LearningPath[]> {
    return Array.from(this.learningPaths.values());
  }
  
  async getLearningPathsByCategory(category: string): Promise<LearningPath[]> {
    return Array.from(this.learningPaths.values()).filter(
      path => path.category === category
    );
  }
  
  // User learning progress methods
  async getUserLearningProgress(userId: number, pathId: number): Promise<UserLearningProgress | undefined> {
    const key = `${userId}-${pathId}`;
    return this.learningProgresses.get(key);
  }
  
  async createUserLearningProgress(insertProgress: InsertUserLearningProgress): Promise<UserLearningProgress> {
    const id = this.currentIds.learningProgress++;
    const startedAt = new Date();
    const progress = 0;
    const userProgress: UserLearningProgress = { 
      ...insertProgress, 
      id, 
      progress, 
      startedAt, 
      completedAt: null 
    };
    
    const key = `${insertProgress.userId}-${insertProgress.pathId}`;
    this.learningProgresses.set(key, userProgress);
    return userProgress;
  }
  
  async updateUserLearningProgress(userId: number, pathId: number, data: Partial<UserLearningProgress>): Promise<UserLearningProgress | undefined> {
    const key = `${userId}-${pathId}`;
    const progress = this.learningProgresses.get(key);
    if (!progress) return undefined;
    
    const updatedProgress = { ...progress, ...data };
    this.learningProgresses.set(key, updatedProgress);
    return updatedProgress;
  }
  
  async getAllUserLearningProgress(userId: number): Promise<UserLearningProgress[]> {
    return Array.from(this.learningProgresses.values()).filter(
      progress => progress.userId === userId
    );
  }
  
  // Milestone log methods
  async getMilestoneLog(id: number): Promise<MilestoneLog | undefined> {
    return this.milestoneLogs.get(id);
  }
  
  async createMilestoneLog(insertLog: InsertMilestoneLog): Promise<MilestoneLog> {
    const id = this.currentIds.milestoneLog++;
    const date = new Date();
    const log: MilestoneLog = { ...insertLog, id, date };
    this.milestoneLogs.set(id, log);
    return log;
  }
  
  async getMilestoneLogsByUser(userId: number): Promise<MilestoneLog[]> {
    return Array.from(this.milestoneLogs.values())
      .filter(log => log.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  
  async getMilestoneLogsByType(userId: number, type: string): Promise<MilestoneLog[]> {
    return Array.from(this.milestoneLogs.values())
      .filter(log => log.userId === userId && log.type === type)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  
  // Support group methods
  async getSupportGroup(id: number): Promise<SupportGroup | undefined> {
    return this.supportGroups.get(id);
  }
  
  async createSupportGroup(insertGroup: InsertSupportGroup): Promise<SupportGroup> {
    const id = this.currentIds.supportGroup++;
    const createdAt = new Date();
    const lastActive = new Date();
    const memberCount = 0;
    const group: SupportGroup = { ...insertGroup, id, memberCount, lastActive, createdAt };
    this.supportGroups.set(id, group);
    return group;
  }
  
  async getAllSupportGroups(): Promise<SupportGroup[]> {
    return Array.from(this.supportGroups.values());
  }
  
  // Group membership methods
  async createGroupMembership(insertMembership: InsertGroupMembership): Promise<GroupMembership> {
    const id = this.currentIds.groupMembership++;
    const joinedAt = new Date();
    const membership: GroupMembership = { ...insertMembership, id, joinedAt };
    this.groupMemberships.set(id, membership);
    
    // Update member count in the group
    const group = await this.getSupportGroup(insertMembership.groupId);
    if (group) {
      const updatedGroup = { 
        ...group, 
        memberCount: group.memberCount + 1,
        lastActive: new Date() 
      };
      this.supportGroups.set(group.id, updatedGroup);
    }
    
    return membership;
  }
  
  async getUserGroups(userId: number): Promise<SupportGroup[]> {
    const memberships = Array.from(this.groupMemberships.values())
      .filter(membership => membership.userId === userId);
      
    const groupIds = memberships.map(membership => membership.groupId);
    return Array.from(this.supportGroups.values())
      .filter(group => groupIds.includes(group.id));
  }
  
  async getGroupMembers(groupId: number): Promise<User[]> {
    const memberships = Array.from(this.groupMemberships.values())
      .filter(membership => membership.groupId === groupId);
      
    const userIds = memberships.map(membership => membership.userId);
    return Array.from(this.users.values())
      .filter(user => userIds.includes(user.id));
  }
  
  // Microsoft integration methods
  async getMicrosoftTokens(userId: number): Promise<MicrosoftTokens | undefined> {
    return Array.from(this.microsoftTokensMap.values()).find(
      tokens => tokens.userId === userId
    );
  }

  async saveMicrosoftTokens(
    userId: number, 
    microsoftEmail: string, 
    accessToken: string, 
    refreshToken: string, 
    expiresAt: Date
  ): Promise<MicrosoftTokens> {
    // Check if tokens already exist for this user
    const existingTokens = await this.getMicrosoftTokens(userId);
    
    if (existingTokens) {
      // Update existing tokens
      const updatedTokens: MicrosoftTokens = {
        ...existingTokens,
        microsoftEmail,
        accessToken,
        refreshToken,
        expiresAt,
        updatedAt: new Date()
      };
      
      this.microsoftTokensMap.set(existingTokens.id, updatedTokens);
      return updatedTokens;
    } else {
      // Create new tokens
      const id = Date.now(); // Simple way to generate a unique ID
      const createdAt = new Date();
      const updatedAt = new Date();
      
      const tokens: MicrosoftTokens = {
        id,
        userId,
        microsoftEmail,
        accessToken,
        refreshToken,
        expiresAt,
        createdAt,
        updatedAt
      };
      
      this.microsoftTokensMap.set(id, tokens);
      return tokens;
    }
  }

  async deleteMicrosoftTokens(userId: number): Promise<boolean> {
    const tokens = await this.getMicrosoftTokens(userId);
    
    if (!tokens) {
      return false;
    }
    
    this.microsoftTokensMap.delete(tokens.id);
    return true;
  }
  
  // Reported issues implementation
  private reportedIssuesMap = new Map<number, ReportedIssue>();
  private issueMessagesMap = new Map<number, IssueMessage>();
  private currentIssueId = 1;
  private currentMessageId = 1;
  
  async getReportedIssue(id: number): Promise<ReportedIssue | undefined> {
    return this.reportedIssuesMap.get(id);
  }
  
  async createReportedIssue(insertIssue: InsertReportedIssue): Promise<ReportedIssue> {
    const id = this.currentIssueId++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const status = "pending";
    
    const issue: ReportedIssue = { 
      ...insertIssue, 
      id, 
      createdAt, 
      updatedAt, 
      status,
      assignedToId: null 
    };
    
    this.reportedIssuesMap.set(id, issue);
    return issue;
  }
  
  async updateReportedIssue(id: number, data: Partial<ReportedIssue>): Promise<ReportedIssue | undefined> {
    const issue = await this.getReportedIssue(id);
    if (!issue) return undefined;
    
    const updatedIssue = { 
      ...issue, 
      ...data,
      updatedAt: new Date() 
    };
    
    this.reportedIssuesMap.set(id, updatedIssue);
    return updatedIssue;
  }
  
  async getReportedIssuesByUser(userId: number): Promise<ReportedIssue[]> {
    return Array.from(this.reportedIssuesMap.values())
      .filter(issue => issue.userId === userId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async getReportedIssuesByAssignee(assigneeId: number): Promise<ReportedIssue[]> {
    return Array.from(this.reportedIssuesMap.values())
      .filter(issue => issue.assignedToId === assigneeId)
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async getAllReportedIssues(): Promise<ReportedIssue[]> {
    return Array.from(this.reportedIssuesMap.values())
      .sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
  }
  
  async getIssueMessage(id: number): Promise<IssueMessage | undefined> {
    return this.issueMessagesMap.get(id);
  }
  
  async createIssueMessage(insertMessage: InsertIssueMessage): Promise<IssueMessage> {
    const id = this.currentMessageId++;
    const createdAt = new Date();
    
    const message: IssueMessage = {
      ...insertMessage,
      id,
      createdAt
    };
    
    this.issueMessagesMap.set(id, message);
    
    // Update the issue's updated timestamp
    const issue = await this.getReportedIssue(insertMessage.issueId);
    if (issue) {
      await this.updateReportedIssue(issue.id, { updatedAt: new Date() });
    }
    
    return message;
  }
  
  async getIssueMessages(issueId: number): Promise<IssueMessage[]> {
    return Array.from(this.issueMessagesMap.values())
      .filter(message => message.issueId === issueId)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  
  // User connections for community channels implementation
  private userConnectionsMap = new Map<number, UserConnection>();
  private directMessagesMap = new Map<number, DirectMessage>();
  private currentConnectionId = 1;
  private currentDirectMessageId = 1;
  
  async getUserConnection(id: number): Promise<UserConnection | undefined> {
    return this.userConnectionsMap.get(id);
  }
  
  async createUserConnection(insertConnection: InsertUserConnection): Promise<UserConnection> {
    const id = this.currentIds.connection++;
    const createdAt = new Date();
    const updatedAt = new Date();
    const status = "pending";
    
    const connection: UserConnection = {
      ...insertConnection,
      id,
      status: status as ConnectionStatusType,
      createdAt,
      updatedAt,
    };
    
    this.userConnectionsMap.set(id, connection);
    return connection;
  }
  
  async updateUserConnection(id: number, data: Partial<UserConnection>): Promise<UserConnection | undefined> {
    const connection = await this.getUserConnection(id);
    if (!connection) return undefined;
    
    const updatedConnection = {
      ...connection,
      ...data,
      updatedAt: new Date()
    };
    
    this.userConnectionsMap.set(id, updatedConnection);
    return updatedConnection;
  }
  
  async getUserConnectionByUsers(userId1: number, userId2: number): Promise<UserConnection | undefined> {
    return Array.from(this.userConnectionsMap.values()).find(
      connection => 
        (connection.requesterId === userId1 && connection.receiverId === userId2) ||
        (connection.requesterId === userId2 && connection.receiverId === userId1)
    );
  }
  
  async getUserConnections(userId: number): Promise<UserConnection[]> {
    return Array.from(this.userConnectionsMap.values()).filter(
      connection => 
        (connection.requesterId === userId || connection.receiverId === userId) &&
        connection.status === "accepted"
    );
  }
  
  async getPendingReceivedConnections(userId: number): Promise<UserConnection[]> {
    return Array.from(this.userConnectionsMap.values()).filter(
      connection => 
        connection.receiverId === userId && 
        connection.status === "pending"
    );
  }
  
  async getConnectedUsers(userId: number): Promise<User[]> {
    const connections = await this.getUserConnections(userId);
    
    const connectedUserIds = connections.map(connection => 
      connection.requesterId === userId ? connection.receiverId : connection.requesterId
    );
    
    return Array.from(this.users.values())
      .filter(user => connectedUserIds.includes(user.id) && user.active !== false);
  }
  
  // Direct messages methods
  async getDirectMessage(id: number): Promise<DirectMessage | undefined> {
    return this.directMessagesMap.get(id);
  }
  
  async createDirectMessage(insertMessage: InsertDirectMessage): Promise<DirectMessage> {
    const id = this.currentIds.directMessage++;
    const createdAt = new Date();
    const read = false;
    
    const message: DirectMessage = {
      ...insertMessage,
      id,
      read,
      createdAt
    };
    
    this.directMessagesMap.set(id, message);
    return message;
  }
  
  async getConversation(userId1: number, userId2: number): Promise<DirectMessage[]> {
    return Array.from(this.directMessagesMap.values())
      .filter(message => 
        (message.senderId === userId1 && message.receiverId === userId2) ||
        (message.senderId === userId2 && message.receiverId === userId1)
      )
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  
  async markMessagesAsRead(userId: number, otherUserId: number): Promise<void> {
    const messages = Array.from(this.directMessagesMap.values())
      .filter(message => message.senderId === otherUserId && message.receiverId === userId);
    
    for (const message of messages) {
      this.directMessagesMap.set(message.id, { ...message, read: true });
    }
  }
  
  async getUnreadMessageCount(userId: number): Promise<number> {
    return Array.from(this.directMessagesMap.values())
      .filter(message => message.receiverId === userId && !message.read)
      .length;
  }
  
  async clearConversation(userId1: number, userId2: number): Promise<boolean> {
    try {
      // Get all message IDs in this conversation
      const messageIds = Array.from(this.directMessagesMap.values())
        .filter(message => 
          (message.senderId === userId1 && message.receiverId === userId2) ||
          (message.senderId === userId2 && message.receiverId === userId1)
        )
        .map(message => message.id);
      
      // Delete all identified messages
      for (const id of messageIds) {
        this.directMessagesMap.delete(id);
      }
      
      return true;
    } catch (error) {
      console.error("Error clearing conversation:", error);
      return false;
    }
  }
  
  // Mental health chat methods
  async createMentalHealthChat(insertChat: InsertMentalHealthChat): Promise<MentalHealthChat> {
    const id = this.currentIds.mentalHealthChat++;
    const createdAt = new Date();
    
    const chat: MentalHealthChat = {
      ...insertChat,
      id,
      createdAt
    };
    
    this.mentalHealthChatsMap.set(id, chat);
    return chat;
  }
  
  async getMentalHealthChatHistory(userId: number, limit: number = 50): Promise<MentalHealthChat[]> {
    return Array.from(this.mentalHealthChatsMap.values())
      .filter(chat => chat.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit)
      .reverse(); // Return in chronological order
  }
  
  async clearMentalHealthChatHistory(userId: number): Promise<boolean> {
    try {
      // Identify all chat messages for this user
      const userChatIds = Array.from(this.mentalHealthChatsMap.entries())
        .filter(([_, chat]) => chat.userId === userId)
        .map(([id, _]) => id);
      
      // Delete all messages for this user
      userChatIds.forEach(id => this.mentalHealthChatsMap.delete(id));
      
      return true;
    } catch (error) {
      console.error(`Error clearing mental health chat history for user ${userId}:`, error);
      return false;
    }
  }
}

// Import the database storage implementation
import { DatabaseStorage } from './storage-db';

// Use database storage instead of memory storage
export const storage = new DatabaseStorage();
