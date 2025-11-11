import React from 'react';
import toast from 'react-hot-toast';

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    style: {
      background: '#10b981',
      color: '#fff',
      fontWeight: 500,
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#10b981',
    },
  });
};

export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    style: {
      background: '#ef4444',
      color: '#fff',
      fontWeight: 500,
    },
    iconTheme: {
      primary: '#fff',
      secondary: '#ef4444',
    },
  });
};

export const showUndo = (message: string, onUndo: () => void) => {
  toast(
    (t) => (
      <div className="flex items-center gap-3">
        <span className="flex-1">{message}</span>
        <button
          onClick={() => {
            toast.dismiss(t.id);
            onUndo();
          }}
          className="px-3 py-1 text-sm font-medium text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors"
        >
          Undo
        </button>
      </div>
    ),
    {
      duration: 5000,
      style: {
        background: '#1f2937',
        color: '#fff',
        fontWeight: 500,
        minWidth: '350px',
      },
    }
  );
};

export const showLoading = (message: string) => {
  return toast.loading(message, {
    style: {
      background: '#3b82f6',
      color: '#fff',
      fontWeight: 500,
    },
  });
};

export const dismissToast = (toastId: string) => {
  toast.dismiss(toastId);
};
