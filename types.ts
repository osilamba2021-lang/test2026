
export type ClothingCategory = 'Tops' | 'Bottoms' | 'Dresses' | 'Outerwear' | 'Shoes' | 'Accessories';

export interface ClothingItem {
  id: string;
  image: string; // Base64
  category: ClothingCategory;
  name: string;
}

export interface InspirationImage {
  id: string;
  image: string; // Base64
}

export interface StyleProfile {
  aesthetic: string;
  silhouettes: string;
  forbidden: string;
  signatureColors: string;
}

export interface GroundingSource {
  title: string;
  uri: string;
}

export interface OutfitSuggestion {
  title: string;
  description: string;
  items: string[]; // IDs of items used
  fashionGuideline: string;
  trendFactor: string;
  type: 'Classic' | 'Practical' | 'Bold';
  identityMatch: string; // Explains how it matches the user's StyleProfile
  sources?: GroundingSource[];
}

export interface StylingState {
  isGenerating: boolean;
  suggestions: OutfitSuggestion[] | null;
  error: string | null;
}
