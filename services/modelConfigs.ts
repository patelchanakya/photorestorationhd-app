export interface ModelConfig {
  model: string;
  buildInput: (base64: string, customPrompt?: string) => Record<string, any>;
}

export type FunctionType = 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'backtolife' | 'enlighten' | 'custom';

export const MODEL_CONFIGS: Record<FunctionType, ModelConfig> = {
  restoration: {
    model: "flux-kontext-apps/restore-image",
    buildInput: (base64: string) => ({
      input_image: `data:image/jpeg;base64,${base64}`
    })
  },
  repair: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "repair and restore this damaged photo, fix tears, scratches, stains, and imperfections while preserving all original details and facial features",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  unblur: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "enhance and restore this image, sharpen and unblur, improve clarity and focus without losing any facial features or adding anything extra",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  colorize: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "apply photo restoration and repair, enhance and improve colors throughout the image, and upscale the final image without losing any specific facial feature or adding anything extra",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  descratch: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "remove scratches, dust, stains, and damage from this image while preserving all facial features and original details without adding anything extra",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: false
    })
  },
  outfit: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "change only the clothing and outfit, keep the exact same face, facial features, hair, pose, body position, and background unchanged, professional business attire",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  background: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "replace only the background with professional studio setting, keep the exact same person, face, facial features, hair, clothing, pose, and body position unchanged",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  backtolife: {
    model: "black-forest-labs/flux-kontext-pro", // Placeholder - will be replaced with proper video API
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "bring this photo to life with natural animation",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  enlighten: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "fix lighting and exposure, enhance shadows and highlights, improve overall illumination",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  custom: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: customPrompt || "enhance this image",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  }
};

export const getModelConfig = (functionType: FunctionType): ModelConfig => {
  const config = MODEL_CONFIGS[functionType];
  if (!config) {
    // Fallback to custom type for unknown function types
    return MODEL_CONFIGS.custom;
  }
  return config;
};