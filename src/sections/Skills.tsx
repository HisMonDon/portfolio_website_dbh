import './Section.css'
import './Skills.css'

const SKILLS = ['React', 'TypeScript', 'Flutter', 'Python', 'C++', 'Firebase']

export default function Skills() {
  return (
    <div>
      <p className="section-eyebrow">Stack</p>
      <h1 className="section-title">Skills</h1>
      <div className="skills-grid">
        {SKILLS.map((skill) => (
          <span className="skills-chip" key={skill}>
            {skill}
          </span>
        ))}
      </div>
    </div>
  )
}
