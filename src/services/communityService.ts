import type { Post, ReactionKind, PostMedia } from '@models/community';

// ─── MOCK EN MEMORIA ─────────────────────────────────────────
let MOCK_POSTS: Post[] = [
  {
    id: 'p1',
    authorUid: 'u1',
    authorName: 'Protectora Patitas',
    authorAvatarURL: 'https://i.pravatar.cc/100?img=15',
    text: 'Rocky busca hogar responsable. Juguetón y noble.',
    links: [{ url: 'https://instagram.com/patitas' }],
    media: [
      {
        kind: 'image',
        downloadURL:
          'https://images.dog.ceo/breeds/terrier-pitbull/20200820_131744.jpg',
        storagePath: 'posts/p1/rocky.jpg',
        width: 800,
        height: 600,
        sizeBytes: 1024 * 200,
        contentType: 'image/jpeg',
      },
    ],
    counters: { like: 12, recommend: 3, comment: 5 },
    createdAt: Date.now(),
  },
];

type Unsub = () => void;

export function subscribeCommunityFeed(opts: {
  limit: number;
  onData: (list: ReadonlyArray<Post>) => void;
  onSnapshotExtra?: (snap: { docs: unknown[] }) => void;
  onError?: (e: unknown) => void;
}): Unsub {
  // Mock: emite una vez
  try {
    opts.onData(MOCK_POSTS.slice(0, opts.limit));
    opts.onSnapshotExtra?.({ docs: [] });
  } catch (e) {
    opts.onError?.(e);
  }
  return () => {};
}

export async function fetchFeedPage(_opts: {
  limit: number;
  cursor: unknown;
}): Promise<{ items: ReadonlyArray<Post>; nextCursor: unknown }> {
  return { items: [], nextCursor: null };
}

export async function toggleReaction(
  postId: string,
  k: ReactionKind,
): Promise<void> {
  const i = MOCK_POSTS.findIndex(p => p.id === postId);
  if (i === -1) return;
  const p = MOCK_POSTS[i]!;
  const cur = p.counters?.[k] ?? 0;
  const counters = { ...(p.counters ?? {}), [k]: cur + 1 };
  MOCK_POSTS = [
    ...MOCK_POSTS.slice(0, i),
    { ...p, counters },
    ...MOCK_POSTS.slice(i + 1),
  ];
}

export async function deleteMyPost(postId: string): Promise<void> {
  MOCK_POSTS = MOCK_POSTS.filter(p => p.id !== postId);
}

export async function getPostById(postId: string): Promise<Post | null> {
  return MOCK_POSTS.find(p => p.id === postId) ?? null;
}

export async function addComment(
  _postId: string,
  _text: string,
): Promise<void> {
  // mock no-op
}

export async function deleteComment(
  _postId: string,
  _commentId: string,
): Promise<void> {
  // mock no-op
}

export async function editComment(
  _postId: string,
  _commentId: string,
  _text: string,
): Promise<void> {
  // mock no-op
}

export async function createPostUsingUploaded(input: {
  text: string;
  links: ReadonlyArray<string>;
  uploaded: ReadonlyArray<PostMedia>;
}): Promise<void> {
  const id = `p${Date.now()}`;
  MOCK_POSTS.unshift({
    id,
    authorUid: 'u1',
    authorName: 'Protectora Patitas',
    text: input.text,
    links: input.links.map(url => ({ url })),
    media: input.uploaded,
    counters: { like: 0, recommend: 0, comment: 0 },
    createdAt: Date.now(),
  });
}

export async function updatePostUsingUploaded(input: {
  postId: string;
  text: string;
  links: ReadonlyArray<string>;
  uploaded: ReadonlyArray<PostMedia>;
}): Promise<void> {
  const i = MOCK_POSTS.findIndex(p => p.id === input.postId);
  if (i === -1) return;
  const prev = MOCK_POSTS[i]!;
  const next: Post = {
    ...prev,
    text: input.text,
    links: input.links.map(url => ({ url })),
    media: input.uploaded,
    updatedAt: Date.now(),
  };
  MOCK_POSTS = [...MOCK_POSTS.slice(0, i), next, ...MOCK_POSTS.slice(i + 1)];
}
