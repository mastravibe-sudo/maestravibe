export type AiTask = "bio" | "caption";

export type AiContext = {
  name?: string;
  bio?: string;
  title?: string;
  caption?: string;
  postType?: string;
  tags?: string;
  location?: string;
};

export async function generateAiSuggestions(task: AiTask, context: AiContext) {
  let response: Response;
  try {
    response = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ task, context }),
    });
  } catch {
    throw new Error("Could not reach AI suggestions. Check your connection and try again.");
  }

  let result: { suggestions?: unknown; error?: unknown };
  try {
    result = await response.json() as typeof result;
  } catch {
    throw new Error("AI suggestions returned an invalid response. Please try again.");
  }
  if (!response.ok) {
    throw new Error(typeof result.error === "string" ? result.error : "AI suggestions could not be generated.");
  }
  if (!Array.isArray(result.suggestions) || !result.suggestions.every((item) => typeof item === "string")) {
    throw new Error("AI suggestions returned an invalid response. Please try again.");
  }
  return result.suggestions as string[];
}
