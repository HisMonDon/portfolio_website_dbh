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
  { name: 'React', time: '1 Year', icon: reactIcon },
  { name: 'Javascript', time: '1 Year', icon: javascriptIcon },
  { name: 'Flutter', time: '2 Years', icon: flutterIcon },
  { name: 'Dart', time: '2 Years', icon: dartIcon },
  { name: 'C++', time: '3 Years', icon: cppIcon },
  { name: 'Python', time: '4 Years', icon: pythonIcon },
  { name: 'Java', time: '3 Years', icon: javaIcon },
  { name: 'Git', time: '2 Years', icon: gitIcon },
  { name: 'SFML', time: '2 Years', icon: sfmlIcon },
  { name: 'VS Code', time: '4 Years', icon: vscodeIcon },
]

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
              <small>{skill.time}</small>
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
