export interface Project {
  id: string
  title: string
  description: string
  images: string[]
  technologies: string[]
  githubUrl?: string
  liveUrl?: string
}

const image = (name: string) =>
  new URL(`../assets/portfolio-source/project_images/${name}`, import.meta.url).href

export const PROJECTS: Project[] = [
  {
    id: 'vera',
    title: 'Vera',
    description: "A cross-platform (Online and Windows) physics platform built for my school's official Physics club with student-taught tutorial videos, login authentication and a video storage feature to save progress.",
    technologies: ['Flutter', 'Firebase', 'Rest API', 'Cloudflare'],
    githubUrl: 'https://github.com/HisMonDon/Vera',
    liveUrl: 'https://veraphysics.com/about',
    images: ['vera_project_1.png', 'vera_project_2.png', 'vera_project_3.png', 'vera_project_4.png', 'vera_project_5.png'].map(image),
  },
  {
    id: 'portfolio-website',
    title: 'Portfolio Website',
    description: "A portfolio website built with Flutter Web, showcasing my projects, skills, and experience with a space-themed animated background. You're on it right now.",
    technologies: ['Flutter', 'Dart'],
    githubUrl: 'https://github.com/HisMonDon/portfolioWebsite',
    images: ['portfolio_project.png'].map(image),
  },
  {
    id: 'pocket-pilot',
    title: 'Pocket Pilot',
    description: 'A mobile app that analyzes recipts and provides insights on spending habits, built with React Native, Firestore, Gemini API, and Cloudinary.',
    technologies: ['React Native', 'Firebase', 'Gemini API', 'Cloudinary'],
    githubUrl: 'https://github.com/justinnova0915/hack-canada-2026',
    liveUrl: 'https://devpost.com/software/pocketpilot-gi9m3v',
    images: ['pocketpilot3.jpg', 'pocketpilot1.png', 'pocketpilot2.png'].map(image),
  },
  {
    id: 'integrals-buoyancy-simulator',
    title: 'Integrals buoyancy Simulator',
    description: "A C++ based physics simulator using calculus and integrals to simulate a ball's net motion when dropped in a liquid with a customizable density.",
    technologies: ['C++', 'SFML', 'CMake', 'GLSL'],
    githubUrl: 'https://github.com/HisMonDon/Buoyancy-Simulator',
    images: ['buoyancy_project_1.png', 'buoyancy_project_2.png'].map(image),
  },
  {
    id: 'competitive-programming',
    title: 'Competitive Programming',
    description: 'Solved problems on DMOJ, focusing on the CCC contest. Worked with data strucutures, graph theory, and other algorithms. Achieved distinction (top 25%) on CCC Senior 2026.',
    technologies: ['C++', 'Python', 'Java'],
    githubUrl: 'https://github.com/HisMonDon/CCC_Senior',
    liveUrl: 'https://dmoj.ca/user/HisMonDon',
    images: ['competitive_project_0.png', 'competitive_project_1.png', 'competitive_project_2.png'].map(image),
  },
  {
    id: 'the-knight',
    title: 'The Knight',
    description: '2D adventure game, with random world generation, and a battle and currency system. This was my Grade 11 Computer Science CPT, and I finished with a 99.',
    technologies: ['Python', 'Pygame'],
    images: ['cpt_project_1.png', 'cpt_project_2.png'].map(image),
  },
  {
    id: 'more-coming-soon',
    title: 'More coming soon!',
    description: 'Stay tuned for more projects coming soon!',
    technologies: [],
    images: ['coming_soon.png'].map(image),
  },
]
