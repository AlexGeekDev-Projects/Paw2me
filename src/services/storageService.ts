// src/services/storageService.ts
import { Platform } from 'react-native';
import { getApp } from '@react-native-firebase/app';
import {
  getStorage,
  ref as storageRef,
  getDownloadURL as storageGetDownloadURL,
  uploadString as storageUploadString,
  putFile as storagePutFile,
  list as storageList,
  listAll as storageListAll,
  type FirebaseStorageTypes,
} from '@react-native-firebase/storage';
import { getAuth } from '@react-native-firebase/auth';

/** ─────────────────────────────────────────────────────────────
 * Tipos
 * ───────────────────────────────────────────────────────────── */
type ContentType =
  | 'image/jpeg'
  | 'image/png'
  | 'image/webp'
  | 'image/heic'
  | 'image/heif';

type PutFromLocal = Readonly<{
  kind: 'local';
  animalId: string;
  fileName: string;
  localUri: string;
  contentType?: ContentType;
}>;

type PutFromBase64 = Readonly<{
  kind: 'base64';
  animalId: string;
  fileName: string;
  base64: string;
  contentType: ContentType;
}>;

export type PutAnimalImageParams = PutFromLocal | PutFromBase64;

export type ListImagesOptions = Readonly<{
  maxResults?: number;
}>;

/** ─────────────────────────────────────────────────────────────
 * Helpers
 * ───────────────────────────────────────────────────────────── */
const app = getApp();
const BUCKET_URL = 'gs://paw-2me.firebasestorage.app';
const storage = getStorage(app, BUCKET_URL);

const errorInfo = (e: unknown) => {
  const err = e as {
    code?: string;
    message?: string;
    nativeErrorCode?: string;
    nativeErrorMessage?: string;
  };
  const parts = [
    err.code ? `[${err.code}]` : undefined,
    err.message,
    err.nativeErrorCode ? `(native:${err.nativeErrorCode})` : undefined,
    err.nativeErrorMessage
      ? `(nativeMsg:${err.nativeErrorMessage})`
      : undefined,
  ].filter(Boolean);
  return parts.join(' ');
};

const normalizeLocalForPut = (uri: string): string => {
  if (Platform.OS === 'ios') {
    return uri.startsWith('file://') ? uri : `file://${uri}`;
  }
  return uri;
};

const objectPath = (animalId: string, fileName: string) =>
  `paws/${animalId}/images/${fileName}`;

async function getDownloadURLWithRetry(
  ref: FirebaseStorageTypes.Reference,
  maxAttempts = 6,
): Promise<string> {
  let attempt = 0;
  while (attempt < maxAttempts) {
    try {
      const url = await storageGetDownloadURL(ref);
      return url;
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
 * API
 * ───────────────────────────────────────────────────────────── */

export async function putAnimalImage(
  params: PutAnimalImageParams,
): Promise<string> {
  const { animalId, fileName } = params;
  const auth = getAuth();

  if (!auth.currentUser) {
    throw new Error('Debe iniciar sesión para subir imágenes.');
  }

  const fullPath = objectPath(animalId, fileName);
  const ref = storageRef(storage, fullPath);
  const uid = auth.currentUser.uid;

  if (params.kind === 'base64') {
    const { base64, contentType } = params;
    try {
      await storageUploadString(ref, base64, 'base64', { contentType });
      const url = await getDownloadURLWithRetry(ref);
      return url;
    } catch (e) {
      try {
        await _debugPingWrite(uid);
      } catch {}
      throw e;
    }
  }

  const { localUri, contentType } = params;
  const pathForPut = normalizeLocalForPut(localUri);

  try {
    await storagePutFile(ref, pathForPut, {
      contentType: contentType ?? 'image/jpeg',
    });
    const url = await getDownloadURLWithRetry(ref);
    return url;
  } catch (e) {
    const altPath = pathForPut.startsWith('file://')
      ? pathForPut.replace(/^file:\/\//, '')
      : `file://${pathForPut}`;

    if (altPath !== pathForPut) {
      try {
        await storagePutFile(ref, altPath, {
          contentType: contentType ?? 'image/jpeg',
        });
        const url = await getDownloadURLWithRetry(ref);
        return url;
      } catch (e2) {
        try {
          await _debugPingWrite(uid);
        } catch {}
        throw e2;
      }
    }

    throw e;
  }
}

export async function _debugPingWrite(uid: string): Promise<string> {
  const ref = storageRef(storage, `diagnostics/${uid}/ping_${Date.now()}.txt`);
  try {
    await storageUploadString(ref, 'pong', 'raw', {
      contentType: 'text/plain',
    } as unknown as FirebaseStorageTypes.SettableMetadata);
    const url = await storageGetDownloadURL(ref);
    return url;
  } catch (e) {
    throw e;
  }
}
