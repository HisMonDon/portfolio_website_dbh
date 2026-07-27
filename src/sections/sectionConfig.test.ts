import { describe, expect, it } from 'vitest'
import { getActiveSectionList, SECTION_ORDER } from './sectionConfig'

describe('sectionConfig', () => {
  it('places Contact directly after About Me and removes Credits', () => {
    expect(SECTION_ORDER).toEqual([
      'about',
      'contact',
      'resume',
      'projects',
      'skills',
    ])
  })

  it('keeps adjacent-section navigation aligned with the new order', () => {
    expect(getActiveSectionList('contact')).toEqual({
      first: 'about',
      second: 'contact',
      third: 'resume',
    })
  })
})
