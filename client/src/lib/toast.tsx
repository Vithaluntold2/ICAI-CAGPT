/**
 * Modern Toast Notification System using Sonner
 * 
 * Replace the current toast system with sonner for:
 * - Beautiful animations
 * - Better accessibility
 * - Stacking notifications
 * - Promise-based notifications
 * - Rich content support
 */

import { toast as sonnerToast, Toaster } from 'sonner';

export type ToastType = 'success' | 'error' | 'warning' | 'info' | 'loading' | 'promise';

interface ToastOptions {
  description?: string;
  duration?: number;
  action?: {
    label: string;
    onClick: () => void;
  };
  cancel?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Modern toast notification helper
 */
export const toast = {
  success: (message: string, options?: ToastOptions) => {
    return sonnerToast.success(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  error: (message: string, options?: ToastOptions) => {
    return sonnerToast.error(message, {
      description: options?.description,
      duration: options?.duration || 5000,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  warning: (message: string, options?: ToastOptions) => {
    return sonnerToast.warning(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  info: (message: string, options?: ToastOptions) => {
    return sonnerToast.info(message, {
      description: options?.description,
      duration: options?.duration || 4000,
      action: options?.action,
      cancel: options?.cancel,
    });
  },

  loading: (message: string) => {
    return sonnerToast.loading(message);
  },

  /**
   * Promise-based toast for async operations
   * Automatically shows loading, then success/error based on promise result
   */
  promise: <T,>(
    promise: Promise<T>,
    messages: {
      loading: string;
      success: string | ((data: T) => string);
      error: string | ((error: any) => string);
    }
  ) => {
    return sonnerToast.promise(promise, messages);
  },

  /**
   * Custom toast with rich content
   */
  custom: (component: React.ReactNode | ((id: string | number) => React.ReactElement)) => {
    return sonnerToast.custom(component as any);
  },

  /**
   * Dismiss a toast by ID
   */
  dismiss: (id?: string | number) => {
    sonnerToast.dismiss(id);
  },
};

/**
 * Toast Provider Component
 * Add this to your App.tsx root
 */
export function ToastProvider() {
  return (
    <Toaster
      position="top-right"
      expand={false}
      richColors={true}
      closeButton={true}
      toastOptions={{
        className: 'font-sans',
        style: {
          background: 'hsl(var(--background))',
          color: 'hsl(var(--foreground))',
          border: '1px solid hsl(var(--border))',
        },
      }}
    />
  );
}

/**
 * Example Usage:
 * 
 * // Simple success
 * toast.success("Document uploaded successfully!");
 * 
 * // With description and action
 * toast.error("Failed to save changes", {
 *   description: "Your session may have expired",
 *   action: {
 *     label: "Retry",
 *     onClick: () => handleRetry()
 *   }
 * });
 * 
 * // Promise-based
 * toast.promise(
 *   fetch('/api/upload').then(r => r.json()),
 *   {
 *     loading: 'Uploading document...',
 *     success: (data) => `${data.filename} uploaded!`,
 *     error: 'Upload failed'
 *   }
 * );
 * 
 * // Loading state
 * const toastId = toast.loading("Processing...");
 * // Later...
 * toast.dismiss(toastId);
 * toast.success("Done!");
 */
