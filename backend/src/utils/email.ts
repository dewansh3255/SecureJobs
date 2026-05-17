/**
 * Email Service
 * Nodemailer-based email utility for transactional emails
 */

import nodemailer from 'nodemailer';
import config from '../config';
import logger from './logger';

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

// Cache auto-created Ethereal test account so we only create it once
let devTransporter: nodemailer.Transporter | null = null;

async function getDevTransporter(): Promise<nodemailer.Transporter> {
  if (devTransporter) return devTransporter;

  // If explicit Ethereal creds are provided in env, use them
  if (process.env.ETHEREAL_USER && process.env.ETHEREAL_PASS) {
    devTransporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      auth: { user: process.env.ETHEREAL_USER, pass: process.env.ETHEREAL_PASS },
    });
    return devTransporter;
  }

  // Auto-create a fresh Ethereal test account (no sign-up needed)
  const testAccount = await nodemailer.createTestAccount();
  logger.info(`Dev email — Ethereal test account: ${testAccount.user}`);
  devTransporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: { user: testAccount.user, pass: testAccount.pass },
  });
  return devTransporter;
}

const getProdTransporter = () =>
  nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '587'),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = config.server.isProduction
      ? getProdTransporter()
      : await getDevTransporter();

    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || 'ProNet'}" <${process.env.FROM_EMAIL || 'noreply@pronet.dev'}>`,
      to: options.to,
      subject: options.subject,
      text: options.text || '',
      html: options.html,
    });

    logger.info(`Email sent: ${info.messageId} to ${options.to}`);

    if (!config.server.isProduction) {
      logger.info(`Email preview: ${nodemailer.getTestMessageUrl(info)}`);
    }
  } catch (error) {
    logger.error('Email send failed', { error, to: options.to, subject: options.subject });
    throw new Error('Failed to send email');
  }
};

export const sendPasswordResetEmail = async (email: string, resetUrl: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Password Reset Request - ProNet',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0a66c2;">Reset Your Password</h2>
        <p>You requested a password reset for your ProNet account.</p>
        <p>Click the button below to reset your password. This link expires in <strong>1 hour</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block; background:#0a66c2; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 13px;">If you didn't request this, please ignore this email. Your password remains unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">ProNet — Professional Networking Platform</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 1 hour.\n\nIf you didn't request this, ignore this email.`,
  });
};

export const sendVerificationEmail = async (email: string, verifyUrl: string): Promise<void> => {
  await sendEmail({
    to: email,
    subject: 'Verify Your Email - ProNet',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #0a66c2;">Verify Your Email Address</h2>
        <p>Welcome to ProNet! Please verify your email address to get started.</p>
        <a href="${verifyUrl}" style="display:inline-block; background:#0a66c2; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin: 16px 0;">
          Verify Email
        </a>
        <p style="color: #666; font-size: 13px;">This link expires in 24 hours.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">ProNet — Professional Networking Platform</p>
      </div>
    `,
    text: `Verify your email: ${verifyUrl}\n\nThis link expires in 24 hours.`,
  });
};
