export type Shelter = {
  id: string;
  displayName: string;
  verified: boolean;
  city?: string;
  state?: string;
  country: string;
  contact: {
    phone?: string;
    email?: string;
    whatsapp?: string;
    website?: string;
    instagram?: string;
    facebook?: string;
    x?: string;
  };
  avatarUrl?: string;
  bannerUrl?: string;
  createdAt: number;
  updatedAt: number;
};
