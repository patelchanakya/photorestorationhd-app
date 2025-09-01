import * as FileSystem from 'expo-file-system';
import * as MediaLibrary from 'expo-media-library';
import * as ImageManipulator from 'expo-image-manipulator';
import { Platform, PixelRatio } from 'react-native';
import { requireNativeModule } from 'expo-modules-core';

const THUMB_DIR = `${FileSystem.cacheDirectory}device_thumbs`;
const safe = (s: string) => s.replace(/[^a-zA-Z0-9._-]/g, '_');

async function ensureThumbDir(): Promise<void> {
  try {
    const info = await FileSystem.getInfoAsync(THUMB_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(THUMB_DIR, { intermediates: true });
    }
  } catch {
    // no-op
  }
}

export async function getOrCreateThumb(
  asset: MediaLibrary.Asset,
  targetWidth: number,
  targetHeight: number
): Promise<string | null> {
  try {
    await ensureThumbDir();
    const key = `${safe(asset.id)}-${Math.round(targetWidth)}x${Math.round(targetHeight)}.jpg`;
    const outPath = `${THUMB_DIR}/${key}`;
    const existing = await FileSystem.getInfoAsync(outPath);
    if (existing.exists) return outPath;

    // Try native thumbnailer first (iOS)
    let CleverThumbs: any = null;
    try {
      CleverThumbs = requireNativeModule('CleverThumbs');
    } catch {}

    const localIdentifier = (asset as any)?.localIdentifier;
    if (Platform.OS === 'ios' && CleverThumbs && localIdentifier) {
      try {
        const uri: string | null = await CleverThumbs.getThumb(
          localIdentifier,
          Math.round(targetWidth * 2),
          Math.round(targetHeight * 2)
        );
        if (uri) {
          try {
            await FileSystem.copyAsync({ from: uri, to: outPath });
          } catch {
            await FileSystem.writeAsStringAsync(outPath, await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 }), { encoding: FileSystem.EncodingType.Base64 });
          }
          return outPath;
        }
      } catch {}
    }

    // Resolve a local uri for manipulation
    const info = await MediaLibrary.getAssetInfoAsync(asset.id);
    const srcUri = (info as any).localUri || (info as any).uri || asset.uri;
    if (!srcUri) return null;

    // Concurrency limit to avoid memory spikes
    const result = await scheduleManipulation(srcUri, Math.round(targetWidth), Math.round(targetHeight));
    const manipulate = result;

    try {
      // Some URIs might be content:// or ph://; read/write via Base64 if copy fails
      await FileSystem.copyAsync({ from: manipulate.uri, to: outPath });
    } catch {
      try {
        await FileSystem.moveAsync({ from: manipulate.uri, to: outPath });
      } catch {
        try {
          const b64 = await FileSystem.readAsStringAsync(manipulate.uri, { encoding: FileSystem.EncodingType.Base64 });
          await FileSystem.writeAsStringAsync(outPath, b64, { encoding: FileSystem.EncodingType.Base64 });
        } catch {}
      }
    }
    return outPath;
  } catch (e) {
    if (__DEV__) {
      console.warn('getOrCreateThumb failed', e);
    }
    return null;
  }
}

// Simple semaphore to limit concurrent manipulations
const MAX_CONCURRENT = 20; // Maximum concurrent for instant loading
let running = 0;
const queue: Array<() => void> = [];
const inflight: Map<string, Promise<{ uri: string }>> = new Map();

function runNext() {
  const next = queue.shift();
  if (next) next();
}

async function scheduleManipulation(srcUri: string, targetW: number, _targetH: number): Promise<{ uri: string }> {
  const pixelRatio = Math.max(1, Math.min(2, PixelRatio.get()));
  const desiredW = Math.max(64, Math.floor(targetW * 1)); // 1x cell width for minimal memory
  const key = `${srcUri}-${desiredW}`;
  const existing = inflight.get(key);
  if (existing) return existing;

  const job = new Promise<{ uri: string }>((resolve, reject) => {
    const start = async () => {
      running++;
      try {
        const manipulated = await ImageManipulator.manipulateAsync(
          srcUri,
          [{ resize: { width: desiredW } }],
          { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG } // Lower quality for faster generation
        );
        resolve(manipulated);
      } catch (e) {
        reject(e);
      } finally {
        running--;
        runNext();
        inflight.delete(key);
      }
    };
    if (running < MAX_CONCURRENT) {
      start();
    } else {
      queue.push(start);
    }
  });

  inflight.set(key, job);
  return job;
}
