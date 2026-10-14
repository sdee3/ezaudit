/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GOOGLE_ANALYTICS?: string
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
