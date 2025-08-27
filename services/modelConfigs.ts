export interface ModelConfig {
  model: string;
  buildInput: (base64: string, customPrompt?: string) => Record<string, any>;
  isVideo?: boolean;
}

export type FunctionType = 'restoration' | 'repair' | 'unblur' | 'colorize' | 'descratch' | 'outfit' | 'background' | 'enlighten' | 'custom' | 'restore_repair';

export const MODEL_CONFIGS: Record<FunctionType, ModelConfig> = {
  restoration: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: "repair and restore this damaged photo, fix tears, scratches, stains, and imperfections while preserving all facial features",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 0,
      prompt_upsampling: true
    })
  },
  repair: {
    model: "flux-kontext-apps/restore-image",
    buildInput: (base64: string) => ({
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      safety_tolerance: 0
    })
  },
  unblur: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: "Remove blur and restore clarity to the image. Sharpen details so that edges, textures, and facial features are clear and natural. Keep the original colors and tones exactly as they are, without altering or enhancing them. Preserve the background and overall composition.",
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
      prompt: "apply photo restoration and repair, enhance and improve colors throughout the image, and upscale the final image without losing any specific facial feature or adding anything extra",
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
      prompt: "Remove all scratches, stains, and visible damage from the image. Repair damaged areas so they blend seamlessly with the surrounding texture, lighting, and shading. Keep the original colors and tones exactly as they are, without altering or enhancing them. Preserve all facial features, background, and composition.",
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
      prompt: "change only the clothing and outfit, keep the exact same face, facial features, hair, pose, body position, and background unchanged, professional business attire",
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
      prompt: "replace only the background with professional studio setting, keep the exact same person, face, facial features, hair, clothing, pose, and body position unchanged",
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
      prompt: "Increase the brightness of the image while keeping all original colors, tones, and saturation exactly as they are. Do not alter contrast, style, or composition. Preserve all facial features, fine details, background, and overall layout.",
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
  },
  restore_repair: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string, customPrompt?: string) => ({
      prompt: "Repair damage and restore the photograph to its original quality. Fill in dark or obscured areas naturally, while preserving facial features and overall authenticity.",
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