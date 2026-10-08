# API Coverage — Phase 08 (Ollama, OpenAI, Anthropic Messages, Claude Code CLI)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> QueQue's need from every backend is the same: one single-turn request (system prompt + privacy-filtered user prompt) that returns a JSON array of 1-3 shell command candidates, inside a 25s budget, inserted into the shell buffer and never executed.
> Surfaces verified 2026-10-07 via Context7 (/websites/ollama_api, /websites/developers_openai_api_reference, /websites/developers_openai_api) and 08-RESEARCH.md (Claude Code 2.1.206).

## Ollama REST API (plans 08-03, 08-05)

| capability | decision | reason |
|---|---|---|
| ollama:chat (POST /api/chat, stream false) | INTEGRATE | |
| ollama:tags (GET /api/tags, picker model list) | INTEGRATE | |
| ollama:chat-streaming | OPT-OUT | not needed — the modal renders only after a complete JSON array parses |
| ollama:structured-output-format | OPT-OUT | not needed yet — shared prompt-level JSON contract plus fail-closed parseCandidates; revisit if local models return prose |
| ollama:tools | OPT-OUT | explicitly out of scope — QueQue never lets a model run tools (insertion-only) |
| ollama:generate (POST /api/generate) | OPT-OUT | not needed — /api/chat covers the system plus user single turn |
| ollama:embed | OPT-OUT | not needed — no retrieval in v1 |
| ollama:show | OPT-OUT | not needed yet — model capabilities are not used to tune requests |
| ollama:pull | OPT-OUT | explicitly out of scope — the picker prints the ollama pull command instead of downloading gigabytes for the user |
| ollama:push | OPT-OUT | explicitly out of scope — QueQue never manages the user's model store |
| ollama:create | OPT-OUT | explicitly out of scope — QueQue never manages the user's model store |
| ollama:copy | OPT-OUT | explicitly out of scope — QueQue never manages the user's model store |
| ollama:delete | OPT-OUT | explicitly out of scope — QueQue never manages the user's model store |
| ollama:ps | OPT-OUT | not needed — loaded-model state is not surfaced |
| ollama:version | OPT-OUT | not needed — /api/tags already proves the server answers |
| ollama:think | OPT-OUT | not needed yet — model default thinking; only message.content is parsed |
| ollama:keep-alive | OPT-OUT | not needed — Ollama default keep-alive is fine for repeat ?? |
| ollama:logprobs | OPT-OUT | not needed |
| ollama:images | OPT-OUT | not needed — text-only shell queries |
| ollama:openai-compatible-endpoint (/v1/chat/completions) | OPT-OUT | not needed — native /api/chat is used |
| ollama:cloud-models (ollama.com with OLLAMA_API_KEY) | OPT-OUT | not needed yet — the pin is local-first and a cloud key would need its own secrets decision |

## OpenAI API (plan 08-04)

| capability | decision | reason |
|---|---|---|
| openai:chat-completions (POST /v1/chat/completions) | INTEGRATE | |
| openai:responses (POST /v1/responses) | OPT-OUT | not needed — Chat Completions covers one text turn and keeps the adapter small |
| openai:streaming | OPT-OUT | not needed — the full JSON array is required before rendering |
| openai:structured-outputs (response_format json_schema) | OPT-OUT | not needed yet — json_schema needs a top-level object, which would fork the shared array contract |
| openai:tools-function-calling | OPT-OUT | explicitly out of scope — insertion-only, no model tool execution |
| openai:models-list | OPT-OUT | not needed yet — the picker checks key presence only and the first ?? validates the key |
| openai:custom-base-url | OPT-OUT | explicitly out of scope — the pin has no baseUrl for openai so OPENAI_API_KEY only goes to api.openai.com |
| openai:embeddings | OPT-OUT | not needed — no retrieval in v1 |
| openai:images | OPT-OUT | explicitly out of scope — text-only product |
| openai:audio-speech-transcription | OPT-OUT | explicitly out of scope — text-only product |
| openai:moderation | OPT-OUT | not needed — output is shown to the user and never executed automatically |
| openai:files | OPT-OUT | explicitly out of scope — no uploads; file contents never leave the machine |
| openai:batch | OPT-OUT | not needed — interactive latency path only |
| openai:fine-tuning | OPT-OUT | explicitly out of scope |
| openai:assistants-threads | OPT-OUT | explicitly out of scope — stateless single turn |
| openai:vector-stores | OPT-OUT | explicitly out of scope |
| openai:realtime | OPT-OUT | explicitly out of scope |
| openai:organization-admin | OPT-OUT | explicitly out of scope |

## Anthropic Messages API via @anthropic-ai/sdk (plan 08-02 and commit 07738ca, shipped)

| capability | decision | reason |
|---|---|---|
| anthropic:messages-create | INTEGRATE | |
| anthropic:streaming | OPT-OUT | not needed — the full JSON array is required before rendering |
| anthropic:tools | OPT-OUT | explicitly out of scope — insertion-only, no model tool execution |
| anthropic:prompt-caching | OPT-OUT | not needed yet — prompts are small and vary per query |
| anthropic:message-batches | OPT-OUT | not needed — interactive latency path only |
| anthropic:token-counting | OPT-OUT | not needed |
| anthropic:files | OPT-OUT | explicitly out of scope — file contents never leave the machine |
| anthropic:models-list | OPT-OUT | not needed — model comes from QQ_MODEL or the default |

## Claude Code CLI print mode (plan 08-02, shipped)

| capability | decision | reason |
|---|---|---|
| claude-code:print-mode-text (claude -p --output-format text) | INTEGRATE | |
| claude-code:output-format-json-or-stream-json | OPT-OUT | not needed — wrapper envelope; text output is the candidate contract |
| claude-code:json-schema | OPT-OUT | not needed yet — later hardening noted in 08-RESEARCH |
| claude-code:tools-mcp-hooks | OPT-OUT | explicitly out of scope — safe-mode with tools disabled keeps the pane from hanging or running tools |
| claude-code:session-persistence-resume | OPT-OUT | not needed — runs with no session persistence |
| claude-code:bare-mode | OPT-OUT | explicitly out of scope — bare mode skips Keychain and OAuth and breaks /login users |
