import { Hono } from "hono"
import { cors } from "hono/cors"
import { logger } from "hono/logger"

import { completionRoutes } from "./routes/chat-completions/route"
import { embeddingRoutes } from "./routes/embeddings/route"
import { messageRoutes } from "./routes/messages/route"
import { modelRoutes } from "./routes/models/route"
import { tokenRoute } from "./routes/token/route"
import { usageRoute } from "./routes/usage/route"
import { state } from "./lib/state"
import { getCopilotToken } from "./services/github/get-copilot-token"
import { HTTPError } from "./lib/error"

export const server = new Hono()

server.use(logger())
server.use(cors())

server.get("/", (c) => c.text("Server running"))

// Health check endpoint - verifies Copilot API connection with timeout
server.get("/health", async (c) => {
  try {
    // Quick check: Verify that we have required tokens
    if (!state.copilotToken || !state.githubToken) {
      return c.json(
        {
          status: "unhealthy",
          reason: "Missing authentication tokens",
          timestamp: new Date().toISOString(),
        },
        503,
      )
    }

    // Verify that we can reach the Copilot API with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 5000) // 5 second timeout

    try {
      await getCopilotToken()
      clearTimeout(timeout)
    } catch (timeoutError) {
      clearTimeout(timeout)
      throw timeoutError
    }

    return c.json({
      status: "healthy",
      timestamp: new Date().toISOString(),
      copilotConnected: true,
    })
  } catch (error) {
    let errorMessage = "Unknown error"

    if (error instanceof HTTPError) {
      errorMessage = `Copilot API error: ${error.message}`
    } else if (error instanceof Error) {
      errorMessage = error.message
    }

    // Log the error for debugging
    console.error("[Health Check] Error:", errorMessage)

    return c.json(
      {
        status: "unhealthy",
        reason: errorMessage,
        timestamp: new Date().toISOString(),
        copilotConnected: false,
      },
      503,
    )
  }
})

// Liveness probe for Kubernetes - lightweight check
server.get("/healthz", (c) =>
  c.json({
    status: "alive",
    timestamp: new Date().toISOString(),
  }),
)

server.route("/chat/completions", completionRoutes)
server.route("/models", modelRoutes)
server.route("/embeddings", embeddingRoutes)
server.route("/usage", usageRoute)
server.route("/token", tokenRoute)

// Compatibility with tools that expect v1/ prefix
server.route("/v1/chat/completions", completionRoutes)
server.route("/v1/models", modelRoutes)
server.route("/v1/embeddings", embeddingRoutes)

// Anthropic compatible endpoints
server.route("/v1/messages", messageRoutes)
