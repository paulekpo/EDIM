export interface AnalyticsData {
  trafficSources: Record<string, number>;
  searchQueries: string[];
}

export interface TrafficSource {
  name: string;
  percentage: number;
}

export function validateTrafficSources(sources: TrafficSource[]): { isValid: boolean; error?: string } {
  if (sources.length === 0) {
    return { isValid: false, error: "At least one traffic source is required" };
  }

  for (const source of sources) {
    if (!source.name.trim()) {
      return { isValid: false, error: "All traffic sources must have a name" };
    }
    if (source.percentage < 0 || source.percentage > 100) {
      return { isValid: false, error: "Percentage must be between 0 and 100" };
    }
  }

  const total = sources.reduce((sum, s) => sum + s.percentage, 0);
  if (Math.abs(total - 100) > 0.01) {
    return { isValid: false, error: `Traffic sources must total 100% (currently ${total.toFixed(1)}%)` };
  }

  return { isValid: true };
}

export function trafficSourcesToRecord(sources: TrafficSource[]): Record<string, number> {
  return sources.reduce((acc, source) => {
    acc[source.name.trim()] = source.percentage;
    return acc;
  }, {} as Record<string, number>);
}

export function parseSearchQueries(input: string): string[] {
  return input
    .split(",")
    .map((q) => q.trim())
    .filter((q) => q.length > 0);
}

export function validateSearchQueries(_queries: string[]): { isValid: boolean; error?: string } {
  // Search queries are optional - if missing, user will see a suggestion toast
  return { isValid: true };
}

export const ACCEPTED_IMAGE_TYPES = ["image/png", "image/jpeg", "image/jpg"];
export const MAX_FILE_SIZE_MB = 10;
export const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

export function validateImageFile(file: File): { isValid: boolean; error?: string } {
  if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
    return { isValid: false, error: "Only PNG, JPG, and JPEG images are accepted" };
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    return { isValid: false, error: `File size must be under ${MAX_FILE_SIZE_MB}MB` };
  }
  return { isValid: true };
}
