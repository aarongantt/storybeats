import type { FriendlyError } from '../services/ai/errorMapping';
import { Button } from './ui/Button';

interface Props {
  error: FriendlyError;
  onRetry?: () => void;
  onDismiss?: () => void;
  className?: string;
}

/**
 * Inline error banner used by screens and components to surface AI failures
 * consistently. Pairs with toFriendlyError() in services/ai/errorMapping.
 */
export function ErrorBanner({ error, onRetry, onDismiss, className = '' }: Props) {
  return (
    <div
      role="alert"
      className={`p-3 bg-red-900/30 border border-red-700/60 rounded-lg text-sm ${className}`}
    >
      <p className="text-red-200 mb-2">{error.message}</p>
      <div className="flex gap-2">
        {error.canRetry && onRetry && (
          <Button size="sm" variant="outline" onClick={onRetry}>
            Retry
          </Button>
        )}
        {onDismiss && (
          <Button size="sm" variant="ghost" onClick={onDismiss}>
            Dismiss
          </Button>
        )}
      </div>
    </div>
  );
}
