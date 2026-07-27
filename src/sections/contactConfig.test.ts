import { describe, expect, it } from 'vitest'
import { buildContactMailto, CONTACT_EMAIL } from './contactConfig'

describe('buildContactMailto', () => {
  it('opens the portfolio email address with the supplied fields filled in', () => {
    const href = buildContactMailto({
      senderEmail: ' visitor@example.com ',
      subject: ' Project idea ',
      message: ' Let us build something. ',
    })
    const [address, query = ''] = href.slice('mailto:'.length).split('?')
    const params = new URLSearchParams(query)

    expect(address).toBe(CONTACT_EMAIL)
    expect(params.get('subject')).toBe('Project idea')
    expect(params.get('body')).toBe(
      'From: visitor@example.com\n\nLet us build something.',
    )
  })
})
