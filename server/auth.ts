import { Express, Response, NextFunction } from "express";
import { Request as ExpressRequest } from "express-serve-static-core";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User, InsertUser, insertUserSchema, OnboardingStatus, type OnboardingStatusType, profiles } from "@shared/schema";
import { type InferSelectModel } from "drizzle-orm";
import { ZodError } from "zod";
import { fromZodError } from "zod-validation-error";
import { upload } from "./upload";
import path from "path";
import fs from "fs";

// Define Profile type from schema
export type Profile = InferSelectModel<typeof profiles>;

// Extend Express Request to include the user property
interface Request extends ExpressRequest {
  user?: User;
}

declare global {
  namespace Express {
    // Define the User interface for Express
    interface User {
      id: number;
      username: string;
      email: string;
      fullName: string;
      role: string;
      createdAt: Date;
    }
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

// JWT Token handling
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "your_jwt_secret_key";
const TOKEN_EXPIRY = "24h";

function generateToken(user: User): string {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role
  };
  
  return jwt.sign(payload, JWT_SECRET, { expiresIn: TOKEN_EXPIRY });
}

function verifyToken(token: string): any {
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch (error) {
    return null;
  }
}

// Authentication middleware
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: "Authentication required" });
  }
  
  const token = authHeader.split(' ')[1];
  const decoded = verifyToken(token);
  
  if (!decoded) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
  
  // Check if the user has been deactivated since logging in
  storage.getUser(decoded.id).then(user => {
    if (!user || user.active === false) {
      return res.status(401).json({ message: "This account has been deactivated" });
    }
    
    req.user = decoded;
    next();
  }).catch(error => {
    console.error("Error checking user status:", error);
    res.status(500).json({ message: "Internal server error" });
  });
}

export function requireRole(roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ message: "Authentication required" });
    }
    
    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ message: "Access denied" });
    }
    
    next();
  };
}

export function setupAuth(app: Express) {
  // Register endpoint
  app.post("/api/register", async (req: Request, res: Response) => {
    try {
      const userData = insertUserSchema.parse(req.body);
      
      // Check if user already exists with active status
      const existingUser = await storage.getUserByUsername(userData.username);
      if (existingUser && existingUser.active !== false) {
        return res.status(400).json({ message: "Username already exists" });
      }
      
      // Check for existing email but allow reuse if the user is inactive
      const existingEmail = await storage.getUserByEmail(userData.email, true); // Include inactive users in search
      
      if (existingEmail) {
        if (existingEmail.active !== false) {
          // Active user with this email exists
          return res.status(400).json({ message: "Email already in use" });
        } else {
          // Inactive user with this email exists - deactivate it completely to allow reuse
          // This is necessary because emails must be unique in the database
          await storage.updateUser(existingEmail.id, { 
            email: `deactivated_${Date.now()}_${existingEmail.email}`,
            active: false
          });
        }
      }
      
      // Hash password and create user
      const hashedPassword = await hashPassword(userData.password);
      
      // If security question and answer are provided, save them
      const securityQuestion = userData.securityQuestion || null;
      const securityAnswer = userData.securityAnswer ? 
        await hashPassword(userData.securityAnswer) : null;
      
      const user = await storage.createUser({
        ...userData,
        password: hashedPassword,
        securityQuestion,
        securityAnswer,
      });
      
      // Create empty profile for the user with onboarding status set to NOT_STARTED
      await storage.createProfile({
        userId: user.id,
        department: "",
        position: "",
        bio: "",
        skills: [],
        interests: [],
        goals: "",
        availability: [],
        onboardingStatus: OnboardingStatus.NOT_STARTED,
        onboardingStep: 0
      });
      
      // Generate token
      const token = generateToken(user);
      
      // Return user data without password
      const { password, securityAnswer: _, ...userWithoutPassword } = user;
      
      console.log("Registration successful. Token generated:", token.substring(0, 20) + "...");
      
      res.status(201).json({
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      if (error instanceof ZodError) {
        const validationError = fromZodError(error);
        return res.status(400).json({ message: validationError.message });
      }
      res.status(500).json({ message: "Error creating user" });
    }
  });
  
  // Login endpoint - supports both username and email
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { username, password } = req.body;
      
      if (!username || !password) {
        return res.status(400).json({ message: "Username/Email and password are required" });
      }
      
      // Try to get user by username first, then by email if not found
      let user = null;
      
      // Check if input contains @ symbol, treat as email
      if (username.includes('@')) {
        user = await storage.getUserByEmail(username);
      } else {
        // Otherwise treat as username
        user = await storage.getUserByUsername(username);
      }
      
      // If user not found by either method
      if (!user) {
        return res.status(401).json({ message: "Invalid username/email or password" });
      }
      
      // Check if the user has been deactivated
      if (user.active === false) {
        return res.status(401).json({ message: "This account has been deactivated" });
      }
      
      // Compare passwords
      const passwordMatch = await comparePasswords(password, user.password);
      if (!passwordMatch) {
        return res.status(401).json({ message: "Invalid username/email or password" });
      }
      
      // Generate token
      const token = generateToken(user);
      
      // Return user data without password
      const { password: _, ...userWithoutPassword } = user;
      
      console.log("Login successful. Token generated:", token.substring(0, 20) + "...");
      
      res.status(200).json({
        user: userWithoutPassword,
        token
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });
  
  // Get current user endpoint
  app.get("/api/user", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Return user data without password
      const { password, ...userWithoutPassword } = user;
      
      res.status(200).json(userWithoutPassword);
    } catch (error) {
      res.status(500).json({ message: "Error fetching user data" });
    }
  });
  
  // User profile endpoint
  app.get("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      res.status(200).json(profile);
    } catch (error) {
      res.status(500).json({ message: "Error fetching profile data" });
    }
  });
  
  // Update profile endpoint
  app.put("/api/profile", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      const updatedProfile = await storage.updateProfile(userId, req.body);
      res.status(200).json(updatedProfile);
    } catch (error) {
      res.status(500).json({ message: "Error updating profile" });
    }
  });
  
  // Upload profile picture endpoint
  app.post("/api/profile/picture", requireAuth, upload.single('profilePicture'), async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }
      
      const userId = req.user.id;
      let profile = await storage.getProfile(userId);
      
      if (!profile) {
        return res.status(404).json({ message: "Profile not found" });
      }
      
      // Store the file path in the database (we don't have a profilePicture field,
      // so we'll use a custom field in the JSON response)
      const filePath = req.file.path;
      const fileUrl = `/uploads/profile-pictures/${path.basename(filePath)}`;
      
      // Return updated profile with URL path for the image
      const profileWithImageUrl = {
        ...profile,
        profilePictureUrl: fileUrl
      };
      
      res.status(200).json(profileWithImageUrl);
    } catch (error) {
      console.error("Error uploading profile picture:", error);
      res.status(500).json({ message: "Error uploading profile picture" });
    }
  });
  
  // Check security question endpoint
  app.post("/api/check-security-question", async (req: Request, res: Response) => {
    try {
      const { email } = req.body;
      
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if user has a security question
      if (!user.securityQuestion) {
        return res.status(404).json({ message: "No security question found for this user" });
      }
      
      // Return the security question
      res.status(200).json({ 
        securityQuestion: user.securityQuestion 
      });
    } catch (error) {
      console.error("Error checking security question:", error);
      res.status(500).json({ message: "Error checking security question" });
    }
  });
  
  // Verify security answer and get username endpoint
  app.post("/api/verify-security-answer", async (req: Request, res: Response) => {
    try {
      const { email, securityAnswer } = req.body;
      
      if (!email || !securityAnswer) {
        return res.status(400).json({ message: "Email and security answer are required" });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if security answer is correct
      if (!user.securityAnswer) {
        return res.status(404).json({ message: "No security answer found for this user" });
      }
      
      const isAnswerCorrect = await comparePasswords(securityAnswer, user.securityAnswer);
      
      if (!isAnswerCorrect) {
        return res.status(401).json({ message: "Incorrect security answer" });
      }
      
      // If answer is correct, return the username
      res.status(200).json({ 
        username: user.username,
        message: "Security answer verified successfully" 
      });
    } catch (error) {
      console.error("Error verifying security answer:", error);
      res.status(500).json({ message: "Error verifying security answer" });
    }
  });
  
  // Reset password endpoint
  app.post("/api/reset-password", async (req: Request, res: Response) => {
    try {
      const { email, securityAnswer, newPassword } = req.body;
      
      if (!email || !securityAnswer || !newPassword) {
        return res.status(400).json({ 
          message: "Email, security answer, and new password are required" 
        });
      }
      
      // Find user by email
      const user = await storage.getUserByEmail(email);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Check if security answer is correct
      if (!user.securityAnswer) {
        return res.status(404).json({ message: "No security answer found for this user" });
      }
      
      const isAnswerCorrect = await comparePasswords(securityAnswer, user.securityAnswer);
      
      if (!isAnswerCorrect) {
        return res.status(401).json({ message: "Incorrect security answer" });
      }
      
      // Hash the new password
      const hashedPassword = await hashPassword(newPassword);
      
      // Update the user's password
      await storage.updateUser(user.id, { password: hashedPassword });
      
      res.status(200).json({ message: "Password reset successfully" });
    } catch (error) {
      console.error("Error resetting password:", error);
      res.status(500).json({ message: "Error resetting password" });
    }
  });
  
  // Onboarding routes
  app.get("/api/onboarding/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        return res.status(200).json({ 
          status: OnboardingStatus.NOT_STARTED, 
          step: 0,
          isComplete: false
        });
      }
      
      // Handle case where onboardingStatus might be null or undefined
      const status = profile.onboardingStatus || OnboardingStatus.NOT_STARTED;
      const step = profile.onboardingStep || 0;
      const isComplete = status === OnboardingStatus.COMPLETED;
      
      res.status(200).json({
        status,
        step,
        isComplete,
        completedAt: isComplete ? profile.onboardingCompletedAt : null
      });
    } catch (error) {
      console.error("Error fetching onboarding status:", error);
      res.status(500).json({ message: "Error fetching onboarding status" });
    }
  });
  
  app.post("/api/onboarding/start", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const profile = await storage.getProfile(userId);
      
      if (!profile) {
        // Create a profile with onboarding status in progress
        const newProfile = await storage.createProfile({
          userId,
          onboardingStatus: OnboardingStatus.IN_PROGRESS,
          onboardingStep: 1
        });
        
        if (!newProfile) {
          return res.status(500).json({ message: "Failed to create profile" });
        }
        
        return res.status(200).json({
          status: OnboardingStatus.IN_PROGRESS,
          step: 1,
          isComplete: false
        });
      }
      
      // Handle case where onboardingStatus might be null or undefined
      const currentStatus = profile.onboardingStatus || OnboardingStatus.NOT_STARTED;
      const currentStep = profile.onboardingStep || 0;
      
      // If onboarding was not started or was in progress, update it
      if (currentStatus !== OnboardingStatus.COMPLETED) {
        const updatedProfile = await storage.updateProfile(userId, {
          onboardingStatus: OnboardingStatus.IN_PROGRESS,
          onboardingStep: Math.max(currentStep, 1) // Resume from last step or start at 1
        });
        
        if (!updatedProfile) {
          // If update fails, still return the existing profile data
          return res.status(200).json({
            status: OnboardingStatus.IN_PROGRESS,
            step: Math.max(currentStep, 1),
            isComplete: false
          });
        }
        
        return res.status(200).json({
          status: OnboardingStatus.IN_PROGRESS,
          step: updatedProfile.onboardingStep || Math.max(currentStep, 1),
          isComplete: false
        });
      }
      
      // If onboarding was already completed, return the current status
      res.status(200).json({
        status: OnboardingStatus.COMPLETED,
        step: currentStep,
        isComplete: true,
        completedAt: profile.onboardingCompletedAt
      });
    } catch (error) {
      console.error("Error starting onboarding:", error);
      res.status(500).json({ message: "Error starting onboarding" });
    }
  });
  
  app.post("/api/onboarding/progress", requireAuth, async (req: Request, res: Response) => {
    try {
      const userId = req.user.id;
      const { step, completed } = req.body;
      
      console.log(`Updating onboarding progress for user ${userId}:`, { step, completed });
      
      if (typeof step !== 'number' || step < 1) {
        console.log("Invalid step parameter:", step);
        return res.status(400).json({ message: "Invalid step parameter" });
      }
      
      // Get or create profile
      let profile = await storage.getProfile(userId);
      
      if (!profile) {
        console.log(`Profile not found for user ${userId}, creating new profile`);
        try {
          profile = await storage.createProfile({
            userId,
            onboardingStatus: OnboardingStatus.IN_PROGRESS as OnboardingStatusType,
            onboardingStep: 1
          });
          
          if (!profile) {
            throw new Error("Failed to create profile");
          }
        } catch (err) {
          console.error("Error creating profile:", err);
          return res.status(500).json({ message: "Failed to create profile for onboarding" });
        }
      }
      
      // Update the onboarding step
      const updateData: Partial<Profile> = {
        onboardingStep: step
      };
      
      // If this is marking the onboarding as complete
      if (completed) {
        updateData.onboardingStatus = OnboardingStatus.COMPLETED as OnboardingStatusType;
        updateData.onboardingCompletedAt = new Date();
        console.log(`Marking onboarding as completed for user ${userId}`);
      } else {
        updateData.onboardingStatus = OnboardingStatus.IN_PROGRESS as OnboardingStatusType;
      }
      
      console.log(`Updating profile with data:`, updateData);
      
      try {
        const updatedProfile = await storage.updateProfile(userId, updateData);
        
        if (!updatedProfile) {
          console.warn(`Failed to update profile for user ${userId}, will return fallback response`);
          // If update fails, return response with values we tried to set
          return res.status(200).json({
            status: completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS,
            step: step,
            isComplete: completed,
            completedAt: completed ? new Date() : null
          });
        }
        
        // Use default values if properties are undefined
        const status = updatedProfile.onboardingStatus || (completed ? OnboardingStatus.COMPLETED : OnboardingStatus.IN_PROGRESS);
        const currentStep = updatedProfile.onboardingStep || step;
        const isComplete = status === OnboardingStatus.COMPLETED;
        
        const response = {
          status,
          step: currentStep,
          isComplete,
          completedAt: isComplete ? (updatedProfile.onboardingCompletedAt || new Date()) : null
        };
        
        console.log(`Successful onboarding update for user ${userId}, sending response:`, response);
        
        res.status(200).json(response);
      } catch (err) {
        console.error(`Error in storage.updateProfile for user ${userId}:`, err);
        return res.status(500).json({ message: "Failed to update profile in database" });
      }
    } catch (error) {
      console.error("Error updating onboarding progress:", error);
      res.status(500).json({ message: "Error updating onboarding progress" });
    }
  });
}
