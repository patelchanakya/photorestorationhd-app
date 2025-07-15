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
    
    // Debug logging
    console.log(`📁 Getting ${type} photo URI:`, uri);
    
    // Check if file exists (async operation, but we'll log the result)
    FileSystem.getInfoAsync(uri).then(info => {
      console.log(`📄 File ${filename} exists:`, info.exists);
      if (info.exists && 'size' in info) {
        console.log(`📏 File size: ${info.size} bytes`);
      }
    }).catch(error => {
      console.error(`❌ Error checking file ${filename}:`, error);
    });
    
    return uri;
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
    const { status } = await MediaLibrary.requestPermissionsAsync();
    
    if (status !== 'granted') {
      throw new Error('Camera roll permission not granted');
    }
    
    await MediaLibrary.saveToLibraryAsync(uri);
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

  // Get storage info
  async getStorageInfo(): Promise<{ used: number; count: number }> {
    let totalSize = 0;
    let fileCount = 0;

    const directories = ['originals', 'restored', 'thumbnails'];
    
    for (const dir of directories) {
      const dirPath = `${this.basePath}${dir}/`;
      
      try {
        const files = await FileSystem.readDirectoryAsync(dirPath);
        fileCount += files.length;
        
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
      count: fileCount,
    };
  }
}

// Export singleton instance
export const photoStorage = new PhotoStorage();