export type Post = {
  id: string;
  animalId: string;
  authorId: string; // user or shelter
  caption?: string;
  media: { images: string[]; videos?: string[] };
  reactionsCount: number;
  commentsCount: number;
  createdAt: number;
  updatedAt: number;
  visibility: 'public' | 'reported' | 'hidden';
};
