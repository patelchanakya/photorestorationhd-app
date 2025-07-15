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
  status: 'pending' | 'processing' | 'completed' | 'failed';
  processing_time_ms?: number;
  created_at: string;
  completed_at?: string;
  error_message?: string;
  prediction_id?: string;
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