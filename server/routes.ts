import type { Express, Request as ExpressRequest, Response } from "express";
import type { ParamsDictionary } from "express-serve-static-core";
import type { ParsedQs } from "qs";
import { User, UserConnection, DirectMessage } from "@shared/schema";

// Extend the Express Request type to include user property
interface Request extends ExpressRequest {
  user?: User;
}
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from 'ws';
import { storage } from "./storage";
import { setupAuth, requireAuth, requireRole } from "./auth";
import { createCalendarEvent } from "./microsoft-auth";
import { sendSessionNotification } from "./azure-email";
import OpenAI from "openai";
import { 
  insertSessionSchema, 
  insertFeedbackSchema, 
  insertMatchSchema, 
  insertLearningPathSchema,
  insertUserLearningProgressSchema,
  insertMilestoneLogSchema,
  insertSupportGroupSchema,
  insertGroupMembershipSchema,
  insertSessionNoteSchema,
  insertActionItemSchema,
  insertReportedIssueSchema,
  insertIssueMessageSchema,
  insertUserConnectionSchema,
  insertDirectMessageSchema,
  UserRole,
  SessionStatus,
  ConnectionStatus,
  OnboardingStatus
} from "@shared/schema";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { 
  getMicrosoftAuthUrl, 
  handleMicrosoftCallback, 
  getUserCalendarEvents,
  isUserConnectedToMicrosoft,
  disconnectMicrosoftAccount
} from "./microsoft-auth";

export async function registerRoutes(app: Express): Promise<Server> {
  // Set up authentication routes
  setupAuth(app);

  // User routes
  app.get("/api/users", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const role = req.query.role as string;
      let users;
      
      if (role) {
        users = await storage.getUsersByRole(role);
      } else {
        // Return all users
        const allUsers = [];
        for (const roleKey in UserRole) {
          const usersWithRole = await storage.getUsersByRole(UserRole[roleKey as keyof typeof UserRole]);
          allUsers.push(...usersWithRole);
        }
        users = allUsers;
      }
      
      // Remove password field from users
      const sanitizedUsers = users.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.status(200).json(sanitizedUsers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching users" });
    }
  });
  
  // Delete/deactivate a user
  app.delete("/api/users/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req, res) => {
    try {
      const userId = parseInt(req.params.id);
      
      // Check if the user exists
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Cast needed because we added the 'active' field after creating TypeScript type
      const updatedUser = await storage.updateUser(userId, { 
        active: false
      } as Partial<User>);
      
      if (!updatedUser) {
        return res.status(500).json({ message: "Failed to deactivate user" });
      }
      
      res.status(200).json({ message: "User deactivated successfully" });
    } catch (error) {
      console.error("Error deactivating user:", error);
      res.status(500).json({ message: "Error deactivating user" });
    }
  });

  // Session routes
  app.post("/api/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      // Debug logging to understand data format issues
      console.log("Received session data:", JSON.stringify(req.body));
      console.log("Date type:", typeof req.body.date);

      // Manual conversion of date if needed
      if (typeof req.body.date === 'string') {
        req.body.date = new Date(req.body.date);
      }
      
      const sessionData = insertSessionSchema.parse(req.body);
      console.log("After parsing:", JSON.stringify(sessionData));
      
      // Check if the mentor is available at the requested time
      const mentorId = sessionData.mentorId;
      const sessionDate = new Date(sessionData.date);
      const sessionDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][sessionDate.getDay()];
      const sessionHour = sessionDate.getHours();
      
      // Convert to AM/PM format to match the format stored in the profile
      let displayHour = sessionHour;
      let ampm = "AM";
      
      if (sessionHour >= 12) {
        ampm = "PM";
        if (sessionHour > 12) {
          displayHour = sessionHour - 12;
        }
      }
      // Handle 12 AM special case
      if (sessionHour === 0) {
        displayHour = 12;
      }
      
      const sessionTimeSlot = `${displayHour.toString().padStart(2, '0')}:00 ${ampm}`;
      console.log(`Checking mentor availability for ${sessionDay} at ${sessionTimeSlot}`);
      
      // Get mentor's profile to check availability
      const mentorProfile = await storage.getProfile(mentorId);
      
      if (mentorProfile && mentorProfile.availability) {
        console.log("Mentor availability:", JSON.stringify(mentorProfile.availability));
        // Find the day in the mentor's availability
        const dayAvailability = mentorProfile.availability.find(day => day.day === sessionDay);
        
        if (!dayAvailability) {
          console.log(`Mentor has no availability set for ${sessionDay}`);
          return res.status(400).json({ 
            message: `Mentor is not available on ${sessionDay}`,
            availableTimes: mentorProfile.availability
          });
        }
        
        console.log(`Available slots for ${sessionDay}:`, dayAvailability.slots);
        // Check if the mentor is available at the requested time slot
        if (!dayAvailability.slots.includes(sessionTimeSlot)) {
          console.log(`Time slot ${sessionTimeSlot} not found in mentor's availability`);
          return res.status(400).json({ 
            message: "Mentor is not available at the requested time slot",
            availableTimes: mentorProfile.availability
          });
        }
        
        console.log(`Mentor is available on ${sessionDay} at ${sessionTimeSlot}`);
      }
      
      const session = await storage.createSession(sessionData);
      
      // Get mentor and mentee details for notification
      const mentor = await storage.getUser(sessionData.mentorId);
      const mentee = await storage.getUser(sessionData.menteeId);
      
      // Send email notification using Azure Communication Services if credentials are available
      if (mentor && mentee) {
        try {
          // Dynamic import to avoid circular dependencies
          const { sendSessionNotification, checkAzureCredentials } = await import('./azure-email');
          const hasAzureCredentials = await checkAzureCredentials();
          
          if (hasAzureCredentials) {
            console.log("Sending session notification email to mentor via Azure:", mentor.email);
            // Send email notification to the mentor
            await sendSessionNotification(
              mentor.email,
              mentee.email,
              mentor.fullName,
              mentee.fullName,
              sessionData.title,
              sessionDate,
              sessionData.duration
            );
          } else {
            console.log("Azure Communication Services credentials not available, skipping email notification");
          }
        } catch (emailError) {
          console.error("Failed to send email notification:", emailError);
          // Don't fail the entire request if email sending fails
        }
      }
      
      res.status(201).json(session);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        console.error("Session validation error:", validationError.message);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Session creation error:", error);
      res.status(500).json({ message: "Error creating session" });
    }
  });

  app.get("/api/sessions", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      
      let sessions;
      if (role === UserRole.MENTOR) {
        sessions = await storage.getSessionsByMentor(userId);
      } else if (role === UserRole.MENTEE || role === UserRole.NEW_MOTHER) {
        sessions = await storage.getSessionsByMentee(userId);
      } else if (role === UserRole.ADMIN) {
        // For admin, we can return all sessions or add a filter
        const mentorId = req.query.mentorId ? Number(req.query.mentorId) : undefined;
        const menteeId = req.query.menteeId ? Number(req.query.menteeId) : undefined;
        
        if (mentorId) {
          sessions = await storage.getSessionsByMentor(mentorId);
        } else if (menteeId) {
          sessions = await storage.getSessionsByMentee(menteeId);
        } else {
          // Return all sessions for now (in a real app, we'd paginate this)
          const allSessions = [];
          const mentors = await storage.getUsersByRole(UserRole.MENTOR);
          for (const mentor of mentors) {
            const mentorSessions = await storage.getSessionsByMentor(mentor.id);
            allSessions.push(...mentorSessions);
          }
          sessions = allSessions;
        }
      } else {
        return res.status(403).json({ message: "Unauthorized" });
      }
      
      res.status(200).json(sessions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching sessions" });
    }
  });

  app.get("/api/sessions/upcoming", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const upcomingSessions = await storage.getUpcomingSessions(userId);
      
      // Enrich with user details
      const enrichedSessions = await Promise.all(upcomingSessions.map(async (session) => {
        const mentor = await storage.getUser(session.mentorId);
        const mentee = await storage.getUser(session.menteeId);
        
        return {
          ...session,
          mentor: mentor ? { 
            id: mentor.id,
            fullName: mentor.fullName,
            username: mentor.username
          } : null,
          mentee: mentee ? {
            id: mentee.id,
            fullName: mentee.fullName,
            username: mentee.username
          } : null
        };
      }));
      
      res.status(200).json(enrichedSessions);
    } catch (error) {
      res.status(500).json({ message: "Error fetching upcoming sessions" });
    }
  });

  app.put("/api/sessions/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = Number(req.params.id);
      const session = await storage.getSession(sessionId);
      
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Check if user is allowed to update this session
      const userId = req.user.id;
      const role = req.user.role;
      
      if (
        role !== UserRole.ADMIN && 
        session.mentorId !== userId && 
        session.menteeId !== userId
      ) {
        return res.status(403).json({ message: "Not authorized to update this session" });
      }
      
      // Check if session is being approved (status changed to CONFIRMED)
      const isBeingApproved = 
        req.body.status === SessionStatus.CONFIRMED && 
        session.status !== SessionStatus.CONFIRMED;
      
      // Update the session in the database
      const updatedSession = await storage.updateSession(sessionId, req.body);
      
      // If the session is being approved, create calendar events for both mentor and mentee
      if (isBeingApproved) {
        console.log(`Session ${sessionId} approved. Creating calendar events...`);
        
        try {
          // Get mentor and mentee details
          const mentor = await storage.getUser(session.mentorId);
          const mentee = await storage.getUser(session.menteeId);
          
          if (!mentor || !mentee) {
            console.error("Could not find mentor or mentee for session", sessionId);
          } else {
            // Description for the calendar event
            const description = `
              <h3>Mentorship Session</h3>
              <p><strong>Title:</strong> ${session.title || 'Mentorship Session'}</p>
              <p><strong>Mentor:</strong> ${mentor.fullName}</p>
              <p><strong>Mentee:</strong> ${mentee.fullName}</p>
              <p><strong>Duration:</strong> ${session.duration} minutes</p>
              <p><strong>Agenda:</strong> ${session.agenda || 'N/A'}</p>
            `;
            
            // Create event on mentor's calendar
            const mentorEvent = await createCalendarEvent(
              session.mentorId,
              `Mentorship: ${session.title || 'Session with ' + mentee.fullName}`,
              new Date(session.date),
              session.duration,
              [mentee.email],
              description
            );
            
            // Create event on mentee's calendar
            const menteeEvent = await createCalendarEvent(
              session.menteeId,
              `Mentorship: ${session.title || 'Session with ' + mentor.fullName}`,
              new Date(session.date),
              session.duration,
              [mentor.email],
              description
            );
            
            if (mentorEvent || menteeEvent) {
              console.log(`Created calendar events for session ${sessionId}`);
              
              // Update the session with the Teams meeting link if available
              if (mentorEvent && mentorEvent.onlineMeeting && mentorEvent.onlineMeeting.joinUrl) {
                await storage.updateSession(sessionId, {
                  meetingLink: mentorEvent.onlineMeeting.joinUrl
                });
                console.log(`Updated session with Teams meeting link`);
              }
            } else {
              console.log(`No calendar events created for session ${sessionId}. Users may not have connected Microsoft accounts.`);
            }
          }
        } catch (calendarError) {
          console.error("Error creating calendar events:", calendarError);
          // We don't want to fail the session approval if calendar sync fails
        }
        
        // Send email notification regardless of calendar event creation
        try {
          const mentor = await storage.getUser(session.mentorId);
          const mentee = await storage.getUser(session.menteeId);
          
          if (mentor && mentee) {
            await sendSessionNotification(
              mentor.email,
              mentee.email,
              mentor.fullName,
              mentee.fullName,
              session.title || 'Mentorship Session',
              new Date(session.date),
              session.duration
            );
            console.log(`Email notification sent for session ${sessionId}`);
          }
        } catch (emailError) {
          console.error("Error sending email notification:", emailError);
        }
      }
      
      res.status(200).json(updatedSession);
    } catch (error) {
      console.error("Error updating session:", error);
      res.status(500).json({ message: "Error updating session" });
    }
  });

  // Feedback routes
  app.post("/api/feedback", requireAuth, async (req: Request, res: Response) => {
    try {
      const feedbackData = insertFeedbackSchema.parse(req.body);
      
      // Check if the session exists
      const session = await storage.getSession(feedbackData.sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Check if user is part of this session
      const userId = req.user.id;
      if (session.mentorId !== userId && session.menteeId !== userId) {
        return res.status(403).json({ message: "Not authorized to provide feedback for this session" });
      }
      
      // Set the from user id to the current user
      feedbackData.fromUserId = userId;
      
      const feedback = await storage.createFeedback(feedbackData);
      res.status(201).json(feedback);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating feedback" });
    }
  });

  app.get("/api/feedback/session/:sessionId", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = Number(req.params.sessionId);
      
      // Check if the session exists
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ message: "Session not found" });
      }
      
      // Check if user is part of this session or an admin
      const userId = req.user.id;
      const role = req.user.role;
      
      if (
        role !== UserRole.ADMIN && 
        session.mentorId !== userId && 
        session.menteeId !== userId
      ) {
        return res.status(403).json({ message: "Not authorized to view feedback for this session" });
      }
      
      const feedbacks = await storage.getFeedbackBySession(sessionId);
      res.status(200).json(feedbacks);
    } catch (error) {
      res.status(500).json({ message: "Error fetching feedback" });
    }
  });

  // Match routes
  app.post("/api/matches", requireAuth, async (req: Request, res: Response) => {
    try {
      const matchData = insertMatchSchema.parse(req.body);
      
      // Only mentees or new mothers can create match requests
      const role = req.user.role;
      if (role !== UserRole.MENTEE && role !== UserRole.NEW_MOTHER) {
        return res.status(403).json({ message: "Only mentees can request matches" });
      }
      
      // Set mentee ID to current user
      matchData.menteeId = req.user.id;
      
      // Check if mentor exists and is actually a mentor
      const mentor = await storage.getUser(matchData.mentorId);
      if (!mentor || mentor.role !== UserRole.MENTOR) {
        return res.status(404).json({ message: "Mentor not found" });
      }
      
      const match = await storage.createMatch(matchData);
      res.status(201).json(match);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating match request" });
    }
  });

  app.get("/api/matches/pending", requireAuth, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
    try {
      const pendingMatches = await storage.getPendingMatches();
      
      // Enrich with user details and profiles
      const enrichedMatches = await Promise.all(pendingMatches.map(async (match) => {
        const mentor = await storage.getUser(match.mentorId);
        const mentee = await storage.getUser(match.menteeId);
        const mentorProfile = mentor ? await storage.getProfile(mentor.id) : null;
        const menteeProfile = mentee ? await storage.getProfile(mentee.id) : null;
        
        return {
          ...match,
          mentor: mentor ? { 
            id: mentor.id,
            fullName: mentor.fullName,
            username: mentor.username,
            email: mentor.email,
            role: mentor.role,
            profile: mentorProfile || undefined
          } : null,
          mentee: mentee ? {
            id: mentee.id,
            fullName: mentee.fullName,
            username: mentee.username,
            email: mentee.email,
            role: mentee.role,
            profile: menteeProfile || undefined
          } : null
        };
      }));
      
      res.status(200).json(enrichedMatches);
    } catch (error) {
      res.status(500).json({ message: "Error fetching pending matches" });
    }
  });

  app.put("/api/matches/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const matchId = Number(req.params.id);
      const match = await storage.getMatch(matchId);
      
      if (!match) {
        return res.status(404).json({ message: "Match request not found" });
      }
      
      // Allow admins to update any match request
      if (req.user.role === UserRole.ADMIN) {
        // Set the admin ID when approving/rejecting
        req.body.adminId = req.user.id;
        const updatedMatch = await storage.updateMatch(matchId, req.body);
        return res.status(200).json(updatedMatch);
      }
      
      // Allow mentors to update their own match requests
      if (req.user.role === UserRole.MENTOR && match.mentorId === req.user.id) {
        // Allow mentors to approve, reject, or remove connections
        if (req.body.status === "approved" || req.body.status === "rejected" || req.body.status === "cancelled") {
          const updatedMatch = await storage.updateMatch(matchId, req.body);
          return res.status(200).json(updatedMatch);
        }
      }
      
      // Allow mentees to update their own match requests
      if (req.user.role === UserRole.MENTEE && match.menteeId === req.user.id) {
        // Allow mentees to cancel connections
        if (req.body.status === "cancelled") {
          const updatedMatch = await storage.updateMatch(matchId, req.body);
          return res.status(200).json(updatedMatch);
        }
      }
      
      // If none of the conditions are met, deny access
      return res.status(403).json({ message: "You don't have permission to update this match request" });
    } catch (error) {
      console.error("Error updating match:", error);
      res.status(500).json({ message: "Error updating match request" });
    }
  });

  // Get matches by mentee ID
  app.get("/api/matches/mentee/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const menteeId = Number(req.params.id);
      
      // Only allow users to view their own matches or admins to view any
      if (req.user.role !== UserRole.ADMIN && req.user.id !== menteeId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const matches = await storage.getMatchesByMentee(menteeId);
      res.status(200).json(matches);
    } catch (error) {
      res.status(500).json({ message: "Error fetching mentee matches" });
    }
  });
  
  // Get matches by mentor ID
  app.get("/api/matches/mentor/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const mentorId = Number(req.params.id);
      
      // Only allow users to view their own matches or admins to view any
      if (req.user.role !== UserRole.ADMIN && req.user.id !== mentorId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      const matches = await storage.getMatchesByMentor(mentorId);
      res.status(200).json(matches);
    } catch (error) {
      res.status(500).json({ message: "Error fetching mentor matches" });
    }
  });

  // Endpoint to get approved mentees for a mentor (for scheduling sessions)
  app.get("/api/mentors/:id/approved-mentees", requireAuth, async (req: Request, res: Response) => {
    try {
      const mentorId = Number(req.params.id);
      
      // Check if user is authorized to access this data
      if (req.user.role !== UserRole.ADMIN && req.user.id !== mentorId) {
        return res.status(403).json({ message: "Access denied" });
      }
      
      // Check if the mentor is active
      const mentor = await storage.getUser(mentorId);
      if (!mentor || mentor.active === false) {
        return res.status(404).json({ message: "Mentor not found or inactive" });
      }
      
      // Get all matches for this mentor that are approved
      const matches = await storage.getMatchesByMentor(mentorId);
      const approvedMatches = matches.filter(match => match.status === "approved");
      
      // Get mentee details for each approved match
      const mentees = await Promise.all(
        approvedMatches.map(async (match) => {
          const mentee = await storage.getUser(match.menteeId);
          // Only include active mentees
          if (mentee && mentee.active !== false) {
            // Remove sensitive information
            const { password, ...menteeInfo } = mentee;
            return {
              ...menteeInfo,
              matchId: match.id
            };
          }
          return null;
        })
      );
      
      // Filter out null values (mentees that weren't found or are inactive)
      const validMentees = mentees.filter(mentee => mentee !== null);
      
      res.status(200).json(validMentees);
    } catch (error) {
      console.error("Error fetching approved mentees:", error);
      res.status(500).json({ message: "Error fetching approved mentees" });
    }
  });
  
  // Get a mentor's availability
  app.get("/api/mentors/:id/availability", requireAuth, async (req: Request, res: Response) => {
    try {
      const mentorId = parseInt(req.params.id);
      
      // Get the mentor's profile which contains their availability
      const mentorProfile = await storage.getProfile(mentorId);
      
      if (!mentorProfile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }
      
      // Return just the availability information
      res.json({
        availability: mentorProfile.availability || []
      });
    } catch (error) {
      console.error("Error fetching mentor availability:", error);
      res.status(500).json({ message: "Failed to fetch mentor availability" });
    }
  });
  
  // Mentor capacity management endpoints
  app.get("/api/mentors/:id/capacity", requireAuth, async (req: Request, res: Response) => {
    try {
      const mentorId = parseInt(req.params.id);
      
      if (isNaN(mentorId)) {
        return res.status(400).json({ message: "Invalid mentor ID" });
      }
      
      // Get mentor's profile
      const profile = await storage.getProfile(mentorId);
      
      if (!profile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }
      
      // Check if the user is the mentor or an admin
      const isAuthorized = req.user.id === mentorId || req.user.role === UserRole.ADMIN;
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to view capacity details" });
      }
      
      // Count active mentees
      const activeMatches = await storage.getMatchesByMentor(mentorId, "approved");
      const currentMenteeCount = activeMatches.length;
      
      // Update the count if it's different from what's stored
      if (profile.currentMenteeCount !== currentMenteeCount) {
        await storage.updateProfile(mentorId, {
          currentMenteeCount: currentMenteeCount
        });
      }
      
      // Return capacity information
      res.json({
        maxCapacity: profile.maxMenteeCapacity || 5,
        currentCount: currentMenteeCount,
        availableSlots: Math.max(0, (profile.maxMenteeCapacity || 5) - currentMenteeCount),
        acceptingNewMentees: profile.acceptingNewMentees !== false,
      });
      
    } catch (error) {
      console.error("Error fetching mentor capacity:", error);
      res.status(500).json({ message: "Error fetching mentor capacity" });
    }
  });
  
  app.put("/api/mentors/:id/capacity", requireAuth, async (req: Request, res: Response) => {
    try {
      const mentorId = parseInt(req.params.id);
      
      if (isNaN(mentorId)) {
        return res.status(400).json({ message: "Invalid mentor ID" });
      }
      
      // Only allow the mentor themselves or an admin to update capacity
      const isAuthorized = req.user.id === mentorId || req.user.role === UserRole.ADMIN;
      
      if (!isAuthorized) {
        return res.status(403).json({ message: "Unauthorized to update capacity" });
      }
      
      const { maxCapacity, acceptingNewMentees } = req.body;
      
      // Validate input
      if (maxCapacity !== undefined && (typeof maxCapacity !== 'number' || maxCapacity < 1 || maxCapacity > 20)) {
        return res.status(400).json({ message: "Maximum capacity must be between 1 and 20" });
      }
      
      if (acceptingNewMentees !== undefined && typeof acceptingNewMentees !== 'boolean') {
        return res.status(400).json({ message: "acceptingNewMentees must be a boolean" });
      }
      
      // Update profile
      const updateData: any = {};
      if (maxCapacity !== undefined) updateData.maxMenteeCapacity = maxCapacity;
      if (acceptingNewMentees !== undefined) updateData.acceptingNewMentees = acceptingNewMentees;
      
      const updatedProfile = await storage.updateProfile(mentorId, updateData);
      
      if (!updatedProfile) {
        return res.status(404).json({ message: "Mentor profile not found" });
      }
      
      // Fetch active matches to get the current count
      const activeMatches = await storage.getMatchesByMentor(mentorId, "approved");
      const currentMenteeCount = activeMatches.length;
      
      res.json({
        maxCapacity: updatedProfile.maxMenteeCapacity || 5,
        currentCount: currentMenteeCount,
        availableSlots: Math.max(0, (updatedProfile.maxMenteeCapacity || 5) - currentMenteeCount),
        acceptingNewMentees: updatedProfile.acceptingNewMentees !== false,
      });
      
    } catch (error) {
      console.error("Error updating mentor capacity:", error);
      res.status(500).json({ message: "Error updating mentor capacity" });
    }
  });

  // Learning path routes
  app.post("/api/learning-paths", requireAuth, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
    try {
      const pathData = insertLearningPathSchema.parse(req.body);
      const learningPath = await storage.createLearningPath(pathData);
      res.status(201).json(learningPath);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating learning path" });
    }
  });

  app.get("/api/learning-paths", requireAuth, async (req: Request, res: Response) => {
    try {
      const category = req.query.category as string;
      
      let learningPaths;
      if (category) {
        learningPaths = await storage.getLearningPathsByCategory(category);
      } else {
        learningPaths = await storage.getAllLearningPaths();
      }
      
      res.status(200).json(learningPaths);
    } catch (error) {
      res.status(500).json({ message: "Error fetching learning paths" });
    }
  });

  // User learning progress routes
  app.post("/api/learning-progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const progressData = insertUserLearningProgressSchema.parse(req.body);
      
      // Set userId to current user
      progressData.userId = req.user.id;
      
      // Check if learning path exists
      const learningPath = await storage.getLearningPath(progressData.pathId);
      if (!learningPath) {
        return res.status(404).json({ message: "Learning path not found" });
      }
      
      // Check if already enrolled
      const existingProgress = await storage.getUserLearningProgress(req.user.id, progressData.pathId);
      if (existingProgress) {
        return res.status(400).json({ message: "Already enrolled in this learning path" });
      }
      
      const progress = await storage.createUserLearningProgress(progressData);
      res.status(201).json(progress);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error starting learning path" });
    }
  });

  app.get("/api/learning-progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const userProgress = await storage.getAllUserLearningProgress(userId);
      
      // Enrich with learning path details
      const enrichedProgress = await Promise.all(userProgress.map(async (progress) => {
        const learningPath = await storage.getLearningPath(progress.pathId);
        
        return {
          ...progress,
          learningPath: learningPath || null
        };
      }));
      
      res.status(200).json(enrichedProgress);
    } catch (error) {
      res.status(500).json({ message: "Error fetching learning progress" });
    }
  });

  app.put("/api/learning-progress/:pathId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const pathId = Number(req.params.pathId);
      
      // Check if the user is enrolled in this path
      const progress = await storage.getUserLearningProgress(userId, pathId);
      if (!progress) {
        return res.status(404).json({ message: "Learning progress not found" });
      }
      
      const updatedProgress = await storage.updateUserLearningProgress(userId, pathId, req.body);
      res.status(200).json(updatedProgress);
    } catch (error) {
      res.status(500).json({ message: "Error updating learning progress" });
    }
  });

  // Milestone log routes (for new mothers)
  app.post("/api/milestone-logs", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const logData = insertMilestoneLogSchema.parse(req.body);
      
      // Set userId to current user
      logData.userId = req.user.id;
      
      const log = await storage.createMilestoneLog(logData);
      res.status(201).json(log);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating milestone log" });
    }
  });

  app.get("/api/milestone-logs", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const type = req.query.type as string;
      
      let logs;
      if (type) {
        logs = await storage.getMilestoneLogsByType(userId, type);
      } else {
        logs = await storage.getMilestoneLogsByUser(userId);
      }
      
      res.status(200).json(logs);
    } catch (error) {
      res.status(500).json({ message: "Error fetching milestone logs" });
    }
  });

  // Support group routes
  app.post("/api/support-groups", requireAuth, requireRole([UserRole.ADMIN, UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const groupData = insertSupportGroupSchema.parse(req.body);
      const group = await storage.createSupportGroup(groupData);
      res.status(201).json(group);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating support group" });
    }
  });

  app.get("/api/support-groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const groups = await storage.getAllSupportGroups();
      res.status(200).json(groups);
    } catch (error) {
      res.status(500).json({ message: "Error fetching support groups" });
    }
  });

  // Group membership routes
  app.post("/api/group-memberships", requireAuth, async (req: Request, res: Response) => {
    try {
      // Parse the request body but don't validate userId yet
      const { groupId, userId } = req.body;
      
      // Priority: use the user ID from the request if provided, otherwise use the authenticated user's ID
      // This allows the client to specify a user ID if needed (for admin operations)
      const userIdToUse = userId || req.user!.id;
      
      // Validate and create the final data object
      const membershipData = insertGroupMembershipSchema.parse({
        groupId,
        userId: userIdToUse
      });
      
      // Check if group exists
      const group = await storage.getSupportGroup(membershipData.groupId);
      if (!group) {
        return res.status(404).json({ message: "Support group not found" });
      }
      
      const membership = await storage.createGroupMembership(membershipData);
      res.status(201).json(membership);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error joining support group" });
    }
  });

  app.get("/api/user-groups", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const groups = await storage.getUserGroups(userId);
      res.status(200).json(groups);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user's groups" });
    }
  });

  app.get("/api/group-members/:groupId", requireAuth, async (req: Request, res: Response) => {
    try {
      const groupId = Number(req.params.groupId);
      
      // Check if group exists
      const group = await storage.getSupportGroup(groupId);
      if (!group) {
        return res.status(404).json({ message: "Support group not found" });
      }
      
      const members = await storage.getGroupMembers(groupId);
      
      // Filter out inactive members and remove password field
      const sanitizedMembers = members
        .filter(member => member.active !== false)
        .map(member => {
          const { password, ...memberWithoutPassword } = member;
          return memberWithoutPassword;
        });
      
      res.status(200).json(sanitizedMembers);
    } catch (error) {
      res.status(500).json({ message: "Error fetching group members" });
    }
  });

  // Get all mentors - accessible by mentees
  app.get("/api/mentors", requireAuth, async (req: Request, res: Response) => {
    try {
      console.log("Fetching mentors from database...");
      const { supportsNewMothers } = req.query;
      console.log(`Query parameters: supportsNewMothers=${supportsNewMothers}`);
      
      const mentors = await storage.getUsersByRole(UserRole.MENTOR);
      console.log(`Found ${mentors.length} users with role mentor`);
      
      // Filter out inactive mentors
      const activeMentors = mentors.filter(mentor => mentor.active !== false);
      console.log(`Found ${activeMentors.length} active mentors`);
      
      // Get profiles for mentors to include their details
      const mentorsWithProfiles = await Promise.all(
        activeMentors.map(async (mentor) => {
          console.log(`Fetching profile for mentor ID: ${mentor.id}`);
          const profile = await storage.getProfile(mentor.id);
          // Remove password for security
          const { password, ...mentorWithoutPassword } = mentor;
          return {
            ...mentorWithoutPassword,
            profile
          };
        })
      );
      
      // Filter mentors based on supportsNewMothers flag if requested
      let filteredMentors = mentorsWithProfiles;
      if (supportsNewMothers === 'true') {
        console.log("Filtering mentors who support new mothers");
        filteredMentors = mentorsWithProfiles.filter(
          mentor => mentor.profile && mentor.profile.supportsNewMothers === true
        );
        console.log(`Found ${filteredMentors.length} mentors who support new mothers`);
      }
      
      console.log(`Returning ${filteredMentors.length} mentors with profiles`);
      res.status(200).json(filteredMentors);
    } catch (error) {
      console.error("Error in /api/mentors endpoint:", error);
      res.status(500).json({ message: "Error fetching mentors" });
    }
  });

  // Stats for dashboard
  app.get("/api/stats", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      
      // Get relevant data for stats
      const upcomingSessions = await storage.getUpcomingSessions(userId);
      
      let stats = {
        activeMentorships: 0,
        upcomingSessions: upcomingSessions.length,
        learningProgress: 0,
        motherSupport: 0
      };
      
      // Get active mentorships based on role
      let matches = [];
      if (role === UserRole.MENTOR) {
        matches = await storage.getMatchesByMentor(userId);
      } else if (role === UserRole.MENTEE || role === UserRole.NEW_MOTHER) {
        matches = await storage.getMatchesByMentee(userId);
      } else if (role === UserRole.ADMIN) {
        // For admin, count all approved matches
        const pendingMatches = await storage.getPendingMatches();
        matches = pendingMatches.filter(match => match.status === "approved");
      }
      
      stats.activeMentorships = matches.filter(match => match.status === "approved").length;
      
      // Get learning progress avg if any
      const learningProgresses = await storage.getAllUserLearningProgress(userId);
      if (learningProgresses.length > 0) {
        const totalProgress = learningProgresses.reduce((sum, item) => sum + item.progress, 0);
        stats.learningProgress = Math.round(totalProgress / learningProgresses.length);
      }
      
      // Get support groups count for new mothers or all if admin
      if (role === UserRole.NEW_MOTHER) {
        const userGroups = await storage.getUserGroups(userId);
        stats.motherSupport = userGroups.length;
      } else if (role === UserRole.ADMIN) {
        const allGroups = await storage.getAllSupportGroups();
        stats.motherSupport = allGroups.length;
      }
      
      res.status(200).json(stats);
    } catch (error) {
      res.status(500).json({ message: "Error fetching stats" });
    }
  });

  // Microsoft Integration Routes

  // Check if user has connected their Microsoft account
  app.get("/api/microsoft/connection-status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const isConnected = await isUserConnectedToMicrosoft(userId);
      
      res.status(200).json({ connected: isConnected });
    } catch (error) {
      console.error("Error checking Microsoft connection status:", error);
      res.status(500).json({ message: "Error checking Microsoft connection status" });
    }
  });

  // Initialize Microsoft auth flow
  app.get("/api/microsoft/auth", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      
      // The redirect URL should match what's registered in Azure AD
      const redirectUri = `${req.protocol}://${req.get('host')}/api/microsoft/callback`;
      
      // Generate the Microsoft auth URL
      const authUrl = await getMicrosoftAuthUrl(userId, redirectUri);
      
      // Return the auth URL
      res.status(200).json({ authUrl });
    } catch (error) {
      console.error("Error initiating Microsoft auth:", error);
      res.status(500).json({ message: "Error initiating Microsoft authentication" });
    }
  });

  // Handle Microsoft auth callback
  app.get("/api/microsoft/callback", async (req: Request, res: Response) => {
    try {
      const { code, state } = req.query;
      
      if (!code || !state) {
        return res.status(400).json({ message: "Missing required parameters" });
      }
      
      // The redirect URL should match what's registered in Azure AD and what was used in the auth initiation
      const redirectUri = `${req.protocol}://${req.get('host')}/api/microsoft/callback`;
      
      // Handle the callback
      const result = await handleMicrosoftCallback(
        code as string, 
        state as string, 
        redirectUri
      );
      
      // Redirect to a success page with the status
      res.redirect(`/profile?microsoftConnected=true&email=${encodeURIComponent(result.email)}`);
    } catch (error) {
      console.error("Error handling Microsoft callback:", error);
      res.redirect('/profile?microsoftConnected=false&error=true');
    }
  });

  // Get user's calendar events
  app.get("/api/microsoft/calendar", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      
      // Check if start and end dates are provided
      const startDateTime = req.query.start as string;
      const endDateTime = req.query.end as string;
      
      if (!startDateTime || !endDateTime) {
        return res.status(400).json({ message: "Start and end dates are required" });
      }
      
      // Fetch calendar events
      const events = await getUserCalendarEvents(userId, startDateTime, endDateTime);
      res.status(200).json(events);
    } catch (error) {
      console.error("Error fetching calendar events:", error);
      res.status(500).json({ 
        message: "Error fetching calendar events", 
        error: error instanceof Error ? error.message : String(error)
      });
    }
  });

  // Disconnect Microsoft account
  app.post("/api/microsoft/disconnect", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const success = await disconnectMicrosoftAccount(userId);
      
      if (success) {
        res.status(200).json({ message: "Microsoft account disconnected successfully" });
      } else {
        res.status(400).json({ message: "Failed to disconnect Microsoft account" });
      }
    } catch (error) {
      console.error("Error disconnecting Microsoft account:", error);
      res.status(500).json({ message: "Error disconnecting Microsoft account" });
    }
  });

  // Issue reporting endpoints
  app.post("/api/issues", requireAuth, async (req: Request, res: Response) => {
    try {
      const { title, description, message } = req.body;
      
      // Create a new reported issue
      const issue = await storage.createReportedIssue({
        title,
        description,
        userId: req.user.id
      });
      
      // Create the initial message
      if (message) {
        await storage.createIssueMessage({
          issueId: issue.id,
          userId: req.user.id,
          message,
        });
      }
      
      res.status(201).json(issue);
    } catch (error) {
      console.error("Error reporting issue:", error);
      res.status(500).json({ message: "Failed to report issue" });
    }
  });
  
  app.get("/api/issues", requireAuth, async (req: Request, res: Response) => {
    try {
      let issues;
      
      // Admins can see all issues
      if (req.user.role === UserRole.ADMIN) {
        issues = await storage.getAllReportedIssues();
      } else {
        // Regular users can only see their own issues
        issues = await storage.getReportedIssuesByUser(req.user.id);
      }
      
      res.json(issues);
    } catch (error) {
      console.error("Error fetching issues:", error);
      res.status(500).json({ message: "Failed to fetch issues" });
    }
  });
  
  app.get("/api/issues/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const issueId = parseInt(req.params.id);
      const issue = await storage.getReportedIssue(issueId);
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      
      // Check if user is authorized to view this issue
      if (req.user.role !== UserRole.ADMIN && issue.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to view this issue" });
      }
      
      const messages = await storage.getIssueMessages(issueId);
      
      res.json({ issue, messages });
    } catch (error) {
      console.error("Error fetching issue details:", error);
      res.status(500).json({ message: "Failed to fetch issue details" });
    }
  });
  
  app.post("/api/issues/:id/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const issueId = parseInt(req.params.id);
      const { message } = req.body;
      
      const issue = await storage.getReportedIssue(issueId);
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      
      // Check if user is authorized to add message to this issue
      if (req.user.role !== UserRole.ADMIN && issue.userId !== req.user.id) {
        return res.status(403).json({ message: "Not authorized to add messages to this issue" });
      }
      
      const newMessage = await storage.createIssueMessage({
        issueId,
        userId: req.user.id,
        message,
      });
      
      // Update the issue's updatedAt timestamp
      await storage.updateReportedIssue(issueId, {
        updatedAt: new Date(),
      });
      
      res.status(201).json(newMessage);
    } catch (error) {
      console.error("Error adding message to issue:", error);
      res.status(500).json({ message: "Failed to add message to issue" });
    }
  });
  
  app.put("/api/issues/:id", requireAuth, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
    try {
      const issueId = parseInt(req.params.id);
      const { status, assignedToId } = req.body;
      
      const issue = await storage.getReportedIssue(issueId);
      
      if (!issue) {
        return res.status(404).json({ message: "Issue not found" });
      }
      
      const updatedIssue = await storage.updateReportedIssue(issueId, {
        status: status || issue.status,
        assignedToId: assignedToId !== undefined ? assignedToId : issue.assignedToId,
        updatedAt: new Date(),
      });
      
      res.json(updatedIssue);
    } catch (error) {
      console.error("Error updating issue:", error);
      res.status(500).json({ message: "Failed to update issue" });
    }
  });

  // Community Channel - User Connections routes
  app.get("/api/community/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const role = req.user.role;
      
      // Get users with the same role (for community channels)
      const users = await storage.getUsersByRole(role);
      
      // Filter out self, inactive users and format response
      const filteredUsers = users
        .filter(user => user.id !== userId && user.active !== false)
        .map(user => {
          const { password, ...userWithoutPassword } = user;
          return userWithoutPassword;
        });
      
      res.status(200).json(filteredUsers);
    } catch (error) {
      console.error("Error fetching community users:", error);
      res.status(500).json({ message: "Error fetching users" });
    }
  });

  app.post("/api/connections", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertUserConnectionSchema.parse(req.body);
      const userId = req.user.id;
      
      // Verify that the requester is the current user
      if (data.requesterId !== userId) {
        return res.status(403).json({ message: "Not authorized to create this connection" });
      }
      
      // Check if a connection request already exists in either direction
      const existingConnection = await storage.getUserConnectionByUsers(
        data.requesterId, 
        data.receiverId
      );
      
      if (existingConnection) {
        // Allow new connection requests only if the existing connection was rejected
        if (existingConnection.status === "rejected") {
          // Update the existing connection to pending status instead of creating a new one
          const updatedConnection = await storage.updateUserConnection(
            existingConnection.id,
            { status: "pending" }
          );
          
          // Notify the receiver of the connection via WebSocket if online
          const receivers = connectedClients.get(data.receiverId.toString());
          if (receivers && receivers.length > 0) {
            const notification = {
              type: 'connection_request',
              connection: updatedConnection,
              from: req.user
            };
            receivers.forEach(client => client.send(JSON.stringify(notification)));
          }
          
          return res.status(200).json(updatedConnection);
        } else {
          return res.status(400).json({ 
            message: "Connection already exists",
            connection: existingConnection 
          });
        }
      }
      
      const connection = await storage.createUserConnection(data);
      
      // Notify the receiver of the connection via WebSocket if online
      const receivers = connectedClients.get(data.receiverId.toString());
      if (receivers && receivers.length > 0) {
        const notification = {
          type: 'connection_request',
          connection
        };
        
        receivers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
          }
        });
      }
      
      res.status(201).json(connection);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error creating connection:", error);
      res.status(500).json({ message: "Error creating connection" });
    }
  });

  app.put("/api/connections/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const connectionId = Number(req.params.id);
      const userId = req.user.id;
      
      // Check if connection exists
      const connection = await storage.getUserConnection(connectionId);
      if (!connection) {
        return res.status(404).json({ message: "Connection not found" });
      }
      
      // Check if user is allowed to update this connection
      if (
        connection.receiverId !== userId && 
        connection.requesterId !== userId
      ) {
        return res.status(403).json({ message: "Not authorized to update this connection" });
      }
      
      // Update connection
      const updatedConnection = await storage.updateUserConnection(connectionId, req.body);
      
      // Notify the other party about connection update via WebSocket if online
      const otherUserId = userId === connection.requesterId 
        ? connection.receiverId 
        : connection.requesterId;
        
      const receivers = connectedClients.get(otherUserId.toString());
      if (receivers && receivers.length > 0) {
        const notification = {
          type: 'connection_updated',
          connection: updatedConnection
        };
        
        receivers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
          }
        });
      }
      
      res.status(200).json(updatedConnection);
    } catch (error) {
      console.error("Error updating connection:", error);
      res.status(500).json({ message: "Error updating connection" });
    }
  });

  app.get("/api/connections", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const connections = await storage.getUserConnections(userId);
      
      res.status(200).json(connections);
    } catch (error) {
      console.error("Error fetching connections:", error);
      res.status(500).json({ message: "Error fetching connections" });
    }
  });

  app.get("/api/connections/pending", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const pendingConnections = await storage.getPendingReceivedConnections(userId);
      
      res.status(200).json(pendingConnections);
    } catch (error) {
      console.error("Error fetching pending connections:", error);
      res.status(500).json({ message: "Error fetching pending connections" });
    }
  });

  app.get("/api/connections/users", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const connectedUsers = await storage.getConnectedUsers(userId);
      
      // Remove sensitive info
      const sanitizedUsers = connectedUsers.map(user => {
        const { password, ...userWithoutPassword } = user;
        return userWithoutPassword;
      });
      
      res.status(200).json(sanitizedUsers);
    } catch (error) {
      console.error("Error fetching connected users:", error);
      res.status(500).json({ message: "Error fetching connected users" });
    }
  });

  // Direct message routes
  app.post("/api/messages", requireAuth, async (req: Request, res: Response) => {
    try {
      const data = insertDirectMessageSchema.parse(req.body);
      const userId = req.user.id;
      
      // Verify that the sender is the current user
      if (data.senderId !== userId) {
        return res.status(403).json({ message: "Not authorized to send this message" });
      }
      
      // Check if users are connected before allowing messages
      const connection = await storage.getUserConnectionByUsers(
        data.senderId, 
        data.receiverId
      );
      
      if (!connection || connection.status !== ConnectionStatus.ACCEPTED) {
        return res.status(403).json({ message: "You can only message users you are connected with" });
      }
      
      const message = await storage.createDirectMessage(data);
      
      // Send message to recipient via WebSocket if online
      const receivers = connectedClients.get(data.receiverId.toString());
      if (receivers && receivers.length > 0) {
        const notification = {
          type: 'direct_message',
          message
        };
        
        receivers.forEach(client => {
          if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(notification));
          }
        });
      }
      
      res.status(201).json(message);
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      console.error("Error sending message:", error);
      res.status(500).json({ message: "Error sending message" });
    }
  });

  app.get("/api/messages/conversation/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const otherUserId = Number(req.params.userId);
      
      // Check if users are connected
      const connection = await storage.getUserConnectionByUsers(userId, otherUserId);
      if (!connection || connection.status !== ConnectionStatus.ACCEPTED) {
        return res.status(403).json({ message: "You can only view conversations with connected users" });
      }
      
      // Mark messages from the other user as read
      await storage.markMessagesAsRead(userId, otherUserId);
      
      // Get conversation history
      const messages = await storage.getConversation(userId, otherUserId);
      
      res.status(200).json(messages);
    } catch (error) {
      console.error("Error fetching conversation:", error);
      res.status(500).json({ message: "Error fetching conversation" });
    }
  });

  app.get("/api/messages/unread", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const count = await storage.getUnreadMessageCount(userId);
      
      res.status(200).json({ count });
    } catch (error) {
      console.error("Error fetching unread message count:", error);
      res.status(500).json({ message: "Error fetching unread message count" });
    }
  });
  
  app.post("/api/messages/clear/:userId", requireAuth, async (req: Request, res: Response) => {
    try {
      const currentUserId = req.user.id;
      const otherUserId = parseInt(req.params.userId, 10);
      
      if (isNaN(otherUserId)) {
        return res.status(400).json({ message: "Invalid user ID" });
      }
      
      // Clear the conversation between these two users
      const result = await storage.clearConversation(currentUserId, otherUserId);
      
      if (result) {
        // Notify the other user via WebSocket if they're online
        const receivers = connectedClients.get(otherUserId.toString());
        if (receivers && receivers.length > 0) {
          const notification = {
            type: 'conversation_cleared',
            withUserId: currentUserId
          };
          
          receivers.forEach(client => {
            if (client.readyState === WebSocket.OPEN) {
              client.send(JSON.stringify(notification));
            }
          });
        }
        
        res.status(200).json({ success: true, message: "Conversation cleared successfully" });
      } else {
        res.status(500).json({ success: false, message: "Failed to clear conversation" });
      }
    } catch (error) {
      console.error("Error clearing conversation:", error);
      res.status(500).json({ message: "Error clearing conversation" });
    }
  });

  // Proxy Support API endpoints
  app.post("/api/proxy-requests", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const motherId = req.user.id;
      const { proxyEmail, ...requestData } = req.body;

      // Find the proxy user by email
      const proxyUser = await storage.getUserByEmail(proxyEmail);
      if (!proxyUser) {
        return res.status(404).json({ error: "User with the provided email not found" });
      }

      // Create the proxy request
      const proxyRequest = await storage.createProxyRequest({
        motherId,
        proxyId: proxyUser.id,
        ...requestData
      });

      res.status(201).json(proxyRequest);
    } catch (error) {
      console.error("Error creating proxy request:", error);
      res.status(500).json({ error: "Failed to create proxy request" });
    }
  });

  app.get("/api/proxy-requests", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;

      // For new mothers, get requests where they are the mother
      // For other roles, get requests where they are the proxy
      let requests;
      if (userRole === UserRole.NEW_MOTHER) {
        requests = await storage.getProxyRequestsByMotherId(userId);
      } else {
        requests = await storage.getProxyRequestsByProxyId(userId);
      }

      // Enhance with user details
      const enhancedRequests = await Promise.all(requests.map(async (request) => {
        let motherDetails, proxyDetails;

        if (request.motherId) {
          const mother = await storage.getUser(request.motherId);
          if (mother) {
            motherDetails = {
              id: mother.id,
              fullName: mother.fullName,
              email: mother.email
            };
          }
        }

        if (request.proxyId) {
          const proxy = await storage.getUser(request.proxyId);
          if (proxy) {
            proxyDetails = {
              id: proxy.id,
              fullName: proxy.fullName,
              email: proxy.email
            };
          }
        }

        return {
          ...request,
          mother: motherDetails,
          proxy: proxyDetails
        };
      }));

      res.json(enhancedRequests);
    } catch (error) {
      console.error("Error fetching proxy requests:", error);
      res.status(500).json({ error: "Failed to fetch proxy requests" });
    }
  });

  app.put("/api/proxy-requests/:id", requireAuth, async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.id);
      const userId = req.user.id;
      const userRole = req.user.role;
      const { status } = req.body;

      // Get the request to check permissions
      const proxyRequest = await storage.getProxyRequestById(requestId);
      if (!proxyRequest) {
        return res.status(404).json({ error: "Proxy request not found" });
      }

      // Only proxy can accept/reject, only mother can complete
      if ((status === ProxyRequestStatus.ACCEPTED || status === ProxyRequestStatus.REJECTED) 
          && proxyRequest.proxyId !== userId) {
        return res.status(403).json({ error: "Only the proxy can accept or reject a request" });
      }

      if (status === ProxyRequestStatus.COMPLETED && proxyRequest.motherId !== userId) {
        return res.status(403).json({ error: "Only the mother can mark a request as completed" });
      }

      // Update the request
      const updatedRequest = await storage.updateProxyRequest(requestId, { status });
      res.json(updatedRequest);
    } catch (error) {
      console.error("Error updating proxy request:", error);
      res.status(500).json({ error: "Failed to update proxy request" });
    }
  });

  app.get("/api/proxy-logs/:requestId", requireAuth, async (req: Request, res: Response) => {
    try {
      const requestId = parseInt(req.params.requestId);
      const userId = req.user.id;

      // Get the request to check permissions
      const proxyRequest = await storage.getProxyRequestById(requestId);
      if (!proxyRequest) {
        return res.status(404).json({ error: "Proxy request not found" });
      }

      // Only users involved in the request can view logs
      if (proxyRequest.motherId !== userId && proxyRequest.proxyId !== userId && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "You don't have permission to view these logs" });
      }

      const logs = await storage.getProxyLogsByRequestId(requestId);
      
      // Enhance logs with creator details
      const enhancedLogs = await Promise.all(logs.map(async (log) => {
        const creator = await storage.getUser(log.createdById);
        return {
          ...log,
          createdBy: creator ? {
            id: creator.id,
            fullName: creator.fullName
          } : undefined
        };
      }));

      res.json(enhancedLogs);
    } catch (error) {
      console.error("Error fetching proxy logs:", error);
      res.status(500).json({ error: "Failed to fetch proxy logs" });
    }
  });

  app.post("/api/proxy-logs", requireAuth, async (req: Request, res: Response) => {
    try {
      const { requestId, title, content, category, priority } = req.body;
      const createdById = req.user.id;

      // Get the request to check permissions
      const proxyRequest = await storage.getProxyRequestById(requestId);
      if (!proxyRequest) {
        return res.status(404).json({ error: "Proxy request not found" });
      }

      // Only users involved in the request can add logs
      if (proxyRequest.motherId !== createdById && proxyRequest.proxyId !== createdById && req.user.role !== UserRole.ADMIN) {
        return res.status(403).json({ error: "You don't have permission to add logs to this request" });
      }

      // Only accepted requests can have logs
      if (proxyRequest.status !== ProxyRequestStatus.ACCEPTED) {
        return res.status(400).json({ error: "Cannot add logs to a request that is not accepted" });
      }

      const log = await storage.createProxyLog({
        requestId,
        createdById,
        title,
        content,
        category,
        priority
      });

      res.status(201).json(log);
    } catch (error) {
      console.error("Error creating proxy log:", error);
      res.status(500).json({ error: "Failed to create proxy log" });
    }
  });

  // Resources API endpoints
  app.get("/api/resources", requireAuth, async (req: Request, res: Response) => {
    try {
      const { category, type } = req.query;
      const resources = await storage.getResources({ 
        category: category as string, 
        type: type as string,
        isPublished: true 
      });
      res.json(resources);
    } catch (error) {
      console.error("Error fetching resources:", error);
      res.status(500).json({ error: "Failed to fetch resources" });
    }
  });

  app.post("/api/resources", requireAuth, requireRole([UserRole.ADMIN]), async (req: Request, res: Response) => {
    try {
      const uploadedById = req.user.id;
      const resourceData = { ...req.body, uploadedById };
      const resource = await storage.createResource(resourceData);
      res.status(201).json(resource);
    } catch (error) {
      console.error("Error creating resource:", error);
      res.status(500).json({ error: "Failed to create resource" });
    }
  });

  app.get("/api/resources/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const resourceId = parseInt(req.params.id);
      const comments = await storage.getResourceCommentsByResourceId(resourceId);
      
      // Enhance with user details
      const enhancedComments = await Promise.all(comments.map(async (comment) => {
        const user = await storage.getUser(comment.userId);
        return {
          ...comment,
          user: user ? {
            id: user.id,
            fullName: user.fullName
          } : undefined
        };
      }));
      
      res.json(enhancedComments);
    } catch (error) {
      console.error("Error fetching resource comments:", error);
      res.status(500).json({ error: "Failed to fetch resource comments" });
    }
  });

  app.post("/api/resources/:id/comments", requireAuth, async (req: Request, res: Response) => {
    try {
      const resourceId = parseInt(req.params.id);
      const userId = req.user.id;
      const { content } = req.body;
      
      const comment = await storage.createResourceComment({
        resourceId,
        userId,
        content
      });
      
      res.status(201).json(comment);
    } catch (error) {
      console.error("Error creating resource comment:", error);
      res.status(500).json({ error: "Failed to create resource comment" });
    }
  });

  // Mental Health Chat API
  app.post("/api/mental-health/chat", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { message } = req.body;
      
      // Save the user's message
      await storage.createMentalHealthChat({
        userId,
        message,
        isFromUser: true
      });
      
      // Call OpenAI API to get the AI response
      // For this to work, we'll need OPENAI_API_KEY in environment variables
      if (!process.env.OPENAI_API_KEY) {
        return res.status(503).json({ error: "Mental health chat service is unavailable" });
      }
      
      // Initialize OpenAI client
      const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
      });
      
      // Get the chat history for context
      const chatHistory = await storage.getMentalHealthChatHistory(userId, 10);
      
      // Format messages for OpenAI API
      const messages = chatHistory.map(chat => ({
        role: chat.isFromUser ? 'user' : 'assistant',
        content: chat.message
      }));
      
      // Add system message at the beginning
      messages.unshift({
        role: 'system',
        content: `You are a friendly and supportive mental health assistant for working mothers. Keep your responses brief and conversational, like a caring friend rather than a textbook.

Guidelines for your responses:
1. Be warm, empathetic and authentic in your tone
2. Keep responses short (2-3 sentences) unless specific details are requested
3. Use casual, everyday language instead of clinical terms
4. Offer practical, realistic suggestions when appropriate
5. Ask thoughtful follow-up questions to keep the conversation going

Your primary goals are to:
- Normalize the challenges of balancing work and motherhood
- Provide a judgment-free space for expressing feelings
- Suggest simple coping strategies when relevant
- Help mothers recognize their strengths and capabilities

Never diagnose conditions or provide medical advice. Focus on being a supportive conversation partner who listens well and responds with empathy and warmth.`
      });
      
      // Add the current message if not already included
      if (!messages.some(msg => msg.role === 'user' && msg.content === message)) {
        messages.push({
          role: 'user',
          content: message
        });
      }
      
      // Call OpenAI API
      // the newest OpenAI model is "gpt-4o" which was released May 13, 2024. do not change this unless explicitly requested by the user
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        max_tokens: 250, // Limiting token length to encourage briefer responses
        messages
      });
      
      const aiResponse = response.choices[0].message.content;
      
      // Analyze sentiment (simplified)
      let sentiment = "neutral";
      if (aiResponse.toLowerCase().includes("sorry") || 
          aiResponse.toLowerCase().includes("difficult") || 
          aiResponse.toLowerCase().includes("challenging")) {
        sentiment = "negative";
      } else if (aiResponse.toLowerCase().includes("great") || 
                aiResponse.toLowerCase().includes("wonderful") || 
                aiResponse.toLowerCase().includes("happy")) {
        sentiment = "positive";
      }
      
      // Save the AI response
      const savedResponse = await storage.createMentalHealthChat({
        userId,
        message: aiResponse,
        isFromUser: false,
        sentiment
      });
      
      res.json({
        message: aiResponse,
        messageId: savedResponse.id,
        sentiment
      });
    } catch (error) {
      console.error("Error in mental health chat:", error);
      res.status(500).json({ error: "Failed to process mental health chat" });
    }
  });

  app.get("/api/mental-health/chat-history", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
      
      const chatHistory = await storage.getMentalHealthChatHistory(userId, limit);
      res.json(chatHistory);
    } catch (error) {
      console.error("Error fetching mental health chat history:", error);
      res.status(500).json({ error: "Failed to fetch mental health chat history" });
    }
  });
  
  app.post("/api/mental-health/clear-chat", requireAuth, requireRole([UserRole.NEW_MOTHER]), async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      
      const success = await storage.clearMentalHealthChatHistory(userId);
      if (success) {
        res.json({ success: true, message: "Chat history cleared successfully" });
      } else {
        res.status(500).json({ success: false, error: "Failed to clear chat history" });
      }
    } catch (error) {
      console.error("Error clearing mental health chat history:", error);
      res.status(500).json({ error: "Failed to clear mental health chat history" });
    }
  });

  // Session Notes API
  app.get("/api/session/:sessionId/notes", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      // Get session to check permissions
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if user is part of this session
      if (req.user && (session.mentorId === req.user.id || session.menteeId === req.user.id)) {
        const notes = await storage.getSessionNotesBySession(sessionId);
        return res.json(notes);
      } else {
        return res.status(403).json({ error: "Not authorized to view these notes" });
      }
    } catch (error) {
      console.error("Error fetching session notes:", error);
      res.status(500).json({ error: "Failed to fetch session notes" });
    }
  });

  app.post("/api/session/notes", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = insertSessionNoteSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid session note data", 
          details: validationResult.error.issues 
        });
      }

      const noteData = validationResult.data;
      
      // Get session to check permissions
      const session = await storage.getSession(noteData.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if user is part of this session
      if (req.user && (session.mentorId === req.user.id || session.menteeId === req.user.id)) {
        const note = await storage.createSessionNote(noteData);
        return res.status(201).json(note);
      } else {
        return res.status(403).json({ error: "Not authorized to add notes to this session" });
      }
    } catch (error) {
      console.error("Error creating session note:", error);
      res.status(500).json({ error: "Failed to create session note" });
    }
  });

  app.put("/api/session/notes/:noteId", requireAuth, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      // Get the note to check ownership
      const note = await storage.getSessionNote(noteId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Get session to check permissions
      const session = await storage.getSession(note.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Only the note creator can update it
      if (req.user && note.createdById === req.user.id) {
        const updatedNote = await storage.updateSessionNote(noteId, req.body);
        return res.json(updatedNote);
      } else {
        return res.status(403).json({ error: "Not authorized to update this note" });
      }
    } catch (error) {
      console.error("Error updating session note:", error);
      res.status(500).json({ error: "Failed to update session note" });
    }
  });

  app.delete("/api/session/notes/:noteId", requireAuth, async (req: Request, res: Response) => {
    try {
      const noteId = parseInt(req.params.noteId);
      if (isNaN(noteId)) {
        return res.status(400).json({ error: "Invalid note ID" });
      }

      // Get the note to check ownership
      const note = await storage.getSessionNote(noteId);
      if (!note) {
        return res.status(404).json({ error: "Note not found" });
      }

      // Get session to check permissions
      const session = await storage.getSession(note.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Only the note creator can delete it
      if (req.user && note.createdById === req.user.id) {
        const success = await storage.deleteSessionNote(noteId);
        if (success) {
          return res.json({ success: true });
        } else {
          return res.status(500).json({ error: "Failed to delete note" });
        }
      } else {
        return res.status(403).json({ error: "Not authorized to delete this note" });
      }
    } catch (error) {
      console.error("Error deleting session note:", error);
      res.status(500).json({ error: "Failed to delete session note" });
    }
  });

  // Action Items API
  app.get("/api/session/:sessionId/action-items", requireAuth, async (req: Request, res: Response) => {
    try {
      const sessionId = parseInt(req.params.sessionId);
      if (isNaN(sessionId)) {
        return res.status(400).json({ error: "Invalid session ID" });
      }

      // Get session to check permissions
      const session = await storage.getSession(sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if user is part of this session
      if (req.user && (session.mentorId === req.user.id || session.menteeId === req.user.id)) {
        const actionItems = await storage.getActionItemsBySession(sessionId);
        return res.json(actionItems);
      } else {
        return res.status(403).json({ error: "Not authorized to view these action items" });
      }
    } catch (error) {
      console.error("Error fetching action items:", error);
      res.status(500).json({ error: "Failed to fetch action items" });
    }
  });

  app.get("/api/action-items/assigned", requireAuth, async (req: Request, res: Response) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Authentication required" });
      }

      const actionItems = await storage.getActionItemsByAssignee(req.user.id);
      return res.json(actionItems);
    } catch (error) {
      console.error("Error fetching assigned action items:", error);
      res.status(500).json({ error: "Failed to fetch assigned action items" });
    }
  });

  app.post("/api/session/action-items", requireAuth, async (req: Request, res: Response) => {
    try {
      // Validate request body
      const validationResult = insertActionItemSchema.safeParse(req.body);
      if (!validationResult.success) {
        return res.status(400).json({ 
          error: "Invalid action item data", 
          details: validationResult.error.issues 
        });
      }

      const itemData = validationResult.data;
      
      // Get session to check permissions
      const session = await storage.getSession(itemData.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if user is part of this session
      if (req.user && (session.mentorId === req.user.id || session.menteeId === req.user.id)) {
        const actionItem = await storage.createActionItem(itemData);
        return res.status(201).json(actionItem);
      } else {
        return res.status(403).json({ error: "Not authorized to add action items to this session" });
      }
    } catch (error) {
      console.error("Error creating action item:", error);
      res.status(500).json({ error: "Failed to create action item" });
    }
  });

  app.put("/api/action-items/:itemId", requireAuth, async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid action item ID" });
      }

      // Get the action item to check permissions
      const actionItem = await storage.getActionItem(itemId);
      if (!actionItem) {
        return res.status(404).json({ error: "Action item not found" });
      }

      // Get session to check permissions
      const session = await storage.getSession(actionItem.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Check if user is part of this session or is the assignee
      if (req.user && (
          session.mentorId === req.user.id || 
          session.menteeId === req.user.id ||
          actionItem.assignedToId === req.user.id ||
          actionItem.createdById === req.user.id
        )) {
        const updatedItem = await storage.updateActionItem(itemId, req.body);
        return res.json(updatedItem);
      } else {
        return res.status(403).json({ error: "Not authorized to update this action item" });
      }
    } catch (error) {
      console.error("Error updating action item:", error);
      res.status(500).json({ error: "Failed to update action item" });
    }
  });

  app.delete("/api/action-items/:itemId", requireAuth, async (req: Request, res: Response) => {
    try {
      const itemId = parseInt(req.params.itemId);
      if (isNaN(itemId)) {
        return res.status(400).json({ error: "Invalid action item ID" });
      }

      // Get the action item to check permissions
      const actionItem = await storage.getActionItem(itemId);
      if (!actionItem) {
        return res.status(404).json({ error: "Action item not found" });
      }

      // Get session to check permissions
      const session = await storage.getSession(actionItem.sessionId);
      if (!session) {
        return res.status(404).json({ error: "Session not found" });
      }

      // Only creator or session participants can delete action items
      if (req.user && (
          actionItem.createdById === req.user.id ||
          session.mentorId === req.user.id || 
          session.menteeId === req.user.id
        )) {
        const success = await storage.deleteActionItem(itemId);
        if (success) {
          return res.json({ success: true });
        } else {
          return res.status(500).json({ error: "Failed to delete action item" });
        }
      } else {
        return res.status(403).json({ error: "Not authorized to delete this action item" });
      }
    } catch (error) {
      console.error("Error deleting action item:", error);
      res.status(500).json({ error: "Failed to delete action item" });
    }
  });

  // Setup WebSocket server for real-time messaging
  const httpServer = createServer(app);
  
  // Map to store connected clients by user ID
  const connectedClients = new Map<number, WebSocket[]>();
  
  // Create WebSocket server
  const wss = new WebSocketServer({ 
    server: httpServer, 
    path: '/ws' 
  });
  
  // WebSocket connection handler
  wss.on('connection', (ws) => {
    console.log('WebSocket client connected');
    let userId: number | null = null;
    
    // Handle WebSocket authentication and messages
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);
        
        // Handle authentication message
        if (data.type === 'auth') {
          // Convert userId to number
          userId = parseInt(data.userId);
          
          // Register this connection for the user
          if (userId && !isNaN(userId)) {
            if (!connectedClients.has(userId)) {
              connectedClients.set(userId, []);
            }
            
            // Remove any stale connections for this user
            const existingConnections = connectedClients.get(userId) || [];
            const activeConnections = existingConnections.filter(
              conn => conn.readyState === WebSocket.OPEN
            );
            
            // Add this new connection
            activeConnections.push(ws);
            connectedClients.set(userId, activeConnections);
            
            console.log(`User ${userId} authenticated on WebSocket. Active connections: ${activeConnections.length}`);
            
            // Send confirmation to client
            ws.send(JSON.stringify({ 
              type: 'auth_success', 
              userId 
            }));
          } else {
            console.error('Invalid userId received:', data.userId);
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Invalid user ID'
            }));
          }
        }
        // Handle sending a direct message
        else if (data.type === 'direct_message' && userId) {
          if (!data.message?.receiverId || !data.message?.content) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Missing required fields for direct message'
            }));
            return;
          }
          
          const senderId = parseInt(userId);
          const receiverId = parseInt(data.message.receiverId);
          
          console.log(`Processing direct message from ${senderId} to ${receiverId}`);
          
          let allowMessage = false;
          
          // Check if users have a connection
          const connection = await storage.getUserConnectionByUsers(senderId, receiverId);
          if (connection && connection.status === ConnectionStatus.ACCEPTED) {
            allowMessage = true;
          }
          
          // If not, check if they have a mentor-mentee relationship
          if (!allowMessage) {
            const sender = await storage.getUser(senderId);
            const receiver = await storage.getUser(receiverId);
            
            if (sender && receiver) {
              // Check if a mentor-mentee match exists (in either direction)
              if (sender.role === UserRole.MENTOR) {
                const mentorMatches = await storage.getMatchesByMentor(senderId);
                const matchWithReceiver = mentorMatches.find(match => 
                  match.menteeId === receiverId && match.status === "approved"
                );
                allowMessage = !!matchWithReceiver;
              } else if (receiver.role === UserRole.MENTOR) {
                const menteeMatches = await storage.getMatchesByMentee(senderId);
                const matchWithReceiver = menteeMatches.find(match => 
                  match.mentorId === receiverId && match.status === "approved"
                );
                allowMessage = !!matchWithReceiver;
              }
            }
          }
          
          // Either connection or mentor-mentee relationship must exist
          if (!allowMessage) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'No active connection or mentorship relationship with this user'
            }));
            return;
          }
          
          // Create the message in the database
          const messageData = {
            senderId,
            receiverId,
            message: data.message.content,
            read: false
          };
          
          const savedMessage = await storage.createDirectMessage(messageData);
          
          // Format message for sending
          const outgoingMessage = {
            id: savedMessage.id,
            senderId: savedMessage.senderId,
            receiverId: savedMessage.receiverId,
            content: savedMessage.message,
            createdAt: savedMessage.createdAt,
            read: savedMessage.read
          };
          
          console.log(`Sending message confirmation to sender ${senderId}`);
          
          // Send the message to the sender (confirmation)
          ws.send(JSON.stringify({
            type: 'message_sent',
            message: outgoingMessage
          }));
          
          // Get sender details for recipient notification
          const sender = await storage.getUser(senderId);
          const senderDetails = sender ? {
            id: sender.id,
            username: sender.username,
            fullName: sender.fullName
          } : null;
          
          // Send the message to all receiver's connections
          const receiverConnections = connectedClients.get(receiverId) || [];
          const activeReceiverConnections = receiverConnections.filter(
            conn => conn.readyState === WebSocket.OPEN
          );
          
          console.log(`Attempting to send message to ${receiverId}. Found ${activeReceiverConnections.length} active connections.`);
          
          if (activeReceiverConnections.length > 0) {
            // Update connectedClients with only active connections
            connectedClients.set(receiverId, activeReceiverConnections);
            
            // Send message to all active connections of the receiver
            for (const conn of activeReceiverConnections) {
              try {
                console.log(`Sending message to recipient connection...`);
                conn.send(JSON.stringify({
                  type: 'new_message',
                  message: outgoingMessage,
                  sender: senderDetails
                }));
              } catch (err) {
                console.error(`Error sending message to receiver connection:`, err);
              }
            }
            console.log(`Message delivered to ${activeReceiverConnections.length} connections of user ${receiverId}`);
          } else {
            console.log(`No active connections found for user ${receiverId}. Message stored in database only.`);
          }
        }
        // Handle marking messages as read
        else if (data.type === 'mark_read' && userId) {
          if (!data.senderId) {
            ws.send(JSON.stringify({
              type: 'error',
              message: 'Missing sender ID'
            }));
            return;
          }
          
          const senderId = parseInt(data.senderId);
          const receiverId = parseInt(userId);
          
          // Mark messages as read
          await storage.markMessagesAsRead(senderId, receiverId);
          
          ws.send(JSON.stringify({
            type: 'messages_marked_read',
            senderId: data.senderId
          }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
        ws.send(JSON.stringify({
          type: 'error',
          message: 'Invalid message format'
        }));
      }
    });
    
    // Handle client disconnection
    ws.on('close', () => {
      if (userId) {
        // Remove this connection from the user's connections
        const userConnections = connectedClients.get(userId);
        if (userConnections) {
          // Filter out this connection and any other closed connections
          const activeConnections = userConnections.filter(
            conn => conn !== ws && conn.readyState === WebSocket.OPEN
          );
          
          // Update the connections map
          if (activeConnections.length > 0) {
            connectedClients.set(userId, activeConnections);
            console.log(`WebSocket client disconnected: User ${userId} still has ${activeConnections.length} active connections.`);
          } else {
            // If no more connections for this user, remove the user entry
            connectedClients.delete(userId);
            console.log(`WebSocket client disconnected: User ${userId} has no more active connections.`);
          }
        }
      } else {
        console.log('WebSocket client disconnected (not authenticated)');
      }
    });
  });
  
  return httpServer;
}
