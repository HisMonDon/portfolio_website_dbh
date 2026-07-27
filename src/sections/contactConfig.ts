export const CONTACT_EMAIL = 'eric.luchenyu@gmail.com'
export const CONTACT_GITHUB_URL = 'https://github.com/HisMonDon'
export const CONTACT_LINKEDIN_URL = 'https://linkedin.com/in/chenyulu'

export interface ContactMessage {
  senderEmail: string
  subject: string
  message: string
}

export function buildContactMailto({
  senderEmail,
  subject,
  message,
}: ContactMessage) {
  const params = new URLSearchParams({
    subject: subject.trim(),
    body: `From: ${senderEmail.trim()}\n\n${message.trim()}`,
  })

  return `mailto:${CONTACT_EMAIL}?${params.toString()}`
}
