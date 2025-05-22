import { ConfidentialClientApplication } from '@azure/msal-node';
import { Client } from '@microsoft/microsoft-graph-client';
import 'isomorphic-fetch';
import { storage } from './storage';

// Microsoft Graph Authentication and API Service

// MSAL configuration for OAuth authentication
const msalConfig = {
  auth: {
    clientId: process.env.MICROSOFT_CLIENT_ID || '',
    clientSecret: process.env.MICROSOFT_CLIENT_SECRET || '',
    authority: `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT_ID}`
  }
};

// Create a confidential client application
const cca = new ConfidentialClientApplication(msalConfig);

// Define required permission scopes for calendar access
const scopes = [
  'https://graph.microsoft.com/Calendars.Read',
  'https://graph.microsoft.com/Calendars.ReadWrite',
  'offline_access', // For refresh tokens
  'openid',
  'profile',
  'email'
];

/**
 * Generate Microsoft auth URL for OAuth flow
 */
export function getMicrosoftAuthUrl(userId: number, redirectUri: string): string {
  // Save the user ID for later association with the token
  const state = JSON.stringify({ userId });
  
  const authCodeUrlParameters = {
    scopes,
    redirectUri,
    state
  };

  return cca.getAuthCodeUrl(authCodeUrlParameters);
}

/**
 * Exchange authorization code for tokens and save them
 */
export async function handleMicrosoftCallback(code: string, state: string, redirectUri: string) {
  try {
    // Parse the state to get user ID
    const { userId } = JSON.parse(state);
    
    // Exchange auth code for tokens
    const tokenResponse = await cca.acquireTokenByCode({
      code,
      scopes,
      redirectUri
    });
    
    // Save tokens to database
    if (tokenResponse?.account?.username && tokenResponse.accessToken && tokenResponse.refreshToken) {
      await storage.saveMicrosoftTokens(
        userId,
        tokenResponse.account.username,
        tokenResponse.accessToken,
        tokenResponse.refreshToken,
        tokenResponse.expiresOn ? new Date(tokenResponse.expiresOn) : new Date(Date.now() + 3600 * 1000)
      );
      
      return {
        success: true,
        email: tokenResponse.account.username
      };
    }
    
    throw new Error('Invalid token response');
  } catch (error) {
    console.error('Error handling Microsoft callback:', error);
    throw error;
  }
}

/**
 * Create a Microsoft Graph client with user's access token
 */
export function createGraphClient(accessToken: string): Client {
  // Initialize the Graph client
  const client = Client.init({
    // Use the provided access token as the authentication provider
    authProvider: (done) => {
      done(null, accessToken);
    }
  });
  
  return client;
}

/**
 * Refresh an expired Microsoft access token
 */
export async function refreshAccessToken(userId: number): Promise<string | null> {
  try {
    // Get the user's refresh token from storage
    const microsoftTokens = await storage.getMicrosoftTokens(userId);
    
    if (!microsoftTokens || !microsoftTokens.refreshToken) {
      return null;
    }
    
    // Use the refresh token to get a new access token
    const refreshTokenRequest = {
      refreshToken: microsoftTokens.refreshToken,
      scopes
    };
    
    const response = await cca.acquireTokenByRefreshToken(refreshTokenRequest);
    
    if (response?.accessToken && response?.refreshToken) {
      // Update the tokens in the database
      await storage.saveMicrosoftTokens(
        userId, 
        microsoftTokens.microsoftEmail,
        response.accessToken,
        response.refreshToken,
        response.expiresOn ? new Date(response.expiresOn) : new Date(Date.now() + 3600 * 1000)
      );
      
      return response.accessToken;
    }
    
    return null;
  } catch (error) {
    console.error('Error refreshing Microsoft access token:', error);
    return null;
  }
}

/**
 * Get a valid access token for a user, refreshing if necessary
 */
export async function getValidAccessToken(userId: number): Promise<string | null> {
  try {
    // Get the user's Microsoft tokens
    const microsoftTokens = await storage.getMicrosoftTokens(userId);
    
    if (!microsoftTokens) {
      return null;
    }
    
    // Check if the token is expired or will expire soon (within 5 minutes)
    const now = new Date();
    const tokenExpiresAt = new Date(microsoftTokens.expiresAt);
    const tokenIsExpired = tokenExpiresAt <= now;
    const tokenExpiresInFiveMinutes = tokenExpiresAt <= new Date(now.getTime() + 5 * 60 * 1000);
    
    if (tokenIsExpired || tokenExpiresInFiveMinutes) {
      // Token is expired or will expire soon, refresh it
      return await refreshAccessToken(userId);
    }
    
    // Token is still valid
    return microsoftTokens.accessToken;
  } catch (error) {
    console.error('Error getting valid access token:', error);
    return null;
  }
}

/**
 * Get a user's calendar events for a specific date range
 */
export async function getUserCalendarEvents(userId: number, startDateTime: string, endDateTime: string) {
  try {
    // Get a valid access token
    const accessToken = await getValidAccessToken(userId);
    
    if (!accessToken) {
      throw new Error('No valid access token found');
    }
    
    // Create a Microsoft Graph client
    const client = createGraphClient(accessToken);
    
    // Query calendar view for events between start and end datetime
    const events = await client
      .api('/me/calendarView')
      .query({
        startDateTime,
        endDateTime,
        $select: 'subject,start,end,isAllDay,organizer,attendees',
        $orderby: 'start/dateTime',
        $top: 100  // Limit to 100 events
      })
      .get();
    
    return events.value;
  } catch (error) {
    console.error('Error fetching calendar events:', error);
    throw error;
  }
}

/**
 * Check if a user has connected their Microsoft account
 */
export async function isUserConnectedToMicrosoft(userId: number): Promise<boolean> {
  try {
    const microsoftTokens = await storage.getMicrosoftTokens(userId);
    return !!microsoftTokens;
  } catch (error) {
    console.error('Error checking Microsoft connection:', error);
    return false;
  }
}

/**
 * Disconnect a user's Microsoft account
 */
export async function disconnectMicrosoftAccount(userId: number): Promise<boolean> {
  try {
    await storage.deleteMicrosoftTokens(userId);
    return true;
  } catch (error) {
    console.error('Error disconnecting Microsoft account:', error);
    return false;
  }
}

/**
 * Create a calendar event for a mentorship session
 */
export async function createCalendarEvent(
  userId: number, 
  sessionTitle: string, 
  sessionDate: Date, 
  durationMinutes: number,
  attendeeEmails: string[] = [],
  description: string = ''
) {
  try {
    // Get a valid access token
    const accessToken = await getValidAccessToken(userId);
    
    if (!accessToken) {
      console.log(`Could not create calendar event for user ${userId}: No valid access token`);
      return null;
    }

    // Calculate end time based on start time and duration
    const endDate = new Date(sessionDate);
    endDate.setMinutes(endDate.getMinutes() + durationMinutes);

    // Format dates for Microsoft Graph API
    const startDateTime = sessionDate.toISOString();
    const endDateTime = endDate.toISOString();

    // Prepare attendees if any
    const attendees = attendeeEmails.map(email => ({
      emailAddress: {
        address: email
      },
      type: 'required'
    }));

    // Create event object
    const event = {
      subject: sessionTitle,
      body: {
        contentType: 'HTML',
        content: description || 'Mentorship session'
      },
      start: {
        dateTime: startDateTime,
        timeZone: 'UTC'
      },
      end: {
        dateTime: endDateTime,
        timeZone: 'UTC'
      },
      isOnlineMeeting: true,
      onlineMeetingProvider: 'teamsForBusiness',
      attendees: attendees
    };

    // Create a Microsoft Graph client
    const client = createGraphClient(accessToken);
    
    // Create the calendar event
    const response = await client
      .api('/me/events')
      .post(event);
    
    console.log(`Calendar event created for user ${userId}:`, response.id);
    return response;
  } catch (error) {
    console.error(`Error creating calendar event for user ${userId}:`, error);
    return null;
  }
}