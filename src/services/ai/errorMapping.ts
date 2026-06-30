import {
  OpenAITimeoutError,
  OpenAIRateLimitError,
  OpenAIValidationError,
  OpenAIAuthError,
  OpenAIServerError,
} from './retry';

export interface FriendlyError {
  message: string;
  canRetry: boolean;
}

/**
 * Map any thrown error (from OpenAI calls or otherwise) into a
 * user-facing message + whether retry is sensible. Used by screen-level
 * error banners so the same failure renders identically everywhere.
 */
export function toFriendlyError(error: unknown): FriendlyError {
  if (error instanceof OpenAITimeoutError) {
    return { message: 'The AI is taking too long. Try again?', canRetry: true };
  }
  if (error instanceof OpenAIRateLimitError) {
    return { message: 'Rate limit hit. Wait a moment and try again.', canRetry: true };
  }
  if (error instanceof OpenAIValidationError) {
    return { message: 'The AI returned an unexpected response. Try again?', canRetry: true };
  }
  if (error instanceof OpenAIAuthError) {
    return { message: 'Your API key is invalid. Please reset it.', canRetry: false };
  }
  if (error instanceof OpenAIServerError) {
    return { message: 'OpenAI is having trouble right now. Try again?', canRetry: true };
  }
  if (error instanceof Error) return { message: error.message, canRetry: true };
  return { message: 'Something went wrong. Try again?', canRetry: true };
}
