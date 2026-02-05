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
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { useRouteStore } from '../stores/routeStore';
import { useReportStore } from '../stores/reportStore';
import { useUIStore } from '../stores/uiStore';
import { exportReport } from '../services/exportService';
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

export function Reports() {
  const navigate = useNavigate();
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportEmail, setExportEmail] = useState('');
  const [isExporting, setIsExporting] = useState(false);

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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowExportModal(true)}
            leftIcon={<Download className="w-4 h-4" />}
          >
            Export
          </Button>
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
            value={`${summary.totalDistance}km`}
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
          <h3 className="font-semibold text-slate-900 mb-3">Stop Details</h3>
          <div className="space-y-2">
            {stopReports.map((report, index) => (
              <StopReportCard key={report.stopId} report={report} index={index} />
            ))}
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
    </div>
  );
}
