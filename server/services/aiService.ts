import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export interface GeneratedIdea {
  title: string;
  rationale: string;
  checklist: string[];
}

export interface AnalyticsData {
  trafficSources: Record<string, number>;
  searchQueries: string[];
}

function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1,
          matrix[i][j - 1] + 1,
          matrix[i - 1][j] + 1
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

function normalizedSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();
  const maxLen = Math.max(aLower.length, bLower.length);
  if (maxLen === 0) return 1;
  const distance = levenshteinDistance(aLower, bLower);
  return (maxLen - distance) / maxLen;
}

export function checkDuplicates(
  newIdeas: GeneratedIdea[],
  previousTitles: string[],
  threshold: number = 0.85
): GeneratedIdea[] {
  return newIdeas.filter((idea) => {
    for (const prevTitle of previousTitles) {
      const similarity = normalizedSimilarity(idea.title, prevTitle);
      if (similarity > threshold) {
        console.log(
          `Rejecting duplicate idea: "${idea.title}" (${(similarity * 100).toFixed(1)}% similar to "${prevTitle}")`
        );
        return false;
      }
    }
    return true;
  });
}

// Helper to clean JSON string if it contains markdown formatting
function cleanJsonString(text: string): string {
  if (!text) return "";
  // Remove markdown code blocks if present
  let cleaned = text.replace(/```json/g, "").replace(/```/g, "");
  return cleaned.trim();
}

export function parseAIResponse(response: string): GeneratedIdea[] {
  try {
    const cleanedResponse = cleanJsonString(response);
    const parsed = JSON.parse(cleanedResponse);

    if (!parsed.ideas || !Array.isArray(parsed.ideas)) {
      throw new Error("Response missing 'ideas' array");
    }

    const validIdeas: GeneratedIdea[] = [];

    for (const idea of parsed.ideas) {
      if (
        typeof idea.title === "string" &&
        typeof idea.rationale === "string" &&
        Array.isArray(idea.checklist) &&
        idea.checklist.length >= 4 &&
        idea.checklist.every((item: unknown) => typeof item === "string")
      ) {
        validIdeas.push({
          title: idea.title.substring(0, 60),
          rationale: idea.rationale,
          checklist: idea.checklist.slice(0, 4),
        });
      }
    }

    return validIdeas;
  } catch (parseError) {
    console.error("JSON parsing failed:", parseError);
    return [];
  }
}

export async function generateIdeas(
  analyticsData: AnalyticsData,
  previousIdeas: string[] = []
): Promise<GeneratedIdea[]> {
  const trafficSourcesFormatted = Object.entries(analyticsData.trafficSources)
    .map(([source, percentage]) => `${source}: ${percentage}%`)
    .join(", ");

  const searchQueriesFormatted =
    analyticsData.searchQueries.length > 0
      ? analyticsData.searchQueries.join(", ")
      : "No search queries available";

  const previousIdeasFormatted =
    previousIdeas.length > 0
      ? previousIdeas.join(", ")
      : "None";

  const prompt = `You are a TikTok content strategist. Based on the following analytics data, generate 8 unique 'How To' video ideas.

Analytics:
- Traffic Sources: ${trafficSourcesFormatted}
- Top Search Queries: ${searchQueriesFormatted}

Requirements:
1. Each idea MUST start with "How To" followed by a specific action and outcome
2. Ideas should target the highest traffic sources
3. Ideas should incorporate the search queries when relevant
4. Each idea must be unique and actionable
5. Avoid these previously generated ideas: ${previousIdeasFormatted}

For each idea, provide:
- title: The "How To..." video idea (max 60 characters)
- rationale: Brief explanation of why this idea (based on which traffic source/query)
- checklist: Exactly 4 actionable steps to complete this video

Return ONLY a valid JSON object with this structure:
{
  "ideas": [
    {
      "title": "How To...",
      "rationale": "Based on...",
      "checklist": ["Step 1", "Step 2", "Step 3", "Step 4"]
    }
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const result = await model.generateContent(prompt);
    const response = result.response.text();

    const ideas = parseAIResponse(response);

    if (ideas.length === 0) {
      throw new Error("Failed to generate any valid ideas from the response");
    }

    const uniqueIdeas = checkDuplicates(ideas, previousIdeas);

    console.log(
      `Generated ${ideas.length} ideas, ${uniqueIdeas.length} unique after filtering`
    );

    return uniqueIdeas;
  } catch (error) {
    console.error("Generate ideas error:", error);
    throw error;
  }
}

export async function analyzeScreenshot(
  base64ImageData: string,
  mimeType: string = "image/png"
): Promise<AnalyticsData> {
  try {
    // Strip header if present to get just the base64 data
    const base64Data = base64ImageData.replace(/^data:image\/\w+;base64,/, "");

    const model = genAI.getGenerativeModel({
      model: "gemini-1.5-flash",
      generationConfig: { responseMimeType: "application/json" }
    });

    const prompt = `Analyze this TikTok analytics screenshot. Extract:
1) Traffic sources with percentages (e.g., 'For You Page: 45%')
2) Any search queries or keywords visible

Return as JSON: { "trafficSources": { "Source Name": percentage_number }, "searchQueries": ["query1", "query2"] }

Important:
- For trafficSources, use the source name as key and the percentage as a NUMBER (not string)
- If you can't find specific data, make reasonable estimates based on typical TikTok analytics
- Return ONLY valid JSON`;

    const imagePart = {
      inlineData: {
        data: base64Data,
        mimeType,
      },
    };

    const result = await model.generateContent([prompt, imagePart]);
    const response = result.response.text();
    const cleanedResponse = cleanJsonString(response);
    const parsed = JSON.parse(cleanedResponse);

    const trafficSources: Record<string, number> = {};
    if (parsed.trafficSources && typeof parsed.trafficSources === "object") {
      for (const [key, value] of Object.entries(parsed.trafficSources)) {
        if (typeof value === "number") {
          trafficSources[key] = value;
        } else if (typeof value === "string") {
          const numValue = parseFloat((value as string).replace(/[^0-9.]/g, ""));
          if (!isNaN(numValue)) {
            trafficSources[key] = numValue;
          }
        }
      }
    }

    const searchQueries: string[] = [];
    if (Array.isArray(parsed.searchQueries)) {
      for (const query of parsed.searchQueries) {
        if (typeof query === "string" && query.trim()) {
          searchQueries.push(query.trim());
        }
      }
    }

    if (Object.keys(trafficSources).length === 0) {
      trafficSources["For You Page"] = 60;
      trafficSources["Following"] = 20;
      trafficSources["Search"] = 15;
      trafficSources["Other"] = 5;
      console.log("Using default traffic sources as none were extracted");
    }

    return { trafficSources, searchQueries };
  } catch (error) {
    console.error("Failed to analyze screenshot:", error);
    return {
      trafficSources: {
        "For You Page": 60,
        "Following": 20,
        "Search": 15,
        "Other": 5,
      },
      searchQueries: [],
    };
  }
}
