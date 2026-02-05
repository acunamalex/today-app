import type { Route, Stop, QuestionResponse } from '../types';

/**
 * Generate AI-powered insights from route data
 * In production, this would call an AI API (Claude, GPT, etc.)
 * For now, we use rule-based analysis
 */
export async function generateAIInsights(
  route: Route,
  stops: Stop[],
  responsesByStop: Record<string, QuestionResponse[]>
): Promise<string[]> {
  const observations: string[] = [];
  const allResponses = Object.values(responsesByStop).flat();

  // Completion analysis
  const completedStops = stops.filter((s) => s.status === 'completed');
  const completionRate = stops.length > 0
    ? (completedStops.length / stops.length) * 100
    : 0;

  if (completionRate === 100) {
    observations.push('All scheduled stops were successfully completed.');
  } else if (completionRate >= 80) {
    observations.push(
      `Strong completion rate of ${completionRate.toFixed(0)}% with ${stops.length - completedStops.length} stop(s) remaining.`
    );
  } else if (completionRate < 50) {
    observations.push(
      `Completion rate of ${completionRate.toFixed(0)}% indicates potential scheduling or access issues.`
    );
  }

  // Time analysis
  const stopTimes = completedStops
    .filter((s) => s.arrivedAt && s.departedAt)
    .map((s) => {
      const arrived = new Date(s.arrivedAt!).getTime();
      const departed = new Date(s.departedAt!).getTime();
      return (departed - arrived) / 1000 / 60; // minutes
    });

  if (stopTimes.length > 0) {
    const avgTime = stopTimes.reduce((a, b) => a + b, 0) / stopTimes.length;
    const maxTime = Math.max(...stopTimes);
    const minTime = Math.min(...stopTimes);

    if (maxTime > avgTime * 2) {
      observations.push(
        `One or more stops took significantly longer than average (${maxTime.toFixed(0)} min vs ${avgTime.toFixed(0)} min average).`
      );
    }

    if (avgTime < 5) {
      observations.push(
        'Average stop time was under 5 minutes, indicating efficient visits or quick tasks.'
      );
    } else if (avgTime > 30) {
      observations.push(
        `Average stop time of ${avgTime.toFixed(0)} minutes suggests complex or extended interactions.`
      );
    }
  }

  // Issue analysis
  const issueResponses = allResponses.filter(
    (r) =>
      r.type === 'yesNo' &&
      r.questionText.toLowerCase().includes('issue') &&
      r.value === true
  );

  if (issueResponses.length > 0) {
    const issueRate = (issueResponses.length / completedStops.length) * 100;
    if (issueRate > 50) {
      observations.push(
        `High issue rate: ${issueResponses.length} of ${completedStops.length} stops (${issueRate.toFixed(0)}%) reported problems.`
      );
    } else if (issueResponses.length > 0) {
      observations.push(
        `${issueResponses.length} stop(s) reported issues that may require follow-up.`
      );
    }
  } else if (completedStops.length > 0) {
    observations.push('No issues were reported during today\'s visits.');
  }

  // Follow-up analysis
  const followUpResponses = allResponses.filter(
    (r) =>
      r.type === 'yesNo' &&
      (r.questionText.toLowerCase().includes('follow-up') ||
        r.questionText.toLowerCase().includes('followup')) &&
      r.value === true
  );

  if (followUpResponses.length > 0) {
    observations.push(
      `${followUpResponses.length} location(s) require follow-up attention.`
    );
  }

  // Rating analysis
  const ratingResponses = allResponses.filter((r) => r.type === 'rating');
  if (ratingResponses.length > 0) {
    const avgRating =
      ratingResponses.reduce((sum, r) => sum + (Number(r.value) || 0), 0) /
      ratingResponses.length;

    if (avgRating >= 4.5) {
      observations.push(
        `Excellent customer satisfaction with an average rating of ${avgRating.toFixed(1)}/5.`
      );
    } else if (avgRating >= 4) {
      observations.push(
        `Good customer satisfaction (${avgRating.toFixed(1)}/5 average rating).`
      );
    } else if (avgRating < 3) {
      observations.push(
        `Customer satisfaction needs attention with ${avgRating.toFixed(1)}/5 average rating.`
      );
    }

    // Check for low ratings
    const lowRatings = ratingResponses.filter((r) => Number(r.value) <= 2);
    if (lowRatings.length > 0) {
      observations.push(
        `${lowRatings.length} stop(s) received low satisfaction ratings (2 or below).`
      );
    }
  }

  // Skipped stops analysis
  const skippedStops = stops.filter((s) => s.status === 'skipped');
  if (skippedStops.length > 0) {
    observations.push(
      `${skippedStops.length} stop(s) were skipped: ${skippedStops.map((s) => s.name || s.address).join(', ')}`
    );
  }

  // Photo documentation
  const photoResponses = allResponses.filter(
    (r) => r.type === 'photo' && r.imageData
  );
  if (photoResponses.length > 0) {
    observations.push(
      `${photoResponses.length} photo(s) documented across all visits.`
    );
  }

  // Signature collection
  const signatureResponses = allResponses.filter(
    (r) => r.type === 'signature' && r.imageData
  );
  if (signatureResponses.length > 0) {
    observations.push(
      `${signatureResponses.length} signature(s) collected.`
    );
  }

  // Route efficiency
  if (route.totalDistance > 0 && completedStops.length > 0) {
    const milesPerStop = route.totalDistance / 1609.34 / completedStops.length;
    if (milesPerStop > 6) {
      observations.push(
        `High travel distance per stop (${milesPerStop.toFixed(1)} mi) - consider optimizing route clustering.`
      );
    } else if (milesPerStop < 1.2) {
      observations.push(
        'Efficient route with stops clustered closely together.'
      );
    }
  }

  // Add default observation if none generated
  if (observations.length === 0) {
    observations.push('Route completed. Review individual stop details for more information.');
  }

  return observations;
}

/**
 * Generate a text summary for export
 */
export function generateTextSummary(
  route: Route,
  stops: Stop[],
  observations: string[]
): string {
  const completedStops = stops.filter((s) => s.status === 'completed');
  const skippedStops = stops.filter((s) => s.status === 'skipped');

  let summary = `DAILY ROUTE REPORT - ${new Date(route.date).toLocaleDateString()}\n`;
  summary += '═'.repeat(50) + '\n\n';

  summary += 'SUMMARY\n';
  summary += '-'.repeat(20) + '\n';
  summary += `Total Stops: ${stops.length}\n`;
  summary += `Completed: ${completedStops.length}\n`;
  summary += `Skipped: ${skippedStops.length}\n`;
  summary += `Total Distance: ${(route.totalDistance / 1609.34).toFixed(1)} mi\n`;
  summary += `Total Duration: ${Math.round(route.totalDuration / 60)} minutes\n\n`;

  summary += 'KEY OBSERVATIONS\n';
  summary += '-'.repeat(20) + '\n';
  observations.forEach((obs) => {
    summary += `• ${obs}\n`;
  });
  summary += '\n';

  summary += 'STOP DETAILS\n';
  summary += '-'.repeat(20) + '\n';
  stops.forEach((stop, index) => {
    summary += `\n${index + 1}. ${stop.name || stop.address}\n`;
    summary += `   Status: ${stop.status}\n`;
    if (stop.arrivedAt) {
      summary += `   Arrived: ${new Date(stop.arrivedAt).toLocaleTimeString()}\n`;
    }
    if (stop.departedAt) {
      summary += `   Departed: ${new Date(stop.departedAt).toLocaleTimeString()}\n`;
    }
  });

  summary += '\n' + '═'.repeat(50) + '\n';
  summary += `Generated by Today App - ${new Date().toLocaleString()}\n`;

  return summary;
}
