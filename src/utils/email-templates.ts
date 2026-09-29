
const BRAND = {
  ink: "#211E19",
  marigold: "#F2A70B",
  paper: "#FBF7EF",
  jade: "#0F6B5C",
  muted: "#8A8272",
  hairline: "#E7DFD0",
};

interface EmailLayoutParams {
  preheader: string;
  heading: string;
  bodyHtml: string;
  ctaText?: string;
  ctaUrl?: string;
  footerNote?: string;
}

/**
 * Shared branded shell for all transactional emails. Table-based layout with
 * every style inlined — email clients (Outlook especially) don't reliably
 * support external stylesheets, flexbox, or CSS variables, so this is
 * deliberately old-school HTML rather than reusing the app's own styles.css.
 */
function emailLayout({ preheader, heading, bodyHtml, ctaText, ctaUrl, footerNote }: EmailLayoutParams): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta http-equiv="X-UA-Compatible" content="IE=edge" />
    <title>Mercado</title>
    <!--[if mso]>
    <style>table {border-collapse: collapse;}</style>
    <![endif]-->
    <style>
      @media only screen and (max-width: 480px) {
        .mc-container { width: 100% !important; }
        .mc-px { padding-left: 20px !important; padding-right: 20px !important; }
      }
    </style>
  </head>
  <body style="margin:0; padding:0; background-color:${BRAND.paper}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">
    <div style="display:none; max-height:0; overflow:hidden; opacity:0;">${preheader}</div>

    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:${BRAND.paper};">
      <tr>
        <td align="center" style="padding: 32px 16px;">
          <table role="presentation" class="mc-container" width="560" cellpadding="0" cellspacing="0" style="width:560px; max-width:100%; background-color:#ffffff; border:1px solid ${BRAND.ink}; border-radius:10px; overflow:hidden;">

            <tr>
              <td style="background-color:${BRAND.marigold}; height:6px; line-height:6px; font-size:0;">&nbsp;</td>
            </tr>

            <tr>
              <td class="mc-px" style="padding: 28px 40px 0 40px;">
                <span style="font-family: Georgia, 'Times New Roman', serif; font-weight: bold; font-size: 22px; color:${BRAND.ink};">
                  mercado<span style="color:${BRAND.marigold};">.</span>
                </span>
              </td>
            </tr>

            <tr>
              <td class="mc-px" style="padding: 24px 40px 8px 40px;">
                <h1 style="margin:0 0 16px 0; font-size:22px; line-height:1.3; color:${BRAND.ink}; font-family: Georgia, 'Times New Roman', serif;">
                  ${heading}
                </h1>
                <div style="font-size:15px; line-height:1.6; color:${BRAND.ink};">
                  ${bodyHtml}
                </div>
              </td>
            </tr>

            ${
              ctaText && ctaUrl
                ? `<tr>
                    <td class="mc-px" style="padding: 8px 40px 32px 40px;">
                      <table role="presentation" cellpadding="0" cellspacing="0">
                        <tr>
                          <td style="border-radius:8px; background-color:${BRAND.ink};">
                            <a href="${ctaUrl}" target="_blank"
                               style="display:inline-block; padding:13px 28px; font-size:15px; font-weight:bold; color:${BRAND.paper}; text-decoration:none; border-radius:8px;">
                              ${ctaText}
                            </a>
                          </td>
                        </tr>
                      </table>
                      <p style="margin: 16px 0 0 0; font-size:12.5px; color:${BRAND.muted}; word-break: break-all;">
                        Or paste this link into your browser:<br />
                        <a href="${ctaUrl}" target="_blank" style="color:${BRAND.jade};">${ctaUrl}</a>
                      </p>
                    </td>
                  </tr>`
                : ""
            }

            <tr>
              <td style="padding: 0 40px;">
                <div style="border-top:1px solid ${BRAND.hairline};"></div>
              </td>
            </tr>

            <tr>
              <td class="mc-px" style="padding: 20px 40px 28px 40px;">
                <p style="margin:0; font-size:12.5px; line-height:1.6; color:${BRAND.muted};">
                  ${footerNote || "If you didn't request this, you can safely ignore this email."}
                </p>
                <p style="margin:12px 0 0 0; font-size:12px; color:${BRAND.muted};">
                  Mercado — a marketplace for real people.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function verificationEmailHtml(name: string, verifyUrl: string): string {
  return emailLayout({
    preheader: "Confirm your email to finish setting up your Mercado account.",
    heading: `Welcome to Mercado, ${name.split(" ")[0]}`,
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Thanks for signing up. Confirm your email address to finish setting up your account.</p>
      <p style="margin:0; color:${BRAND.muted}; font-size:13.5px;">This link expires in 24 hours.</p>
    `,
    ctaText: "Verify my email",
    ctaUrl: verifyUrl,
  });
}

export function verificationEmailText(name: string, verifyUrl: string): string {
  return `Welcome to Mercado, ${name.split(" ")[0]}!\n\nConfirm your email address: ${verifyUrl}\n\nThis link expires in 24 hours.`;
}

export function passwordResetEmailHtml(name: string, resetUrl: string): string {
  return emailLayout({
    preheader: "Reset your Mercado password.",
    heading: "Reset your password",
    bodyHtml: `
      <p style="margin:0 0 12px 0;">Hi ${name.split(" ")[0]}, someone requested a password reset for this account.</p>
      <p style="margin:0; color:${BRAND.muted}; font-size:13.5px;">If this wasn't you, you can safely ignore this email — your password won't change. This link expires in 1 hour.</p>
    `,
    ctaText: "Reset my password",
    ctaUrl: resetUrl,
  });
}

export function passwordResetEmailText(name: string, resetUrl: string): string {
  return `Hi ${name.split(" ")[0]},\n\nSomeone requested a password reset for this account. If this wasn't you, ignore this email.\n\nReset your password: ${resetUrl}\n\nThis link expires in 1 hour.`;
}