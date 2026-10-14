/// <reference types="vite/client" />

interface ImportMetaEnv {
  [key: string]: string | undefined
  readonly VITE_GOOGLE_ANALYTICS?: string
  /** SDEE3 Identity (Clerk) publishable key. See docs/specs/03-identity-auth.md. */
  readonly VITE_CLERK_PUBLISHABLE_KEY: string
  /** SDEE3 Identity hub sign-in endpoint. */
  readonly VITE_CLERK_SIGN_IN_URL?: string
  /** SDEE3 Identity hub sign-up endpoint. */
  readonly VITE_CLERK_SIGN_UP_URL?: string
  /** This app's origin, used to build the hub ?redirect_url=. */
  readonly VITE_APP_ORIGIN?: string
  /** Convex deployment URL. */
  readonly VITE_CONVEX_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

declare module 'typewriter-effect' {
  import type { FC } from 'react'

  export interface TypewriterClass {
    typeString(text: string): TypewriterClass
    pauseFor(ms: number): TypewriterClass
    deleteAll(speed?: number): TypewriterClass
    start(): TypewriterClass
  }

  const Typewriter: FC<{
    onInit?: (typewriter: TypewriterClass) => void
    options?: { loop?: boolean }
  }>

  export default Typewriter
}
