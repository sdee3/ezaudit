import { AuthConfig } from "convex/server"

export default {
  providers: [
    // SDEE3 Identity hub (Clerk). The `domain` env var is set on the deployment by
    // the parent flow; reading an unset variable here is expected in dev.
    { domain: process.env.CLERK_JWT_ISSUER_DOMAIN!, applicationID: "convex" },
  ],
} satisfies AuthConfig
