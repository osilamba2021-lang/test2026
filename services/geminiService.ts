
import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, InspirationImage, OutfitSuggestion, GroundingSource, StyleProfile, UserAnalysis } from "../types";

// Note: process.env.API_KEY is handled by the platform
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

/**
 * Analyzes a user's photo to determine their body architecture
 */
export const analyzeBodyArchitecture = async (base64Image: string): Promise<UserAnalysis> => {
  const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;
  
  const prompt = `
    Analyze this individual's body architecture for high-end fashion styling.
    Identify:
    1. Body Shape (e.g. Hourglass, Pear, Rectangle, Inverted Triangle, Apple).
    2. Proportions (e.g. Long torso/Short legs, High hip, Wide shoulders).
    3. Height Estimate (e.g. Petite, Average, Tall).
    4. Suggested Fashion Focus (What should they highlight or balance?).

    Return ONLY a JSON object.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        {
          role: 'user',
          parts: [
            { inlineData: { mimeType: "image/png", data: imageData } },
            { text: prompt }
          ]
        }
      ],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            bodyShape: { type: Type.STRING },
            proportions: { type: Type.STRING },
            suggestedFocus: { type: Type.STRING },
            heightEstimate: { type: Type.STRING }
          },
          required: ["bodyShape", "proportions", "suggestedFocus", "heightEstimate"]
        }
      }
    });

    return JSON.parse(response.text || '{}');
  } catch (error) {
    console.error("Analysis Error:", error);
    throw new Error("Unable to analyze architecture. Ensure photo is clear.");
  }
};

export const generateOutfits = async (
  wardrobe: ClothingItem[], 
  inspiration: InspirationImage[],
  prompt: string,
  profile: StyleProfile,
  pinterestUrl?: string
): Promise<OutfitSuggestion[]> => {
  
  const wardrobeParts = wardrobe.map((item) => ({
    inlineData: {
      mimeType: "image/png",
      data: item.image.includes(',') ? item.image.split(',')[1] : item.image
    }
  }));

  const inspirationParts = inspiration.map(item => ({
    inlineData: {
      mimeType: "image/png",
      data: item.image.includes(',') ? item.image.split(',')[1] : item.image
    }
  }));

  const architectureContext = profile.aiAnalysis 
    ? `VISUAL ARCHITECTURE:
       - Shape: ${profile.aiAnalysis.bodyShape}
       - Proportions: ${profile.aiAnalysis.proportions}
       - Height: ${profile.aiAnalysis.heightEstimate}
       - Stylist Focus: ${profile.aiAnalysis.suggestedFocus}`
    : `PHYSICAL PROFILE:
       - Shape: ${profile.bodyType || 'Balanced'}
       - Height: ${profile.height || 'Average'}`;

  const systemInstruction = `
    You are "The Lady's Personal Stylist". 
    Create THREE outfit options from the WARDROBE provided.
    
    ${architectureContext}

    STYLE PREFERENCES:
    - Aesthetic: ${profile.aesthetic || 'Sophisticated'}
    - Forbidden: ${profile.forbidden || 'None'}

    FLATTERY LOGIC:
    - Balance user's proportions using "The Lady's Guide to Proportion".
    ${prompt}

    Return a JSON block with "outfits" array.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: 'user', 
          parts: [
            ...wardrobeParts, 
            { text: "--- END OF WARDROBE ---" },
            ...inspirationParts,
            { text: "--- END OF INSPIRATION ---" },
            { text: "Please generate outfits based on my wardrobe and profile context." } 
          ] 
        }
      ],
      config: {
        systemInstruction,
        tools: [{ googleSearch: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            outfits: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING },
                  fashionGuideline: { type: Type.STRING },
                  trendFactor: { type: Type.STRING },
                  identityMatch: { type: Type.STRING },
                  proportionNote: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["Classic", "Practical", "Bold"] },
                  items: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ["title", "description", "fashionGuideline", "trendFactor", "identityMatch", "proportionNote", "type", "items"]
              }
            }
          },
          required: ["outfits"]
        }
      }
    });

    const groundingChunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    const sources: GroundingSource[] = groundingChunks?.map((chunk: any) => ({
      title: chunk.web?.title || "Fashion Trend",
      uri: chunk.web?.uri || "#"
    })).filter((s: any) => s.uri !== "#") || [];

    const data = JSON.parse(response.text || '{"outfits":[]}');
    
    return data.outfits.map((outfit: any) => ({
      ...outfit,
      sources,
      items: outfit.items.map((idx: string) => {
        const n = parseInt(idx);
        return wardrobe[n]?.id;
      }).filter(Boolean)
    }));
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Styling failed. Please ensure you have items in your vault.");
  }
};
