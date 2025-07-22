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
      const directories = ['originals', 'restored', 'thumbnails'];
      
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
          console.log(`✅ Created directory: ${dirPath}`);
        }
      }
    } catch (error) {
      console.error('Failed to initialize storage directories:', error);
    }
  }

  // Save original photo
  async saveOriginal(uri: string): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      const fileName = `original_${Date.now()}.jpg`;
      const destination = `${this.basePath}originals/${fileName}`;
      
      await FileSystem.copyAsync({
        from: uri,
        to: destination
      });
      
      console.log(`✅ Saved original photo: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('Failed to save original photo:', error);
      throw error;
    }
  }

  // Save restored photo from URL
  async saveRestored(url: string, originalFileName: string): Promise<string> {
    try {
      await this.initializeStorage(); // Ensure directories exist
      
      const fileName = originalFileName.replace('original_', 'restored_');
      const destination = `${this.basePath}restored/${fileName}`;
      
      console.log(`⬇️ Downloading restored photo from: ${url}`);
      const result = await FileSystem.downloadAsync(url, destination);
      
      if (result.status === 200) {
        console.log(`✅ Saved restored photo: ${fileName}`);
        return fileName;
      } else {
        throw new Error(`Download failed with status: ${result.status}`);
      }
    } catch (error) {
      console.error('Failed to save restored photo:', error);
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
      
      const fileName = `thumb_${type}_${Date.now()}.jpg`;
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
      
      console.log(`✅ Created thumbnail: ${fileName}`);
      return fileName;
    } catch (error) {
      console.error('Failed to create thumbnail:', error);
      throw error;
    }
  }

  // Get full URI for a stored photo
  getPhotoUri(type: 'original' | 'restored' | 'thumbnail', filename: string): string {
    const folder = type === 'thumbnail' ? 'thumbnails' : type === 'restored' ? 'restored' : 'originals';
    const uri = `${this.basePath}${folder}/${filename}`;
    return uri;
  }
  
  // Check if a photo file exists
  async checkPhotoExists(type: 'original' | 'restored' | 'thumbnail', filename: string): Promise<boolean> {
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
          console.warn('Failed to delete file:', uri, error);
        }
      })
    );
  }

  // Export photo to camera roll
  async exportToCameraRoll(uri: string): Promise<void> {
    console.log('🔄 Starting camera roll export for:', uri);
    
    // Validate MediaLibrary is available
    if (!MediaLibrary) {
      console.error('❌ MediaLibrary is not available');
      throw new Error('Photo library functionality is not available. Please restart the app.');
    }
    
    if (!MediaLibrary.getPermissionsAsync) {
      console.error('❌ MediaLibrary.getPermissionsAsync is not available');
      throw new Error('Photo library permissions not available. Please update the app.');
    }
    
    try {
      // Check if file exists first
      console.log('🔍 Checking if file exists...');
      const fileInfo = await FileSystem.getInfoAsync(uri);
      if (!fileInfo.exists) {
        console.error('❌ File does not exist:', uri);
        throw new Error('Photo file not found. Please try again.');
      }
      console.log('✅ File exists, size:', fileInfo.size);

      // First check if we already have permissions
      console.log('🔍 Checking existing permissions...');
      const { status: existingStatus } = await MediaLibrary.getPermissionsAsync();
      console.log('📱 Existing permission status:', existingStatus);
      
      let finalStatus = existingStatus;
      
      // Only request if we don't have permissions
      if (existingStatus !== 'granted') {
        console.log('🔄 Requesting photo library permissions...');
        const { status: newStatus } = await MediaLibrary.requestPermissionsAsync();
        finalStatus = newStatus;
        console.log('📱 New permission status:', finalStatus);
      }
      
      if (finalStatus !== 'granted') {
        console.error('❌ Permission denied:', finalStatus);
        throw new Error('Camera roll permission not granted. Please enable photo library access in iPhone Settings > Privacy & Security > Photos.');
      }
      
      console.log('🔄 Processing image with ImageManipulator...');
      // Use ImageManipulator to create a new file with current timestamp
      const processedImage = await ImageManipulator.manipulateAsync(
        uri,
        [], // No modifications needed
        { 
          compress: 1, // Keep original quality
          format: ImageManipulator.SaveFormat.JPEG 
        }
      );
      console.log('✅ Image processed, new URI:', processedImage.uri);
      
      console.log('🔄 Creating asset in photo library...');
      // Save the processed image to library (will have current timestamp)
      const asset = await MediaLibrary.createAssetAsync(processedImage.uri);
      console.log('📱 Asset created:', asset?.id);
      
      if (!asset) {
        console.error('❌ Failed to create asset - asset is null');
        throw new Error('Failed to save photo to library');
      }
      
      console.log('✅ Photo saved to camera roll successfully!');
      
      // Clean up the temporary file created by ImageManipulator
      try {
        await FileSystem.deleteAsync(processedImage.uri, { idempotent: true });
        console.log('🧹 Cleaned up temporary file');
      } catch (cleanupError) {
        console.warn('⚠️ Failed to clean up temporary file:', cleanupError);
      }
      
    } catch (error: any) {
      console.error('❌ MediaLibrary save error:', error);
      console.error('❌ Error type:', typeof error);
      console.error('❌ Error message:', error.message);
      console.error('❌ Error stack:', error.stack);
      
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
      console.warn('Failed to clear cache:', error);
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
        console.warn(`Failed to read directory ${dir}:`, error);
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
            console.warn(`Failed to delete file ${file}:`, error);
          }
        }
      } catch (error) {
        console.warn(`Failed to read directory ${dir}:`, error);
      }
    }

    console.log(`🗑️ Deleted ${deletedCount} photo files`);
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