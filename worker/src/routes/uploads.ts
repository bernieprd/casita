import type { Env } from '../types'

export async function uploadRecipePhoto(req: Request, env: Env): Promise<Response> {
  const formData = await req.formData()
  const file = formData.get('file') as File | null

  if (!file || !file.type.startsWith('image/')) {
    return Response.json({ error: 'Expected an image file' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() ?? 'jpg').toLowerCase()
  const key = `${crypto.randomUUID()}.${ext}`

  await env.RECIPE_PHOTOS.put(key, file.stream(), {
    httpMetadata: { contentType: file.type },
  })

  const origin = new URL(req.url).origin
  return Response.json({ url: `${origin}/recipe-photos/${key}` }, { status: 201 })
}

export async function serveRecipePhoto(_req: Request, env: Env, key: string): Promise<Response> {
  const object = await env.RECIPE_PHOTOS.get(key)
  if (!object) return Response.json({ error: 'Not found' }, { status: 404 })

  const headers = new Headers()
  object.writeHttpMetadata(headers)
  headers.set('Cache-Control', 'public, max-age=31536000, immutable')

  return new Response(object.body, { headers })
}
