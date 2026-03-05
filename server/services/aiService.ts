import OpenAI from "openai";
import { normalizedSimilarity } from "../utils";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface GeneratedIdea {
  title: string;
  rationale: string;
  checklist: string[];
}

export interface AnalyticsData {
  trafficSources: Record<string, number>;
  searchQueries: string[];
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

export function parseGPTResponse(response: string): GeneratedIdea[] {
  try {
    const jsonMatch = response.match(/\{[\s\S]*"ideas"[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

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
    console.error("JSON parsing failed, attempting regex extraction:", parseError);
    return extractIdeasWithRegex(response);
  }
}

function extractIdeasWithRegex(response: string): GeneratedIdea[] {
  const ideas: GeneratedIdea[] = [];

  const titleMatches = response.match(/"title"\s*:\s*"([^"]+)"/g);
  const rationaleMatches = response.match(/"rationale"\s*:\s*"([^"]+)"/g);
  const checklistMatches = response.match(
    /"checklist"\s*:\s*\[([\s\S]*?)\]/g
  );

  if (!titleMatches) return ideas;

  for (let i = 0; i < titleMatches.length; i++) {
    const titleMatch = titleMatches[i].match(/"title"\s*:\s*"([^"]+)"/);
    const rationaleMatch = rationaleMatches?.[i]?.match(
      /"rationale"\s*:\s*"([^"]+)"/
    );
    const checklistMatch = checklistMatches?.[i]?.match(
      /"checklist"\s*:\s*\[([\s\S]*?)\]/
    );

    if (titleMatch) {
      const checklist: string[] = [];
      if (checklistMatch) {
        const items = checklistMatch[1].match(/"([^"]+)"/g);
        if (items) {
          items.forEach((item) => {
            const cleaned = item.replace(/"/g, "");
            if (cleaned) checklist.push(cleaned);
          });
        }
      }

      ideas.push({
        title: titleMatch[1].substring(0, 60),
        rationale: rationaleMatch?.[1] || "Based on analytics data",
        checklist:
          checklist.length >= 4
            ? checklist.slice(0, 4)
            : [
                "Research the topic",
                "Create script outline",
                "Record the video",
                "Edit and publish",
              ],
      });
    }
  }

  return ideas;
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelayMs: number = 1000
): Promise<T> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Attempt ${attempt}/${maxAttempts} failed:`, lastError.message);

      if (attempt < maxAttempts) {
        const delay = baseDelayMs * Math.pow(2, attempt - 1);
        console.log(`Retrying in ${delay}ms...`);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("All retry attempts failed");
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

  const response = await retryWithBackoff(async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "system",
          content:
            "You are a helpful TikTok content strategist. Always respond with valid JSON only.",
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_completion_tokens: 2048,
      temperature: 0.8,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI");
    }
    return content;
  });

  const ideas = parseGPTResponse(response);

  if (ideas.length === 0) {
    throw new Error("Failed to generate any valid ideas from the response");
  }

  const uniqueIdeas = checkDuplicates(ideas, previousIdeas);

  console.log(
    `Generated ${ideas.length} ideas, ${uniqueIdeas.length} unique after filtering`
  );

  return uniqueIdeas;
}

export async function analyzeScreenshot(
  base64ImageData: string
): Promise<AnalyticsData> {
  const imageUrl = base64ImageData.startsWith("data:")
    ? base64ImageData
    : `data:image/png;base64,${base64ImageData}`;

  const response = await retryWithBackoff(async () => {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        {
          role: "user",
          content: [
            {
              type: "text",
              text: `Analyze this TikTok analytics screenshot. Extract:
1) Traffic sources with percentages (e.g., 'For You Page: 45%')
2) Any search queries or keywords visible

Return as JSON: { "trafficSources": { "Source Name": percentage_number }, "searchQueries": ["query1", "query2"] }

Important:
- For trafficSources, use the source name as key and the percentage as a NUMBER (not string)
- If you can't find specific data, make reasonable estimates based on typical TikTok analytics
- Always return valid JSON only`,
            },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
      max_completion_tokens: 1024,
    });

    const content = completion.choices[0]?.message?.content;
    if (!content) {
      throw new Error("Empty response from OpenAI vision");
    }
    return content;
  });

  try {
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No valid JSON found in vision response");
    }

    const parsed = JSON.parse(jsonMatch[0]);

    const trafficSources: Record<string, number> = {};
    if (parsed.trafficSources && typeof parsed.trafficSources === "object") {
      for (const [key, value] of Object.entries(parsed.trafficSources)) {
        if (typeof value === "number") {
          trafficSources[key] = value;
        } else if (typeof value === "string") {
          const numValue = parseFloat(value.replace(/[^0-9.]/g, ""));
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
    console.error("Failed to parse vision response:", error);
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
