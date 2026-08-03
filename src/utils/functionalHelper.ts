/**
 * CueBook Functional Programming Helpers
 * Designed with UNIX Philosophy (Do One Thing Well, Pipe/Combine) 
 * and ACID Principles (Consistency & Isolation for Pure State Transformations).
 */

/**
 * Formats a time in seconds into a structured string.
 * Curried for maximum flexibility, enabling custom separators and custom zero-padding.
 * Usage: formatTimeWith(':')(2)(seconds) -> "05:30"
 */
export const formatTimeWith = (separator: string) => (padDigits: number) => (totalSeconds: number): string => {
  const maxSec = Math.max(0, totalSeconds);
  const mins = Math.floor(maxSec / 60);
  const secs = Math.floor(maxSec % 60);
  const pad = (num: number) => num.toString().padStart(padDigits, '0');
  return `${pad(mins)}${separator}${pad(secs)}`;
};

/**
 * Pre-configured standard timer formatter.
 * Standard "MM:SS" colon format.
 */
export const formatMinutesSeconds = formatTimeWith(':')(2);

/**
 * Value threshold comparators.
 * Curried to allow clean, declarative composition of range checking.
 */
export const isLessThan = (limit: number) => (value: number): boolean => value < limit;
export const isGreaterThan = (limit: number) => (value: number): boolean => value > limit;

/**
 * Logical logical combiner helpers.
 * Allows piping predicates together without nested if-else structures (UNIX piping).
 */
export const and = <T>(f1: (x: T) => boolean, f2: (x: T) => boolean) => (value: T): boolean => f1(value) && f2(value);

/**
 * Custom composed state checker.
 * True if time is less than 60 seconds and greater than 0 seconds (the warning window).
 */
export const isWarningTime = and(isLessThan(60), isGreaterThan(0));

/**
 * Set membership predicate creator.
 * Curried function to test if a given candidate exists within a configuration list.
 * Great for clean selector UI components.
 */
export const isContainedIn = <T>(list: T[]) => (candidate: T): boolean => list.includes(candidate);
