# Serper.dev MCP Server Design

## Goal

Build a public TypeScript npm package that exposes the working Serper.dev APIs as separate Model Context Protocol tools for Claude Code and Codex. The package runs locally over stdio through `npx`, reads credentials from the environment, and can be published to npm and GitHub without containing secrets.

## Scope

The first release exposes these twelve tools:

1. `serper_search`
2. `serper_images`
3. `serper_videos`
4. `serper_places`
5. `serper_maps`
6. `serper_reviews`
7. `serper_news`
8. `serper_shopping`
9. `serper_lens`
10. `serper_patents`
11. `serper_autocomplete`
12. `serper_scrape`

Scholar is deliberately excluded because the endpoint is not working. Batch requests are also excluded from the first MCP surface: MCP callers can invoke individual tools repeatedly, while single-request schemas keep tool selection and validation clear.

## Architecture

The package uses the official Model Context Protocol TypeScript SDK with `StdioServerTransport`. A small executable entry point validates startup configuration and connects a constructed `McpServer` to stdio. Tool registration is separate from transport startup so tests can instantiate the server without launching a child process.

A shared Serper client owns HTTP behavior. It selects `https://google.serper.dev/<endpoint>` for Google result tools and `https://scrape.serper.dev/` for scraping, adds `X-API-KEY` and JSON headers, applies a bounded timeout, and translates network, HTTP, and invalid-JSON failures into safe errors. It never logs the API key or request headers.

Tool definitions use endpoint-specific Zod request schemas. Shared search options such as `q`, `location`, `gl`, `hl`, `tbs`, `num`, and `page` are reused where the examples show they apply; maps, reviews, lens, and scrape receive their own specialized schemas.

## Response Contract

Responses balance useful typing with compatibility:

- Stable response metadata such as `searchParameters` and `credits` is modeled.
- Common result fields such as `title`, `link`, `snippet`, `position`, image URLs, and source metadata are modeled when applicable.
- Endpoint-specific collections remain extensible and preserve unknown keys.
- The original successful Serper JSON object is returned without normalization or field removal.
- MCP results include the object as `structuredContent` and pretty-printed JSON as text content for clients that do not consume structured output.

This gives callers predictable common fields without breaking when Google or Serper adds endpoint-specific data.

## Components and Files

- `package.json`: ESM package metadata, public `bin`, npm publication allowlist, scripts, dependencies, engine requirement, and repository metadata.
- `tsconfig.json`: strict Node TypeScript compilation into `dist`.
- `src/index.ts`: executable stdio entry point and fatal-startup handling.
- `src/server.ts`: server construction and registration orchestration.
- `src/serper-client.ts`: authenticated HTTP client, timeout, response parsing, and safe error mapping.
- `src/schemas.ts`: request schemas, shared request fields, and extensible response models.
- `src/tools.ts`: twelve separately named MCP tool registrations mapped to client endpoints.
- `test/serper-client.test.ts`: client request, authentication, routing, timeout, and error tests using injected `fetch`.
- `test/tools.test.ts`: tool discovery, schema validation, endpoint mapping, structured output, and MCP error tests.
- `README.md`: capabilities, security, installation, Claude Code configuration, Codex configuration, local development, and publishing instructions.
- `LICENSE`: open-source license text.
- `.gitignore`: build, dependency, coverage, local environment, and secret exclusions.

The local `requests` reference file is not part of the npm publication and must not be committed while it contains a credential.

## Data Flow

1. Claude Code or Codex starts the package through its npm executable.
2. The executable reads `SERPER_API_KEY`; missing configuration fails at startup with a concise stderr message.
3. The MCP client discovers twelve distinct tools and chooses one based on its name, description, and input schema.
4. The SDK validates arguments before the handler runs.
5. The handler sends the validated request through the shared Serper client.
6. The client returns parsed JSON or throws a sanitized typed error.
7. The handler returns structured JSON and a text fallback, or an MCP tool result with `isError: true`.

Nothing except MCP protocol messages is written to stdout. Diagnostics go to stderr because stdout is reserved for stdio JSON-RPC.

## Error Handling and Security

- `SERPER_API_KEY` is required and is never accepted as a tool argument.
- Input URLs for lens and scrape must use `http` or `https`.
- Requests use a configurable but bounded timeout with a safe default.
- Non-2xx responses retain the Serper status and a bounded, sanitized message without exposing headers or credentials.
- Invalid JSON, connection failures, and timeouts produce distinct safe messages.
- Tool handlers return expected upstream failures as MCP tool errors; unexpected startup failures terminate with a nonzero exit status.
- The npm `files` allowlist publishes only compiled output, documentation, and license files.
- The existing exposed credential must be revoked before the repository is published.

## Testing

Development follows test-driven implementation. Client tests inject a fake `fetch` implementation and verify the exact URL, method, body, and required headers without using a live credential. Tool tests use the SDK's in-memory transport or direct registered handlers to verify discovery and calls through the MCP boundary.

Targeted tests cover:

- all twelve tool names;
- required and optional input validation;
- specialized maps, reviews, lens, and scrape inputs;
- correct Google versus scrape host routing;
- successful structured and text results;
- missing configuration, HTTP errors, invalid JSON, timeout, and network failures;
- absence of credentials from output and errors;
- clean TypeScript compilation and npm package contents.

No automated test consumes Serper credits. After all offline checks pass, one explicitly authorized live smoke test may use the user-provided key through a process environment variable. The command must not print or persist the key, and the key must still be rotated before publication because it has already been exposed outside a secret store.

## Distribution and Integration

The package is ESM and publishes a shebang-enabled executable in `dist/index.js`. Users can run it with `npx -y <package-name>` and set `SERPER_API_KEY` in their MCP client configuration. The README provides current examples for both Claude Code and Codex and distinguishes project-scoped from user-scoped configuration where supported.

The repository will be ready for GitHub publication, but automated npm publishing, GitHub Actions, remote repository creation, and the actual `npm publish` operation are outside this implementation unless requested separately.

## Acceptance Criteria

- Exactly twelve working Serper tools are discoverable; scholar is absent.
- Each tool has an endpoint-specific validated request schema.
- Stable response fields are modeled while all successful Serper response data is preserved.
- Authentication uses only `SERPER_API_KEY` and cannot leak through normal errors or logs.
- Claude Code and Codex can launch the compiled package over stdio.
- Tests do not require network access or consume Serper credits.
- Typecheck, tests, build, and package-content validation pass.
- Documentation contains install, configuration, security, development, and publication guidance.
