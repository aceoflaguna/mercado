import nodemailer, { Transporter } from "nodemailer";
import { env } from "../config/env";

let transporterPromise: Promise<Transporter> | null = null;

async function getTransporter(): Promise<Transporter> {
  if (transporterPromise) return transporterPromise;

  if (env.smtp.host) {
    transporterPromise = Promise.resolve(
      nodemailer.createTransport({
        host: env.smtp.host,
        port: env.smtp.port,
        secure: env.smtp.port === 465,
        auth: env.smtp.user ? { user: env.smtp.user, pass: env.smtp.pass } : undefined,
      })
    );
  } else {
    // No SMTP configured — spin up a free, disposable Ethereal inbox so
    // email sending works out of the box on localhost with zero setup.
    // Nothing is delivered anywhere real; sendEmail() logs a preview link.
    transporterPromise = nodemailer.createTestAccount().then((testAccount) => {
      console.log(`\n📧 No SMTP_HOST set — using a disposable Ethereal test inbox.`);
      console.log(`   Emails are NOT delivered anywhere; a preview link is logged per send.\n`);
      return nodemailer.createTransport({
        host: testAccount.smtp.host,
        port: testAccount.smtp.port,
        secure: testAccount.smtp.secure,
        auth: { user: testAccount.user, pass: testAccount.pass },
      });
    });
  }

  return transporterPromise;
}

export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  const transporter = await getTransporter();
  const info = await transporter.sendMail({ from: env.smtp.from, to, subject, html });

  const previewUrl = nodemailer.getTestMessageUrl(info);
  if (previewUrl) {
    console.log(`\n📧 Email sent — preview: ${previewUrl}\n`);
  }
}