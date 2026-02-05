import emailjs from '@emailjs/browser';
import type { DayReport } from '../types';
import { generateExecutiveSummary } from './exportService';

// EmailJS configuration
// To use this service:
// 1. Create a free account at https://www.emailjs.com/
// 2. Create an email service (Gmail, Outlook, etc.)
// 3. Create an email template with variables: {{to_email}}, {{subject}}, {{message}}, {{from_name}}
// 4. Copy your Service ID, Template ID, and Public Key below

const EMAILJS_SERVICE_ID = import.meta.env.VITE_EMAILJS_SERVICE_ID || '';
const EMAILJS_TEMPLATE_ID = import.meta.env.VITE_EMAILJS_TEMPLATE_ID || '';
const EMAILJS_PUBLIC_KEY = import.meta.env.VITE_EMAILJS_PUBLIC_KEY || '';

export interface EmailResult {
  success: boolean;
  message: string;
}

/**
 * Check if EmailJS is configured
 */
export function isEmailConfigured(): boolean {
  return !!(EMAILJS_SERVICE_ID && EMAILJS_TEMPLATE_ID && EMAILJS_PUBLIC_KEY);
}

/**
 * Send executive summary via EmailJS
 */
export async function sendExecutiveSummaryEmail(
  report: DayReport,
  toEmail: string,
  fromName: string = 'Today Route Planner'
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      message: 'Email service not configured. Please set up EmailJS credentials.',
    };
  }

  if (!toEmail || !toEmail.includes('@')) {
    return {
      success: false,
      message: 'Please provide a valid email address.',
    };
  }

  const summaryText = generateExecutiveSummary(report);
  const dateStr = new Date(report.date).toLocaleDateString();

  const templateParams = {
    to_email: toEmail,
    subject: `Executive Summary - Route Report ${dateStr}`,
    message: summaryText,
    from_name: fromName,
    report_date: dateStr,
    stops_completed: `${report.summary.completedStops}/${report.summary.totalStops}`,
    total_distance: `${report.summary.totalDistance.toFixed(1)} km`,
    efficiency: `${report.summary.locationsPerHour.toFixed(1)} locations/hour`,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    if (response.status === 200) {
      return {
        success: true,
        message: `Summary sent successfully to ${toEmail}!`,
      };
    } else {
      return {
        success: false,
        message: 'Failed to send email. Please try again.',
      };
    }
  } catch (error) {
    console.error('EmailJS error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email.',
    };
  }
}

/**
 * Send a simple notification email
 */
export async function sendNotificationEmail(
  toEmail: string,
  subject: string,
  message: string,
  fromName: string = 'Today Route Planner'
): Promise<EmailResult> {
  if (!isEmailConfigured()) {
    return {
      success: false,
      message: 'Email service not configured.',
    };
  }

  const templateParams = {
    to_email: toEmail,
    subject,
    message,
    from_name: fromName,
  };

  try {
    const response = await emailjs.send(
      EMAILJS_SERVICE_ID,
      EMAILJS_TEMPLATE_ID,
      templateParams,
      EMAILJS_PUBLIC_KEY
    );

    return {
      success: response.status === 200,
      message: response.status === 200 ? 'Email sent!' : 'Failed to send email.',
    };
  } catch (error) {
    console.error('EmailJS error:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to send email.',
    };
  }
}
