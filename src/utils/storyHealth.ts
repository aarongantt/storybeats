import type { Beat, StoryHealth } from '../types/story';

/**
 * Calculate story health metrics based on beat emotional data
 */
export function calculateStoryHealth(beats: Beat[]): StoryHealth | null {
  const completedBeats = beats.filter(b => b.emotionalData);

  // Need at least 3 beats to calculate health
  if (completedBeats.length < 3) {
    return null;
  }

  // 1. Overall Tension: average of all tension values
  const avgTension = completedBeats.reduce((sum, b) =>
    sum + b.emotionalData!.tension, 0
  ) / completedBeats.length;

  // 2. Emotional Variety: how many different tones used
  const toneSet = new Set(completedBeats.map(b => b.selectedTone));
  const emotionalVariety = (toneSet.size / 4) * 10; // 4 possible tones

  // 3. Arc Consistency: check if intensity flows smoothly (not too jagged)
  const intensities = completedBeats
    .sort((a, b) => a.number - b.number)
    .map(b => b.emotionalData!.intensity);

  const differences = intensities.slice(1).map((val, i) =>
    Math.abs(val - intensities[i])
  );
  const avgDifference = differences.reduce((sum, d) => sum + d, 0) / (differences.length || 1);
  const arcConsistency = Math.max(0, 10 - avgDifference); // Lower difference = higher consistency

  // 4. Check structural requirements
  const hasProperBeginning = beats[0]?.emotionalData !== undefined;
  const hasClimacticMoment = completedBeats.some(b => b.emotionalData!.tension >= 9);

  return {
    overallTension: Math.round(avgTension * 10) / 10,
    emotionalVariety: Math.round(emotionalVariety * 10) / 10,
    arcConsistency: Math.round(arcConsistency * 10) / 10,
    hasProperBeginning,
    hasClimacticMoment,
    recommendations: [], // Will be populated by AI later if needed
  };
}
