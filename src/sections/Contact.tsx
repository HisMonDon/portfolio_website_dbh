import { useState, type FormEvent } from 'react'
import { HudTriangleMesh } from '../features/faceChat/HudIcons'
import './Section.css'
import './Contact.css'
import {
  buildContactMailto,
  CONTACT_EMAIL,
  CONTACT_GITHUB_URL,
  CONTACT_LINKEDIN_URL,
} from './contactConfig'

const CONTACT_LINKS = [
  {
    label: 'GitHub',
    detail: 'View my code',
    href: CONTACT_GITHUB_URL,
    external: true,
  },
  {
    label: 'LinkedIn',
    detail: 'Connect with me',
    href: CONTACT_LINKEDIN_URL,
    external: true,
  },
  {
    label: 'Email',
    detail: CONTACT_EMAIL,
    href: `mailto:${CONTACT_EMAIL}`,
    external: false,
  },
] as const

export default function Contact() {
  const [senderEmail, setSenderEmail] = useState('')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    window.location.href = buildContactMailto({ senderEmail, subject, message })
  }

  return (
    <section className="contact-section" aria-labelledby="contact-title">
      <div className="contact-heading">
        <p className="section-eyebrow">Start a conversation</p>
        <h1 className="section-title" id="contact-title">Contact me</h1>
        <p className="contact-intro">
          Have an idea, an opportunity, or just want to say hello? Choose a channel or
          send me a message.
        </p>
      </div>

      <div className="contact-links" aria-label="Contact links">
        {CONTACT_LINKS.map(({ label, detail, href, external }) => (
          <a
            className="contact-link"
            href={href}
            key={label}
            {...(external ? { target: '_blank', rel: 'noreferrer' } : {})}
          >
            <HudTriangleMesh className="contact-link-triangle-mesh" />
            <span className="contact-link-label">{label}</span>
            <span className="contact-link-detail">{detail}</span>
            <span className="contact-link-arrow" aria-hidden="true">↗</span>
          </a>
        ))}
      </div>

      <div className="contact-compose">
        <div className="contact-compose-edge" aria-hidden="true">
          {Array.from({ length: 7 }).map((_, index) => (
            <span
              key={index}
              className="contact-compose-tick"
              style={{ animationDelay: `${index * 90}ms` }}
            />
          ))}
        </div>

        <div className="contact-compose-heading">
          <div>
            <p className="contact-compose-kicker">Direct message</p>
            <h2>Send an email to me</h2>
          </div>
          <span className="contact-status" aria-hidden="true">
            <span /> Ready
          </span>
        </div>

        <form className="contact-form" onSubmit={handleSubmit}>
          <label className="contact-field">
            <span>Your email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={senderEmail}
              onChange={(event) => setSenderEmail(event.target.value)}
              required
            />
          </label>

          <label className="contact-field">
            <span>Subject</span>
            <input
              type="text"
              placeholder="What would you like to talk about?"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              required
            />
          </label>

          <label className="contact-field contact-message-field">
            <span>Message</span>
            <textarea
              placeholder="Tell me a little about your idea…"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              required
            />
          </label>

          <div className="contact-form-footer">
            <p>Opens your email app with everything filled in.</p>
            <button className="contact-submit" type="submit">
              Compose email <span aria-hidden="true">→</span>
            </button>
          </div>
        </form>
      </div>
    </section>
  )
}
