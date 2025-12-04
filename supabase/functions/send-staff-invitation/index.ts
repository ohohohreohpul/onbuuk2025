import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { Resend } from "npm:resend@3.0.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface InvitationRequest {
  email: string;
  full_name: string;
  role: string;
  business_name: string;
  invite_token: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const { email, full_name, role, business_name, invite_token }: InvitationRequest = await req.json();

    const inviteUrl = `${req.headers.get('origin') || 'http://localhost:5173'}/accept-invite?token=${invite_token}`;

    const emailHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .header {
              background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
              color: white;
              padding: 30px;
              text-align: center;
              border-radius: 8px 8px 0 0;
            }
            .content {
              background: #ffffff;
              padding: 30px;
              border: 1px solid #e5e7eb;
              border-top: none;
            }
            .button {
              display: inline-block;
              background: #1e293b;
              color: white;
              padding: 14px 28px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
            }
            .role-badge {
              display: inline-block;
              background: #e0e7ff;
              color: #4338ca;
              padding: 4px 12px;
              border-radius: 4px;
              font-size: 14px;
              font-weight: 600;
              text-transform: capitalize;
            }
            .footer {
              text-align: center;
              padding: 20px;
              color: #6b7280;
              font-size: 14px;
            }
            .info-box {
              background: #f3f4f6;
              padding: 15px;
              border-radius: 6px;
              margin: 20px 0;
            }
          </style>
        </head>
        <body>
          <div class="header">
            <h1>You're Invited to Join ${business_name}</h1>
          </div>
          <div class="content">
            <p>Hi ${full_name},</p>

            <p>Great news! You've been invited to join <strong>${business_name}</strong> as a <span class="role-badge">${role}</span>.</p>

            <div class="info-box">
              <strong>What's Next?</strong>
              <ol style="margin: 10px 0; padding-left: 20px;">
                <li>Click the button below to accept your invitation</li>
                <li>Create your secure password</li>
                <li>Start accessing your portal immediately</li>
              </ol>
            </div>

            <div style="text-align: center;">
              <a href="${inviteUrl}" class="button">Accept Invitation & Create Account</a>
            </div>

            <p style="font-size: 14px; color: #6b7280;">
              Or copy and paste this link into your browser:<br>
              <a href="${inviteUrl}" style="color: #4338ca; word-break: break-all;">${inviteUrl}</a>
            </p>

            <p style="font-size: 14px; color: #6b7280; margin-top: 30px;">
              <strong>Important:</strong> This invitation link will expire in 7 days. If you didn't expect this invitation or have any questions, please contact your administrator.
            </p>
          </div>
          <div class="footer">
            <p>This is an automated message from ${business_name}</p>
            <p>Please do not reply to this email</p>
          </div>
        </body>
      </html>
    `;

    const resendApiKey = Deno.env.get('RESEND_API_KEY');

    if (!resendApiKey) {
      throw new Error('RESEND_API_KEY not configured');
    }

    const resend = new Resend(resendApiKey);

    const { data, error: resendError } = await resend.emails.send({
      from: 'Buuk <onboarding@resend.dev>',
      to: email,
      subject: `You're invited to join ${business_name}`,
      html: emailHtml,
    });

    if (resendError) {
      console.error('Resend error:', resendError);
      throw new Error(`Failed to send email: ${resendError.message}`);
    }

    console.log('✅ Staff invitation email sent successfully');
    console.log('To:', email);
    console.log('Resend ID:', data?.id);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Invitation email sent successfully',
        emailId: data?.id,
        recipient: email
      }),
      {
        status: 200,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );

  } catch (error) {
    console.error('Error:', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send invitation'
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          'Content-Type': 'application/json',
        },
      }
    );
  }
});
