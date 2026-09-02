export interface ProjectStorySection {
  title: string
  body: string
}

export interface ProjectChallenge {
  problem: string
  approach: string
}

export interface ProjectDeepDiveEntry {
  question: string
  answer: string
}

export interface Project {
  id: string
  title: string
  description: string
  tier: 'featured' | 'more'
  images: string[]
  technologies: string[]
  githubUrl?: string
  liveUrl?: string
  liveLabel?: string
  // Short outcome line shown next to the title, e.g. an award or a real usage number.
  resultBadge?: string
  story?: ProjectStorySection[]
  // Case-study material: the specific technical problems solved and how, an optional plain-text
  // architecture diagram, and a Q&A "deep dive" section for readers who want more than the story.
  challenges?: ProjectChallenge[]
  architecture?: string
  deepDive?: ProjectDeepDiveEntry[]
}

const image = (name: string) =>
  new URL(`../assets/portfolio-source/project_images/${name}`, import.meta.url).href

export const PROJECTS: Project[] = [
  {
    id: 'vera',
    title: 'Vera',
    description: "A cross-platform learning platform for my school's Physics Club, with student-made tutorials, authentication, and saved video progress.",
    tier: 'featured',
    resultBadge: '1,000+ visitors in 30 days',
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
    challenges: [
      {
        problem: "Existing physics resources didn't match the specific course structure students needed, and switching between multiple sites broke the study flow.",
        approach: 'Built a single, curriculum-aligned platform by working directly with the physics department head to organize lessons by course and topic.',
      },
      {
        problem: 'I had never used a frontend framework before starting this project.',
        approach: 'Learned Flutter and Dart from scratch to build one consistent interface that works across devices, instead of picking a framework I already knew and compromising on reach.',
      },
      {
        problem: "The original video playback package could not reliably play Vera's WebM lesson videos.",
        approach: "Traced the failure to the media layer specifically, evaluated alternative playback approaches, and replaced it with Chewie on top of Flutter's video_player package instead of patching around the symptom.",
      },
      {
        problem: 'Content needed to support authentication and per-user saved progress without a dedicated backend team.',
        approach: 'Used Firebase for accounts, content storage, and saved video progress, learned independently alongside Flutter.',
      },
    ],
    architecture:
`   Student opens lesson
            |
            v
  Firebase Auth (account)
            |
            v
   Flutter client (Vera)
       /          \\
  Lesson content   Saved progress
   (Firestore)       (Firestore)
       \\          /
            v
     Chewie + video_player
      (WebM playback)`,
    deepDive: [
      {
        question: 'Why build a full platform instead of a simpler study guide?',
        answer: "The problem was not a lack of information online, it was that the information was scattered across sites organized differently from the actual course. A platform let lessons, videos, and saved progress live in one place, matched to the course structure students were actually following.",
      },
      {
        question: 'What happens when a lesson video fails to load?',
        answer: 'That was the real bug I hit: the original playback package silently failed on Vera\'s WebM files. Once I isolated it to the media layer, I could evaluate alternatives with confidence instead of guessing at fixes further up the stack.',
      },
      {
        question: 'What did I personally build?',
        answer: 'The entire platform end to end: the Flutter interface, the Firebase-backed authentication and saved progress system, the video playback layer, and the curriculum structure itself, developed with the physics department head.',
      },
      {
        question: 'What would I change with another week?',
        answer: 'I would add lightweight analytics on which lessons students revisit most, since student feedback, like requests for more AP exam walkthroughs, already showed the roadmap should follow actual usage, not just my own guesses.',
      },
    ],
  },

  {
    id: 'chaos-roll',
    title: 'Chaos Roll',
    description: 'A wave-survival game where Gemini generates playable abilities and enemy waves in real time. The challenge was not calling an LLM, it was making unpredictable model output safe enough to drive a live game.',
    tier: 'featured',
    resultBadge: '1st Place, Hack the Valley Hack Day',
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
    challenges: [
      {
        problem: 'Gemini occasionally returned malformed or semantically invalid ability and enemy definitions.',
        approach: 'Every response is checked against an expected schema before it is allowed anywhere near game state.',
      },
      {
        problem: 'Even schema-valid responses could still break game balance, for example a weapon with an absurd damage value.',
        approach: 'Every numeric value is clamped to a wave-scaled power curve, so nothing generated can exceed what the game can safely handle at that point in the match.',
      },
      {
        problem: 'A malformed or unsafe candidate needed a fallback that did not just break the wave.',
        approach: 'Invalid candidates are rejected and the match falls back to deterministic assets instead of executing untrusted output.',
      },
      {
        problem: 'Generation could not be allowed to freeze the match while waiting on the model.',
        approach: 'Ability and enemy generation runs asynchronously against a shared match clock, so combat, pause, and resume phases stay responsive independent of API latency.',
      },
      {
        problem: 'Gemini rate limits could stall generation mid-match.',
        approach: 'Requests are cached and sequenced carefully so the match can pause safely and recover gracefully when generation takes longer than expected.',
      },
    ],
    architecture:
`     Gemini API
          |
          v
  Structured JSON
 (ability / enemy)
          |
          v
    Schema check
     /         \\
  valid       invalid
    |             |
    v             v
Clamp to wave  Deterministic
power curve      fallback
    |             |
    v             |
Game state <-------`,
    deepDive: [
      {
        question: "Why not trust Gemini's output directly?",
        answer: 'Gemini can return syntactically valid JSON that is still unsafe for the game, for example a value far outside what a given wave should allow. Generation was treated as untrusted input from the start, the same way I would treat any external API response.',
      },
      {
        question: 'What happens when generation fails or is invalid?',
        answer: 'The match does not stall or crash. Invalid candidates are rejected and the game falls back to deterministic assets, so a bad response degrades the experience instead of breaking it.',
      },
      {
        question: 'What did I personally build?',
        answer: "The schema validation and clamping layer between Gemini's output and the game's TypeScript systems, the shared match clock that keeps combat, pause, and generation in sync, and the caching and request sequencing that absorbs Gemini's rate limits without freezing gameplay.",
      },
      {
        question: 'What would I change with another week?',
        answer: 'I would add an automated revision step that sends invalid responses back to the model with the specific validation error, instead of only discarding them, so more of Gemini\'s output becomes usable rather than falling back to static content.',
      },
    ],
  },
  {
    id: 'distill',
    title: 'Distill',
    description: 'Eye-tracking Chrome extension that calibrates to what a reader actually looks at, then hides the ads, navigation clutter, and autoplay media competing for their attention.',
    tier: 'featured',
    resultBadge: '1st Place, NGN Hacks 2026',
    technologies: ['React', 'Vite', 'TensorFlow', 'MediaPipe', 'FastAPI', 'Python', 'Qwen2.5-7B-Instruct'],
    liveUrl: 'https://devpost.com/software/distill-ojsuza',
    liveLabel: 'View on Devpost',
    images: ['distill_1.png', 'distill_2.jpg', 'distill_3.jpg'].map(image),
    story: [
      {
        title: 'The problem',
        body: 'Modern webpages are often cluttered with ads, navigation menus, and autoplay media that compete for attention against the content someone actually came to read. Distill asks whether a browser extension can identify that clutter automatically and hide it, without also hiding anything the page needs to function or that protects the user, like consent banners or password fields.',
      },
      {
        title: 'Personalizing with eye tracking',
        body: 'Distill uses MediaPipe and TensorFlow to run an eye-tracking calibration pass so the extension can learn what a given user actually looks at versus skips over, then tune its simplification to that person rather than applying one fixed rule to every page and every visitor.',
      },
      {
        title: 'A layered, safety-checked pipeline',
        body: 'Page elements are classified through a layered pipeline that combines rule-based heuristics with LLM analysis from a Qwen2.5-7B-Instruct model served through a FastAPI backend. Deterministic safety flags sit on top of that pipeline so consent controls, password fields, and other sensitive elements are never hidden, regardless of what the classifier decides.',
      },
      {
        title: 'Result',
        body: 'Built with Lucy Yang at NGN Hacks 2026, Distill won first place, validating the idea that combining lightweight heuristics with model-based judgment, bounded by hard safety rules, can make a browsing experience genuinely calmer without sacrificing user control.',
      },
    ],
    challenges: [
      {
        problem: 'Automatically hiding page clutter risks hiding something the page actually needs, like a consent banner or a password field.',
        approach: 'Deterministic safety flags sit above the classifier and are never overridden, so sensitive or functional elements can never be hidden regardless of what the model decides.',
      },
      {
        problem: "A single fixed rule for what counts as clutter does not fit every reader or every page.",
        approach: 'An eye-tracking calibration pass built with MediaPipe and TensorFlow learns what a specific user actually looks at versus skips, and simplification is tuned to that person.',
      },
      {
        problem: 'Classifying page elements accurately needed more judgment than simple heuristics alone could provide.',
        approach: 'Combined rule-based heuristics with LLM analysis from a Qwen2.5-7B-Instruct model served through a FastAPI backend, layering model judgment on top of deterministic rules instead of replacing them.',
      },
    ],
    architecture:
`   Webpage DOM
        |
        v
 Rule-based heuristics
        |
        v
 Qwen2.5-7B-Instruct
  (FastAPI backend)
        |
        v
 Safety flag check
 (consent, auth, etc.)
   /            \\
blocked         allowed
   |                |
   v                v
keep visible   hide element`,
    deepDive: [
      {
        question: 'Why not just let the model decide what to hide?',
        answer: "An LLM's judgment about what counts as clutter is a suggestion, not a guarantee. Consent banners, login forms, and other functional or protective elements are marked safe by deterministic rules that the model's classification can never override.",
      },
      {
        question: 'What happens when the eye-tracking calibration is inaccurate for a user?',
        answer: 'The extension still falls back to the rule-based heuristics layer, so simplification degrades to a reasonable default instead of breaking or hiding the wrong content.',
      },
      {
        question: 'What did I personally build?',
        answer: 'I worked on the layered classification pipeline and the safety-flag logic that sits above it, alongside Lucy Yang, who I built this with at NGN Hacks 2026.',
      },
      {
        question: 'What would I change with another week?',
        answer: 'I would add a visible review step so a user can see and undo anything the extension hid, closing the loop between an automatic decision and user trust the same way Pocket Pilot does for AI-extracted receipt data.',
      },
    ],
  },

  {
    id: 'face-tracking-avatar',
    title: 'Face-Tracking Avatar',
    description: 'A browser-based 3D avatar that replays recorded facial expressions, head movement, and speech through a conversational portfolio interface.',
    tier: 'featured',
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
    challenges: [
      {
        problem: 'A recorded conversational avatar needed to feel intentional even when audio is muted, playback is skipped, or the browser cannot render WebGL.',
        approach: 'Wrapped the face-tracking system in dialogue logic, synchronized transcript timing, skip behavior, and loading fallbacks, so the interaction still makes sense under any of those conditions.',
      },
      {
        problem: "Raw MediaPipe blendshape scores do not map cleanly onto a 3D model's resting expression.",
        approach: 'Ran a neutral calibration pass to compensate for my own resting expression before applying scores to the avatar mesh.',
      },
      {
        problem: 'Recording and rendering frame rates do not match, which would otherwise cause visible stuttering during playback.',
        approach: 'Interpolated between recorded frames at playback time so the result stays stable regardless of the rate mismatch.',
      },
      {
        problem: 'Most of the real difficulty was not the face tracking itself, it was coordinating many independent systems, like animation, audio, scrolling, and navigation, without one interrupting another.',
        approach: 'Built dedicated state handling for section-specific clips and playback phases so each system stays predictable on its own and in combination.',
      },
    ],
    architecture:
`Webcam recording session
           |
           v
 MediaPipe Face Landmarker
   (blendshape scores)
           |
           v
 Neutral calibration pass
           |
           v
  Recorded clip (JSON)
    + separate audio
           |
           v
 Clip player (frame clock)
           |
           v
 Three.js avatar mesh
 (morph targets + bones)`,
    deepDive: [
      {
        question: 'Why replay a recorded clip instead of tracking a live webcam feed?',
        answer: 'A live feed would need camera access from every visitor, which is invasive and unreliable. Recording a performance once and replaying the blendshape and pose data on a 3D model gets the same expressive result without asking visitors for camera permission.',
      },
      {
        question: "What happens when the browser can't render WebGL?",
        answer: 'The interface has loading fallbacks specifically for that case, since the conversation still needs to make sense if the avatar itself never appears.',
      },
      {
        question: 'What did I personally build?',
        answer: 'The full pipeline: the calibration and recording setup, the clip playback and frame interpolation system, the Three.js avatar rendering, and the dialogue and transcript logic coordinating all of it.',
      },
      {
        question: 'What would I change with another week?',
        answer: 'I would extend the same clip player to support a couple more dialogue branches, since the dialogue graph is already built to support that, and it is the fastest way to add depth without touching the underlying playback system.',
      },
    ],
  },
  {
    id: 'integrals-buoyancy-simulator',
    title: 'Integrals buoyancy Simulator',
    description: "Models buoyancy and vertical motion by numerically integrating force relationships across submerged geometry, with a customizable liquid density.",
    tier: 'featured',
    technologies: ['C++', 'SFML', 'CMake', 'GLSL'],
    githubUrl: 'https://github.com/HisMonDon/Buoyancy-Simulator',
    images: ['buoyancy_project_1.png', 'buoyancy_project_2.png'].map(image),
  },

  {
    id: 'pocket-pilot',
    title: 'Pocket Pilot',
    description: 'A mobile app that analyzes receipts and turns them into useful insights about personal spending habits.',
    tier: 'more',
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
    challenges: [
      {
        problem: "Receipt photos vary wildly in lighting, layout, and merchant formatting, so extraction can't assume a consistent structure.",
        approach: 'Gemini interprets receipt content into structured spending information, but the interface treats every generated result as reviewable rather than presenting it as unquestionably correct.',
      },
      {
        problem: 'Uploads, persistence, and AI-assisted analysis needed to stay independently reasoned about across a mobile client.',
        approach: 'Split responsibilities cleanly: React Native for the interface, Cloudinary for receipt images, Firestore for user and transaction data, and Gemini scoped only to interpretation and insight generation.',
      },
      {
        problem: 'A useful AI feature needed more than a single model call to earn user trust.',
        approach: 'Focused engineering effort on managing the information before and after the Gemini call, like upload handling, structured storage, and reviewable output, rather than treating the model call itself as the hard part.',
      },
    ],
    architecture:
`Receipt photo (upload)
           |
           v
     Cloudinary
   (image storage)
           |
           v
     Gemini API
 (structured extraction)
           |
           v
      Firestore
 (transactions + insights)
           |
           v
  User review / correction`,
    deepDive: [
      {
        question: "Why not trust Gemini's extracted receipt data directly?",
        answer: 'Receipt formatting is inconsistent enough that extraction will sometimes be wrong. The interface surfaces generated data for review instead of writing it silently, so a bad extraction is a quick correction, not a hidden error in someone\'s spending history.',
      },
      {
        question: 'What happens when a receipt photo is low quality or unusual?',
        answer: "The upload and storage layer, Cloudinary and Firestore, stays independent from the interpretation step, so a bad extraction doesn't corrupt stored data. The user can still see and correct the result.",
      },
      {
        question: 'What did I personally build?',
        answer: 'I worked on the app within a team, focused on connecting the mobile client to Cloudinary and Firestore and structuring the Gemini-assisted analysis step.',
      },
      {
        question: 'What would I change with another week?',
        answer: 'I would add confidence indicators to extracted line items, similar to the safety-flag approach in Distill, so users know at a glance which fields are worth double-checking.',
      },
    ],
  },
  {
    id: 'competitive-programming',
    title: 'Competitive Programming',
    description: 'Solved problems on DMOJ, focusing on the CCC contest. Worked with data structures, graph theory, and other algorithms.',
    tier: 'more',
    technologies: ['C++', 'Python', 'Java'],
    githubUrl: 'https://github.com/HisMonDon/CCC_Senior',
    liveUrl: 'https://dmoj.ca/user/HisMonDon',
    images: ['competitive_project_0.png', 'competitive_project_1.png', 'competitive_project_2.png'].map(image),
  },
  {
    id: 'portfolio-website',
    title: 'Portfolio Website',
    description: 'An earlier portfolio built with Flutter Web to present my projects, skills, and experience through a space-themed interface.',
    tier: 'more',
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
    id: 'the-knight',
    title: 'The Knight',
    description: '2D adventure game, with random world generation, and a battle and currency system. This was my Grade 11 Computer Science CPT, and I finished with a 99.',
    tier: 'more',
    technologies: ['Python', 'Pygame'],
    images: ['cpt_project_1.png', 'cpt_project_2.png'].map(image),
  },

]
