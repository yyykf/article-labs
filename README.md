# Article Labs

Runnable companion labs for technical articles.

This repository collects small, focused reproductions for articles. Each lab is a real working project, kept in its own subdirectory under `labs/`.

## Labs

| Lab | Article | What it reproduces |
| --- | --- | --- |
| [`codex-tool-call-loop`](./labs/codex-tool-call-loop) | [我误会了 Codex 的 Tool Call](https://mp.weixin.qq.com/s/fkg0x-A-2IU_NdlC8619hg) | A Responses API agent loop where UI receives live process output while the model only receives bounded tool results. |

## Repository Shape

```text
article-labs/
├── labs/
│   └── codex-tool-call-loop/
└── README.md
```

Each lab owns its own dependencies, README, environment example, and run instructions. A TypeScript lab can have its own `package.json`; a Python lab can have its own `pyproject.toml` or `requirements.txt`; a Go lab can have its own `go.mod`.

## Secrets

Do not commit API keys. Labs read credentials from local environment variables such as `OPENAI_API_KEY`.
