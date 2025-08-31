export interface User {
  id: string;
  email: string;
  created_at: string;
}

export interface Restoration {
  id: string;
  user_id: string;
  original_filename: string;
  restored_filename?: string;
  thumbnail_filename?: string;
  video_filename?: string;
  // Add Replicate URLs for immediate display before local saving
  replicate_url?: string;
  video_replicate_url?: string;
  // Track if local files are ready
  local_files_ready?: boolean;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_time_ms?: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  prediction_id?: string;
  function_type?: 'restoration' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'repair' | 'enlighten' | 'custom';
  custom_prompt?: string; // Add custom_prompt field for Photo Magic detection
  is_video?: boolean;
}

export interface RestorationInput {
  imageUri: string;
  userId: string;
}

export interface ProcessingStatus {
  status: 'idle' | 'uploading' | 'processing' | 'completed' | 'failed';
  progress?: number;
  error?: string;
}

export interface PhotoData {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}