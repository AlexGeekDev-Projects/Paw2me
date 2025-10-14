export interface PostDoc {
  id: string;
  animalId: string;
  authorUid: string;
  content: string;
  imageUrls?: string[]; // opcional, evita mandar undefined en writes
  status: 'active' | 'hidden';
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: number; // Date.now()
  updatedAt: number;
}

export type NewPostInput = Omit<
  PostDoc,
  | 'id'
  | 'reactionCount'
  | 'commentCount'
  | 'shareCount'
  | 'createdAt'
  | 'updatedAt'
> & {
  reactionCount?: number; // opcional por si se desea inyectar 0 explícito
  commentCount?: number;
  shareCount?: number;
  imageUrls?: string[];
};

export interface PostCardVM {
  id: string;
  animalId: string;
  content: string;
  imageUrls: string[];
  reactionCount: number;
  commentCount: number;
  shareCount: number;
  createdAt: number;
  // estado del usuario
  reactedByMe: boolean;
}
