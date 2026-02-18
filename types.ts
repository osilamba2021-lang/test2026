
export type ClothingCategory = 'Tops' | 'Bottoms' | 'Dresses' | 'Outerwear' | 'Shoes' | 'Accessories';
export type ClothingFit = 'Tailored' | 'Oversized' | 'Relaxed' | 'Slim' | 'Petite';
export type ClothingClassification = 'Basic' | 'Statement';

export interface ClothingItem {
  id: string;
  image: string; // Base64
  category: ClothingCategory;
  name: string;
  color?: string;
  fit?: ClothingFit;
  classification?: ClothingClassification;
  style?: string; // e.g. "Minimalist", "Bohemian"
}

export interface InspirationImage {
  id: string;
  image: string; // Base64
}

export interface UserAnalysis {
  bodyShape: string;
  proportions: string;
  suggestedFocus: string; // e.g. "Highlight waist", "Elongate legs"
  heightEstimate: string;
}

export interface StyleProfile {
  aesthetic: string;
  silhouettes: string;
  forbidden: string;
  signatureColors: string;
  bodyType: string;
  height: string;
  pinterestProfile?: string; // New: Persistent Pinterest link
  analysisPhoto?: string; // Base64
  aiAnalysis?: UserAnalysis;
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
  identityMatch: string; 
  proportionNote: string; 
  sources?: GroundingSource[];
}

export interface OutfitRating {
  comfort: number; // 1-5
  style: number; // 1-5
  notes?: string;
}

export interface SavedOutfit extends OutfitSuggestion {
  id: string;
  timestamp: number;
  rating?: OutfitRating;
  occasionCategory: string; // e.g., "Work", "Date Night", "Gala", etc.
}

export interface StylingState {
  isGenerating: boolean;
  suggestions: OutfitSuggestion[] | null;
  error: string | null;
}
