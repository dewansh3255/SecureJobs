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

const createTransporter = () => {
  if (config.server.isProduction) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  // Development: use Ethereal (catch-all fake SMTP)
  return nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
      user: process.env.ETHEREAL_USER || 'test@ethereal.email',
      pass: process.env.ETHEREAL_PASS || 'testpass',
    },
  });
};

export const sendEmail = async (options: EmailOptions): Promise<void> => {
  try {
    const transporter = createTransporter();
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
        <p>Click the button below to reset your password. This link expires in <strong>10 minutes</strong>.</p>
        <a href="${resetUrl}" style="display:inline-block; background:#0a66c2; color:#fff; padding:12px 24px; border-radius:6px; text-decoration:none; margin: 16px 0;">
          Reset Password
        </a>
        <p style="color: #666; font-size: 13px;">If you didn't request this, please ignore this email. Your password remains unchanged.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="color: #999; font-size: 12px;">ProNet — Professional Networking Platform</p>
      </div>
    `,
    text: `Reset your password: ${resetUrl}\n\nThis link expires in 10 minutes.\n\nIf you didn't request this, ignore this email.`,
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
