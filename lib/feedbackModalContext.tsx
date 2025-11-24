// Context for opening Feedback modal from anywhere in the app
'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

interface FeedbackModalData {
  showName: string;
  shotName: string;
  shotTag: string;
  version?: string;
  department: string;
  status: string;
  taskId?: string;
}

interface FeedbackModalContextType {
  openFeedbackModal: (data: FeedbackModalData) => void;
  closeFeedbackModal: () => void;
  isOpen: boolean;
  prefilledData: FeedbackModalData | null;
}

const FeedbackModalContext = createContext<FeedbackModalContextType | undefined>(undefined);

export function FeedbackModalProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const [prefilledData, setPrefilledData] = useState<FeedbackModalData | null>(null);

  const openFeedbackModal = (data: FeedbackModalData) => {
    setPrefilledData(data);
    setIsOpen(true);
  };

  const closeFeedbackModal = () => {
    setIsOpen(false);
    // Clear data after a short delay to allow closing animation
    setTimeout(() => setPrefilledData(null), 300);
  };

  return (
    <FeedbackModalContext.Provider value={{ openFeedbackModal, closeFeedbackModal, isOpen, prefilledData }}>
      {children}
    </FeedbackModalContext.Provider>
  );
}

export function useFeedbackModal() {
  const context = useContext(FeedbackModalContext);
  if (!context) {
    throw new Error('useFeedbackModal must be used within FeedbackModalProvider');
  }
  return context;
}
