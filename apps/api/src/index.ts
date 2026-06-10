import { app } from './app'

app.listen(3000)
// biome-ignore lint/suspicious/noConsole: server startup log
console.log(`🦊 API on ${app.server?.hostname}:${app.server?.port}`)
