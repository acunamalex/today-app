import { create } from 'zustand';
import type { DayReport, ExecutiveSummary, StopReport, Route, Stop, QuestionResponse } from '../types';
import { db } from '../db/dexie';
import { generateAIInsights } from '../services/reportService';

interface ReportState {
  currentReport: DayReport | null;
  reports: DayReport[];
  isLoading: boolean;
  isGenerating: boolean;
  error: string | null;

  // Actions
  generateReport: (routeId: string) => Promise<DayReport>;
  loadReport: (reportId: string) => Promise<void>;
  loadReportByRoute: (routeId: string) => Promise<DayReport | null>;
  loadUserReports: (userId: string, limit?: number) => Promise<void>;
  deleteReport: (reportId: string) => Promise<void>;
  clearError: () => void;
}

export const useReportStore = create<ReportState>()((set, get) => ({
  currentReport: null,
  reports: [],
  isLoading: false,
  isGenerating: false,
  error: null,

  generateReport: async (routeId) => {
    set({ isGenerating: true, error: null });

    try {
      // Load route data
      const route = await db.routes.get(routeId);
      if (!route) throw new Error('Route not found');

      // Load all stops for this route
      const stops = await db.stops
        .where({ routeId })
        .sortBy('order');

      // Load all responses for all stops
      const allResponses = await db.questionResponses
        .where({ routeId })
        .toArray();

      // Group responses by stop
      const responsesByStop = allResponses.reduce((acc, response) => {
        if (!acc[response.stopId]) {
          acc[response.stopId] = [];
        }
        acc[response.stopId].push(response);
        return acc;
      }, {} as Record<string, QuestionResponse[]>);

      // Calculate metrics
      const summary = calculateSummary(route, stops, responsesByStop);

      // Generate AI insights
      const aiObservations = await generateAIInsights(route, stops, responsesByStop);
      summary.observations = aiObservations;

      // Create stop reports
      const stopReports: StopReport[] = stops.map((stop) => ({
        stopId: stop.id,
        address: stop.address,
        name: stop.name,
        timeSpent: calculateTimeSpent(stop),
        arrivedAt: stop.arrivedAt,
        departedAt: stop.departedAt,
        status: stop.status,
        responses: responsesByStop[stop.id] || [],
      }));

      // Create the report
      const report: DayReport = {
        id: crypto.randomUUID(),
        routeId,
        userId: route.userId,
        date: route.date,
        summary,
        stopReports,
        generatedAt: new Date(),
      };

      // Check for existing report and update or create
      const existingReport = await db.dayReports
        .where({ routeId })
        .first();

      if (existingReport) {
        await db.dayReports.update(existingReport.id, report);
        report.id = existingReport.id;
      } else {
        await db.dayReports.add(report);
      }

      set({
        currentReport: report,
        isGenerating: false,
      });

      return report;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to generate report',
        isGenerating: false,
      });
      throw error;
    }
  },

  loadReport: async (reportId) => {
    set({ isLoading: true, error: null });

    try {
      const report = await db.dayReports.get(reportId);
      if (!report) throw new Error('Report not found');

      set({ currentReport: report, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load report',
        isLoading: false,
      });
    }
  },

  loadReportByRoute: async (routeId) => {
    set({ isLoading: true, error: null });

    try {
      const report = await db.dayReports
        .where({ routeId })
        .first();

      set({ currentReport: report || null, isLoading: false });
      return report || null;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load report',
        isLoading: false,
      });
      return null;
    }
  },

  loadUserReports: async (userId, limit = 30) => {
    set({ isLoading: true, error: null });

    try {
      const reports = await db.dayReports
        .where({ userId })
        .reverse()
        .sortBy('date');

      set({
        reports: reports.slice(0, limit),
        isLoading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load reports',
        isLoading: false,
      });
    }
  },

  deleteReport: async (reportId) => {
    const { reports } = get();

    await db.dayReports.delete(reportId);

    set({
      reports: reports.filter((r) => r.id !== reportId),
      currentReport: get().currentReport?.id === reportId ? null : get().currentReport,
    });
  },

  clearError: () => set({ error: null }),
}));

// Helper function to calculate time spent at a stop
function calculateTimeSpent(stop: Stop): number {
  if (!stop.arrivedAt || !stop.departedAt) return 0;

  const arrived = new Date(stop.arrivedAt).getTime();
  const departed = new Date(stop.departedAt).getTime();

  return Math.round((departed - arrived) / 1000 / 60); // minutes
}

// Helper function to calculate executive summary
function calculateSummary(
  route: Route,
  stops: Stop[],
  responsesByStop: Record<string, QuestionResponse[]>
): ExecutiveSummary {
  const completedStops = stops.filter((s) => s.status === 'completed');
  const skippedStops = stops.filter((s) => s.status === 'skipped');

  // Calculate total on-site time
  let totalOnSiteTime = 0;
  completedStops.forEach((stop) => {
    totalOnSiteTime += calculateTimeSpent(stop);
  });

  // Calculate total drive time (estimated from route duration minus on-site time)
  const totalDriveTime = Math.max(0, Math.round(route.totalDuration / 60) - totalOnSiteTime);

  // Calculate total time
  let totalTime = totalOnSiteTime + totalDriveTime;
  if (route.startedAt && route.completedAt) {
    totalTime = Math.round(
      (new Date(route.completedAt).getTime() - new Date(route.startedAt).getTime()) / 1000 / 60
    );
  }

  // Calculate locations per hour
  const hoursWorked = totalTime / 60;
  const locationsPerHour = hoursWorked > 0 ? completedStops.length / hoursWorked : 0;

  // Calculate average time per stop
  const averageTimePerStop = completedStops.length > 0
    ? totalOnSiteTime / completedStops.length
    : 0;

  // Calculate trends
  const trends = calculateTrends(stops, responsesByStop);

  // Calculate flagged issues
  const flaggedIssues = calculateFlaggedIssues(stops, responsesByStop);

  return {
    totalStops: stops.length,
    completedStops: completedStops.length,
    skippedStops: skippedStops.length,
    totalDriveTime,
    totalOnSiteTime,
    totalTime,
    locationsPerHour: Math.round(locationsPerHour * 10) / 10,
    averageTimePerStop: Math.round(averageTimePerStop),
    totalDistance: Math.round(route.totalDistance / 1000 * 10) / 10, // km
    trends,
    observations: [], // Will be filled by AI
    flaggedIssues,
  };
}

// Helper function to calculate trends from responses
function calculateTrends(
  stops: Stop[],
  responsesByStop: Record<string, QuestionResponse[]>
): ExecutiveSummary['trends'] {
  const trends: ExecutiveSummary['trends'] = [];
  const allResponses = Object.values(responsesByStop).flat();

  // Completion rate trend
  const completionRate = stops.length > 0
    ? Math.round((stops.filter((s) => s.status === 'completed').length / stops.length) * 100)
    : 0;

  trends.push({
    label: 'Completion Rate',
    value: `${completionRate}%`,
    type: completionRate >= 80 ? 'positive' : completionRate >= 50 ? 'neutral' : 'negative',
  });

  // Yes/No question analysis
  const yesNoResponses = allResponses.filter((r) => r.type === 'yesNo');
  if (yesNoResponses.length > 0) {
    // Check for "issues found" question
    const issueResponses = yesNoResponses.filter(
      (r) => r.questionText.toLowerCase().includes('issue')
    );
    if (issueResponses.length > 0) {
      const issuesFound = issueResponses.filter((r) => r.value === true).length;
      const issueRate = Math.round((issuesFound / issueResponses.length) * 100);
      trends.push({
        label: 'Issues Reported',
        value: `${issueRate}%`,
        type: issueRate > 30 ? 'negative' : issueRate > 10 ? 'neutral' : 'positive',
      });
    }

    // Check for "follow-up needed" question
    const followUpResponses = yesNoResponses.filter(
      (r) => r.questionText.toLowerCase().includes('follow-up') || r.questionText.toLowerCase().includes('followup')
    );
    if (followUpResponses.length > 0) {
      const followUpsNeeded = followUpResponses.filter((r) => r.value === true).length;
      trends.push({
        label: 'Follow-ups Needed',
        value: followUpsNeeded.toString(),
        type: followUpsNeeded > 0 ? 'neutral' : 'positive',
      });
    }
  }

  // Rating analysis
  const ratingResponses = allResponses.filter((r) => r.type === 'rating');
  if (ratingResponses.length > 0) {
    const avgRating = ratingResponses.reduce((sum, r) => sum + (Number(r.value) || 0), 0) / ratingResponses.length;
    trends.push({
      label: 'Avg. Satisfaction',
      value: `${avgRating.toFixed(1)}/5`,
      type: avgRating >= 4 ? 'positive' : avgRating >= 3 ? 'neutral' : 'negative',
    });
  }

  return trends;
}

// Helper function to identify flagged issues
function calculateFlaggedIssues(
  stops: Stop[],
  responsesByStop: Record<string, QuestionResponse[]>
): ExecutiveSummary['flaggedIssues'] {
  const issues: ExecutiveSummary['flaggedIssues'] = [];

  stops.forEach((stop) => {
    const responses = responsesByStop[stop.id] || [];

    // Check for issue-related responses
    responses.forEach((response) => {
      // Flag if "issues found" is yes
      if (
        response.type === 'yesNo' &&
        response.questionText.toLowerCase().includes('issue') &&
        response.value === true
      ) {
        // Look for description
        const descriptionResponse = responses.find(
          (r) => r.type === 'text' && r.questionText.toLowerCase().includes('description')
        );

        issues.push({
          severity: 'medium',
          description: descriptionResponse?.value
            ? `Issue at ${stop.name || stop.address}: ${descriptionResponse.value}`
            : `Issue reported at ${stop.name || stop.address}`,
          stopId: stop.id,
        });
      }

      // Flag low ratings
      if (response.type === 'rating' && Number(response.value) <= 2) {
        issues.push({
          severity: Number(response.value) === 1 ? 'high' : 'medium',
          description: `Low satisfaction rating (${response.value}/5) at ${stop.name || stop.address}`,
          stopId: stop.id,
        });
      }
    });

    // Flag skipped stops
    if (stop.status === 'skipped') {
      issues.push({
        severity: 'low',
        description: `Stop skipped: ${stop.name || stop.address}`,
        stopId: stop.id,
      });
    }
  });

  // Sort by severity
  const severityOrder = { high: 0, medium: 1, low: 2 };
  return issues.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);
}
