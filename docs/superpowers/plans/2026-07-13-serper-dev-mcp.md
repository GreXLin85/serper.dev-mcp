# Serper.dev MCP Server Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publish-ready `serper-dev-mcp` TypeScript package exposing twelve working Serper.dev endpoints as separate stdio MCP tools for Claude Code and Codex.

**Architecture:** A transport-independent `McpServer` registers endpoint definitions backed by a shared fetch-based Serper client. Request schemas are endpoint-specific; response schemas model stable/common fields with passthrough preservation, and handlers return both structured JSON and text JSON.

**Tech Stack:** Node.js 20+, TypeScript 7, ESM, `@modelcontextprotocol/sdk` 1.29, Zod 4, Vitest 4, npm.

---

## File Map

- Create `package.json`: npm package, executable, scripts, dependencies, and publish allowlist.
- Create `tsconfig.json`: strict ESM compilation to `dist`.
- Create `vitest.config.ts`: focused unit-test discovery.
- Create `.gitignore`: prevent secrets, local request samples, dependencies, output, and coverage from entering Git.
- Create `LICENSE`: MIT license.
- Create `src/serper-client.ts`: authenticated POST client and sanitized errors.
- Create `src/schemas.ts`: reusable request fields, twelve input schemas, and extensible response schemas.
- Create `src/tools.ts`: declarative endpoint registry and twelve MCP registrations.
- Create `src/server.ts`: construct a server with injected client dependencies.
- Create `src/index.ts`: stdio executable and startup configuration.
- Create `test/serper-client.test.ts`: focused transport/error tests.
- Create `test/tools.test.ts`: tool list, routing, validation, output, and error tests.
- Create `README.md`: install, integration, security, development, and publication guide.

## Task 1: Package Scaffold

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `vitest.config.ts`
- Create: `.gitignore`
- Create: `LICENSE`

- [ ] **Step 1: Add package metadata and scripts**

Use package name and executable `serper-dev-mcp`, ESM mode, `dist/index.js` as the binary, Node `>=20`, and a `files` allowlist containing only `dist`, `README.md`, and `LICENSE`. Add `build`, `typecheck`, `test`, `test:watch`, and `prepack` scripts. Pin current compatible major versions for the MCP SDK, Zod, TypeScript, Vitest, and Node types.

```json
{
  "name": "serper-dev-mcp",
  "version": "0.1.0",
  "description": "Model Context Protocol server for Serper.dev search and scraping APIs",
  "type": "module",
  "bin": { "serper-dev-mcp": "dist/index.js" },
  "files": ["dist", "README.md", "LICENSE"],
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "typecheck": "tsc -p tsconfig.json --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "prepack": "npm run build"
  },
  "engines": { "node": ">=20" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.29.0",
    "zod": "^4.4.3"
  },
  "devDependencies": {
    "@types/node": "^26.1.1",
    "typescript": "^7.0.2",
    "vitest": "^4.1.10"
  },
  "license": "MIT"
}
```

- [ ] **Step 2: Add strict compiler and test configuration**

Compile `src` only with `module` and `moduleResolution` set to `NodeNext`, `target` `ES2022`, `rootDir` `src`, `outDir` `dist`, declarations and source maps enabled, and strict/noUncheckedIndexedAccess enabled. Configure Vitest for `test/**/*.test.ts` in Node.

- [ ] **Step 3: Protect local and secret-bearing files**

Ignore `node_modules/`, `dist/`, `coverage/`, `.env`, `.env.*`, `*.log`, and `/requests`. Do not modify or add the local `requests` file.

- [ ] **Step 4: Add the MIT license**

Use the standard MIT text with copyright `2026 GreXLin85`.

- [ ] **Step 5: Install dependencies without running validation**

Run: `npm install`

Expected: `package-lock.json` is created and no source/test validation is run during the implementation phase.

- [ ] **Step 6: Commit the scaffold**

```bash
git add package.json package-lock.json tsconfig.json vitest.config.ts .gitignore LICENSE
git commit -m "chore: scaffold Serper MCP package"
```

## Task 2: Serper HTTP Client

**Files:**
- Create: `test/serper-client.test.ts`
- Create: `src/serper-client.ts`

- [ ] **Step 1: Write focused client tests first**

Define a reusable fake `fetch` and cover these behaviors without real network access:

```ts
it('posts JSON with Serper authentication to the Google host', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ credits: 1 }), { status: 200 }),
  );
  const client = new SerperClient({ apiKey: 'test-key', fetch });
  await client.request('search', { q: 'apple' });
  expect(fetch).toHaveBeenCalledWith(
    'https://google.serper.dev/search',
    expect.objectContaining({
      method: 'POST',
      headers: expect.objectContaining({ 'X-API-KEY': 'test-key' }),
      body: JSON.stringify({ q: 'apple' }),
    }),
  );
});

it('routes scrape to the scrape host', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response(JSON.stringify({ text: 'Example' }), { status: 200 }),
  );
  await new SerperClient({ apiKey: 'test-key', fetch }).request('scrape', {
    url: 'https://example.com',
  });
  expect(fetch).toHaveBeenCalledWith('https://scrape.serper.dev/', expect.any(Object));
});

it('reports non-2xx responses without exposing the API key', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response('rate limited', { status: 429 }),
  );
  const request = new SerperClient({ apiKey: 'test-key', fetch }).request('search', { q: 'apple' });
  await expect(request).rejects.toMatchObject({ code: 'http', status: 429 });
  await expect(request).rejects.not.toThrow('test-key');
});

it('distinguishes invalid JSON responses', async () => {
  const fetch = vi.fn<typeof globalThis.fetch>().mockResolvedValue(
    new Response('not-json', { status: 200 }),
  );
  await expect(
    new SerperClient({ apiKey: 'test-key', fetch }).request('search', { q: 'apple' }),
  ).rejects.toMatchObject({ code: 'invalid_response' });
});

it('maps aborted requests to a timeout error', async () => {
  vi.useFakeTimers();
  const fetch = vi.fn<typeof globalThis.fetch>((_input, init) => new Promise((_resolve, reject) => {
    init?.signal?.addEventListener('abort', () => reject(init.signal?.reason));
  }));
  const request = new SerperClient({ apiKey: 'test-key', fetch, timeoutMs: 1_000 })
    .request('search', { q: 'apple' });
  await vi.advanceTimersByTimeAsync(1_000);
  await expect(request).rejects.toMatchObject({ code: 'timeout' });
  vi.useRealTimers();
});
```

- [ ] **Step 2: Implement the minimal client API**

Export:

```ts
export type SerperEndpoint =
  | 'search' | 'images' | 'videos' | 'places' | 'maps' | 'reviews'
  | 'news' | 'shopping' | 'lens' | 'patents' | 'autocomplete' | 'scrape';

export interface SerperClientOptions {
  apiKey: string;
  fetch?: typeof globalThis.fetch;
  timeoutMs?: number;
}

export class SerperApiError extends Error {
  constructor(
    message: string,
    readonly code: 'http' | 'network' | 'timeout' | 'invalid_response',
    readonly status?: number,
  ) { super(message); }
}

export class SerperClient {
  constructor(options: SerperClientOptions);
  request(endpoint: SerperEndpoint, body: Record<string, unknown>): Promise<Record<string, unknown>>;
}
```

Validate non-empty API keys in the constructor. Use a 30-second default timeout clamped to 1–120 seconds. POST JSON with `X-API-KEY` and `Content-Type`; route only `scrape` to the scrape host. Parse successful responses as JSON objects. Bound upstream error text to 500 characters, never include headers, and always clear the timeout.

- [ ] **Step 3: Commit client code and tests**

```bash
git add src/serper-client.ts test/serper-client.test.ts
git commit -m "feat: add secure Serper API client"
```

## Task 3: Schemas and MCP Tools

**Files:**
- Create: `test/tools.test.ts`
- Create: `src/schemas.ts`
- Create: `src/tools.ts`
- Create: `src/server.ts`

- [ ] **Step 1: Write tool-boundary tests first**

Use `InMemoryTransport.createLinkedPair()` with the SDK `Client` to test the real MCP boundary. Keep the suite table-driven and focused:

```ts
const expectedTools = [
  'serper_search', 'serper_images', 'serper_videos', 'serper_places',
  'serper_maps', 'serper_reviews', 'serper_news', 'serper_shopping',
  'serper_lens', 'serper_patents', 'serper_autocomplete', 'serper_scrape',
];

it('exposes exactly the twelve supported tools', async () => {
  const result = await client.listTools();
  expect(result.tools.map((tool) => tool.name).sort()).toEqual(expectedTools.sort());
  expect(result.tools.some((tool) => tool.name.includes('scholar'))).toBe(false);
});

it.each([
  ['serper_search', 'search', { q: 'apple' }],
  ['serper_images', 'images', { q: 'apple' }],
  ['serper_videos', 'videos', { q: 'apple' }],
  ['serper_places', 'places', { q: 'coffee' }],
  ['serper_maps', 'maps', { q: 'Apple Store' }],
  ['serper_reviews', 'reviews', { cid: '123' }],
  ['serper_news', 'news', { q: 'apple' }],
  ['serper_shopping', 'shopping', { q: 'iphone' }],
  ['serper_lens', 'lens', { url: 'https://example.com/image.jpg' }],
  ['serper_patents', 'patents', { q: 'touchscreen' }],
  ['serper_autocomplete', 'autocomplete', { q: 'apple' }],
  ['serper_scrape', 'scrape', { url: 'https://example.com', includeMarkdown: true }],
])('routes %s to %s', async (tool, endpoint, args) => {
  request.mockResolvedValueOnce({ credits: 1 });
  await client.callTool({ name: tool, arguments: args });
  expect(request).toHaveBeenLastCalledWith(endpoint, args);
});

it('returns the complete object as structured content and JSON text', async () => {
  const upstream = { searchParameters: { q: 'apple' }, organic: [{ title: 'Apple', futureField: 42 }], credits: 1 };
  request.mockResolvedValueOnce(upstream);
  const result = await client.callTool({ name: 'serper_search', arguments: { q: 'apple' } });
  expect(result.structuredContent).toEqual(upstream);
  expect(JSON.parse(result.content[0]?.type === 'text' ? result.content[0].text : '')).toEqual(upstream);
});

it('rejects a missing search query before calling Serper', async () => {
  await expect(client.callTool({ name: 'serper_search', arguments: {} })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

it.each(['serper_lens', 'serper_scrape'])('rejects non-http URLs for %s', async (name) => {
  await expect(client.callTool({ name, arguments: { url: 'file:///etc/passwd' } })).rejects.toThrow();
  expect(request).not.toHaveBeenCalled();
});

it('returns sanitized upstream failures as MCP tool errors', async () => {
  request.mockRejectedValueOnce(new SerperApiError('Serper request failed with HTTP 429.', 'http', 429));
  const result = await client.callTool({ name: 'serper_search', arguments: { q: 'apple' } });
  expect(result.isError).toBe(true);
  expect(result.content).toEqual([{ type: 'text', text: 'Serper request failed with HTTP 429.' }]);
});
```

- [ ] **Step 2: Implement reusable input schemas**

Create described Zod fields and endpoint objects. Use positive integers for `page`/`num`, two-letter lowercase-friendly strings for `gl`/`hl`, and `http`/`https` URL refinement. Export exactly twelve schemas:

```ts
export const toolInputSchemas = {
  search: searchInputSchema,
  images: imageInputSchema,
  videos: videoInputSchema,
  places: placesInputSchema,
  maps: mapsInputSchema,
  reviews: reviewsInputSchema,
  news: newsInputSchema,
  shopping: shoppingInputSchema,
  lens: lensInputSchema,
  patents: patentsInputSchema,
  autocomplete: autocompleteInputSchema,
  scrape: scrapeInputSchema,
} as const;
```

Maps must require at least one of `q`, `placeId`, or `cid`; reviews must require at least one of `cid`, `fid`, or `placeId`. `sortBy` accepts `mostRelevant`, `newest`, `highestRating`, and `lowestRating`. Preserve only fields documented in the local examples.

- [ ] **Step 3: Implement balanced response schemas**

Use `.catchall(z.unknown())` at every modeled object boundary. Model shared `searchParameters`, `credits`, common result fields, and endpoint collection keys (`organic`, `images`, `videos`, `places`, `reviews`, `news`, `shopping`, `suggestions`, and scrape markdown/text fields). Parsing must preserve all unknown fields and collections.

- [ ] **Step 4: Register twelve declarative tools**

Define `TOOL_DEFINITIONS` with name, title, description, endpoint, input schema, and response schema. Register every entry with `server.registerTool`. Each handler must parse the preserved response and return:

```ts
{
  structuredContent: result,
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
}
```

Catch `SerperApiError` and return `isError: true` with its sanitized message. Convert unexpected errors to `Serper request failed unexpectedly.` without stack traces or request data.

- [ ] **Step 5: Add injectable server construction**

Export `createServer(client: Pick<SerperClient, 'request'>): McpServer`, set server name `serper-dev-mcp` and version `0.1.0`, and call `registerSerperTools`.

- [ ] **Step 6: Commit schemas, tools, server, and tests**

```bash
git add src/schemas.ts src/tools.ts src/server.ts test/tools.test.ts
git commit -m "feat: expose Serper endpoints as MCP tools"
```

## Task 4: Executable and Documentation

**Files:**
- Create: `src/index.ts`
- Create: `README.md`
- Modify: `package.json`

- [ ] **Step 1: Add the stdio executable**

Create a shebang-enabled entry point:

```ts
#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { createServer } from './server.js';
import { SerperClient } from './serper-client.js';

async function main(): Promise<void> {
  const apiKey = process.env.SERPER_API_KEY?.trim();
  if (!apiKey) throw new Error('SERPER_API_KEY is required.');
  const server = createServer(new SerperClient({ apiKey }));
  await server.connect(new StdioServerTransport());
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Unknown startup error.';
  console.error(`serper-dev-mcp: ${message}`);
  process.exitCode = 1;
});
```

Do not log a successful startup message because stdio clients own the process lifecycle.

- [ ] **Step 2: Write README usage and security documentation**

Document all twelve tools and their parameters. Include placeholders, never the provided key:

```bash
claude mcp add --scope user serper-dev -e SERPER_API_KEY=YOUR_KEY -- npx -y serper-dev-mcp
codex mcp add serper-dev --env SERPER_API_KEY=YOUR_KEY -- npx -y serper-dev-mcp
```

Also include install-from-source, `npm test`, `npm run typecheck`, `npm run build`, `npm pack --dry-run`, manual MCP Inspector guidance, responsible key handling, release checklist, and a note that Serper usage consumes account credits.

- [ ] **Step 3: Complete repository metadata**

Add keywords, author, homepage, bugs, and repository fields using the intended GitHub URL `https://github.com/GreXLin85/serper.dev-mcp`. Do not create or push a remote.

- [ ] **Step 4: Commit executable and docs**

```bash
git add src/index.ts README.md package.json package-lock.json
git commit -m "docs: add MCP setup and publishing guide"
```

## Task 5: Independent QA and Confirmed Fixes

**Files:**
- Modify only files implicated by confirmed QA findings.

- [ ] **Step 1: Inspect scope and secret safety**

Run:

```bash
git status --short
git ls-files
git grep -n '[REDACTED]' -- . ':!requests'
```

Expected: only intended package files are tracked; `requests` is ignored; the exposed key is absent from tracked files.

- [ ] **Step 2: Run the smallest checks first**

```bash
npm test -- test/serper-client.test.ts
npm test -- test/tools.test.ts
npm run typecheck
npm run build
```

Expected: all commands exit 0 with no unexpected warnings.

- [ ] **Step 3: Inspect npm package contents**

Run: `npm pack --dry-run --json`

Expected: package contains compiled `dist` files, `README.md`, `LICENSE`, and package metadata; it excludes `src`, `test`, `requests`, environment files, and secrets.

- [ ] **Step 4: Run one authorized live smoke test**

Pass the user-provided key only through the process environment without echoing it. Call one low-cost `serper_search` request through the MCP client boundary and assert a successful result with `credits`. Do not place the key in a script, shell history file, config file, test fixture, Git file, or captured output.

- [ ] **Step 5: Fix only confirmed failures and rerun the affected check**

For each finding, make the smallest focused change and rerun the command that exposed it. Do not expand the feature scope.

- [ ] **Step 6: Commit QA fixes if any**

```bash
git add -u
git commit -m "fix: address Serper MCP QA findings"
```

- [ ] **Step 7: Final repository check**

Run: `git status --short --branch`

Expected: clean `main` branch, with only intentionally ignored local `requests` data outside Git.
