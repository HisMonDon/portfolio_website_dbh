import './Section.css'
import portfolioImage from '../assets/portfolio-source/portfolio_image.jpg'

export default function AboutMe() {
  return (
    <div className="about-section">
      <div>
        <h1 className="section-title">About Me</h1>
        <p className="section-text">
          Hey, my name is <strong>Chenyu Lu</strong>.
        </p>
        <p className="section-text">
          I&apos;m a high school IB student at St.Robert Catholic High School
          interested in pursuing computer science. I&apos;m really passionate about
          coding, and I love building projects that positively impact people in
          a variety of fields using my skills.
        </p>
        <p className="section-text">
          Do not hesitate to connect view my open source projects on GitHub,
          connect with me on LinkedIn, or send me an email!
        </p>
      </div>
      <img className="about-portrait" src={portfolioImage} alt="Chenyu Lu" />
    </div>
  )
}
