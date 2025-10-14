import { db, storage, nowTs } from './firebase';
import {
  collection,
  doc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  type FirebaseFirestoreTypes,
} from '@react-native-firebase/firestore';
import type { PostDoc, NewPostInput, PostCardVM } from '@models/post';

const postsCol = () => collection(db, 'posts');
const postDoc = (postId: string) => doc(db, 'posts', postId);
const reactionsCol = (postId: string) =>
  collection(db, 'posts', postId, 'reactions');

export const postImagesPath = (postId: string) => `posts/${postId}/images`;

export const listPostsPublic = async (opts?: {
  limit?: number;
  animalId?: string;
}) => {
  const q = query(
    postsCol(),
    where('status', '==', 'active'),
    orderBy('createdAt', 'desc'),
    ...(opts?.animalId ? [where('animalId', '==', opts.animalId)] : []),
    ...(opts?.limit ? [limit(opts.limit)] : []),
  );

  const snap = await getDocs(q);
  const items: PostDoc[] = snap.docs.map(
    (
      d: FirebaseFirestoreTypes.QueryDocumentSnapshot<FirebaseFirestoreTypes.DocumentData>,
    ) => {
      const data = d.data() as Omit<PostDoc, 'id'>;
      return { id: d.id, ...data };
    },
  );
  return items;
};

export const getUserReacted = async (postId: string, uid: string) => {
  const r = doc(db, 'posts', postId, 'reactions', uid);
  const s = await getDoc(r);
  return s.exists(); // método
};

export const countReactions = async (postId: string) => {
  const snap = await getDocs(reactionsCol(postId));
  return snap.size;
};

export const toggleReaction = async (postId: string, uid: string) => {
  const r = doc(db, 'posts', postId, 'reactions', uid);
  const s = await getDoc(r);
  if (s.exists()) {
    await deleteDoc(r);
    return false;
  }
  await setDoc(r, { createdAt: nowTs() });
  return true;
};

export const createPost = async (postId: string, input: NewPostInput) => {
  const ref = postDoc(postId);
  const now = nowTs();
  // 👇 Cumple exactOptionalPropertyTypes: no escribimos `undefined` explícito
  const base: Record<string, unknown> = {
    animalId: input.animalId,
    authorUid: input.authorUid,
    content: input.content,
    status: input.status,
    reactionCount: input.reactionCount ?? 0,
    commentCount: input.commentCount ?? 0,
    shareCount: input.shareCount ?? 0,
    createdAt: now,
    updatedAt: now,
  };
  const payload =
    input.imageUrls && input.imageUrls.length > 0
      ? { ...base, imageUrls: input.imageUrls }
      : base;

  await setDoc(ref, payload);
};

export const toPostVM = (post: PostDoc, reactedByMe: boolean): PostCardVM => ({
  id: post.id,
  animalId: post.animalId,
  content: post.content,
  imageUrls: post.imageUrls ?? [],
  reactionCount: post.reactionCount,
  commentCount: post.commentCount,
  shareCount: post.shareCount,
  createdAt: post.createdAt,
  reactedByMe,
});

export const putPostImage = async (
  postId: string,
  localUri: string,
  fileName: string,
) => {
  const ref = storage.ref(`${postImagesPath(postId)}/${fileName}`);
  await ref.putFile(localUri);
  return ref.getDownloadURL();
};
