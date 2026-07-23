import './Section.css'

export default function Resume() {
  return (
    <div>
      <p className="section-eyebrow">CV</p>
      <h1 className="section-title">Resume</h1>
      <p className="section-text">
        Placeholder summary of experience and education. Link the real PDF
        from the button below once it's ready.
      </p>
      <a className="section-button" href="/resume.pdf" target="_blank" rel="noreferrer">
        Download resume
      </a>
    </div>
  )
}
