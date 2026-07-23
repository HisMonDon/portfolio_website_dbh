export interface Project {
  id: string
  title: string
  description: string
  images: string[]
}

export const PROJECTS: Project[] = [
  {
    id: 'project-1',
    title: 'Project One',
    description:
      'Placeholder description for project one. Replace with a real summary of what it does and the stack used.',
    images: ['1', '2', '3'],
  },
  {
    id: 'project-2',
    title: 'Project Two',
    description: 'Placeholder description for project two.',
    images: ['1', '2'],
  },
  {
    id: 'project-3',
    title: 'Project Three',
    description: 'Placeholder description for project three.',
    images: ['1', '2', '3', '4'],
  },
  {
    id: 'project-4',
    title: 'Project Four',
    description: 'Placeholder description for project four.',
    images: ['1'],
  },
]
