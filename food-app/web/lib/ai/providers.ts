// Adapters for the frontier providers. Each one lists the models a key can use and runs one chat completion.
// The fetch function is injected so tests run without a network or a real key. Errors never include the key.

export type ProviderId = 'openai' | 'anthropic' | 'gemini';
export const PROVIDERS: { id: ProviderId; label: string }[] = [
  { id: 'openai', label: 'OpenAI' },
  { id: 'anthropic', label: 'Anthropic (Claude)' },
  { id: 'gemini', label: 'Google (Gemini)' },
];
export const isProvider = (v: unknown): v is ProviderId => PROVIDERS.some((p) => p.id === v);

export type ModelInfo = { id: string; label: string };
type Fetch = typeof fetch;

export class ProviderError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

const TIMEOUT_MS = 20_000;

async function call(fetchFn: Fetch, url: string, init: RequestInit): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchFn(url, { ...init, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch {
    // No answer at all (offline, DNS, timeout). The error text is generic: it must not echo the URL's headers.
    throw new ProviderError('The provider could not be reached. Check the network and try again.', 0);
  }
  if (!response.ok) {
    // The status is useful to the admin ("key refused" or "model not available"); the body may echo details, so it is not shown.
    const message = response.status === 401 || response.status === 403
      ? 'The provider refused this key. Check it is correct and has access to the models.'
      : response.status === 404
        ? 'The provider does not have that model available for this key.'
        : `The provider answered with status ${response.status}.`;
    throw new ProviderError(message, response.status);
  }
  return response.json();
}

/** Models a key can use for chat. Non-chat models (embeddings, speech, images) are filtered out. */
export async function listModels(provider: ProviderId, apiKey: string, fetchFn: Fetch = fetch): Promise<ModelInfo[]> {
  if (provider === 'openai') {
    const json = (await call(fetchFn, 'https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${apiKey}` },
    })) as { data: { id: string }[] };
    const chat = /^(gpt-|o\d|chatgpt-)/;
    const excluded = /(embedding|tts|whisper|dall-e|moderation|image|audio|realtime|transcribe|search)/;
    return json.data
      .map((m) => m.id)
      .filter((id) => chat.test(id) && !excluded.test(id))
      .sort()
      .map((id) => ({ id, label: id }));
  }
  if (provider === 'anthropic') {
    const json = (await call(fetchFn, 'https://api.anthropic.com/v1/models?limit=100', {
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
    })) as { data: { id: string; display_name?: string }[] };
    return json.data
      .filter((m) => m.id.startsWith('claude'))
      .map((m) => ({ id: m.id, label: m.display_name ?? m.id }));
  }
  const json = (await call(fetchFn, 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', {
    headers: { 'x-goog-api-key': apiKey },
  })) as { models: { name: string; displayName?: string; supportedGenerationMethods?: string[] }[] };
  return json.models
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => ({ id: m.name.replace(/^models\//, ''), label: m.displayName ?? m.name }));
}

/** One chat completion. The system text and the customer text are sent as separate roles. Returns the reply text. */
export async function complete(
  provider: ProviderId,
  apiKey: string,
  model: string,
  system: string,
  user: string,
  fetchFn: Fetch = fetch,
): Promise<string> {
  if (provider === 'openai') {
    const json = (await call(fetchFn, 'https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        response_format: { type: 'json_object' },
        max_completion_tokens: 600,
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    })) as { choices: { message: { content: string } }[] };
    return json.choices[0]?.message?.content ?? '';
  }
  if (provider === 'anthropic') {
    const json = (await call(fetchFn, 'https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, max_tokens: 600, system, messages: [{ role: 'user', content: user }] }),
    })) as { content: { type: string; text?: string }[] };
    return json.content.find((c) => c.type === 'text')?.text ?? '';
  }
  const json = (await call(fetchFn, `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST',
    headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents: [{ role: 'user', parts: [{ text: user }] }],
      generationConfig: { responseMimeType: 'application/json', maxOutputTokens: 600 },
    }),
  })) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  return json.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}
