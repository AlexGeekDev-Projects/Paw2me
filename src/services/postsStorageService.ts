import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getStorage,
  ref as storageRef,
  getDownloadURL as storageGetDownloadURL,
  uploadString as storageUploadString,
  putFile as storagePutFile,
  type FirebaseStorageTypes,
} from '@react-native-firebase/storage';
import { getAuth } from '@react-native-firebase/auth';

export type ImgContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

export type VidContentType =
  | 'video/mp4'
  | 'video/quicktime'
  | 'video/webm'
  | 'video/3gpp';

type PutImageBase64 = Readonly<{
  kind: 'base64';
  postId: string;
  fileName: string;
  base64: string;
  contentType: ImgContentType;
}>;

type PutImageLocal = Readonly<{
  kind: 'local';
  postId: string;
  fileName: string;
  localUri: string;
  contentType?: ImgContentType;
}>;

export type PutPostImageParams = PutImageBase64 | PutImageLocal;

export type PutPostVideoParams = Readonly<{
  postId: string;
  fileName: string;
  localUri: string;
  contentType?: VidContentType;
}>;

const app = getApp();
const BUCKET_URL = 'gs://paw-2me.firebasestorage.app';
const storage = getStorage(app, BUCKET_URL);

const normalizeLocalForPut = (uri: string): string => {
  if (Platform.OS === 'ios')
    return uri.startsWith('file://') ? uri : `file://${uri}`;
  return uri;
};

const imgPath = (postId: string, fileName: string) =>
  `posts/${postId}/images/${fileName}`;
const vidPath = (postId: string, fileName: string) =>
  `posts/${postId}/videos/${fileName}`;

async function getDownloadURLWithRetry(
  ref: FirebaseStorageTypes.Reference,
  maxAttempts = 6,
): Promise<string> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      return await storageGetDownloadURL(ref);
    } catch (e) {
      const code = (e as { code?: string }).code ?? '';
      const retryable =
        code === 'storage/object-not-found' ||
        code === 'storage/retry-limit-exceeded';
      if (!retryable || attempt === maxAttempts - 1) throw e;
      const delay = 200 * 2 ** attempt;
      await new Promise<void>(res => setTimeout(res, delay));
      attempt += 1;
    }
  }
  throw new Error('getDownloadURL backoff agotado');
}

/** ─────────────────────────────────────────────────────────────
 * API pública
 * ───────────────────────────────────────────────────────────── */

export async function putPostImage(
  params: PutPostImageParams,
): Promise<string> {
  const auth = getAuth();
  if (!auth.currentUser)
    throw new Error('Debe iniciar sesión para subir imágenes.');

  const fullPath = imgPath(params.postId, params.fileName);
  const ref = storageRef(storage, fullPath);

  if (params.kind === 'base64') {
    await storageUploadString(ref, params.base64, 'base64', {
      contentType: params.contentType,
    });
    return await getDownloadURLWithRetry(ref);
  }

  const pathForPut = normalizeLocalForPut(params.localUri);
  try {
    await storagePutFile(ref, pathForPut, {
      contentType: params.contentType ?? 'image/jpeg',
    });
    return await getDownloadURLWithRetry(ref);
  } catch (e) {
    // alterna file:// (iOS/Android) igual que tu helper
    const altPath = pathForPut.startsWith('file://')
      ? pathForPut.replace(/^file:\/\//, '')
      : `file://${pathForPut}`;
    if (altPath !== pathForPut) {
      await storagePutFile(ref, altPath, {
        contentType: params.contentType ?? 'image/jpeg',
      });
      return await getDownloadURLWithRetry(ref);
    }
    throw e;
  }
}

export async function putPostVideo(
  params: PutPostVideoParams,
): Promise<string> {
  const auth = getAuth();
  if (!auth.currentUser)
    throw new Error('Debe iniciar sesión para subir videos.');

  const fullPath = vidPath(params.postId, params.fileName);
  const ref = storageRef(storage, fullPath);
  const pathForPut = normalizeLocalForPut(params.localUri);

  try {
    await storagePutFile(ref, pathForPut, {
      contentType: params.contentType ?? 'video/mp4',
    });
    return await getDownloadURLWithRetry(ref);
  } catch (e) {
    // Fallback: alterna entre file:// y ruta “desnuda”
    const altPath = pathForPut.startsWith('file://')
      ? pathForPut.replace(/^file:\/\//, '')
      : `file://${pathForPut}`;
    if (altPath !== pathForPut) {
      await storagePutFile(ref, altPath, {
        contentType: params.contentType ?? 'video/mp4',
      });
      return await getDownloadURLWithRetry(ref);
    }
    throw e;
  }
}
