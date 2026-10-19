# API Coverage — Ollama /api/chat and OpenAI Chat Completions (quick 261018-wax)

> Full coverage by default. Opt-outs are explicit, reasoned decisions.
> Scope: this quick task adds request parameters to two endpoints QueQue already calls
> (Phase 08 plans 08-03 and 08-04). No new endpoint, SDK or package is added. Rows cover the
> capabilities of those two endpoints that bear on getting a whole answer back.

| capability | decision | reason |
|---|---|---|
| ollama.chat (non-streaming POST, existing) | INTEGRATE | |
| ollama.chat.think (false: no thinking output) | INTEGRATE | |
| ollama.chat.format (JSON schema structured output) | INTEGRATE | |
| ollama.chat.options.num_predict (output cap 16000) | INTEGRATE | |
| ollama.chat.options.num_ctx (context 20480) | INTEGRATE | |
| ollama.chat.done_reason (cut-off detection, existing read) | INTEGRATE | |
| ollama.tags (model list for the picker, existing) | INTEGRATE | |
| ollama.chat.stream (streamed rows) | OPT-OUT | not needed yet: only the Claude adapters stream rows; out of scope for this cut-off fix |
| ollama.chat.tools | OPT-OUT | explicitly out of scope: QueQue returns command candidates, it never runs tools |
| ollama.generate / embed / pull / create / delete / show | OPT-OUT | not needed: chat covers the one turn QueQue makes; model management stays with the ollama CLI |
| ollama.chat.options sampling (temperature, top_p, seed) | OPT-OUT | not needed: steering goes in the system prompt only (project rule) |
| openai.chat_completions (POST, existing) | INTEGRATE | |
| openai.chat_completions.response_format json_schema strict | INTEGRATE | |
| openai.chat_completions.max_completion_tokens (16000) | INTEGRATE | |
| openai.chat_completions.reasoning_effort (low, retry ladder none/minimal/low, omit on rejection) | INTEGRATE | |
| openai.chat_completions.finish_reason (cut-off detection, existing read) | INTEGRATE | |
| openai.chat_completions.refusal (existing read) | INTEGRATE | |
| openai.chat_completions.stream | OPT-OUT | not needed yet: only the Claude adapters stream rows; out of scope for this cut-off fix |
| openai.chat_completions.tools / tool_choice | OPT-OUT | explicitly out of scope: QueQue never runs tools |
| openai.chat_completions sampling (temperature, top_p, max_tokens) | OPT-OUT | not needed and rejected by reasoning models (cerebrum 08-04 rule) |
| openai.responses API | OPT-OUT | explicitly out of scope: the adapter stays on Chat Completions (08-04 decision) |
| openai.models list | OPT-OUT | not needed: the pin names the model; the picker does not list OpenAI models |
