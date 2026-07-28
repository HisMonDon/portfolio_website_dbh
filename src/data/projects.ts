export interface ProjectStorySection {
  title: string
  body: string
}

export interface Project {
  id: string
  title: string
  description: string
  images: string[]
  technologies: string[]
  githubUrl?: string
  liveUrl?: string
  liveLabel?: string
  story?: ProjectStorySection[]
}

const image = (name: string) =>
  new URL(`../assets/portfolio-source/project_images/${name}`, import.meta.url).href

export const PROJECTS: Project[] = [
  {
    id: 'vera',
    title: 'Vera',
    description: "A cross-platform learning platform for my school's Physics Club, with student-made tutorials, authentication, and saved video progress.",
    technologies: ['Flutter', 'Firebase', 'Rest API', 'Cloudflare'],
    githubUrl: 'https://github.com/HisMonDon/Vera',
    liveUrl: 'https://veraphysics.com/about',
    images: ['vera_project_1.png', 'vera_project_2.png', 'vera_project_3.png', 'vera_project_4.png', 'vera_project_5.png'].map(image),
    story: [
      {
        title: 'Why I started it',
        body: 'While studying AP Physics 1 in Grade 9, I found that most online resources were either too broad or organized differently from my course. Finding one clear answer often meant piecing together several websites. Later, as an executive instructor in my school\'s physics club, I watched younger students run into the same problem. Vera began as the focused learning resource I wished had existed for both groups.',
      },
      {
        title: 'Building the platform',
        body: 'I founded and independently developed Vera even though I had not previously used a frontend framework. I learned Flutter and Dart to build a consistent cross-platform interface, then taught myself Firebase to support accounts, content, and saved learning progress. The result grew from a personal study tool into a structured platform for lessons, tutorial videos, and multiple physics courses.',
      },
      {
        title: 'Solving real implementation problems',
        body: 'The original playback package did not reliably support Vera\'s WebM lesson videos. I isolated the problem to the media layer, compared alternative playback approaches, and replaced it with Chewie on top of Flutter\'s video_player package. That experience reinforced the importance of diagnosing the failing boundary instead of repeatedly patching symptoms around it.',
      },
      {
        title: 'Curriculum and impact',
        body: 'To expand beyond courses I had personally taken, I worked with the head of my school\'s physics department to review the curriculum and organize more than 20 hours of focused lessons by course and topic. After launch, Vera reached over 1,000 unique visitors during one 30-day period. Student feedback directly influenced the roadmap, including requests for more walkthroughs of past AP exam questions.',
      },
      {
        title: 'What it taught me',
        body: 'Vera changed how I define a successful technical project. Accuracy matters, but usefulness has to be validated with the people the product serves. I now approach unfamiliar technology as something I can learn in service of a real need, while treating interviews, feedback, and subject-matter review as part of engineering rather than work that happens after it.',
      },
    ],
  },
  {
    id: 'portfolio-website',
    title: 'Portfolio Website',
    description: 'An earlier portfolio built with Flutter Web to present my projects, skills, and experience through a space-themed interface.',
    technologies: ['Flutter', 'Dart'],
    githubUrl: 'https://github.com/HisMonDon/portfolioWebsite',
    images: ['portfolio_project.png'].map(image),
    story: [
      {
        title: 'Designing a personal interface',
        body: 'This project was my first attempt to make a portfolio feel like an authored experience rather than a stack of resume sections. I used a space-inspired visual direction, animated backgrounds, and project-focused navigation to connect the presentation to my interest in technical and scientific work.',
      },
      {
        title: 'Building with Flutter Web',
        body: 'I organized the site as reusable Dart widgets so project cards, skill displays, and navigation could evolve without duplicating layout code. Working in Flutter also made responsive behavior a deliberate part of the component structure, because the same interface needed to remain understandable across very different screen sizes.',
      },
      {
        title: 'What I carried forward',
        body: 'The project taught me that a portfolio is itself a product: hierarchy, motion, loading behavior, and writing all affect whether someone understands the work. Its strongest ideas informed later iterations, while its limitations pushed me to become more intentional about accessibility, content depth, and performance.',
      },
    ],
  },
  {
    id: 'chaos-roll',
    title: 'Chaos Roll',
    description: 'A wave-survival game where Gemini generates playable abilities and enemy waves in real time. Winner of Hack the Valley Hack Day.',
    technologies: ['React', 'TypeScript', 'Gemini API', 'Structured JSON'],
    liveUrl: 'https://devpost.com/software/live-forge',
    liveLabel: 'View on Devpost',
    images: ['chaos_roll_1.png', 'chaos_roll_2.png', 'chaos_roll_3.png'].map(image),
    story: [
      {
        title: 'The idea',
        body: 'Most games decide their weapons, enemies, and balance before a match begins. Chaos Roll explored a different question: could generative AI create functional game content at the moment a player needs it? The result is a wave-survival brawler where Gemini creates new ability choices every fifteen seconds and also assembles the enemy waves the player must survive.',
      },
      {
        title: 'Turning model output into gameplay',
        body: 'Gemini returns structured definitions rather than flavor text. An ability can include damage, cooldown, range, targeting behavior, effect type, and pixel-art data; enemy definitions include composition, statistics, appearance, and supported special behaviors. TypeScript systems turn accepted definitions into projectiles, lightning strikes, poison clouds, explosions, shields, healing pulses, and movement effects.',
      },
      {
        title: 'Validation before execution',
        body: 'The central engineering challenge was reliability. Every response is checked against an expected schema and every numeric value is clamped to a wave-scaled power curve before it reaches the game. Malformed candidates are rejected and revised instead of being executed blindly. This boundary lets the model invent mechanics and visual identity while the engine remains responsible for safety, balance, and what is actually possible.',
      },
      {
        title: 'Architecture and scope',
        body: 'A shared match clock synchronizes combat, pause, selection, and resume phases across the player and an AI rival lane, while each lane owns its loadout, generation requests, enemies, and combat state. We originally planned networked multiplayer, but cut it when it became clear that networking would consume the one-day hackathon without strengthening the core idea. That decision let us deliver a focused demonstration of live generative gameplay.',
      },
      {
        title: 'Results and lessons',
        body: 'Chaos Roll won first place at Hack the Valley Hack Day. Building it showed us that generating an interesting idea is the easy part; making AI output dependable enough to execute requires schemas, clamps, fallbacks, caching, and careful request sequencing. Gemini rate limits made those safeguards especially important, because the match needed to pause safely and recover gracefully when generation took longer than expected.',
      },
    ],
  },
  {
    id: 'face-tracking-avatar',
    title: 'Face-Tracking Avatar',
    description: 'A browser-based 3D avatar that replays recorded facial expressions, head movement, and speech through a conversational portfolio interface.',
    technologies: ['MediaPipe', 'Three.js', 'React', 'TypeScript'],
    githubUrl: 'https://github.com/HisMonDon/portfolio_website_dbh',
    images: [],
    story: [
      {
        title: 'The interaction goal',
        body: 'I wanted the About section to feel closer to a conversation than a conventional biography. The visitor chooses questions, hears a recorded answer, and sees a 3D avatar reproduce the performance. The interface had to make that interaction feel intentional while remaining understandable when audio is muted, playback is skipped, or the browser cannot render WebGL.',
      },
      {
        title: 'Capturing a performance',
        body: 'During recording, MediaPipe Face Landmarker converts webcam frames into named facial blendshape scores. Head and upper-body transforms are stored beside those scores as timestamped data, while the spoken answer is recorded separately. A neutral calibration pass compensates for the performer\'s resting expression before values are applied to the model.',
      },
      {
        title: 'Replaying it in Three.js',
        body: 'At playback time, the clip clock walks through recorded frames and maps each named score onto the corresponding morph target in the avatar mesh. Pose data drives the relevant bones, while Three.js handles the model, lighting, synthetic-skin treatment, and animated temple HUD. Interpolation between frames keeps the result stable when rendering and recording rates differ.',
      },
      {
        title: 'Designing for real browsing',
        body: 'The technical system is wrapped in dialogue logic, synchronized transcript timing, skip behavior, section-specific clips, muted playback, loading fallbacks, and responsive layouts. Much of the work was not the face tracking itself, but coordinating animation, audio, scrolling, navigation, and error states without letting one system interrupt another.',
      },
      {
        title: 'What I learned',
        body: 'This project taught me to treat an interactive feature as a full product surface. A convincing demo needs graceful failure paths, accessible controls, predictable state transitions, and careful performance work in addition to the central visual effect. It also gave me deeper experience connecting recorded data, real-time rendering, and interface state in one React application.',
      },
    ],
  },
  {
    id: 'pocket-pilot',
    title: 'Pocket Pilot',
    description: 'A mobile app that analyzes receipts and turns them into useful insights about personal spending habits.',
    technologies: ['React Native', 'Firebase', 'Gemini API', 'Cloudinary'],
    githubUrl: 'https://github.com/justinnova0915/hack-canada-2026',
    liveUrl: 'https://devpost.com/software/pocketpilot-gi9m3v',
    images: ['pocketpilot3.jpg', 'pocketpilot1.png', 'pocketpilot2.png'].map(image),
    story: [
      {
        title: 'Making receipts useful',
        body: 'Pocket Pilot starts with information people already receive but rarely revisit: the receipt. The goal was to reduce the effort between making a purchase and understanding where the money went, turning an uploaded receipt into structured spending information and more approachable summaries.',
      },
      {
        title: 'The product flow',
        body: 'React Native provides the mobile experience, Cloudinary handles receipt images, and Firestore stores user and transaction data. Gemini helps interpret receipt content and generate insights from the extracted information. Keeping those responsibilities separate made it easier to reason about uploads, persistence, and AI-assisted analysis as distinct stages of one workflow.',
      },
      {
        title: 'Design considerations',
        body: 'Receipt photos are not uniform: lighting, layout, merchant formatting, and line-item naming all vary. The interface therefore has to make generated information reviewable instead of presenting every result as unquestionable. The project strengthened my understanding of designing AI features around user trust, clear feedback, and data that may need correction.',
      },
      {
        title: 'What I learned',
        body: 'Pocket Pilot gave me experience connecting a mobile client to cloud storage, persistent data, and a generative model within one user-facing flow. It also reinforced that a useful AI product depends less on calling a model once and more on managing the information before and after that call.',
      },
    ],
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
