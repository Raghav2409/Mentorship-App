import { EmailClient } from "@azure/communication-email";

// Lazy initialize Azure Communication Services Email client only when connection string is available
let emailClient: EmailClient | null = null;

function initializeEmailClient() {
  if (emailClient) return emailClient;
  
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
  
  if (!connectionString) {
    console.warn("Azure Communication Services connection string not found. Email notifications will not be sent.");
    return null;
  }
  
  try {
    emailClient = new EmailClient(connectionString);
    return emailClient;
  } catch (error) {
    console.error("Failed to initialize Azure Communication Services Email client:", error);
    return null;
  }
}

interface EmailParams {
  to: string[];
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  console.log("Attempting to send email with Azure Communication Services");
  console.log(`From: ${params.from}`);
  console.log(`To: ${params.to.join(', ')}`);
  console.log(`Subject: ${params.subject}`);
  
  const client = initializeEmailClient();
  
  if (!client) {
    console.warn("Azure Email client not initialized. Email not sent.");
    console.warn("Check that AZURE_COMMUNICATION_CONNECTION_STRING is properly set.");
    return false;
  }
  
  try {
    const message = {
      senderAddress: params.from,
      content: {
        subject: params.subject,
        plainText: params.text || '',
        html: params.html || '',
      },
      recipients: {
        to: params.to.map(email => ({ address: email })),
      }
    };
    
    console.log("Email message prepared, sending now...");
    const poller = await client.beginSend(message);
    console.log("Email sent, waiting for confirmation...");
    const response = await poller.pollUntilDone();
    
    console.log(`Email sent successfully. Message ID: ${response.id}`);
    return true;
  } catch (error) {
    console.error('Azure Communication Services email error:', error);
    console.error('Error details:', JSON.stringify(error, null, 2));
    return false;
  }
}

export async function sendSessionNotification(
  mentorEmail: string, 
  menteeEmail: string, 
  mentorName: string,
  menteeName: string,
  sessionTitle: string,
  sessionDate: Date,
  sessionDuration: number
): Promise<boolean> {
  // Format date and time
  const dateStr = sessionDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  
  const timeStr = sessionDate.toLocaleTimeString('en-US', { 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  
  // Create email HTML
  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4f46e5;">Session Scheduled</h2>
      <p>Hello ${mentorName},</p>
      <p>A new mentorship session has been scheduled with you.</p>
      
      <div style="background-color: #f9fafb; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <h3 style="margin-top: 0; color: #111827;">${sessionTitle}</h3>
        <p style="margin-bottom: 5px;"><strong>Date:</strong> ${dateStr}</p>
        <p style="margin-bottom: 5px;"><strong>Time:</strong> ${timeStr}</p>
        <p style="margin-bottom: 5px;"><strong>Duration:</strong> ${sessionDuration} minutes</p>
        <p style="margin-bottom: 0;"><strong>Mentee:</strong> ${menteeName}</p>
      </div>
      
      <p>You can view the details and manage this session in your dashboard.</p>
      <p>Thank you for your contribution to our mentorship program!</p>
      
      <div style="margin-top: 30px; font-size: 12px; color: #6b7280;">
        <p>This is an automated message. Please do not reply to this email.</p>
      </div>
    </div>
  `;
  
  // Create text version (fallback)
  const text = `
Session Scheduled

Hello ${mentorName},

A new mentorship session has been scheduled with you.

Session: ${sessionTitle}
Date: ${dateStr}
Time: ${timeStr}
Duration: ${sessionDuration} minutes
Mentee: ${menteeName}

You can view the details and manage this session in your dashboard.

Thank you for your contribution to our mentorship program!
  `;
  
  // Since we're using Azure Communication Services, we should use the default Azure domain
  // Azure provides a default sender domain like <your-resource-name>.azurecomm.net
  // Extract the domain from the connection string if possible
  const connectionString = process.env.AZURE_COMMUNICATION_CONNECTION_STRING || '';
  let senderAddress = 'DoNotReply@azurecomm.net';  // Default fallback
  
  // Extract resource name from connection string
  const resourceNameMatch = connectionString.match(/endpoint=https:\/\/([^\.]+)\.communication\.azure\.com/i);
  if (resourceNameMatch && resourceNameMatch[1]) {
    const resourceName = resourceNameMatch[1];
    senderAddress = `DoNotReply@${resourceName}.azurecomm.net`;
  }
  
  console.log(`Using Azure Communication Services sender email address: ${senderAddress}`);
  
  return sendEmail({
    to: [mentorEmail],
    from: senderAddress, // Must be from a verified domain in Azure Communication Services
    subject: `Mentorship Session: ${sessionTitle}`,
    html,
    text
  });
}

// Check if Azure credentials are available
export async function checkAzureCredentials(): Promise<boolean> {
  return !!process.env.AZURE_COMMUNICATION_CONNECTION_STRING;
}