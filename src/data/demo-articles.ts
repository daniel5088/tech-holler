import type { Article } from "@/types/content";

const demoSources = [
  {
    title: "Demonstration source: replace through the publishing pipeline",
    publisher: "The Tech Holler",
    url: "/methodology",
    publishedAt: "2026-06-12T12:00:00-04:00",
    sourceType: "primary" as const,
  },
  {
    title: "How The Tech Holler verifies developing stories",
    publisher: "The Tech Holler",
    url: "/methodology",
    publishedAt: "2026-06-12T12:00:00-04:00",
    sourceType: "top-tier" as const,
  },
];

export const demoArticles: Article[] = [
  {
    id: "demo-1",
    slug: "ai-agents-are-leaving-the-chat-window",
    title: "AI Agents Are Crawlin' Outta the Chat Window and Into the Work Shed",
    dek: "The next wave of assistants is less about clever talk and more about finishing multi-step jobs without wanderin' into a ditch.",
    category: "ai-robotics",
    publishedAt: "2026-06-12T07:00:00-04:00",
    updatedAt: "2026-06-12T07:00:00-04:00",
    readingMinutes: 6,
    author: "Buckley Byte",
    confidence: "medium",
    isBreaking: false,
    isDemo: true,
    trendScore: 88,
    heroImageAlt: "Editorial illustration of an AI control panel inside a rural workshop",
    quickTake: [
      "Agent systems are shifting from answers toward completed workflows.",
      "Reliability, permissions, and audit trails matter more than flashy demos.",
      "Businesses should start with narrow, reversible tasks.",
    ],
    sections: [
      {
        heading: "What in tarnation changed?",
        paragraphs: [
          "For a spell, most AI products sat in a chat box and waited for somebody to poke 'em. Agent-style systems are built to plan a string of actions, use software tools, check the result, and keep moving. That ain't artificial general intelligence; it is workflow automation with a language model riding shotgun.",
          "The useful question is no longer whether the machine can produce a pretty paragraph. It is whether the whole contraption can finish a bounded job, show its receipts, and stop before it does something expensive or dumb.",
        ],
      },
      {
        heading: "Why it matters",
        paragraphs: [
          "A dependable agent could trim the repetitive work around research, support, coding, and operations. A sloppy one can move an error through five systems before a human notices. The winners will likely be products with clear permissions, strong evaluation, and a big red stop button.",
        ],
      },
      {
        heading: "The road ahead",
        paragraphs: [
          "Expect the near-term market to favor supervised agents that handle small jobs and ask before irreversible actions. Fully independent digital workers make a mighty fine keynote, but the practical money is in systems that know when to holler for help.",
        ],
      },
    ],
    sources: demoSources,
  },
  {
    id: "demo-2",
    slug: "passkeys-finally-getting-practical",
    title: "Passkeys Are Finally Gettin' Easier Than Rememberin' Pa$$word123",
    dek: "Passwordless sign-in is moving from security conference promise to something regular folks can use without cussin' at the screen.",
    category: "cyber-internet",
    publishedAt: "2026-06-11T19:00:00-04:00",
    updatedAt: "2026-06-11T19:00:00-04:00",
    readingMinutes: 5,
    author: "Buckley Byte",
    confidence: "high",
    isBreaking: false,
    isDemo: true,
    trendScore: 75,
    heroImageAlt: "Editorial illustration of a glowing key unlocking a digital gate",
    quickTake: [
      "Passkeys reduce phishing risk by binding sign-in to the real service.",
      "Cross-device recovery remains the part users need explained clearly.",
      "Organizations should support passkeys alongside existing recovery paths.",
    ],
    sections: [
      {
        heading: "A key without the key ring",
        paragraphs: [
          "A passkey uses cryptography stored on your device instead of a secret phrase you can accidentally hand to a crook. The service gets proof that your device holds the right key, but it never receives the private part. That makes a fake login page about as useful as a screen door on a submarine.",
        ],
      },
      {
        heading: "The hitch in the trailer",
        paragraphs: [
          "The hard part is not the math. It is helping people understand where their passkeys sync, how they move to a new phone, and what happens when every device goes missing. Good recovery design will decide whether this becomes boring infrastructure or another half-finished security feature.",
        ],
      },
    ],
    sources: demoSources,
  },
  {
    id: "demo-3",
    slug: "home-robots-need-better-hands",
    title: "Home Robots Got Plenty of Brains, but Their Hands Still Ain't Worth a Darn",
    dek: "Better AI has made robots more adaptable, yet grabbing a wet glass or folding a shirt remains a mechanical rodeo.",
    category: "ai-robotics",
    publishedAt: "2026-06-11T13:00:00-04:00",
    updatedAt: "2026-06-11T13:00:00-04:00",
    readingMinutes: 7,
    author: "Buckley Byte",
    confidence: "medium",
    isBreaking: false,
    isDemo: true,
    trendScore: 72,
    heroImageAlt: "Editorial illustration of a household robot carefully holding a glass",
    quickTake: [
      "Manipulation is a tougher bottleneck than navigation or conversation.",
      "Useful home robots will likely begin with a small menu of chores.",
      "Safety and repairability may matter more than humanoid appearance.",
    ],
    sections: [
      {
        heading: "Why hands are hard",
        paragraphs: [
          "A kitchen is a chaos laboratory. Objects bend, slip, spill, break, and hide behind one another. Humans solve that mess with touch, vision, experience, and little adjustments we barely notice. A robot has to calculate the whole dadgum affair.",
        ],
      },
      {
        heading: "What arrives first",
        paragraphs: [
          "The first useful machines probably will not do every chore. They will handle repetitive jobs in carefully mapped homes, use special tools, and politely refuse unfamiliar situations. That may sound less like science fiction, but a machine that reliably unloads a dishwasher is still one heck of an engineering achievement.",
        ],
      },
    ],
    sources: demoSources,
  },
  {
    id: "demo-4",
    slug: "science-fiction-interface-predictions",
    title: "Science Fiction Nailed the Talking Computer, Then Got the Privacy Part Sideways",
    dek: "Fiction predicted natural conversation with machines, but usually skipped the servers, surveillance, and business models behind the curtain.",
    category: "sci-fi-reality",
    publishedAt: "2026-06-11T07:00:00-04:00",
    updatedAt: "2026-06-11T07:00:00-04:00",
    readingMinutes: 6,
    author: "Buckley Byte",
    confidence: "high",
    isBreaking: false,
    isDemo: true,
    trendScore: 69,
    heroImageAlt: "Editorial illustration combining a retro spaceship computer and a modern smart speaker",
    quickTake: [
      "Conversational interfaces moved from fiction into everyday products.",
      "Stories often ignored data collection and platform incentives.",
      "Modern speculative fiction can help expose the hidden infrastructure.",
    ],
    sections: [
      {
        heading: "The prediction that landed",
        paragraphs: [
          "Writers figured people would rather speak naturally than memorize a stack of commands. They were right as rain. What they often missed was that the friendly computer voice might be connected to warehouses of servers and a company eager to measure every click.",
        ],
      },
      {
        heading: "Fiction's next job",
        paragraphs: [
          "The best science fiction does not need to predict a gadget exactly. It can reveal who controls the gadget, who pays for it, and who gets left holding the bag. That is where stories still have a head start on product demos.",
        ],
      },
    ],
    sources: demoSources,
  },
  {
    id: "demo-5",
    slug: "small-satellites-change-weather-forecasting",
    title: "A Swarm of Little Satellites Could Make Weather Forecasts Less Squirrely",
    dek: "More frequent observations may sharpen forecasts, provided researchers can calibrate a sky full of smaller, cheaper instruments.",
    category: "space-science",
    publishedAt: "2026-06-10T19:00:00-04:00",
    updatedAt: "2026-06-10T19:00:00-04:00",
    readingMinutes: 6,
    author: "Buckley Byte",
    confidence: "medium",
    isBreaking: false,
    isDemo: true,
    trendScore: 65,
    heroImageAlt: "Editorial illustration of small satellites observing a storm over farmland",
    quickTake: [
      "More satellites can shorten the time between observations.",
      "Cheap sensors still require careful calibration and data fusion.",
      "Better short-range forecasts could aid farms, utilities, and emergency crews.",
    ],
    sections: [
      {
        heading: "More eyes on the storm",
        paragraphs: [
          "Traditional weather satellites are powerful but costly. Constellations of smaller spacecraft offer another approach: gather more frequent slices of the atmosphere and combine them with established observations. More data does not automatically mean a better forecast, but timely data can help models catch a fast-changing storm.",
        ],
      },
      {
        heading: "The calibration problem",
        paragraphs: [
          "A bargain sensor that drifts is just a confident liar in orbit. Scientists have to compare instruments, correct biases, and understand what each measurement truly represents before feeding it to a forecast model.",
        ],
      },
    ],
    sources: demoSources,
  },
  {
    id: "demo-6",
    slug: "what-personal-computing-looks-like-in-2035",
    title: "By 2035, Your Computer May Be Less a Box and More a Traveling Tool Belt",
    dek: "A futurecasting look at ambient displays, private local AI, and why the humble laptop probably ain't dead yet.",
    category: "futurecasting",
    publishedAt: "2026-06-10T13:00:00-04:00",
    updatedAt: "2026-06-10T13:00:00-04:00",
    readingMinutes: 8,
    author: "Buckley Byte",
    confidence: "low",
    isBreaking: false,
    isDemo: true,
    trendScore: 62,
    forecastHorizon: "2030-2035",
    heroImageAlt: "Editorial illustration of wearable displays and a compact personal computer in 2035",
    quickTake: [
      "Computing may spread across wearables, rooms, vehicles, and cloud services.",
      "Local AI could keep sensitive context close to the user.",
      "Laptops survive because keyboards, screens, and ownership remain useful.",
    ],
    sections: [
      {
        heading: "The forecast",
        paragraphs: [
          "The personal computer is likely to split into a collection of surfaces while keeping a private core. Glasses, earbuds, dashboards, and room displays may borrow context from a device or account that belongs to you. The trick is making the pieces cooperate without turning your life into a company data buffet.",
        ],
      },
      {
        heading: "What could derail it",
        paragraphs: [
          "Battery limits, social resistance, regulation, and plain old inconvenience could keep ambient computing from spreading. Folks will not wear a forehead projector just because a keynote calls it magical. Products have to be comfortable, trustworthy, and genuinely faster than pulling out a phone.",
        ],
      },
      {
        heading: "Confidence and assumptions",
        paragraphs: [
          "Confidence is low because this forecast crosses a decade. It assumes continued progress in efficient chips, display hardware, local models, and interoperable identity. Any one of those could bog down like a pickup in red clay.",
        ],
      },
    ],
    sources: demoSources,
  },
];
