import { HONORS } from '../../data/honors'

export default function Honors() {
  return (
    <section className="honors-section" aria-labelledby="honors-heading">
      <p className="honors-eyebrow" id="honors-heading">Selected Honors</p>
      <div className="honors-grid">
        {HONORS.map((honor) => (
          <div className="honor-item" key={honor.detail}>
            <span className="honor-result">{honor.result}</span>
            <span className="honor-detail">{honor.detail}</span>
          </div>
        ))}
      </div>
    </section>
  )
}
