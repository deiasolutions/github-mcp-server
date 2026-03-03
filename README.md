# GitHub MCP Server

Self-hosted GitHub MCP server for Fr@nk CLI (ShiftCenter). Bridges `@modelcontextprotocol/server-github` to SSE for use with the Anthropic API `mcp_servers` parameter.

## Architecture

- **Express.js** server with SSE endpoint (`/sse`) and OAuth flow (`/oauth/*`)
- **PostgreSQL** for encrypted GitHub token storage (AES-256-GCM)
- **MCP Bridge** spawns `@modelcontextprotocol/server-github` as subprocess, bridges stdio to SSE
- **Railway** deployment with health checks

## Setup

1. Copy `.env.example` to `.env` and fill in values
2. Create a GitHub OAuth App at https://github.com/settings/developers
3. `npm install`
4. `npm run dev`

## Endpoints

- `GET /health` - Health check
- `GET /sse?user_id=X` - SSE endpoint for MCP protocol
- `POST /sse/message` - Send MCP message to active session
- `GET /oauth/connect?user_id=X` - Start GitHub OAuth flow
- `GET /oauth/callback` - OAuth callback (GitHub redirects here)
- `POST /oauth/disconnect` - Revoke stored token

## Deployment

Deploy to Railway. See `railway.json` for config. Set all env vars from `.env.example` in Railway dashboard.
