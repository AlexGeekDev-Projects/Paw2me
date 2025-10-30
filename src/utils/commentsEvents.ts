// ───────── Animal ─────────
export type AnimalCommentEvent = Readonly<{ pawId: string; delta?: number }>;
type AnimalListener = (e: AnimalCommentEvent) => void;

const animalListeners = new Set<AnimalListener>();

export function onAnimalCommentAdded(fn: AnimalListener): () => void {
  animalListeners.add(fn);
  return () => animalListeners.delete(fn);
}

export function emitAnimalCommentAdded(e: AnimalCommentEvent) {
  for (const fn of animalListeners) {
    try {
      fn(e);
    } catch {}
  }
}

// ───────── Post (Feed) ─────────
export type PostCommentEvent = Readonly<{ postId: string; delta?: number }>;
type PostListener = (e: PostCommentEvent) => void;

const postListeners = new Set<PostListener>();

export function onPostCommentAdded(fn: PostListener): () => void {
  postListeners.add(fn);
  return () => postListeners.delete(fn);
}

export function emitPostCommentAdded(e: PostCommentEvent) {
  for (const fn of postListeners) {
    try {
      fn(e);
    } catch {}
  }
}
