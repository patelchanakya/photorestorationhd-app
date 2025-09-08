import React, { createContext, useState, ReactNode, use } from 'react';

export interface JobState {
  id: string;
  type: 'photo' | 'video';
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  imageUri?: string;
  startTime: number;
  estimatedDuration: number; // in seconds
  resultId?: string;
}

interface JobContextType {
  activeJob: JobState | null;
  startJob: (job: Omit<JobState, 'status' | 'startTime'>) => void;
  updateJobProgress: (progress: number) => void;
  completeJob: (resultId: string) => void;
  failJob: (error?: string) => void;
  clearJob: () => void;
  cancelJob: () => void;
  canStartNewJob: () => boolean;
  getTimeRemaining: () => number;
}

const JobContext = createContext<JobContextType | undefined>(undefined);

export function JobProvider({ children }: { children: ReactNode }) {
  const [activeJob, setActiveJob] = useState<JobState | null>(null);

  const startJob = (job: Omit<JobState, 'status' | 'startTime'>) => {
    setActiveJob({
      ...job,
      status: 'processing',
      startTime: Date.now(),
    });
  };

  const updateJobProgress = (progress: number) => {
    setActiveJob(prev => 
      prev ? { ...prev, progress } : null
    );
  };

  const completeJob = (resultId: string) => {
    setActiveJob(prev => 
      prev ? { ...prev, status: 'completed', resultId, progress: 100 } : null
    );
  };

  const failJob = (error?: string) => {
    setActiveJob(prev => 
      prev ? { ...prev, status: 'failed', progress: 0 } : null
    );
  };

  const clearJob = () => {
    setActiveJob(null);
  };

  const cancelJob = () => {
    setActiveJob(prev => 
      prev ? { ...prev, status: 'failed', progress: 0 } : null
    );
  };

  const canStartNewJob = () => {
    return !activeJob || activeJob.status === 'completed' || activeJob.status === 'failed';
  };

  const getTimeRemaining = (): number => {
    if (!activeJob || activeJob.status !== 'processing') return 0;
    
    const elapsed = (Date.now() - activeJob.startTime) / 1000;
    const remaining = Math.max(0, activeJob.estimatedDuration - elapsed);
    return Math.ceil(remaining);
  };

  return (
    <JobContext.Provider value={{
      activeJob,
      startJob,
      updateJobProgress,
      completeJob,
      failJob,
      clearJob,
      cancelJob,
      canStartNewJob,
      getTimeRemaining,
    }}>
      {children}
    </JobContext.Provider>
  );
}

export function useJob() {
  const context = use(JobContext);
  if (!context) {
    throw new Error('useJob must be used within a JobProvider');
  }
  return context;
}