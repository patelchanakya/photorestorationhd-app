import * as FileSystem from 'expo-file-system';
import * as ImageManipulator from 'expo-image-manipulator';
import * as MediaLibrary from 'expo-media-library';
import { PhotoData, Restoration } from '../types';

class PhotoStorage {
  private basePath: string;

  constructor() {
    this.basePath = `${FileSystem.documentDirectory}restorations/`;
    this.initializeStorage();
  }

  // Initialize storage directories
  private async initializeStorage() {
    try {
      const directories = ['originals', 'restored', 'thumbnails', 'videos'];
      
      // Ensure base directory exists
      const baseInfo = await FileSystem.getInfoAsync(this.basePath);
      if (!baseInfo.exists) {
        await FileSystem.makeDirectoryAsync(this.basePath, { intermediates: true });
      }
      
      for (const dir of directories) {
        const dirPath = `${this.basePath}${dir}/`;
        const dirInfo = await FileSystem.getInfoAsync(dirPath);
        
        if (!dirInfo.exists) {
          await FileSystem.makeDirectoryAsync(dirPath, { intermediates: true });
          if (__DEV__) {
            console.log(`✅ Created directory: ${dirPath}`);
          }
        }
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to initialize storage directories:', error);
      }
    }
  }

  // Save original photo
  async saveOriginal(uri: string): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      const fileName = `clever_${Date.now()}.jpg`;
      const destination = `${this.basePath}originals/${fileName}`;
      
      await FileSystem.copyAsync({
        from: uri,
        to: destination
      });
      
      if (__DEV__) {
        console.log(`✅ Saved original photo: ${fileName}`);
      }
      return fileName;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save original photo:', error);
      }
      throw error;
    }
  }

  // Save restored photo from URL
  async saveRestored(url: string, originalFileName: string): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      // Keep the same prefix pattern to avoid breaking existing restorations
      const fileName = originalFileName.includes('pastpix_') 
        ? originalFileName.replace('pastpix_', 'pastpix_restored_')
        : originalFileName.replace('clever_', 'clever_restored_');
      const destination = `${this.basePath}restored/${fileName}`;
      
      if (__DEV__) {
        console.log(`⬇️ Downloading restored photo from: ${url}`);
      }
      const result = await FileSystem.downloadAsync(url, destination);
      
      if (result.status === 200) {
        if (__DEV__) {
          console.log(`✅ Saved restored photo: ${fileName}`);
        }
        return fileName;
      } else {
        throw new Error(`Download failed with status: ${result.status}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save restored photo:', error);
      }
      throw error;
    }
  }

  // Save video from URL
  async saveVideo(url: string, originalFileName: string): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      // Create video filename based on original
      const fileName = originalFileName.includes('pastpix_') 
        ? originalFileName.replace('pastpix_', 'pastpix_video_').replace('.jpg', '.mp4')
        : originalFileName.replace('clever_', 'clever_video_').replace('.jpg', '.mp4');
      const destination = `${this.basePath}videos/${fileName}`;
      
      if (__DEV__) {
        console.log(`⬇️ Downloading video from: ${url}`);
      }
      const result = await FileSystem.downloadAsync(url, destination);
      
      if (result.status === 200) {
        if (__DEV__) {
          console.log(`✅ Saved video: ${fileName}`);
        }
        return fileName;
      } else {
        throw new Error(`Video download failed with status: ${result.status}`);
      }
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to save video:', error);
      }
      throw error;
    }
  }

  // Generate and save thumbnail
  async createThumbnail(uri: string, type: 'original' | 'restored'): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      // Check if source file exists
      const sourceInfo = await FileSystem.getInfoAsync(uri);
      if (!sourceInfo.exists) {
        throw new Error(`Source file does not exist: ${uri}`);
      }
      
      const fileName = `clever_thumb_${type}_${Date.now()}.jpg`;
      const destination = `${this.basePath}thumbnails/${fileName}`;
      
      // Create a small thumbnail (300px wide)
      const result = await ImageManipulator.manipulateAsync(
        uri,
        [{ resize: { width: 300 } }],
        { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG }
      );
      
      await FileSystem.copyAsync({
        from: result.uri,
        to: destination
      });
      
      if (__DEV__) {
        console.log(`✅ Created thumbnail: ${fileName}`);
      }
      return fileName;
    } catch (error) {
      if (__DEV__) {
        console.error('Failed to create thumbnail:', error);
      }
      throw error;
    }
  }

  // Get full URI for a stored photo or video
  getPhotoUri(type: 'original' | 'restored' | 'thumbnail' | 'video', filename: string): string {
    const folder = type === 'thumbnail' ? 'thumbnails' : 
                   type === 'restored' ? 'restored' : 
                   type === 'video' ? 'videos' : 'originals';
    const uri = `${this.basePath}${folder}/${filename}`;
    return uri;
  }
  
  // Check if a photo or video file exists
  async checkPhotoExists(type: 'original' | 'restored' | 'thumbnail' | 'video', filename: string): Promise<boolean> {
    try {
      const uri = this.getPhotoUri(type, filename);
      const info = await FileSystem.getInfoAsync(uri);
      return info.exists;
    } catch (error) {
      return false;
    }
  }

  // Delete a photo and its associated files
  async deleteRestoration(restoration: Restoration): Promise<void> {
    const filesToDelete = [
      restoration.original_filename && this.getPhotoUri('original', restoration.original_filename),
      restoration.restored_filename && this.getPhotoUri('restored', restoration.restored_filename),
      restoration.thumbnail_filename && this.getPhotoUri('thumbnail', restoration.thumbnail_filename),
    ].filter(Boolean) as string[];

    await Promise.all(
      filesToDelete.map(async (uri) => {
        try {
          await FileSystem.deleteAsync(uri);
        } catch (error) {
          if (__DEV__) {
            console.warn('Failed to delete file:', uri, error);
          }
        }
      })
    );
  }

  // Save local video file (for mock/local videos)
  async saveLocalVideo(videoUri: string, originalImageId: string): Promise<string> {
    try {
      await this.initializeStorage();
      
      const fileName = `video_${originalImageId}_${Date.now()}.mp4`;
      const destination = `${this.basePath}videos/${fileName}`;
      
      // Copy video to local storage
      await FileSystem.copyAsync({
        from: videoUri,
        to: destination
      });
      
      if (__DEV__) {
        console.log('✅ Local video saved to storage:', destination);
      }
      
      return destination;
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to save local video:', error);
      }
      throw new Error('Failed to save video. Please try again.');
    }
  }

  // Export video to camera roll
  async exportVideoToCameraRoll(uri: string): Promise<void> {
    if (__DEV__) {
      console.log('🔄 Starting video export to camera roll:', uri);
    }
    
    try {
      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        throw new Error('Video file not found. Please try again.');
      }

      // Check/request permissions
      let { status } = await MediaLibrary.getPermissionsAsync();
      if (status !== 'granted') {
        const permission = await MediaLibrary.requestPermissionsAsync();
        if (permission.status !== 'granted') {
          throw new Error('Camera roll access denied. Please enable permissions in Settings.');
        }
        status = permission.status;
      }

      // Save to camera roll
      const asset = await MediaLibrary.createAssetAsync(uri);
      
      if (__DEV__) {
        console.log('✅ Video exported to camera roll successfully:', asset.uri);
      }
      
    } catch (error) {
      if (__DEV__) {
        console.error('❌ Failed to export video to camera roll:', error);
      }
      
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to save video to camera roll. Please try again.');
    }
  }

  // Export photo to camera roll
  async exportToCameraRoll(uri: string): Promise<void> {
    if (__DEV__) {
      console.log('🔄 Starting camera roll export for:', uri);
    }
    
    // Validate MediaLibrary is available
    if (!MediaLibrary) {
      if (__DEV__) {
        console.error('❌ MediaLibrary is not available');
      }
      throw new Error('Photo library functionality is not available. Please restart the app.');
    }
    
    if (!MediaLibrary.getPermissionsAsync) {
      if (__DEV__) {
        console.error('❌ MediaLibrary.getPermissionsAsync is not available');
      }
      throw new Error('Photo library permissions not available. Please update the app.');
    }
    
    try {
      // Check if file exists first
      if (__DEV__) {
        console.log('🔍 Checking if file exists...');
      }
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        if (__DEV__) {
          console.error('❌ File does not exist:', uri);
        }
        throw new Error('Photo file not found. Please try again.');
      }
      if (__DEV__) {
        console.log('✅ File exists, size:', fileInfo.size);
      }

      // First check if we already have permissions
      if (__DEV__) {
        console.log('🔍 Checking existing permissions...');
      }
      const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();
      if (__DEV__) {
        console.log('📱 Existing permission status:', existingStatus);
      }
      
      let finalStatus = existingStatus;
      
      // Only request if we don't have permissions
      if (existingStatus !== 'granted') {
        if (__DEV__) {
          console.log('🔄 Requesting photo library permissions...');
        }
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        finalStatus = newStatus;
        if (__DEV__) {
          console.log('📱 New permission status:', finalStatus);
        }
      }
      
      if (finalStatus !== 'granted') {
        if (__DEV__) {
          console.error('❌ Permission denied:', finalStatus);
        }
        throw new Error('Camera roll permission not granted. Please enable photo library access in iPhone Settings > Privacy & Security > Photos.');
      }
      
      if (__DEV__) {
        console.log('🔄 Processing image with ImageManipulator...');
      }
      // Use ImageManipulator to create a new file with current timestamp
      const processedImage = await ImageManipulator.manipulateAsync(
        uri,
        [], // No modifications needed
        { 
          compress: 1, // Keep original quality
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      if (__DEV__) {
        console.log('✅ Image processed, new URI:', processedImage.uri);
      }
      
      if (__DEV__) {
        console.log('🔄 Creating asset in photo library...');
      }
      // Save the processed image to library (will have current timestamp)
      const asset = await MediaLibrary.createAssetAsync(processedImage.uri);
      if (__DEV__) {
        console.log('📱 Asset created:', asset?.id);
      }
      
      if (!asset) {
        if (__DEV__) {
          console.error('❌ Failed to create asset - asset is null');
        }
        throw new Error('Failed to save photo to library');
      }
      
      if (__DEV__) {
        console.log('✅ Photo saved to camera roll successfully!');
      }
      
      // Clean up the temporary file created by ImageManipulator
      try {
        await FileSystem.deleteAsync(processedImage.uri, { idempotent: true });
        if (__DEV__) {
          console.log('🧹 Cleaned up temporary file');
        }
      } catch (cleanupError) {
        if (__DEV__) {
          console.warn('⚠️ Failed to clean up temporary file:', cleanupError);
        }
      }
      
    } catch (error: any) {
      if (__DEV__) {
        console.error('❌ MediaLibrary save error:', error);
        console.error('❌ Error type:', typeof error);
        console.error('❌ Error message:', error.message);
        console.error('❌ Error stack:', error.stack);
      }
      
      // Provide more specific error messages
      if (error.message?.includes('NSPhotoLibraryAddUsageDescription')) {
        throw new Error('Photo library access not available in Expo Go. Please use the Share button instead, or test in a development build.');
      } else if (error.message?.includes('permission')) {
        throw new Error('Photo library access denied. Please enable in iPhone Settings > Privacy & Security > Photos.');
      } else if (error.message?.includes('not found')) {
        throw new Error('Photo file not found. Please try again.');
      } else if (error.message?.includes('createAssetAsync')) {
        throw new Error('Failed to save photo to library. Please check your photo library permissions.');
      } else {
        throw new Error(`Failed to save photo: ${error.message || 'Unknown error occurred'}`);
      }
    }
  }

  // Get photo info
  async getPhotoInfo(uri: string): Promise<PhotoData> {
    const info = await FileSystem.getInfoAsync(uri);
    
    if (!info.exists) {
      throw new Error('Photo not found');
    }

    // Get image dimensions
    const result = await ImageManipulator.manipulateAsync(
      uri,
      [],
      { format: ImageManipulator.SaveFormat.JPEG }
    );

    return {
      uri,
      width: result.width,
      height: result.height,
    };
  }

  // Clear cache (temp files)
  async clearCache(): Promise<void> {
    const cacheDir = `${FileSystem.cacheDirectory}`;
    
    try {
      const files = await FileSystem.readDirectoryAsync(cacheDir);
      
      await Promise.all(
        files
          .filter(file => file.includes('ImagePicker') || file.includes('ImageManipulator'))
          .map(file => FileSystem.deleteAsync(`${cacheDir}${file}`, { idempotent: true }))
      );
    } catch (error) {
      if (__DEV__) {
        console.warn('Failed to clear cache:', error);
      }
    }
  }

  // Get storage info (simple version)
  async getStorageInfo(): Promise<{ used: number; count: number }> {
    let totalSize = 0;
    let restorationCount = 0;

    const directories = ['originals', 'restored', 'thumbnails'];
    
    for (const dir of directories) {
      const dirPath = `${this.basePath}${dir}/`;
      
      try {
        const files = await FileSystem.readDirectoryAsync(dirPath);
        
        // Count restorations based on originals directory only
        if (dir === 'originals') {
          restorationCount = files.length;
        }
        
        for (const file of files) {
          const fileInfo = await FileSystem.getInfoAsync(`${dirPath}${file}`);
          if (fileInfo.exists && 'size' in fileInfo) {
            totalSize += fileInfo.size;
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`Failed to read directory ${dir}:`, error);
        }
      }
    }

    return {
      used: totalSize,
      count: restorationCount,
    };
  }


  // Delete all photos from storage
  async deleteAllPhotos(): Promise<{ deletedCount: number }> {
    let deletedCount = 0;
    const directories = ['originals', 'restored', 'thumbnails'];
    
    for (const dir of directories) {
      const dirPath = `${this.basePath}${dir}/`;
      
      try {
        const files = await FileSystem.readDirectoryAsync(dirPath);
        
        // Delete each file
        for (const file of files) {
          try {
            await FileSystem.deleteAsync(`${dirPath}${file}`, { idempotent: true });
            deletedCount++;
          } catch (error) {
            if (__DEV__) {
              console.warn(`Failed to delete file ${file}:`, error);
            }
          }
        }
      } catch (error) {
        if (__DEV__) {
          console.warn(`Failed to read directory ${dir}:`, error);
        }
      }
    }

    if (__DEV__) {
      console.log(`🗑️ Deleted ${deletedCount} photo files`);
    }
    return { deletedCount };
  }
}

// Export singleton instance
export const photoStorage = new PhotoStorage();

// Additional functions for TanStack Query integration
export interface StoredRestoration {
  id: string;
  originalImageUri: string;
  restoredImageUri: string;
  createdAt: string;
}

// Simple in-memory storage for demo purposes
// In production, you might want to use AsyncStorage or SQLite
let storedRestorations: StoredRestoration[] = [];

export async function saveRestoredPhoto(data: {
  id: string;
  originalImageUri: string;
  restoredImageUri: string;
  createdAt: Date;
}): Promise<void> {
  const restoration: StoredRestoration = {
    id: data.id,
    originalImageUri: data.originalImageUri,
    restoredImageUri: data.restoredImageUri,
    createdAt: data.createdAt.toISOString(),
  };
  
  storedRestorations.unshift(restoration);
  
  // Keep only the last 50 restorations
  if (storedRestorations.length > 50) {
    storedRestorations = storedRestorations.slice(0, 50);
  }
}

export async function getStoredRestorations(): Promise<StoredRestoration[]> {
  return storedRestorations;
}