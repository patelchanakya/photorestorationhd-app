export interface ModelConfig {
  model: string;
  buildInput: (base64: string) => Record<string, any>;
}

export type FunctionType = 'restoration' | 'unblur' | 'colorize' | 'descratch';

export const MODEL_CONFIGS: Record<FunctionType, ModelConfig> = {
  restoration: {
    model: "flux-kontext-apps/restore-image",
    buildInput: (base64: string) => ({
      input_image: `data:image/jpeg;base64,${base64}`
    })
  },
  unblur: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string) => ({
      prompt: "sharpen and unblur this image, enhance clarity and focus without losing any facial features or adding anything extra",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: true
    })
  },
  colorize: {
    model: "black-forest-labs/flux-kontext-pro",
    buildInput: (base64: string) => ({
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
    buildInput: (base64: string) => ({
      prompt: "remove scratches, dust, stains, and damage from this image while preserving all facial features and original details without adding anything extra",
      input_image: `data:image/jpeg;base64,${base64}`,
      output_format: "png",
      aspect_ratio: "match_input_image",
      safety_tolerance: 6,
      prompt_upsampling: false
    })
  }
};

export const getModelConfig = (functionType: FunctionType): ModelConfig => {
  const config = MODEL_CONFIGS[functionType];
  if (!config) {
    throw new Error(`Unsupported function type: ${functionType}`);
  }
  return config;
};