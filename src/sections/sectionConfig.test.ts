import { describe, expect, it } from 'vitest'
import { getActiveSectionList, SECTION_ORDER } from './sectionConfig'

describe('sectionConfig', () => {
  it('places Contact last, after About Me, Projects, Resume, and Skills', () => {
    expect(SECTION_ORDER).toEqual([
      'about',
      'projects',
      'resume',
      'skills',
      'contact',
    ])
  })

  it('keeps adjacent-section navigation aligned with the new order', () => {
    expect(getActiveSectionList('contact')).toEqual({
      first: 'skills',
      second: 'contact',
      third: 'about',
    })
  })
})
