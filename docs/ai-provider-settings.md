# AI provider settings

IT Admin > Tokens > AI Provider controls both policy alignment and the chatbot.
Select a provider, enter its chat model ID and API key, then select Test & Save.
This sends a small JSON generation request (provider charges may apply). Settings
are replaced only after a valid response. A connection test is not a guarantee of
policy-analysis accuracy or future provider availability.

Supported providers: DeepSeek, OpenAI, Google Gemini, Groq and OpenRouter.
Use a text chat model supporting JSON output. Native Anthropic endpoints and
arbitrary custom URLs are not supported; compatible models can be used through
OpenRouter. Provider keys are not interchangeable.

An empty key input preserves the saved key only for the same provider. Changing
providers requires a new key. Clear credentials disables both AI features,
including fallback to the environment key. A failed replacement preserves the
previous configuration. Saving another valid configuration re-enables AI.

The encrypted configuration lives in the existing system_settings table and
requires the deployment's stable APP_KEY. No database migration is needed.
DEEPSEEK_API_KEY and DEEPSEEK_MODEL remain the initial fallback until settings
are first saved or cleared. Keys are never returned by the settings API or
included in audit payloads. Provider URLs are fixed and redirects are disabled.

GET, POST and DELETE /api/ai-settings require authentication and the existing
it_admin or it_publisher administrator roles. POST is limited to 10 requests per
minute. Both AI clients resolve the current settings on each call.

Verification:

```powershell
php backend/vendor/phpunit/phpunit/phpunit backend/tests --bootstrap backend/vendor/autoload.php
cd frontend-rn
npx tsc --noEmit
npx expo export -p web
node tests/ai-settings.browser.cjs
```

The browser test expects a frontend at localhost:3001 (override with
POSTFLOW_WEB_URL), mocks API requests and never changes live settings.

Provider references:

- https://api-docs.deepseek.com/api/create-chat-completion/
- https://developers.openai.com/api/reference/resources/chat/subresources/completions/methods/create
- https://ai.google.dev/gemini-api/docs/openai
- https://console.groq.com/docs/openai
- https://openrouter.ai/docs/api/reference/overview
