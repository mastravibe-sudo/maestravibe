import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const RATE_LIMIT = 8;
const RATE_WINDOW_MS = 60_000;
const MAX_ACTIVE_USERS = 5_000;
const rateLimits = new Map<string, { count: number; resetAt: number }>();

type AiTask = "bio" | "caption";
type AiContext = {
  name?: string;
  bio?: string;
  title?: string;
  caption?: string;
  postType?: string;
  tags?: string;
  location?: string;
};

function consumeRateLimit(userId: string, now: number) {
  let entry = rateLimits.get(userId);
  if (!entry || now >= entry.resetAt) {
    if (!entry && rateLimits.size >= MAX_ACTIVE_USERS) {
      for (const [id, limit] of rateLimits) {
        if (now >= limit.resetAt) rateLimits.delete(id);
      }
      if (rateLimits.size >= MAX_ACTIVE_USERS) return { allowed: false, capacityReached: true, retryAfter: 60 };
    }
    entry = { count: 0, resetAt: now + RATE_WINDOW_MS };
    rateLimits.set(userId, entry);
  }
  if (entry.count >= RATE_LIMIT) {
    return { allowed: false, capacityReached: false, retryAfter: Math.max(1, Math.ceil((entry.resetAt - now) / 1000)) };
  }
  entry.count += 1;
  return { allowed: true, capacityReached: false, retryAfter: 0 };
}

function readContext(value: unknown): AiContext | null {
  if (value === undefined) return {};
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const limits: Record<keyof AiContext, number> = {
    name: 100,
    bio: 400,
    title: 100,
    caption: 1000,
    postType: 40,
    tags: 300,
    location: 100,
  };
  const context: AiContext = {};
  for (const [key, maxLength] of Object.entries(limits) as Array<[keyof AiContext, number]>) {
    const field = (value as Record<string, unknown>)[key];
    if (field === undefined) continue;
    if (typeof field !== "string") return null;
    context[key] = field.trim().slice(0, maxLength);
  }
  return context;
}

function parseSuggestions(content: unknown, task: AiTask) {
  if (typeof content !== "string") return null;
  try {
    const parsed: unknown = JSON.parse(content);
    if (!parsed || typeof parsed !== "object" || !("suggestions" in parsed) || !Array.isArray(parsed.suggestions)) return null;
    const maxLength = task === "bio" ? 400 : 500;
    const suggestions = parsed.suggestions
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.trim().slice(0, maxLength))
      .filter(Boolean)
      .slice(0, task === "bio" ? 1 : 3);
    return suggestions.length ? suggestions : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return Response.json({ error: "Log in to use AI suggestions." }, { status: 401 });

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("account_status")
    .eq("id", user.id)
    .maybeSingle();
  if (profileError) return Response.json({ error: "Could not verify account access." }, { status: 500 });
  if (profile?.account_status !== "approved") {
    return Response.json({ error: "An approved account is required to use AI suggestions." }, { status: 403 });
  }

  const limit = consumeRateLimit(user.id, Date.now());
  if (!limit.allowed) {
    if (limit.capacityReached) {
      return Response.json({ error: "AI suggestions are temporarily busy. Please try again shortly." }, { status: 503 });
    }
    return Response.json(
      { error: "You are requesting suggestions too quickly. Please try again in a minute." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 16_384) {
    return Response.json({ error: "AI request is too large." }, { status: 413 });
  }

  let body: unknown;
  try {
    const rawBody = await request.text();
    if (rawBody.length > 16_384) return Response.json({ error: "AI request is too large." }, { status: 413 });
    body = JSON.parse(rawBody);
  } catch {
    return Response.json({ error: "Invalid AI request." }, { status: 400 });
  }
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return Response.json({ error: "Invalid AI request." }, { status: 400 });
  }

  const requestBody = body as Record<string, unknown>;
  const task = requestBody.task;
  const context = readContext(requestBody.context);
  if ((task !== "bio" && task !== "caption") || !context) {
    return Response.json({ error: "Choose a valid AI suggestion type." }, { status: 400 });
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) return Response.json({ error: "AI suggestions are not configured on the server." }, { status: 503 });

  const instructions = task === "bio"
    ? "Write one concise, authentic social profile bio. Use only details supplied by the user. Keep it under 400 characters. Return only a JSON object with a suggestions array containing one string."
    : "Write three distinct, natural social post caption suggestions. Use only details supplied by the user. Keep each under 500 characters. Return only a JSON object with a suggestions array containing three strings.";

  let groqResponse: Response;
  try {
    groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.7,
        max_tokens: task === "bio" ? 180 : 500,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: instructions },
          { role: "user", content: JSON.stringify(context) },
        ],
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return Response.json({ error: "AI suggestions are temporarily unavailable. Please try again." }, { status: 502 });
  }

  if (!groqResponse.ok) {
    return Response.json({ error: "AI suggestions could not be generated. Please try again." }, { status: 502 });
  }

  let responseBody: unknown;
  try {
    responseBody = await groqResponse.json();
  } catch {
    return Response.json({ error: "AI returned an invalid response. Please try again." }, { status: 502 });
  }

  if (!responseBody || typeof responseBody !== "object" || !("choices" in responseBody) || !Array.isArray(responseBody.choices)) {
    return Response.json({ error: "AI returned an invalid response. Please try again." }, { status: 502 });
  }
  const firstChoice = responseBody.choices[0];
  if (!firstChoice || typeof firstChoice !== "object" || !("message" in firstChoice) || !firstChoice.message || typeof firstChoice.message !== "object" || !("content" in firstChoice.message)) {
    return Response.json({ error: "AI returned an invalid response. Please try again." }, { status: 502 });
  }

  const suggestions = parseSuggestions(firstChoice.message.content, task);
  if (!suggestions) return Response.json({ error: "AI returned no usable suggestions. Please try again." }, { status: 502 });
  return Response.json({ suggestions });
}
