import { useEffect, useState } from 'react';
import { listenAnimalCommentsCount } from '@services/animalCommentsService';

export function useAnimalCommentsCount(pawId: string) {
  const [count, setCount] = useState<number>(0);
  useEffect(() => {
    const off = listenAnimalCommentsCount(pawId, setCount);
    return off;
  }, [pawId]);
  return count;
}
