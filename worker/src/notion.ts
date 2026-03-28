import type { NotionPage, NotionQueryResponse, NotionBlock, NotionBlocksResponse } from './types'

const NOTION_API = 'https://api.notion.com/v1'
const NOTION_VERSION = '2022-06-28'

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    'Notion-Version': NOTION_VERSION,
    'Content-Type': 'application/json',
  }
}

export class NotionError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message)
    this.name = 'NotionError'
  }
}

async function assertOk(res: Response): Promise<void> {
  if (!res.ok) throw new NotionError(res.status, await res.text())
}

// Fetches a single page from a database (no auto-pagination).
export async function queryDatabasePage(
  token: string,
  databaseId: string,
  options: {
    filter?: unknown
    sorts?: unknown
    pageSize?: number
    cursor?: string
  } = {},
): Promise<{ results: NotionPage[]; nextCursor: string | null }> {
  const body: Record<string, unknown> = {}
  if (options.filter) body.filter = options.filter
  if (options.sorts) body.sorts = options.sorts
  if (options.pageSize) body.page_size = options.pageSize
  if (options.cursor) body.start_cursor = options.cursor

  const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  await assertOk(res)

  const data: NotionQueryResponse = await res.json()
  return {
    results: data.results.filter(p => !p.archived),
    nextCursor: data.has_more && data.next_cursor ? data.next_cursor : null,
  }
}

// Fetches all pages from a database, following pagination automatically.
export async function queryDatabase(
  token: string,
  databaseId: string,
  filter?: unknown,
  sorts?: unknown,
): Promise<NotionPage[]> {
  const pages: NotionPage[] = []
  let cursor: string | undefined

  do {
    const body: Record<string, unknown> = {}
    if (filter) body.filter = filter
    if (sorts) body.sorts = sorts
    if (cursor) body.start_cursor = cursor

    const res = await fetch(`${NOTION_API}/databases/${databaseId}/query`, {
      method: 'POST',
      headers: headers(token),
      body: JSON.stringify(body),
    })
    await assertOk(res)

    const data: NotionQueryResponse = await res.json()
    pages.push(...data.results.filter(p => !p.archived))
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  return pages
}

export async function getPage(token: string, pageId: string): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    headers: headers(token),
  })
  await assertOk(res)
  return res.json()
}

export async function getBlockChildren(token: string, blockId: string): Promise<NotionBlock[]> {
  const blocks: NotionBlock[] = []
  let cursor: string | undefined

  do {
    const url = new URL(`${NOTION_API}/blocks/${blockId}/children`)
    if (cursor) url.searchParams.set('start_cursor', cursor)

    const res = await fetch(url.toString(), { headers: headers(token) })
    await assertOk(res)

    const data: NotionBlocksResponse = await res.json()
    blocks.push(...data.results)
    cursor = data.has_more && data.next_cursor ? data.next_cursor : undefined
  } while (cursor)

  return blocks
}

export async function updatePage(
  token: string,
  pageId: string,
  properties: Record<string, unknown>,
): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ properties }),
  })
  await assertOk(res)
  return res.json()
}

export async function createPage(
  token: string,
  databaseId: string,
  properties: Record<string, unknown>,
): Promise<NotionPage> {
  const res = await fetch(`${NOTION_API}/pages`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify({ parent: { database_id: databaseId }, properties }),
  })
  await assertOk(res)
  return res.json()
}

export async function archivePage(token: string, pageId: string): Promise<void> {
  const res = await fetch(`${NOTION_API}/pages/${pageId}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify({ archived: true }),
  })
  await assertOk(res)
}
