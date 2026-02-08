import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { clsx } from 'clsx';
import {
  ArrowLeft,
  Download,
  Mail,
  FileText,
  Table,
  RefreshCw,
  MapPin,
  Clock,
  Route,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  Loader2,
  Share2,
  Copy,
  Send,
  Search,
  Filter,
  XCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';
import { useReportStore } from '../stores/reportStore';
import { useUIStore } from '../stores/uiStore';
import {
  exportReport,
  shareExecutiveSummaryViaEmail,
  copyExecutiveSummaryToClipboard,
} from '../services/exportService';
import {
  sendExecutiveSummaryEmail,
  isEmailConfigured,
} from '../services/emailService';
import {
  Button,
  Card,
  CardHeader,
  Badge,
  StatusBadge,
  EmptyState,
  LoadingCard,
  Modal,
  Input,
} from '../components/common';
import type { DayReport, StopReport, FlaggedIssue } from '../types';
import { formatDuration, formatSmartDate } from '../utils/timeCalculations';

function MetricCard({
  icon: Icon,
  label,
  value,
  subtext,
  trend,
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  subtext?: string;
  trend?: 'up' | 'down' | 'neutral';
}) {
  return (
    <Card className="text-center">
      <div className="flex flex-col items-center">
        <Icon className="w-5 h-5 text-primary-500 mb-1" />
        <span className="text-2xl font-bold text-slate-900">{value}</span>
        <span className="text-xs text-slate-500">{label}</span>
        {subtext && (
          <span
            className={clsx(
              'text-xs mt-1',
              trend === 'up' && 'text-success-600',
              trend === 'down' && 'text-danger-600',
              trend === 'neutral' && 'text-slate-500'
            )}
          >
            {subtext}
          </span>
        )}
      </div>
    </Card>
  );
}

function TrendCard({ label, value, type }: { label: string; value: string; type: string }) {
  const colors = {
    positive: 'bg-success-50 border-success-200 text-success-700',
    negative: 'bg-danger-50 border-danger-200 text-danger-700',
    neutral: 'bg-slate-50 border-slate-200 text-slate-700',
  };

  return (
    <div
      className={clsx(
        'flex items-center justify-between px-4 py-3 rounded-lg border',
        colors[type as keyof typeof colors] || colors.neutral
      )}
    >
      <span className="text-sm font-medium">{label}</span>
      <span className="font-bold">{value}</span>
    </div>
  );
}

function IssueCard({ issue }: { issue: FlaggedIssue }) {
  const severityConfig = {
    high: { color: 'danger', icon: AlertTriangle },
    medium: { color: 'warning', icon: AlertTriangle },
    low: { color: 'default', icon: AlertTriangle },
  };

  const config = severityConfig[issue.severity];

  return (
    <div className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg">
      <config.icon
        className={clsx(
          'w-5 h-5 flex-shrink-0 mt-0.5',
          issue.severity === 'high' && 'text-danger-500',
          issue.severity === 'medium' && 'text-warning-500',
          issue.severity === 'low' && 'text-slate-500'
        )}
      />
      <div>
        <Badge
          variant={
            issue.severity === 'high'
              ? 'danger'
              : issue.severity === 'medium'
              ? 'warning'
              : 'default'
          }
          size="sm"
        >
          {issue.severity.toUpperCase()}
        </Badge>
        <p className="text-sm text-slate-700 mt-1">{issue.description}</p>
      </div>
    </div>
  );
}

function StopReportCard({
  report,
  index,
}: {
  report: StopReport;
  index: number;
}) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card padding="none" className="overflow-hidden">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-3 p-4 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center text-primary-600 font-bold text-sm">
          {index + 1}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h4 className="font-medium text-slate-900 truncate">
              {report.name || report.address}
            </h4>
            <StatusBadge status={report.status} size="sm" />
          </div>
          {report.timeSpent > 0 && (
            <p className="text-xs text-slate-500">
              {formatDuration(report.timeSpent)} on site
            </p>
          )}
        </div>
        {isExpanded ? (
          <ChevronDown className="w-5 h-5 text-slate-400" />
        ) : (
          <ChevronRight className="w-5 h-5 text-slate-400" />
        )}
      </button>

      {isExpanded && report.responses.length > 0 && (
        <div className="border-t border-slate-200 px-4 py-3 bg-slate-50 space-y-2">
          {report.responses.map((response) => (
            <div key={response.id} className="text-sm">
              <span className="text-slate-600">{response.questionText}: </span>
              <span className="font-medium text-slate-900">
                {response.type === 'yesNo'
                  ? response.value
                    ? 'Yes'
                    : 'No'
                  : response.type === 'rating'
                  ? `${response.value}/5`
                  : response.type === 'photo' || response.type === 'signature'
                  ? response.imageData
                    ? 'Captured'
                    : 'Not provided'
                  : String(response.value || '—')}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

type StopFilter = 'all' | 'completed' | 'skipped';

export function Reports() {
  const navigate = useNavigate();
  const [showExportModal, setShowExportModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [stopFilter, setStopFilter] = useState<StopFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const { user } = useAuthStore();
  const { currentRoute } = useRouteStore();
  const {
    currentReport,
    isLoading,
    isGenerating,
    generateReport,
    loadReportByRoute,
  } = useReportStore();
  const { addToast } = useUIStore();

  // Load or generate report
  useEffect(() => {
    const loadReport = async () => {
      if (!currentRoute) return;

      const existingReport = await loadReportByRoute(currentRoute.id);
      if (!existingReport && currentRoute.status === 'completed') {
        generateReport(currentRoute.id);
      }
    };

    loadReport();
  }, [currentRoute, loadReportByRoute, generateReport]);

  const handleExport = async (format: 'pdf' | 'csv' | 'email') => {
    if (!currentReport) return;

    setIsExporting(true);

    try {
      await exportReport(currentReport, format, { email: exportEmail });
      addToast(
        format === 'email'
          ? 'Opening email client...'
          : `${format.toUpperCase()} downloaded!`,
        'success'
      );
      setShowExportModal(false);
    } catch (error) {
      addToast(`Failed to export ${format}`, 'error');
    } finally {
      setIsExporting(false);
    }
  };

  const handleRegenerate = async () => {
    if (!currentRoute) return;

    try {
      await generateReport(currentRoute.id);
      addToast('Report regenerated', 'success');
    } catch (error) {
      addToast('Failed to regenerate report', 'error');
    }
  };

  const handleShareSummary = async (method: 'email' | 'copy' | 'direct') => {
    if (!currentReport) return;

    if (method === 'direct') {
      // Send email directly without opening email client
      if (!exportEmail || !exportEmail.includes('@')) {
        addToast('Please enter a valid email address', 'warning');
        return;
      }

      setIsSendingEmail(true);
      try {
        const result = await sendExecutiveSummaryEmail(currentReport, exportEmail);
        if (result.success) {
          addToast(result.message, 'success');
          setShowShareModal(false);
          setExportEmail('');
        } else {
          addToast(result.message, 'error');
        }
      } catch (error) {
        addToast('Failed to send email', 'error');
      } finally {
        setIsSendingEmail(false);
      }
    } else if (method === 'email') {
      shareExecutiveSummaryViaEmail(currentReport, exportEmail);
      addToast('Opening email client...', 'success');
      setShowShareModal(false);
    } else {
      copyExecutiveSummaryToClipboard(currentReport).then((success) => {
        if (success) {
          addToast('Summary copied to clipboard!', 'success');
        } else {
          addToast('Failed to copy', 'error');
        }
      });
      setShowShareModal(false);
    }
  };

  if (isLoading || isGenerating) {
    return (
      <div className="min-h-screen bg-background p-4">
        <LoadingCard
          message={isGenerating ? 'Generating report...' : 'Loading report...'}
        />
      </div>
    );
  }

  if (!currentReport) {
    return (
      <div className="min-h-screen bg-background p-4">
        <EmptyState
          icon={FileText}
          title="No Report Available"
          description="Complete a route to generate a report"
          action={{
            label: 'Go to Day Setup',
            onClick: () => navigate('/'),
          }}
        />
      </div>
    );
  }

  const { summary, stopReports } = currentReport;

  // Filter stops based on search and filter
  const filteredStops = stopReports.filter((report) => {
    // Apply status filter
    if (stopFilter !== 'all' && report.status !== stopFilter) {
      return false;
    }

    // Apply search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      return (
        report.address.toLowerCase().includes(query) ||
        (report.name && report.name.toLowerCase().includes(query))
      );
    }

    return true;
  });

  return (
    <div className="min-h-screen bg-background pb-8">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              className="p-2 -ml-2 rounded-lg hover:bg-slate-100"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div>
              <h1 className="font-semibold text-slate-900">Daily Report</h1>
              <p className="text-xs text-slate-500">
                {formatSmartDate(currentReport.date)}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowShareModal(true)}
              leftIcon={<Send className="w-4 h-4" />}
            >
              Send Summary
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowExportModal(true)}
              leftIcon={<Download className="w-4 h-4" />}
            >
              Export
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-3">
          <MetricCard icon={MapPin} label="Stops" value={summary.totalStops} />
          <MetricCard
            icon={CheckCircle}
            label="Done"
            value={summary.completedStops}
          />
          <MetricCard
            icon={Route}
            label="Distance"
            value={`${(summary.totalDistance * 0.621371).toFixed(1)}mi`}
          />
          <MetricCard
            icon={Clock}
            label="Time"
            value={formatDuration(summary.totalTime)}
          />
        </div>

        {/* Performance Stats */}
        <Card>
          <CardHeader title="Performance" subtitle="Today's efficiency metrics" />
          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-700">
                {summary.locationsPerHour}
              </p>
              <p className="text-xs text-primary-600">Locations per hour</p>
            </div>
            <div className="p-3 bg-primary-50 rounded-lg text-center">
              <p className="text-2xl font-bold text-primary-700">
                {formatDuration(summary.averageTimePerStop)}
              </p>
              <p className="text-xs text-primary-600">Avg. time per stop</p>
            </div>
          </div>
        </Card>

        {/* Trends */}
        {summary.trends.length > 0 && (
          <Card>
            <CardHeader title="Trends" />
            <div className="mt-4 space-y-2">
              {summary.trends.map((trend, index) => (
                <TrendCard
                  key={index}
                  label={trend.label}
                  value={String(trend.value)}
                  type={trend.type}
                />
              ))}
            </div>
          </Card>
        )}

        {/* AI Observations */}
        {summary.observations.length > 0 && (
          <Card>
            <CardHeader
              title="Key Observations"
              subtitle="AI-generated insights from your visits"
            />
            <div className="mt-4 space-y-3">
              {summary.observations.map((observation, index) => (
                <div
                  key={index}
                  className="flex items-start gap-3 text-sm text-slate-700"
                >
                  <TrendingUp className="w-4 h-4 text-primary-500 flex-shrink-0 mt-0.5" />
                  <p>{observation}</p>
                </div>
              ))}
            </div>
          </Card>
        )}

        {/* Flagged Issues */}
        {summary.flaggedIssues.length > 0 && (
          <Card>
            <CardHeader
              title="Flagged Issues"
              subtitle={`${summary.flaggedIssues.length} item(s) need attention`}
            />
            <div className="mt-4 space-y-2">
              {summary.flaggedIssues.map((issue, index) => (
                <IssueCard key={index} issue={issue} />
              ))}
            </div>
          </Card>
        )}

        {/* Stop Details */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-slate-900">Stop Details</h3>
            <span className="text-sm text-slate-500">
              {filteredStops.length} of {stopReports.length} stops
            </span>
          </div>

          {/* Search and Filter */}
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by address or name..."
                className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <XCircle className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filter tabs */}
          <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1">
            {(['all', 'completed', 'skipped'] as StopFilter[]).map((filter) => (
              <button
                key={filter}
                onClick={() => setStopFilter(filter)}
                className={clsx(
                  'flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
                  stopFilter === filter
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                )}
              >
                {filter === 'all' && `All (${stopReports.length})`}
                {filter === 'completed' &&
                  `Completed (${stopReports.filter((s) => s.status === 'completed').length})`}
                {filter === 'skipped' &&
                  `Skipped (${stopReports.filter((s) => s.status === 'skipped').length})`}
              </button>
            ))}
          </div>

          <div className="space-y-2">
            {filteredStops.length > 0 ? (
              filteredStops.map((report, index) => (
                <StopReportCard key={report.stopId} report={report} index={index} />
              ))
            ) : (
              <div className="text-center py-8 text-slate-500">
                <Filter className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p>No stops match your filter</p>
              </div>
            )}
          </div>
        </div>

        {/* Regenerate */}
        <div className="text-center">
          <Button
            variant="ghost"
            onClick={handleRegenerate}
            isLoading={isGenerating}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            Regenerate Report
          </Button>
        </div>
      </main>

      {/* Export Modal */}
      <Modal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        title="Export Report"
        size="sm"
      >
        <div className="space-y-3">
          <Button
            fullWidth
            variant="outline"
            onClick={() => handleExport('pdf')}
            isLoading={isExporting}
            leftIcon={<FileText className="w-4 h-4" />}
          >
            Download as PDF
          </Button>
          <Button
            fullWidth
            variant="outline"
            onClick={() => handleExport('csv')}
            isLoading={isExporting}
            leftIcon={<Table className="w-4 h-4" />}
          >
            Download as CSV
          </Button>
          <div className="pt-3 border-t border-slate-200">
            <Input
              label="Email Address (optional)"
              type="email"
              value={exportEmail}
              onChange={(e) => setExportEmail(e.target.value)}
              placeholder="recipient@email.com"
            />
            <Button
              fullWidth
              variant="outline"
              onClick={() => handleExport('email')}
              isLoading={isExporting}
              leftIcon={<Mail className="w-4 h-4" />}
              className="mt-3"
            >
              Share via Email
            </Button>
          </div>
        </div>
      </Modal>

      {/* Share Executive Summary Modal */}
      <Modal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        title="Share Executive Summary"
        size="sm"
      >
        <div className="space-y-4">
          <p className="text-sm text-slate-600">
            Share your AI-powered executive summary with key metrics, trends, and insights.
          </p>

          <Input
            label="Recipient Email"
            type="email"
            value={exportEmail}
            onChange={(e) => setExportEmail(e.target.value)}
            placeholder="manager@company.com"
          />

          <div className="space-y-2">
            {isEmailConfigured() ? (
              <Button
                fullWidth
                onClick={() => handleShareSummary('direct')}
                isLoading={isSendingEmail}
                leftIcon={<Send className="w-4 h-4" />}
                disabled={!exportEmail || !exportEmail.includes('@')}
              >
                Send Email Directly
              </Button>
            ) : (
              <Button
                fullWidth
                onClick={() => handleShareSummary('email')}
                leftIcon={<Mail className="w-4 h-4" />}
              >
                Send via Email Client
              </Button>
            )}
            <Button
              fullWidth
              variant="outline"
              onClick={() => handleShareSummary('copy')}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              Copy to Clipboard
            </Button>
          </div>

          <p className="text-xs text-slate-400 text-center">
            {isEmailConfigured()
              ? 'Email will be sent directly from the app.'
              : 'Opens your default email app to send the summary.'}
          </p>
        </div>
      </Modal>
    </div>
  );
}
