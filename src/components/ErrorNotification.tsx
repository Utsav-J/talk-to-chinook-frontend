import { useEffect } from 'react';
import './ErrorNotification.css';

interface ErrorNotificationProps {
  message: string;
  onClose: () => void;
  duration?: number;
}

export function ErrorNotification({ message, onClose, duration = 5000 }: ErrorNotificationProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(onClose, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  return (
    <div className="error-notification" role="alert">
      <div className="error-content">
        <span className="error-icon">⚠️</span>
        <span className="error-message">{message}</span>
      </div>
      <button className="error-close" onClick={onClose} aria-label="Close error">
        ×
      </button>
    </div>
  );
}

