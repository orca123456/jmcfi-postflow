import type { ReactNode } from 'react';

export interface LoginAssistantNotice {
  id: number;
  message: string;
}

export interface AuthExperienceProps {
  children: ReactNode;
  departing?: boolean;
  onDepartureComplete?: () => void;
  assistantNotice?: LoginAssistantNotice | null;
  lockSeconds?: number;
}
