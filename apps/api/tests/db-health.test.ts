import { describe, expect, it } from 'bun:test'
import { sql } from 'drizzle-orm'
import { db } from '../src/db/client'

describe('db health', () => {
  it('responds to a SELECT 1', async () => {
    const rows = await db.execute(sql`select 1 as ok`)
    expect(rows[0]).toMatchObject({ ok: 1 })
  })
})
