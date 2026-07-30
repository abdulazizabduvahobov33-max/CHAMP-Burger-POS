/** Everything an AIProvider needs to answer a business question — resolved once per request
 * by ai.service.ts so no provider implementation has to know about auth/req internals. */
export type AIContext = {
  locationId: string;
  userId: string;
};

export type AIReply = {
  text: string;
};

/**
 * The single interface every AI backend implements — the free local provider today, OpenAI or
 * Anthropic Claude later. Nothing outside `modules/ai/providers` (the service, controller,
 * routes, or the client) knows or cares which implementation is active: swap the provider
 * returned by `providers/index.ts`'s `getAIProvider()` and everything else keeps working
 * unchanged.
 */
export interface AIProvider {
  readonly name: string;
  generateResponse(message: string, context: AIContext): Promise<AIReply>;
}
