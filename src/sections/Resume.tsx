import './Section.css'
import resumePdf from '../assets/eric-chen-resume-2026.pdf'

export default function Resume() {
  return (
    <div>
      <p className="section-eyebrow">CV</p>
      <h1 className="section-title">Resume</h1>
      <p className="section-text">
        Download my current resume for an overview of my experience, education,
        projects, and technical skills.
      </p>
      <a className="section-button" href={resumePdf} download="Eric-Chen-Resume-2026.pdf">
        Download resume
      </a>
    </div>
  )
}
