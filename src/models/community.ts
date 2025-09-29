export type MediaKind = 'image' | 'video';

export type PostMedia = Readonly<{
  kind: MediaKind;
  downloadURL: string;
  storagePath: string; // "posts/<id>/<file>"
  contentType?: string;
  sizeBytes?: number;
  width?: number;
  height?: number;
  durationSec?: number;
}>;

export type ReactionKind = 'like' | 'recommend';

export type PostCounters = Readonly<{
  like?: number;
  recommend?: number;
  comment?: number;
}>;

export type LinkItem = Readonly<{ url: string }>;

export type Post = Readonly<{
  id: string;
  authorUid: string;
  authorName?: string;
  authorAvatarURL?: string;
  text?: string;
  links?: ReadonlyArray<LinkItem>;
  media?: ReadonlyArray<PostMedia>;
  counters?: PostCounters;
  createdAt: unknown; // Firestore Timestamp u otro — tratamos como desconocido
  updatedAt?: unknown;
}>;
