import { format, formatDistanceToNow, isToday, isYesterday, parseISO } from 'date-fns';

/**
 * Format a date for display
 */
export function formatDate(date: Date | string, formatStr = 'PPP'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format time for display
 */
export function formatTime(date: Date | string, formatStr = 'p'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format date and time
 */
export function formatDateTime(date: Date | string, formatStr = 'PPp'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, formatStr);
}

/**
 * Format relative time (e.g., "5 minutes ago")
 */
export function formatRelativeTime(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true });
}

/**
 * Format smart date (Today, Yesterday, or date)
 */
export function formatSmartDate(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;

  if (isToday(d)) {
    return 'Today';
  }
  if (isYesterday(d)) {
    return 'Yesterday';
  }
  return format(d, 'MMM d, yyyy');
}

/**
 * Format duration in minutes to human readable string
 */
export function formatDuration(minutes: number): string {
  if (minutes < 1) {
    return '< 1 min';
  }
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (mins === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${mins}m`;
}

/**
 * Format duration in seconds
 */
export function formatDurationSeconds(seconds: number): string {
  return formatDuration(seconds / 60);
}

/**
 * Calculate time difference in minutes
 */
export function getTimeDifferenceMinutes(
  start: Date | string,
  end: Date | string
): number {
  const startDate = typeof start === 'string' ? parseISO(start) : start;
  const endDate = typeof end === 'string' ? parseISO(end) : end;

  return (endDate.getTime() - startDate.getTime()) / 1000 / 60;
}

/**
 * Get today's date as ISO string (YYYY-MM-DD)
 */
export function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Check if a date string is today
 */
export function isDateToday(dateString: string): boolean {
  return dateString === getTodayString();
}

/**
 * Format distance for display
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  const km = meters / 1000;
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}

/**
 * Format speed for display
 */
export function formatSpeed(metersPerSecond: number): string {
  const kmh = metersPerSecond * 3.6;
  return `${Math.round(kmh)} km/h`;
}

/**
 * Calculate ETA based on distance and average speed
 */
export function calculateETA(
  distanceMeters: number,
  avgSpeedKmh = 40
): {
  minutes: number;
  formatted: string;
  arrivalTime: Date;
} {
  const hours = distanceMeters / 1000 / avgSpeedKmh;
  const minutes = hours * 60;
  const arrivalTime = new Date(Date.now() + minutes * 60 * 1000);

  return {
    minutes,
    formatted: formatDuration(minutes),
    arrivalTime,
  };
}

/**
 * Get day of week name
 */
export function getDayOfWeek(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, 'EEEE');
}

/**
 * Get greeting based on time of day
 */
export function getGreeting(): string {
  const hour = new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }
  if (hour < 17) {
    return 'Good afternoon';
  }
  return 'Good evening';
}
