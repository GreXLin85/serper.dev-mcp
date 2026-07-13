# serper-dev-mcp

A local [Model Context Protocol](https://modelcontextprotocol.io/) server for the working [Serper.dev](https://serper.dev/) Google search and web scraping APIs. It exposes twelve focused tools over stdio for clients such as Claude Code and Codex.

The server requires Node.js 20 or newer and a Serper.dev API key. Every request consumes credits from the configured Serper account according to Serper's current pricing.

## Tools

The package deliberately does not expose Scholar because that endpoint is not working, and it does not provide batch tools.

| MCP tool | Serper endpoint | Purpose | Required parameters |
| --- | --- | --- | --- |
| `serper_search` | `search` | Google web results | `q` |
| `serper_images` | `images` | Google image results | `q` |
| `serper_videos` | `videos` | Google video results | `q` |
| `serper_places` | `places` | Google local place results | `q` |
| `serper_maps` | `maps` | Google Maps place results | At least one of `q`, `placeId`, or `cid` |
| `serper_reviews` | `reviews` | Reviews for a Google place | At least one of `cid`, `fid`, or `placeId` |
| `serper_news` | `news` | Google News results | `q` |
| `serper_shopping` | `shopping` | Google Shopping results | `q` |
| `serper_lens` | `lens` | Google Lens analysis of an image | `url` |
| `serper_patents` | `patents` | Google Patents results | `q` |
| `serper_autocomplete` | `autocomplete` | Google query suggestions | `q` |
| `serper_scrape` | `scrape` | Extract content from a web page | `url` |

### Parameters

Search-like tools accept the following parameters where shown below:

- `q` (string): query text.
- `location` (string, optional): geographic location for localized results.
- `gl` (string, optional): two-letter lowercase country code, such as `us` or `tr`.
- `hl` (string, optional): two-letter lowercase interface language code, such as `en` or `tr`.
- `tbs` (string, optional): Google time-based filter, such as `qdr:h` or `qdr:m`.
- `num` (positive integer, optional): requested maximum result count.
- `page` (positive integer, optional): one-based result page.

`serper_search`, `serper_images`, `serper_videos`, `serper_places`, `serper_news`, `serper_shopping`, and `serper_patents` accept all seven search-like parameters. `serper_autocomplete` accepts `q`, `location`, `gl`, and `hl`.

Specialized tools use these parameters:

- `serper_maps`: optional `q`, `hl`, `ll`, `placeId`, `cid`, and `page`. At least one of `q`, `placeId`, or `cid` is required. `ll` identifies the map center/zoom string accepted by Serper.
- `serper_reviews`: optional `cid`, `fid`, `placeId`, `gl`, `hl`, `sortBy`, `topicId`, and `nextPageToken`. At least one place identifier is required. `sortBy` is one of `mostRelevant`, `newest`, `highestRating`, or `lowestRating`.
- `serper_lens`: required `url`, plus optional `location`, `gl`, `hl`, and `tbs`.
- `serper_scrape`: required `url` and optional boolean `includeMarkdown`.

Lens and scrape URLs must use `http` or `https`. Each successful call returns the complete Serper object as MCP `structuredContent`, plus pretty-printed JSON text for clients without structured-output support.

## Run with npx

The package is designed to be launched by an MCP client, but it can be started directly when `SERPER_API_KEY` is already set in the process environment:

```bash
SERPER_API_KEY=YOUR_KEY npx -y serper-dev-mcp
```

The process communicates using MCP JSON-RPC on stdout, so it does not print a startup banner.

## Claude Code

Register it for the current user:

```bash
claude mcp add --scope user serper-dev -e SERPER_API_KEY=YOUR_KEY -- npx -y serper-dev-mcp
```

Use `--scope project` instead of `--scope user` only when a project-scoped configuration is appropriate. Do not commit a real key in shared MCP configuration.

## Codex

Register the server with Codex:

```bash
codex mcp add serper-dev --env SERPER_API_KEY=YOUR_KEY -- npx -y serper-dev-mcp
```

Keep the real value in an environment or secret-management workflow appropriate for your machine rather than in repository files.

## Local development

Install and build from source:

```bash
git clone https://github.com/GreXLin85/serper.dev-mcp.git
cd serper.dev-mcp
npm install
npm run build
SERPER_API_KEY=YOUR_KEY node dist/index.js
```

Offline project checks:

```bash
npm test
npm run typecheck
npm run build
npm pack --dry-run
```

The tests inject fake HTTP responses and do not consume Serper credits. For interactive protocol inspection, build the package and launch `node dist/index.js` through the [MCP Inspector](https://github.com/modelcontextprotocol/inspector), providing `SERPER_API_KEY` only through its environment configuration.

## Security

- The API key is read only from `SERPER_API_KEY`; it is never a tool argument.
- The server does not log request headers, bodies, successful responses, or the API key.
- HTTP response details are bounded and reflected credentials are redacted before errors cross the MCP boundary.
- Network, timeout, invalid-response, and unexpected errors use safe messages without stack traces.
- Only `http` and `https` URLs are accepted by Lens and scrape tools.
- `.env` files and the local `requests` reference file are excluded from Git and the npm package.

Revoke and rotate any credential that has been pasted into a command, document, issue, chat, or other non-secret store before publishing or sharing the repository.

## Publishing checklist

Before releasing a version:

1. Revoke any previously exposed key and confirm no credential is present in tracked files or Git history.
2. Run `npm test`, `npm run typecheck`, and `npm run build` on Node.js 20 or newer.
3. Run `npm pack --dry-run` and confirm the package contains only compiled `dist` output, `README.md`, `LICENSE`, and npm-generated package metadata.
4. Inspect the twelve advertised tools with MCP Inspector using a non-production key with limited credits.
5. Update the version and release notes, then publish with the intended npm account and provenance settings.
6. Tag the exact published commit and create the matching GitHub release.

Publishing, remote creation, CI setup, and live API smoke tests are intentionally not automated by this repository.

## Credits and license

This project uses the official [Model Context Protocol TypeScript SDK](https://github.com/modelcontextprotocol/typescript-sdk) and integrates with [Serper.dev](https://serper.dev/). It is not affiliated with Google or Serper.dev.

Licensed under the [MIT License](LICENSE). Copyright 2026 GreXLin85.
