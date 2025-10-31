// src/models/reaction.ts
export type ReactionKey = 'love' | 'sad' | 'match';

export type ReactionCounts = Readonly<{
  love: number;
  sad: number;
  match: number;
}>;
