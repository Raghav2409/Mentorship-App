import { MailService } from '@sendgrid/mail';

// Lazy initialize SendGrid mail service only when API key is available
let mailService: MailService | null = null;

function initializeMailService() {
  if (mailService) return mailService;
  
  if (!process.env.SENDGRID_API_KEY) {
    console.warn("SendGrid API key not found. Email notifications will not be sent.");
    return null;
  }
  
  mailService = new MailService();
  mailService.setApiKey(process.env.SENDGRID_API_KEY as string);
  return mailService;
}

interface EmailParams {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
}

export async function sendEmail(params: EmailParams): Promise<boolean> {
  const service = initializeMailService();
  
  if (!service) {
    console.warn("SendGrid mail service not initialized. Email not sent.");
    return false;
  }
  
  try {
    const mailData = {
      to: params.to,
      from: params.from, 
      subject: params.subject,
      text: params.text || "",
      html: params.html || "",
    };
    await service.send(mailData);
    console.log(`Email sent successfully to ${params.to}`);
    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
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
  
  return sendEmail({
    to: mentorEmail,
    from: 'mentorship@company.com', // Should be a verified sender in SendGrid
    subject: `Mentorship Session: ${sessionTitle}`,
    html
  });
}

// Ask secrets only when we try to use email functions
export async function checkSendGridCredentials(): Promise<boolean> {
  return !!process.env.SENDGRID_API_KEY;
}