// Finalized script text for each dialogue node, verbatim. See dialogueGraph.ts for the node
// structure these ids map onto.
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
      "I started coding because I wanted to turn ideas into real tools. My first major project was Vera, a free physics platform built with Flutter and Firebase for my school's physics club.",
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
      'For a machine-learning research project on skeleton-based action recognition supervised by a university professor, I combined three different models I trained that recognize human actions from skeleton data. I expected majority voting to improve accuracy, but the two weaker models often agreed on the same mistake and overruled the strongest, making the fusion ineffective. You can see more of this on my resume.',
  },
  4: {
    id: 4,
    prompt: "Anything you want to ask that's not about code?",
    response:
      "Outside coding, I enjoy doing physics, mathematics, swimming, and skiing. I don't have much free time, but when I do, I love hanging out and playing games with my friends.",
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
      'The tracking technically worked, but the model’s expressions looked weak and unnatural. I fixed that by calibrating the model to own face first, then amplifying expressions like smiles and eyebrow raises so the animation felt much more natural and responsive.',
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
      'I wrote an evaluation script that measured exactly which predictions the fusion fixed and which correct answers it destroyed, and ultimately tried a different type of fusion method: feature fusion. I don’t want to get too technical, so all in all this proved to work very well. You can see more in my resume.',
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
      "I speak English and Mandarin fluently, mais je peux parler francais aussi through my IB school and my work with La Silhouette, my school's French writing club.",
  },
  13: {
    id: 13,
    prompt: 'Coffee or tea?',
    response:
      'Haha, probably tea. I drink coffee occasionally, but not often enough to pretend it represents my personality, work ethic, or entire approach to software engineering.',
  },
  17: {
    id: 17,
    prompt: 'What are you looking for in a role?',
    response:
      "I'm looking for a role where I can contribute to a real product, learn from experienced developers, and work on problems that are technically challenging and useful to people.",
  },
  18: {
    id: 18,
    prompt: "Thanks for chatting. What's one thing you want me to remember?",
    response:
      "I'm both a builder and a problem solver. I enjoy solving difficult technical problems, but I also care about making the result understandable and useful to other people.",
  },
  19: {
    id: 19,
    prompt: 'Anything else you’re curious about?',
    response:
      'Definitely. You can return to the opening questions and explore another project, something I learned from failure, or what I do outside software.',
  },
}
