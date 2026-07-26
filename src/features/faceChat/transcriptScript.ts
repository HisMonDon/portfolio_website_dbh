// Finalized script text for each dialogue node, verbatim. See
// dialogueGraph.ts for the node structure these ids map onto:
//   1-4   openings, 5-12 follow-ups, 13/15/16 closings, 14 loop node.

export interface TranscriptEntry {
  id: number
  prompt: string
  response: string
}

export const TRANSCRIPT_SCRIPT: Record<number, TranscriptEntry> = {
  1: {
    id: 1,
    prompt: "How'd you get into coding?",
    response:
      'I started coding because I wanted to turn ideas into real tools. My first major project was Vera, a free physics platform built with Flutter and Firebase for students at my school.',
  },
  2: {
    id: 2,
    prompt: 'Walk me through your face-tracking project.',
    response:
      'The avatar you are seeing right now uses MediaPipe to detect facial blendshapes from a webcam, then maps them onto a 3D model in Three.js. I also added calibration so expressions look more natural.',
  },
  3: {
    id: 3,
    prompt: "What's a project that went wrong?",
    response:
      'I combined three ML models expecting majority voting to boost accuracy. Instead, the two weaker ones agreed on the same mistake and overruled the best one — more on my resume.',
  },
  4: {
    id: 4,
    prompt: "Anything you want to ask that's not about code?",
    response:
      "Outside coding, I teach physics, mathematics, swimming, and skiing. I don't have much free time, but when I do, I love hanging out and playing games with my friends.",
  },
  5: {
    id: 5,
    prompt: "What's the hardest thing you had to unlearn?",
    response:
      'I had to unlearn that more features meant a better project. Now I build the smallest useful version first, test it, and only add complexity when it solves a real problem.',
  },
  6: {
    id: 6,
    prompt: 'What do you wish someone told you starting out?',
    response:
      "I wish someone told me to plan projects thoroughly. Previously, I thought that if you were good at coding, you would be fine for everything. However, by attending hackathons and building my own projects, I realized that planning should be an important aspect in one's project.",
  },
  7: {
    id: 7,
    prompt: 'What were some problems in this project?',
    response:
      "The tracking technically worked, but the model's expressions looked weak and unnatural. I fixed that by calibrating the model to my own face first, then amplifying expressions like smiles and eyebrow raises so the animation felt much more natural and responsive.",
  },
  8: {
    id: 8,
    prompt: 'Why Three.js instead of Unity?',
    response:
      'I chose Three.js because the face-tracking project is built directly into my portfolio website. It works naturally with React and runs in the browser, so visitors can try it instantly without downloading a separate Unity application.',
  },
  9: {
    id: 9,
    prompt: "What'd you do differently after?",
    response:
      "I switched from majority-vote fusion to feature fusion — combining the models' raw outputs instead of their final decisions. That fixed it, more on my resume.",
  },
  10: {
    id: 10,
    prompt: 'How do you usually debug something like that?',
    response:
      'I break the pipeline into stages and inspect each output separately. Then I reproduce the issue with the smallest possible example until I can identify the exact failing assumption.',
  },
  11: {
    id: 11,
    prompt: 'What do you do outside of code?',
    response:
      "As of the 2026-2027 school year, I'm president of my school's Physics Club, the vice president of a French Article newspaper club, an assistant teacher at Spirit of Math, and a Level 2 ski instructor. I am also on the swim team and part of the swimming club LCM.",
  },
  12: {
    id: 12,
    prompt: 'What languages do you speak?',
    response:
      "I speak English and Mandarin fluently, mais je peux parler français aussi through my IB school and my work with La Silhouette, my school's French writing club.",
  },
  13: {
    id: 13,
    prompt: 'Coffee or tea?',
    response:
      'Haha, probably tea. I drink coffee occasionally, but not often enough to pretend it represents my personality, work ethic, or entire approach to software engineering.',
  },
  14: {
    id: 14,
    prompt: "Anything else you're curious about?",
    response:
      "Definitely. You can return to the opening questions and explore another project, something I learned from failure, or what I do outside software.",
  },
  15: {
    id: 15,
    prompt: 'What are you looking for in a role?',
    response:
      "I'm looking for a role where I can contribute to a real product, learn from experienced developers, and work on problems that are technically challenging and useful to people.",
  },
  16: {
    id: 16,
    prompt: "Thanks for chatting. What's one thing you want me to remember?",
    response:
      "I'm both a builder and a teacher. I enjoy solving difficult technical problems, but I also care about making the result understandable and useful to other people.",
  },
}
