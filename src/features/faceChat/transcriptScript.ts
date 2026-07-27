// Finalized script text for each dialogue node, verbatim. See dialogueGraph.ts for the node
// structure these ids map onto.
export interface TranscriptEntry {
  id: number
  prompt: string
  response: string
}

export const TRANSCRIPT_SCRIPT: Record<number, TranscriptEntry> = {
  0: {
    id: 0,
    prompt: 'Live Transcript',
    response:
      "Hi, I'm Chenyu Lu, but I also go by Eric. I'm a student and developer who enjoys turning technical ideas into projects that people can actually use. The avatar you're speaking with is one of those projects that is inside my portfolio. It uses real-time face tracking to mirror my expressions while answering questions about my work, experiences, and interests. You can start by choosing any of the questions on the screen.",
  },
  1: {
    id: 1,
    prompt: "How'd you get into coding?",
    response:
      "How did I get into coding? Well, I started coding because I wanted to turn ideas into real tools. My first major project was Vera, which was a free physics platform built with Flutter and Firebase for my school's physics club. You can see more on that in my project section of this portfolio.",
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
      'What is a project that went wrong? Well, for a machine-learning research project on skeleton-based action recognition supervised by a university professor, I combined three different models I trained that recognize human actions from skeleton data. I expected majority voting to improve accuracy, but the two weaker models often agreed on the same mistake and overruled the strongest, making the fusion ineffective. You can see more on this on my resume.',
  },
  4: {
    id: 4,
    prompt: "Anything you want to ask that's not about code?",
    response:
      "That's a great question. Outside of coding, I enjoy doing physics and mathematics. I also swim and ski, and I don't have much free time, but when I do, I love hanging out and playing games with my friends.",
  },
  5: {
    id: 5,
    prompt: "What's the hardest thing you had to unlearn?",
    response:
      "I had to unlearn that more features meant a better project. Now, I build the smallest useful version first, and then I test it and only add complexity when it solves a real problem. For hackathons, I usually do this using AI, like Google AI Studio, to prototype and visualize it, so it's quick, fast, and efficient.",
  },
  6: {
    id: 6,
    prompt: 'What do you wish someone told you starting out?',
    response:
      "I wish someone told me to plan projects thoroughly. Previously, I thought that if you were good at coding, you would be fine for everything. However, by attending hackathons and building my own projects, I realized that planning should be an important part in one's project.",
  },
  7: {
    id: 7,
    prompt: 'What were some problems in this project?',
    response:
      "The tracking technically worked, but the model's expressions looked weak and unnatural. I fixed that by calibrating the model to my own face first, and then amplifying expressions like smiles and eyebrow raises so the animation felt much more natural and responsive. It's not perfect yet, as you can see some of my speech is still not that great, but it's still better than the original, and hopefully in time I can be able to improve it.",
  },
  8: {
    id: 8,
    prompt: 'Why Three.js instead of Unity?',
    response:
      'I chose Three.js because the face-tracking project is built directly into my portfolio website. It works naturally with React and runs in the browser, so visitors like you can try it instantly without downloading a separate Unity application. However, if you want to try it yourself, the link is in my project section under this project.',
  },
  9: {
    id: 9,
    prompt: "What'd you do differently after?",
    response:
      "I wrote an evaluation script that measured exactly which predictions the fusion fixed and which correct answers it destroyed, and ultimately tried a different type of fusion: feature fusion. I don't want to get too technical, so all in all this proved to work very, very well. You can see more in my resume or under my project section.",
  },
  10: {
    id: 10,
    prompt: 'How do you usually debug something like that?',
    response:
      'I break the pipeline into stages and inspect each output separately. Then I reproduce the issue with the smallest possible example until I can identify the exact failing assumption. I also do this for competitive coding when some of my test cases are wrong.',
  },
  11: {
    id: 11,
    prompt: 'What do you do outside of code?',
    response:
      "As of the 2026 and 2027 school year, I'm president of my school's Physics Club, the vice president of a French article newspaper club, an assistant teacher at Spirit of Math, and a Level 2 ski instructor. I'm also on the swim team and part of the swimming club LCM.",
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
      "What a question. I would probably say tea. I drink coffee occasionally, but not often enough that I love it. And tea really calms me down, and I just generally enjoy drinking tea more, although I don't drink that much of either one.",
  },
  17: {
    id: 17,
    prompt: 'What are you looking for in a role?',
    response:
      "I'm looking for a role where I can contribute to a real product or a real project, learn from experienced developers, and work on problems that are technically challenging and genuinely useful for people.",
  },
  18: {
    id: 18,
    prompt: "Thanks for chatting. What's one thing you want me to remember?",
    response:
      "I'm both a builder and a problem solver. I enjoy solving difficult technical problems, but I also care about making the result understandable and useful for other people.",
  },
  19: {
    id: 19,
    prompt: 'Anything else you’re curious about?',
    response:
      'Definitely. You can return to the opening questions and explore another project, something I learned from failure, or what I do outside software.',
  },
}
