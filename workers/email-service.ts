/**
 * Email Service using SendGrid
 * Handles sending team invitation and password reset emails
 */

const SENDGRID_API_URL = 'https://api.sendgrid.com/v3/mail/send';
const SENDER_EMAIL = 'hello@channelautomation.com';
const APP_URL = 'https://voice-config.channelautomation.com/';

interface SendEmailOptions {
  to: string;
  subject: string;
  htmlContent: string;
}

/**
 * Send an email using SendGrid API
 */
async function sendEmail(
  apiKey: string,
  options: SendEmailOptions
): Promise<{ success: boolean; error?: string }> {
  try {
    const response = await fetch(SENDGRID_API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [
          {
            to: [{ email: options.to }],
            subject: options.subject,
          },
        ],
        from: {
          email: SENDER_EMAIL,
          name: 'Voice AI Dashboard',
        },
        content: [
          {
            type: 'text/html',
            value: options.htmlContent,
          },
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid API error:', response.status, errorText);
      return {
        success: false,
        error: `SendGrid API error: ${response.status}`,
      };
    }

    return { success: true };
  } catch (error: any) {
    console.error('Error sending email:', error);
    return {
      success: false,
      error: error.message || 'Failed to send email',
    };
  }
}

/**
 * Generate HTML email template with consistent styling
 */
function generateEmailTemplate(
  title: string,
  content: string,
  buttonText?: string,
  buttonLink?: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="600" style="max-width: 600px; background-color: #ffffff; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
          <!-- Header -->
          <tr>
            <td style="padding: 40px 40px 30px; text-align: center; border-bottom: 1px solid #e5e5e5;">
              <h1 style="margin: 0; font-size: 24px; font-weight: 600; color: #1a1a1a;">Voice AI Dashboard</h1>
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; font-size: 20px; font-weight: 600; color: #1a1a1a;">${title}</h2>
              ${content}
            </td>
          </tr>
          
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9f9f9; border-top: 1px solid #e5e5e5; text-align: center;">
              <p style="margin: 0; font-size: 12px; color: #666666;">
                This email was sent by Voice AI Dashboard<br>
                If you have any questions, please contact support.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

/**
 * Send team invitation email with login credentials
 */
export async function sendTeamInviteEmail(
  apiKey: string | undefined,
  options: {
    to: string;
    workspaceName: string;
    email: string;
    temporaryPassword: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) {
    console.warn('SendGrid API key not configured, skipping email send');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const loginLink = `${APP_URL}login`;

  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
      You've been invited to join <strong>${options.workspaceName}</strong> on Voice AI Dashboard!
    </p>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
      Your account has been created. Please use the following credentials to log in:
    </p>
    
    <div style="background-color: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #1a1a1a; font-size: 14px;">Email:</strong>
            <span style="color: #333333; font-size: 14px; font-family: monospace; margin-left: 10px;">${options.email}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #1a1a1a; font-size: 14px;">Temporary Password:</strong>
            <span style="color: #333333; font-size: 14px; font-family: monospace; margin-left: 10px;">${options.temporaryPassword}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
      <strong>Important:</strong> For security reasons, please change your password after your first login.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Log In to Dashboard
      </a>
    </div>
    
    <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${loginLink}" style="color: #2563eb; text-decoration: underline;">${loginLink}</a>
    </p>
  `;

  const htmlContent = generateEmailTemplate(
    `Welcome to ${options.workspaceName}!`,
    content,
    'Log In to Dashboard',
    loginLink
  );

  return sendEmail(apiKey, {
    to: options.to,
    subject: `You've been invited to join ${options.workspaceName} on Voice AI Dashboard`,
    htmlContent,
  });
}

/**
 * Send password reset email with new credentials
 */
export async function sendPasswordResetEmail(
  apiKey: string | undefined,
  options: {
    to: string;
    email: string;
    newPassword: string;
  }
): Promise<{ success: boolean; error?: string }> {
  if (!apiKey) {
    console.warn('SendGrid API key not configured, skipping email send');
    return { success: false, error: 'SendGrid API key not configured' };
  }

  const loginLink = `${APP_URL}login`;

  const content = `
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
      Your password has been reset by an administrator.
    </p>
    <p style="margin: 0 0 20px; font-size: 16px; line-height: 1.6; color: #333333;">
      Please use the following new credentials to log in:
    </p>
    
    <div style="background-color: #f9f9f9; border: 1px solid #e5e5e5; border-radius: 6px; padding: 20px; margin: 20px 0;">
      <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%">
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #1a1a1a; font-size: 14px;">Email:</strong>
            <span style="color: #333333; font-size: 14px; font-family: monospace; margin-left: 10px;">${options.email}</span>
          </td>
        </tr>
        <tr>
          <td style="padding: 8px 0;">
            <strong style="color: #1a1a1a; font-size: 14px;">New Password:</strong>
            <span style="color: #333333; font-size: 14px; font-family: monospace; margin-left: 10px;">${options.newPassword}</span>
          </td>
        </tr>
      </table>
    </div>
    
    <p style="margin: 20px 0; font-size: 14px; line-height: 1.6; color: #666666;">
      <strong>Important:</strong> For security reasons, please change your password after logging in.
    </p>
    
    <div style="text-align: center; margin: 30px 0;">
      <a href="${loginLink}" style="display: inline-block; padding: 14px 32px; background-color: #2563eb; color: #ffffff; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 16px;">
        Log In to Dashboard
      </a>
    </div>
    
    <p style="margin: 20px 0 0; font-size: 14px; line-height: 1.6; color: #666666;">
      If the button doesn't work, copy and paste this link into your browser:<br>
      <a href="${loginLink}" style="color: #2563eb; text-decoration: underline;">${loginLink}</a>
    </p>
  `;

  const htmlContent = generateEmailTemplate(
    'Your password has been reset',
    content,
    'Log In to Dashboard',
    loginLink
  );

  return sendEmail(apiKey, {
    to: options.to,
    subject: 'Your password has been reset - Voice AI Dashboard',
    htmlContent,
  });
}

