import { cors } from '@elysiajs/cors'
import { Elysia, t } from 'elysia'
import { auth } from './auth'
import { env } from './env'

export function buildApp() {
  return new Elysia({ prefix: '/api' })
    .use(cors({ origin: env.WEB_ORIGIN, credentials: true }))
    .mount(auth.handler)
    .get('/ping', () => ({ status: 'ok' as const, service: 'quitto-api' }), {
      response: t.Object({ status: t.Literal('ok'), service: t.String() }),
    })
}

export const app = buildApp()
export type App = typeof app
