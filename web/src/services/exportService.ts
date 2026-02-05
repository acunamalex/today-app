import jsPDF from 'jspdf';
import Papa from 'papaparse';
import type { DayReport, StopReport, QuestionResponse } from '../types';

/**
 * Export report as PDF
 */
export async function exportToPDF(report: DayReport): Promise<Blob> {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  // Helper function for page breaks
  const checkPageBreak = (requiredSpace: number) => {
    if (y + requiredSpace > doc.internal.pageSize.getHeight() - margin) {
      doc.addPage();
      y = margin;
    }
  };

  // Title
  doc.setFontSize(24);
  doc.setTextColor(37, 99, 235); // Primary blue
  doc.text('Today', margin, y);

  y += 10;
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59); // Slate 800
  doc.text('Daily Route Report', margin, y);

  y += 8;
  doc.setFontSize(12);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.text(
    new Date(report.date).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
    margin,
    y
  );

  // Divider line
  y += 10;
  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.line(margin, y, pageWidth - margin, y);

  // Executive Summary
  y += 15;
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Executive Summary', margin, y);

  y += 10;
  doc.setFontSize(10);
  doc.setTextColor(71, 85, 105); // Slate 600

  const { summary } = report;

  // Stats grid
  const stats = [
    { label: 'Total Stops', value: summary.totalStops.toString() },
    { label: 'Completed', value: summary.completedStops.toString() },
    { label: 'Skipped', value: summary.skippedStops.toString() },
    { label: 'Total Distance', value: `${(summary.totalDistance * 0.621371).toFixed(1)} mi` },
    { label: 'Drive Time', value: `${summary.totalDriveTime} min` },
    { label: 'On-Site Time', value: `${summary.totalOnSiteTime} min` },
    { label: 'Locations/Hour', value: summary.locationsPerHour.toFixed(1) },
    { label: 'Avg Time/Stop', value: `${summary.averageTimePerStop} min` },
  ];

  const colWidth = (pageWidth - 2 * margin) / 4;
  stats.forEach((stat, index) => {
    const col = index % 4;
    const row = Math.floor(index / 4);
    const x = margin + col * colWidth;
    const currentY = y + row * 15;

    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(stat.label, x, currentY);

    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(stat.value, x, currentY + 5);
  });

  y += 35;

  // Trends
  if (summary.trends.length > 0) {
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Trends', margin, y);

    y += 8;
    summary.trends.forEach((trend) => {
      checkPageBreak(8);
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      doc.text(`• ${trend.label}: ${trend.value}`, margin + 5, y);
      y += 6;
    });
  }

  // Observations
  if (summary.observations.length > 0) {
    y += 10;
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text('Key Observations', margin, y);

    y += 8;
    summary.observations.forEach((obs) => {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const lines = doc.splitTextToSize(`• ${obs}`, pageWidth - 2 * margin - 5);
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 2;
    });
  }

  // Flagged Issues
  if (summary.flaggedIssues.length > 0) {
    y += 10;
    checkPageBreak(30);
    doc.setFontSize(12);
    doc.setTextColor(239, 68, 68); // Danger red
    doc.text('Flagged Issues', margin, y);

    y += 8;
    summary.flaggedIssues.forEach((issue) => {
      checkPageBreak(12);
      doc.setFontSize(10);
      doc.setTextColor(71, 85, 105);
      const severityColor = {
        high: [239, 68, 68],
        medium: [245, 158, 11],
        low: [100, 116, 139],
      };
      doc.setTextColor(...(severityColor[issue.severity] as [number, number, number]));
      const lines = doc.splitTextToSize(
        `[${issue.severity.toUpperCase()}] ${issue.description}`,
        pageWidth - 2 * margin - 5
      );
      doc.text(lines, margin + 5, y);
      y += lines.length * 5 + 2;
    });
  }

  // Stop Details
  y += 15;
  checkPageBreak(30);
  doc.setFontSize(14);
  doc.setTextColor(30, 41, 59);
  doc.text('Stop Details', margin, y);

  report.stopReports.forEach((stop, index) => {
    y += 12;
    checkPageBreak(40);

    // Stop header
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(`${index + 1}. ${stop.name || stop.address}`, margin, y);

    // Status badge
    const statusColors: Record<string, [number, number, number]> = {
      completed: [16, 185, 129],
      skipped: [245, 158, 11],
      pending: [100, 116, 139],
      in_progress: [37, 99, 235],
    };
    doc.setTextColor(...(statusColors[stop.status] || [100, 116, 139]));
    doc.setFontSize(9);
    doc.text(stop.status.toUpperCase(), pageWidth - margin - 25, y);

    y += 6;
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);

    if (stop.arrivedAt) {
      doc.text(
        `Arrived: ${new Date(stop.arrivedAt).toLocaleTimeString()}`,
        margin + 5,
        y
      );
    }
    if (stop.departedAt) {
      doc.text(
        `Departed: ${new Date(stop.departedAt).toLocaleTimeString()}`,
        margin + 60,
        y
      );
    }
    if (stop.timeSpent > 0) {
      doc.text(`Time: ${stop.timeSpent} min`, margin + 120, y);
    }

    // Responses (limited to avoid PDF overflow)
    if (stop.responses.length > 0) {
      y += 6;
      const displayResponses = stop.responses.slice(0, 5); // Limit responses
      displayResponses.forEach((response) => {
        checkPageBreak(8);
        doc.setFontSize(8);
        doc.setTextColor(100, 116, 139);

        let valueStr = '';
        if (response.type === 'yesNo') {
          valueStr = response.value ? 'Yes' : 'No';
        } else if (response.type === 'rating') {
          valueStr = `${response.value}/5`;
        } else if (response.type === 'photo' || response.type === 'signature') {
          valueStr = response.imageData ? '[Captured]' : '[Not provided]';
        } else {
          valueStr = String(response.value || '-');
        }

        const text = `${response.questionText}: ${valueStr}`;
        const lines = doc.splitTextToSize(text, pageWidth - 2 * margin - 10);
        doc.text(lines, margin + 10, y);
        y += lines.length * 4 + 1;
      });

      if (stop.responses.length > 5) {
        doc.text(`... and ${stop.responses.length - 5} more responses`, margin + 10, y);
        y += 5;
      }
    }
  });

  // Footer
  y = doc.internal.pageSize.getHeight() - 15;
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text(
    `Generated by Today App - ${new Date().toLocaleString()}`,
    margin,
    y
  );

  return doc.output('blob');
}

/**
 * Export report as CSV
 */
export function exportToCSV(report: DayReport): string {
  const rows: Record<string, string | number>[] = [];

  report.stopReports.forEach((stop) => {
    const baseRow = {
      Date: report.date,
      'Stop #': rows.length + 1,
      Address: stop.address,
      Name: stop.name || '',
      Status: stop.status,
      'Arrived At': stop.arrivedAt
        ? new Date(stop.arrivedAt).toISOString()
        : '',
      'Departed At': stop.departedAt
        ? new Date(stop.departedAt).toISOString()
        : '',
      'Time Spent (min)': stop.timeSpent,
    };

    // Add response data as columns
    const responseColumns: Record<string, string | number> = {};
    stop.responses.forEach((response) => {
      const columnName = response.questionText.replace(/[,\n\r]/g, ' ');
      let value: string | number = '';

      if (response.type === 'yesNo') {
        value = response.value ? 'Yes' : 'No';
      } else if (response.type === 'rating') {
        value = Number(response.value) || 0;
      } else if (response.type === 'photo' || response.type === 'signature') {
        value = response.imageData ? 'Yes' : 'No';
      } else {
        value = String(response.value || '');
      }

      responseColumns[columnName] = value;
    });

    rows.push({ ...baseRow, ...responseColumns });
  });

  return Papa.unparse(rows);
}

/**
 * Download a file
 */
export function downloadFile(
  content: Blob | string,
  filename: string,
  mimeType: string
): void {
  const blob =
    content instanceof Blob ? content : new Blob([content], { type: mimeType });

  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Share via email (opens email client)
 */
export function shareViaEmail(
  report: DayReport,
  recipientEmail?: string
): void {
  const subject = encodeURIComponent(
    `Route Report - ${new Date(report.date).toLocaleDateString()}`
  );

  const body = encodeURIComponent(`
Daily Route Report
Date: ${new Date(report.date).toLocaleDateString()}

Summary:
- Total Stops: ${report.summary.totalStops}
- Completed: ${report.summary.completedStops}
- Skipped: ${report.summary.skippedStops}
- Total Distance: ${(report.summary.totalDistance * 0.621371).toFixed(1)} mi
- Total Time: ${report.summary.totalTime} minutes

Key Observations:
${report.summary.observations.map((o) => `- ${o}`).join('\n')}

${report.summary.flaggedIssues.length > 0 ? `
Flagged Issues:
${report.summary.flaggedIssues.map((i) => `- [${i.severity.toUpperCase()}] ${i.description}`).join('\n')}
` : ''}

---
Generated by Today App
  `.trim());

  const mailtoLink = `mailto:${recipientEmail || ''}?subject=${subject}&body=${body}`;
  window.location.href = mailtoLink;
}

/**
 * Generate executive summary text for sharing
 */
export function generateExecutiveSummary(report: DayReport): string {
  const { summary } = report;
  const dateStr = new Date(report.date).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  let text = `📊 EXECUTIVE SUMMARY - ${dateStr}\n\n`;

  // Performance metrics
  text += `📈 PERFORMANCE METRICS\n`;
  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `• Stops Completed: ${summary.completedStops}/${summary.totalStops}\n`;
  text += `• Total Distance: ${(summary.totalDistance * 0.621371).toFixed(1)} mi\n`;
  text += `• Total Time: ${Math.round(summary.totalTime / 60)} hrs ${summary.totalTime % 60} min\n`;
  text += `• Efficiency: ${summary.locationsPerHour.toFixed(1)} locations/hour\n`;
  text += `• Avg Time per Stop: ${summary.averageTimePerStop} min\n\n`;

  // Trends
  if (summary.trends.length > 0) {
    text += `📊 TRENDS\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary.trends.forEach((trend) => {
      const icon = trend.type === 'positive' ? '✅' : trend.type === 'negative' ? '⚠️' : '📌';
      text += `${icon} ${trend.label}: ${trend.value}\n`;
    });
    text += `\n`;
  }

  // AI Observations
  if (summary.observations.length > 0) {
    text += `💡 KEY INSIGHTS (AI-Generated)\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary.observations.forEach((obs, i) => {
      text += `${i + 1}. ${obs}\n`;
    });
    text += `\n`;
  }

  // Flagged Issues
  if (summary.flaggedIssues.length > 0) {
    text += `🚨 ITEMS REQUIRING ATTENTION\n`;
    text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
    summary.flaggedIssues.forEach((issue) => {
      const icon = issue.severity === 'high' ? '🔴' : issue.severity === 'medium' ? '🟡' : '🔵';
      text += `${icon} [${issue.severity.toUpperCase()}] ${issue.description}\n`;
    });
    text += `\n`;
  }

  text += `━━━━━━━━━━━━━━━━━━━━━━━\n`;
  text += `Generated by Today Route Planner`;

  return text;
}

/**
 * Share executive summary via email
 */
export function shareExecutiveSummaryViaEmail(
  report: DayReport,
  recipientEmail?: string
): void {
  const subject = encodeURIComponent(
    `Executive Summary - Route Report ${new Date(report.date).toLocaleDateString()}`
  );

  const summaryText = generateExecutiveSummary(report);
  const body = encodeURIComponent(summaryText);

  const mailtoLink = `mailto:${recipientEmail || ''}?subject=${subject}&body=${body}`;
  window.location.href = mailtoLink;
}

/**
 * Copy executive summary to clipboard
 */
export async function copyExecutiveSummaryToClipboard(report: DayReport): Promise<boolean> {
  const summaryText = generateExecutiveSummary(report);

  try {
    await navigator.clipboard.writeText(summaryText);
    return true;
  } catch (error) {
    console.error('Failed to copy to clipboard:', error);
    return false;
  }
}

/**
 * Export to different formats
 */
export async function exportReport(
  report: DayReport,
  format: 'pdf' | 'csv' | 'email',
  options?: { email?: string }
): Promise<void> {
  const dateStr = new Date(report.date).toISOString().split('T')[0];
  const filename = `route-report-${dateStr}`;

  switch (format) {
    case 'pdf': {
      const pdfBlob = await exportToPDF(report);
      downloadFile(pdfBlob, `${filename}.pdf`, 'application/pdf');
      break;
    }
    case 'csv': {
      const csvContent = exportToCSV(report);
      downloadFile(csvContent, `${filename}.csv`, 'text/csv');
      break;
    }
    case 'email': {
      shareViaEmail(report, options?.email);
      break;
    }
  }
}
