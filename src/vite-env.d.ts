/// <reference types="vite/client" />

declare const __BUILD_TIME__: string
declare module '*.txt' {
  const content: string
  export default content
}
