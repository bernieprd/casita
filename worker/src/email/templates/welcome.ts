import type { Env } from '../../types'
import { getAppBaseUrl } from '../../types'

export function welcomeEmailHtml(env: Env, unsubscribeToken: string): string {
  const appUrl = getAppBaseUrl(env)
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Welcome to Casita</title>
</head>
<body style="margin:0;padding:0;background:#f9fafb;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:40px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:#18181b;padding:32px 40px;">
              <p style="margin:0;font-size:24px;font-weight:700;color:#ffffff;letter-spacing:-0.5px;">🏡 Casita</p>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h1 style="margin:0 0 16px;font-size:22px;font-weight:600;color:#18181b;">Welcome to Casita!</h1>
              <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#52525b;">
                Your household is all set. Here's what you can do right now:
              </p>

              <table cellpadding="0" cellspacing="0" width="100%">
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;">
                    <p style="margin:0;font-size:15px;color:#18181b;"><strong>🛒 Shopping lists</strong></p>
                    <p style="margin:4px 0 0;font-size:14px;color:#71717a;">Add items, tick them off, and share with your household in real time.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;">
                    <p style="margin:0;font-size:15px;color:#18181b;"><strong>📋 To-dos</strong></p>
                    <p style="margin:4px 0 0;font-size:14px;color:#71717a;">Track chores, tasks, and anything else that needs doing.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;border-bottom:1px solid #f4f4f5;">
                    <p style="margin:0;font-size:15px;color:#18181b;"><strong>🍽️ Recipes</strong></p>
                    <p style="margin:4px 0 0;font-size:14px;color:#71717a;">Save your favourite recipes and push ingredients straight to your shopping list.</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:12px 0;">
                    <p style="margin:0;font-size:15px;color:#18181b;"><strong>📅 Calendar</strong></p>
                    <p style="margin:4px 0 0;font-size:14px;color:#71717a;">Connect Google Calendar to see events alongside your household tasks.</p>
                  </td>
                </tr>
              </table>

              <table cellpadding="0" cellspacing="0" style="margin:32px 0 0;">
                <tr>
                  <td style="background:#18181b;border-radius:8px;">
                    <a href="${appUrl}" style="display:inline-block;padding:14px 28px;font-size:15px;font-weight:600;color:#ffffff;text-decoration:none;">Open Casita →</a>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="padding:24px 40px;border-top:1px solid #f4f4f5;">
              <p style="margin:0;font-size:12px;color:#a1a1aa;">
                You're receiving this because you created a Casita account.
                If you didn't sign up, you can safely ignore this email.
                &nbsp;·&nbsp;
                <a href="${appUrl}/account/unsubscribe?token=${unsubscribeToken}" style="color:#a1a1aa;">Unsubscribe</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#d4d4d8;">
                Casita · mycasita.app
                <!-- TODO(can-spam): add physical mailing address here before sending to a real user base -->
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`
}
