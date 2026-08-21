# Plascom TripFlag

TripFlag is an enterprise-grade automated rule parser and telemetry tracking system designed for truck trip data. Built with a scalable microservices-inspired monorepo structure, it leverages natural language processing to extract complex flagging rules and maintains zero-overhead real-time telemetry across both API traffic and AI model consumption.

## Deployed Applications

- **Main Application & API:** https://tripflag.vercel.app
- **Enterprise Log Viewer:** [Insert Log Viewer Vercel URL here]

## System Architecture

The repository is structured as a monorepo containing two distinct Next.js applications that operate independently but share the underlying Postgres database layer.

1.  **Core Application (`/`)**: 
    The primary engine responsible for receiving natural language input, querying the AI models, matching database schemas, and returning structured JSON rules.
2.  **Telemetry Dashboard (`/log-viewer`)**: 
    A standalone application providing a secure, read-only interface into the system's operational health, API traffic payloads, and AI usage metrics.

### Database Layer (Neon Serverless Postgres)
Both applications connect to a unified serverless Postgres database using the `@neondatabase/serverless` driver. 
-   `api_logs`: Tracks all HTTP requests, responses, headers, and status codes.
-   `ai_logs`: Tracks granular LLM usage including prompt tokens, completion tokens, latency, and exact JSON payloads for debugging.

To prevent infinite database growth, a probabilistic background cleanup routine runs asynchronously on 1% of write operations, automatically purging logs older than 30 days.

## API Architecture

The system utilizes an asynchronous, non-blocking telemetry pattern. 

### Telemetry Interceptor Pattern
A higher-order function (`lib/logger.js`) wraps all exported Next.js API route handlers. This interceptor captures the incoming request, awaits the core response, and immediately returns the response to the client. The database logging operation is dispatched asynchronously to the Vercel execution context using `Promise.allSettled`, guaranteeing that the client never waits for database writes, ensuring zero latency overhead.

### AI Interceptor Pattern
A similar wrapper exists around the Groq SDK client (`lib/groq.js`). Every AI completion request is timed, and the request payload, response payload, and token consumption statistics are dispatched asynchronously to the `ai_logs` table.

## Local Development

### Prerequisites
- Node.js 18+
- Neon Database URL
- Groq API Key

### Environment Setup
Create a `.env.local` file in both the root directory and the `log-viewer` directory:
```env
DATABASE_URL="postgres://..."
GROQ_API_KEY="gsk_..."
```

### Running the Core Application
```bash
npm install
npm run dev
```

### Running the Log Viewer
```bash
cd log-viewer
npm install
npm run dev
```
The Log Viewer runs on port 3000 by default (or port 3001 if the core application is running concurrently).

## Deployment

Both applications are configured for deployment on Vercel.

1.  **Core Application**: Deploy the root directory standardly.
2.  **Log Viewer**: Create a new Vercel project pointing to this repository, and set the "Root Directory" override to `log-viewer`. Ensure environment variables are duplicated to the new project.
