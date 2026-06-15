import type { Env } from '../types'

interface SendEmailOptions {
  to: string
  subject: string
  html: string
}

export async function sendEmail(
  { to, subject, html }: SendEmailOptions,
  env: Pick<Env, 'RESEND_API_KEY' | 'RESEND_FROM_EMAIL'>
): Promise<void> {
  const from = env.RESEND_FROM_EMAIL ?? 'Casita <hello@mycasita.app>'
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ from, to, subject, html }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`Resend error ${res.status}: ${body}`)
  }
}
