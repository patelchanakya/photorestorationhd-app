/**
 * Video Generation Types
 * Shared types for video generation across all services
 */

export interface VideoGenerationOptions {
  mode?: 'standard' | 'pro';
  duration?: number; // Allow any number, will be validated by backend
  negativePrompt?: string;
  subscriptionTier?: 'free' | 'pro';
}

export interface VideoProgress {
  phase: string;
  elapsedSeconds: number;
  estimatedTotalSeconds?: number;
}

export interface VideoStatus {
  status: 'starting' | 'processing' | 'completed' | 'failed' | 'canceled';
  progress?: VideoProgress;
  error?: string;
}