
import { GoogleGenAI, Type } from "@google/genai";
import { ClothingItem, InspirationImage, OutfitSuggestion, GroundingSource, StyleProfile, UserAnalysis } from "../types";

/**
 * Analyzes a user's photo to determine their body architecture
 */
export const analyzeBodyArchitecture = async (base64Image: string): Promise<UserAnalysis> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
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

/**
 * Automatically classifies a clothing item from an image
 */
export const analyzeClothingItem = async (base64Image: string): Promise<Partial<ClothingItem>> => {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    const imageData = base64Image.includes(',') ? base64Image.split(',')[1] : base64Image;

    const prompt = `
      Analyze this clothing item photo. 
      Classify it into the following categories:
      - Category: 'Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'
      - Name: A short, elegant descriptive name (e.g. "Silk Cream Blouse")
      - Color: Dominant color family
      - Fit: 'Tailored', 'Oversized', 'Relaxed', 'Slim', 'Petite' (Best guess)
      - Classification: 'Basic' (versatile staple) or 'Statement' (bold/unique)
      - Style: The aesthetic vibe (e.g. Minimalist, Bohemian, Vintage, Preppy)
      - Material: Fabric appearance (e.g. Denim, Silk, Cotton, Leather)

      Return JSON.
    `;

    try {
        const response = await ai.models.generateContent({
            model: "gemini-2.5-flash-image",
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
                        category: { type: Type.STRING, enum: ['Tops', 'Bottoms', 'Dresses', 'Outerwear', 'Shoes', 'Accessories'] },
                        name: { type: Type.STRING },
                        color: { type: Type.STRING },
                        fit: { type: Type.STRING, enum: ['Tailored', 'Oversized', 'Relaxed', 'Slim', 'Petite'] },
                        classification: { type: Type.STRING, enum: ['Basic', 'Statement'] },
                        style: { type: Type.STRING },
                        material: { type: Type.STRING }
                    },
                    required: ["category", "name", "color", "classification"]
                }
            }
        });
        return JSON.parse(response.text || '{}');
    } catch (error) {
        console.error("Clothing Analysis Error:", error);
        return { name: "New Item", category: "Tops", classification: "Basic" };
    }
};

export const generateOutfits = async (
  wardrobe: ClothingItem[], 
  inspiration: InspirationImage[],
  prompt: string,
  profile: StyleProfile,
  pinterestUrl?: string
): Promise<OutfitSuggestion[]> => {
  const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
  
  const now = Date.now();
  const laundryCycleDays = profile.laundryCycle || 7;
  const oneDayMs = 24 * 60 * 60 * 1000;

  const wardrobeParts = wardrobe.map((item, index) => {
    let wornInfo = "Status: Clean";
    if (item.lastWorn) {
        const daysSince = Math.floor((now - item.lastWorn) / oneDayMs);
        if (daysSince === 0) wornInfo = "Status: WORN TODAY (Avoid unless specified)";
        else if (daysSince === 1) wornInfo = "Status: WORN YESTERDAY (Strictly avoid for Tops)";
        else if (daysSince < laundryCycleDays) wornInfo = `Status: Worn ${daysSince} days ago (Likely in Laundry)`;
        else wornInfo = `Status: Clean (Last worn ${daysSince} days ago)`;
    }

    return {
      text: `ITEM #${index}: 
      Name: ${item.name}
      Category: ${item.category}
      Color: ${item.color || 'Unspecified'}
      Material: ${item.material || 'Unspecified'}
      Fit: ${item.fit || 'Standard'}
      Type: ${item.classification || 'Basic'}
      Style: ${item.style || 'Classic'}
      ${wornInfo}`
    };
  });

  const wardrobeImages = wardrobe.map((item) => ({
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

  const targetPinterest = pinterestUrl || profile.pinterestProfile;

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
    You are "The Lady's Personal Stylist", a world-class fashion curator. 
    You strictly adhere to "The Lady's Guide to Fashion", traditional etiquette, and high-fashion protocols.
    
    FASHION PROTOCOL & RULES:
    1.  **Dress Code Adherence**:
        - **White Tie**: Floor-length ball gowns ONLY. Gloves required. No watches.
        - **Black Tie**: Floor-length gowns or very formal cocktail dresses. 
        - **Cocktail**: Knee-length or midi dresses. Heels required.
        - **Smart Casual**: Polished separates. No distressed denim.
    2.  **The Rule of Thirds**: Enforce the golden ratio in styling (1/3 to 2/3 visual split).
    3.  **Basics & Statements**: Never pair two loud statement pieces unless doing "Maximalist". Typically mix 1 statement with basics.
    4.  **Color Harmony**: Use the 3-color rule or tonal dressing. Shoes must complement the hemline.

    LAUNDRY & REWEAR LOGIC:
    - Laundry Cycle is set to ${laundryCycleDays} days.
    - **Strict Rule**: Do NOT suggest a Top worn yesterday or today.
    - **Guideline**: Avoid items labeled "Likely in Laundry" unless they are Outerwear (Coats/Jackets) or Shoes/Accessories, which have longer wear cycles.
    - **Exception**: If the user asks for a specific item, ignore laundry rules.

    ARCHITECTURAL FLATTERY:
    - You MUST balance the user's specific proportions:
    ${architectureContext}

    USER STYLE DNA:
    - Aesthetic: ${profile.aesthetic || 'Sophisticated'}
    - Signature Colors: ${profile.signatureColors}
    - Forbidden: ${profile.forbidden || 'None'}

    ${targetPinterest ? `PINTEREST ANALYSIS: Access and analyze the visual style from this Pinterest link: ${targetPinterest}. If it is a full account/profile, identify the recurring themes, color palettes, and silhouettes across all their boards to define their personal brand.` : ""}

    TASK:
    Create THREE outfit options from the WARDROBE provided to fit the request perfectly.
    ${prompt}

    Return a JSON block with "outfits" array. Reference items by their # index.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: [
        { 
          role: 'user', 
          parts: [
            ...wardrobeParts,
            { text: "--- WARDROBE IMAGES ---" },
            ...wardrobeImages, 
            { text: "--- END OF WARDROBE ---" },
            ...inspirationParts,
            { text: "--- END OF INSPIRATION ---" },
            { text: "Synthesize my daily ritual request. Ensure strict adherence to fashion rules." } 
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
                  fashionGuideline: { type: Type.STRING, description: "Cite the specific fashion rule applied (e.g. 'Rule of Thirds', 'Black Tie Protocol')" },
                  trendFactor: { type: Type.STRING },
                  identityMatch: { type: Type.STRING },
                  proportionNote: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["Classic", "Practical", "Bold"] },
                  items: { type: Type.ARRAY, items: { type: Type.STRING, description: "Index of the item in the list provided" } }
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
      items: outfit.items.map((idxStr: string) => {
        const n = parseInt(idxStr);
        return wardrobe[n]?.id;
      }).filter(Boolean)
    }));
  } catch (error) {
    console.error("Gemini Error:", error);
    throw new Error("Styling failed. Check your wardrobe metadata.");
  }
};
