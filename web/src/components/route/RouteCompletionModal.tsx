import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  CheckCircle,
  Send,
  Copy,
  FileText,
  Home,
  Clock,
  MapPin,
  TrendingUp,
} from 'lucide-react';
import { Button, Modal, Input } from '../common';
import { useUIStore } from '../../stores/uiStore';
import {
  shareExecutiveSummaryViaEmail,
  copyExecutiveSummaryToClipboard,
} from '../../services/exportService';
import {
  sendExecutiveSummaryEmail,
  isEmailConfigured,
} from '../../services/emailService';
import type { DayReport } from '../../types';

export interface RouteCompletionModalProps {
  isOpen: boolean;
  onClose: () => void;
  report: DayReport | null;
  completedStops: number;
  totalStops: number;
  totalDistance?: number;
  totalTime?: number;
}

export function RouteCompletionModal({
  isOpen,
  onClose,
  report,
  completedStops,
  totalStops,
  totalDistance,
  totalTime,
}: RouteCompletionModalProps) {
  const navigate = useNavigate();
  const { addToast } = useUIStore();
  const [recipientEmail, setRecipientEmail] = useState('');
  const [isSendingSummary, setIsSendingSummary] = useState(false);

  const handleSendSummary = async () => {
    if (!report) {
      addToast('Report not ready yet', 'warning');
      return;
    }

    if (isEmailConfigured() && recipientEmail) {
      setIsSendingSummary(true);
      try {
        const result = await sendExecutiveSummaryEmail(report, recipientEmail);
        if (result.success) {
          addToast(result.message, 'success');
          setRecipientEmail('');
        } else {
          addToast(result.message, 'error');
        }
      } catch (error) {
        addToast('Failed to send summary', 'error');
      } finally {
        setIsSendingSummary(false);
      }
    } else {
      shareExecutiveSummaryViaEmail(report, recipientEmail);
      addToast('Opening email client...', 'success');
    }
  };

  const handleCopySummary = async () => {
    if (!report) {
      addToast('Report not ready yet', 'warning');
      return;
    }

    const success = await copyExecutiveSummaryToClipboard(report);
    if (success) {
      addToast('Summary copied to clipboard!', 'success');
    } else {
      addToast('Failed to copy summary', 'error');
    }
  };

  const handleViewReport = () => {
    onClose();
    navigate('/reports');
  };

  const handleGoHome = () => {
    onClose();
    navigate('/');
  };

  const completionRate = totalStops > 0 ? Math.round((completedStops / totalStops) * 100) : 0;
  const distanceMiles = totalDistance ? (totalDistance * 0.621371).toFixed(1) : null;
  const timeDisplay = totalTime ? `${Math.floor(totalTime / 60)}h ${totalTime % 60}m` : null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={() => {}}
      title="Route Complete!"
      size="sm"
    >
      <div className="space-y-4">
        {/* Success header */}
        <div className="text-center py-4">
          <div className="w-16 h-16 rounded-full bg-success-100 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-10 h-10 text-success-600" />
          </div>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">
            Great Work Today!
          </h3>
          <p className="text-slate-600 text-sm">
            You completed {completedStops} of {totalStops} stops.
          </p>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-2 bg-slate-50 rounded-lg p-3">
          <div className="text-center">
            <div className="flex items-center justify-center text-primary-600 mb-1">
              <TrendingUp className="w-4 h-4" />
            </div>
            <p className="text-lg font-bold text-slate-900">{completionRate}%</p>
            <p className="text-xs text-slate-500">Complete</p>
          </div>
          {distanceMiles && (
            <div className="text-center">
              <div className="flex items-center justify-center text-primary-600 mb-1">
                <MapPin className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-slate-900">{distanceMiles}</p>
              <p className="text-xs text-slate-500">Miles</p>
            </div>
          )}
          {timeDisplay && (
            <div className="text-center">
              <div className="flex items-center justify-center text-primary-600 mb-1">
                <Clock className="w-4 h-4" />
              </div>
              <p className="text-lg font-bold text-slate-900">{timeDisplay}</p>
              <p className="text-xs text-slate-500">Total Time</p>
            </div>
          )}
        </div>

        {/* Email and actions */}
        <div className="space-y-3">
          <div className="space-y-2">
            <Input
              label="Recipient Email"
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="manager@company.com"
            />

            <Button
              fullWidth
              onClick={handleSendSummary}
              isLoading={isSendingSummary}
              leftIcon={<Send className="w-4 h-4" />}
              disabled={!recipientEmail || !recipientEmail.includes('@')}
            >
              {isEmailConfigured() ? 'Send Email with PDF' : 'Send via Email Client'}
            </Button>

            {!isEmailConfigured() && (
              <p className="text-xs text-slate-400 text-center">
                Opens your default email app
              </p>
            )}
          </div>

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <Button
              fullWidth
              variant="outline"
              onClick={handleCopySummary}
              leftIcon={<Copy className="w-4 h-4" />}
            >
              Copy Summary to Clipboard
            </Button>

            <Button
              fullWidth
              variant="outline"
              onClick={handleViewReport}
              leftIcon={<FileText className="w-4 h-4" />}
            >
              View Full Report
            </Button>

            <Button
              fullWidth
              variant="ghost"
              onClick={handleGoHome}
              leftIcon={<Home className="w-4 h-4" />}
            >
              Back to Home
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
