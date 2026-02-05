import { clsx } from 'clsx';
import { GripVertical, MapPin, Clock, Trash2, Navigation, CheckCircle, XCircle } from 'lucide-react';
import type { Stop } from '../../types';
import { StatusBadge } from '../common';
import { formatDuration, formatDistance } from '../../services/geocodeService';

export interface StopCardProps {
  stop: Stop;
  index: number;
  isActive?: boolean;
  isDragging?: boolean;
  estimatedDuration?: number;
  estimatedDistance?: number;
  onRemove?: () => void;
  onClick?: () => void;
  onNavigate?: () => void;
  dragHandleProps?: any;
  showActions?: boolean;
}

export function StopCard({
  stop,
  index,
  isActive = false,
  isDragging = false,
  estimatedDuration,
  estimatedDistance,
  onRemove,
  onClick,
  onNavigate,
  dragHandleProps,
  showActions = true,
}: StopCardProps) {
  const getStatusIcon = () => {
    switch (stop.status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-success-500" />;
      case 'skipped':
        return <XCircle className="w-5 h-5 text-warning-500" />;
      case 'in_progress':
        return (
          <div className="w-5 h-5 rounded-full border-2 border-primary-500 border-t-transparent animate-spin" />
        );
      default:
        return (
          <div className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center">
            <span className="text-xs font-medium text-slate-600">{index + 1}</span>
          </div>
        );
    }
  };

  return (
    <div
      className={clsx(
        'group flex items-stretch gap-3 p-4 bg-white rounded-xl border transition-all duration-200',
        isDragging && 'shadow-lg scale-[1.02]',
        isActive
          ? 'border-primary-500 ring-2 ring-primary-100'
          : 'border-slate-200 hover:border-slate-300',
        onClick && 'cursor-pointer'
      )}
      onClick={onClick}
    >
      {/* Drag Handle */}
      {dragHandleProps && (
        <div
          {...dragHandleProps}
          className="flex items-center px-1 -ml-2 cursor-grab active:cursor-grabbing text-slate-400 hover:text-slate-600 touch-none"
        >
          <GripVertical className="w-5 h-5" />
        </div>
      )}

      {/* Status/Index indicator */}
      <div className="flex-shrink-0 flex items-center">
        {getStatusIcon()}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            {stop.name && (
              <h4 className="font-medium text-slate-900 truncate">
                {stop.name}
              </h4>
            )}
            <p
              className={clsx(
                'flex items-center gap-1 truncate',
                stop.name ? 'text-sm text-slate-500' : 'font-medium text-slate-900'
              )}
            >
              <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
              {stop.address}
            </p>
          </div>
          <StatusBadge status={stop.status} size="sm" />
        </div>

        {/* Estimated time/distance */}
        {(estimatedDuration || estimatedDistance) && (
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            {estimatedDuration && (
              <span className="flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {formatDuration(estimatedDuration)}
              </span>
            )}
            {estimatedDistance && (
              <span>{formatDistance(estimatedDistance)}</span>
            )}
          </div>
        )}

        {/* Time info for completed stops */}
        {stop.arrivedAt && (
          <div className="flex items-center gap-3 mt-2 text-xs text-slate-500">
            <span>
              Arrived: {new Date(stop.arrivedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
            {stop.departedAt && (
              <span>
                Left: {new Date(stop.departedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Actions */}
      {showActions && (
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {onNavigate && stop.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onNavigate();
              }}
              className="p-2 rounded-lg text-primary-600 hover:bg-primary-50 transition-colors"
              title="Navigate"
            >
              <Navigation className="w-4 h-4" />
            </button>
          )}
          {onRemove && stop.status === 'pending' && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="p-2 rounded-lg text-danger-500 hover:bg-danger-50 transition-colors"
              title="Remove"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
