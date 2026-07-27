import type { SectionId } from '../components/NavBar';

export const SECTION_ORDER: SectionId[] = [
    'about',
    'projects',
    'resume',
    'skills',
    'contact',
];

export type ActiveSection = {
    first: SectionId;
    second: SectionId;
    third: SectionId;
};

export function getActiveSectionList(id: SectionId): ActiveSection {
    const index = SECTION_ORDER.indexOf(id);

    return {
        first: SECTION_ORDER[(index - 1 + SECTION_ORDER.length) % SECTION_ORDER.length],
        second: SECTION_ORDER[index],
        third: SECTION_ORDER[(index + 1) % SECTION_ORDER.length],
    };
}
