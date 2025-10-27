// src/models/comment.ts
export type CommentId = string;
export type PostId = string;
export type UID = string;

export type CommentDoc = Readonly<{
  id: CommentId;
  postId: PostId;
  authorUid: UID;
  content: string;
  createdAt: number; // epoch ms
  updatedAt?: number | null; // epoch ms
  replyToId?: CommentId | null;
  deleted?: boolean;
}>;

export type NewComment = Readonly<{
  content: string;
  replyToId?: CommentId | null;
}>;

export type CommentsPage = Readonly<{
  items: CommentDoc[];
  nextCursor: unknown | null; // interno del servicio (snapshot)
}>;
