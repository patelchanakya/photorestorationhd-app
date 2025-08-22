/**
 * Centralized video animation prompts
 * Single source of truth for all video generation prompts
 */

// Standard animation prompts used throughout the app
export const ANIMATION_PROMPTS = {
  'bring this photo to life with natural animation': 'Life',
  'animate with a friendly wave': 'Wave', 
  'animate with a warm hug gesture': 'Hug',
  'animate as a group celebration': 'Celebrate',
  'animate with love and affection': 'Love',
  'animate with dancing movements': 'Dance',
  'animate with fun and playful movements': 'Fun',
  'animate with a warm smile': 'Smile'
} as const;

// Type for animation prompt keys
export type AnimationPromptKey = keyof typeof ANIMATION_PROMPTS;

// Default prompt used when no specific prompt is provided
export const DEFAULT_ANIMATION_PROMPT: AnimationPromptKey = 'bring this photo to life with natural animation';

// Get display name for a prompt
export function getPromptDisplayName(prompt: string): string {
  return ANIMATION_PROMPTS[prompt as AnimationPromptKey] || 'Custom';
}

// Validate if a prompt is supported
export function isValidPrompt(prompt: string): prompt is AnimationPromptKey {
  return prompt in ANIMATION_PROMPTS;
}

// Get all available prompt keys
export function getAllPromptKeys(): AnimationPromptKey[] {
  return Object.keys(ANIMATION_PROMPTS) as AnimationPromptKey[];
}