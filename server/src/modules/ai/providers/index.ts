import { env } from "../../../config/env.js";
import { localProvider } from "./localProvider.js";
import type { AIProvider } from "./types.js";

/**
 * Provider factory — the ONLY place that decides which AI backend answers a request.
 * `ai.service.ts` and everything above it (controller, routes, client) only ever see the
 * `AIProvider` interface, so adding a real LLM later is a two-step, additive change:
 *
 *   1. Create `providers/openaiProvider.ts` (or `claudeProvider.ts`) implementing `AIProvider`
 *      — call the OpenAI/Anthropic SDK inside `generateResponse()`, optionally still calling
 *      into `report.service.ts`/`ingredient.service.ts` first to ground the prompt with real
 *      numbers (tool-use / RAG-style), same as `localProvider.ts` already does.
 *   2. Return it below when `env.ai.provider` matches and the matching API key is present.
 *
 * No other file needs to change. Falls back to `localProvider` for "local", an unset/missing
 * key, or any unrecognised `AI_PROVIDER` value — the app always has a working assistant even
 * with zero configuration.
 */
export function getAIProvider(): AIProvider {
  switch (env.ai.provider) {
    case "openai":
    case "claude":
    case "anthropic":
      // Not implemented yet (per product decision: ship the free local mode first). Falling
      // back keeps the app functional if AI_PROVIDER is set ahead of the key being wired up.
      return localProvider;
    case "local":
    default:
      return localProvider;
  }
}
