import { Platform } from 'react-native';
import {
  getStorage,
  ref as storageRef,
  putFile,
  getDownloadURL,
  list,
} from '@react-native-firebase/storage';

export const putAnimalImage = async (
  animalId: string,
  localUri: string,
  fileName: string,
): Promise<string> => {
  const storage = getStorage();
  const ref = storageRef(storage, `animals/${animalId}/images/${fileName}`);

  const path =
    Platform.select({
      ios: localUri.startsWith('file://')
        ? localUri.replace('file://', '')
        : localUri,
      android: localUri,
      default: localUri,
    }) ?? localUri;

  await putFile(ref, path);
  return getDownloadURL(ref);
};

export const listAnimalImages = async (
  animalId: string,
  maxResults = 6,
): Promise<string[]> => {
  const storage = getStorage();
  const dirRef = storageRef(storage, `animals/${animalId}/images`);
  const l = await list(dirRef, { maxResults });
  return Promise.all(l.items.map(r => getDownloadURL(r)));
};
