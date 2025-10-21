// @models/post.ts
export interface PostDoc {
  id: string;
  animalId: string;
  authorUid: string;
  content: string;
  imageUrls?: string[];
  videoUrls?: string[]; // ← NUEVO
  status: 'active' | 'hidden';
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: number;
  updatedAt: number;
}

export interface PostCardVM {
  id: string;
  animalId: string;
  content: string;
  imageUrls: string[];
  videoUrls?: string[]; // ← NUEVO (opcional)
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: number;
  reactedByMe: boolean;
  updatedAt?: number;
}
