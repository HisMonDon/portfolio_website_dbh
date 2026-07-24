import './Section.css'
import './Skills.css'
import reactIcon from '../assets/portfolio-source/skill_icons/react_icon_skills.png'
import javascriptIcon from '../assets/portfolio-source/skill_icons/javascript_icon_skills.png'
import flutterIcon from '../assets/portfolio-source/skill_icons/flutter_icon_skills.png'
import dartIcon from '../assets/portfolio-source/skill_icons/dart_icon_skills.png'
import cppIcon from '../assets/portfolio-source/skill_icons/cpp_icon_skills.png'
import pythonIcon from '../assets/portfolio-source/skill_icons/python_icon_skills.png'
import javaIcon from '../assets/portfolio-source/skill_icons/java_icon_skills.png'
import gitIcon from '../assets/portfolio-source/skill_icons/git_icon_skills.png'
import sfmlIcon from '../assets/portfolio-source/skill_icons/sfml_icon_skills.png'
import vscodeIcon from '../assets/portfolio-source/skill_icons/vscode_icon_skills.png'

const SKILLS = [
  { name: 'React', started: '2025-07-01', icon: reactIcon },
  { name: 'Javascript', started: '2025-07-01', icon: javascriptIcon },
  { name: 'Flutter', started: '2024-07-01', icon: flutterIcon },
  { name: 'Dart', started: '2024-07-01', icon: dartIcon },
  { name: 'C++', started: '2023-07-01', icon: cppIcon },
  { name: 'Python', started: '2022-07-01', icon: pythonIcon },
  { name: 'Java', started: '2023-07-01', icon: javaIcon },
  { name: 'Git', started: '2024-07-01', icon: gitIcon },
  { name: 'SFML', started: '2024-07-01', icon: sfmlIcon },
  { name: 'VS Code', started: '2022-07-01', icon: vscodeIcon },
]

function getExperience(started: string) {
  const [startYear, startMonth, startDay] = started.split('-').map(Number)
  const today = new Date()
  const anniversaryHasPassed =
    today.getMonth() > startMonth - 1 ||
    (today.getMonth() === startMonth - 1 && today.getDate() >= startDay)
  const years = today.getFullYear() - startYear - (anniversaryHasPassed ? 0 : 1)

  return `${years} ${years === 1 ? 'Year' : 'Years'}`
}

export default function Skills() {
  return (
    <div>
      <h1 className="section-title">Technical Skills</h1>
      <div className="skills-grid">
        {SKILLS.map((skill) => (
          <div className="skills-chip" key={skill.name}>
            <img src={skill.icon} alt="" />
            <span>
              <strong>{skill.name}</strong>
              <small>{getExperience(skill.started)}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
