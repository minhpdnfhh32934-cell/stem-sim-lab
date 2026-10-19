import type { Messages } from '../types';

/** English UI strings. Must have exactly the same keys as `vi.ts` (checked by the type). */
const en: Messages = {
  app: {
    name: 'SimLab',
    tagline: 'Physics · Chemistry · Biology simulations',
  },
  subjects: {
    label: 'Subject',
    physics: 'Physics',
    chemistry: 'Chemistry',
    biology: 'Biology',
  },
  topbar: {
    problemLabel: 'Problem',
    problemPlaceholder: 'Type or paste a problem… (Ctrl+Enter to analyze)',
    analyze: 'Analyze',
    analyzeNeedsText: 'Enter a problem to analyze',
    analyzeAiOff: 'AI is off — enable it in Settings, or build the scene manually',
    analyzeNeedsKey: 'Connect AI to use this feature (click to open Connect AI)',
    cancelAnalyze: 'Cancel analysis',
    manual: 'Build a scene (no AI)',
    undo: 'Undo (Ctrl+Z)',
    redo: 'Redo (Ctrl+Y)',
    settings: 'Settings',
    toggleTheme: 'Toggle light / dark theme',
    presentation: 'Presentation mode (F5)',
  },
  ai: {
    notAllowed: 'AI: not enabled',
    notAllowedHint:
      'AI is not enabled on this computer yet (18+ not confirmed). Simulations work as usual.',
    offline: 'AI: offline',
    cloud: 'Connected to {provider}',
    off: 'AI: off',
    noKey: 'AI not connected',
    cloudHint: 'Using {provider} · model: {model}. The problem is sent to their servers.',
    offHint: 'AI is off. The sample library and the manual scene builder still work.',
    noKeyHint: 'No API key for {provider}. Open Settings → Connect AI to enter it.',
    problem: 'AI: needs checking',
    quotaHint:
      '{provider} reports its quota is used up. Wait a while or try tomorrow; manual building still works.',
    badModelHint: 'The chosen model was not found. Open Settings → Connect AI to fix it.',
    errorHint: 'The AI server reported an error. Open Settings → Connect AI to test again.',
    badKeyHint: '{provider} refused the API key (wrong or disabled). Check it in Settings.',
    local: 'AI on this computer: {name}',
    localHint:
      'Chosen: {label} at {address}. SimLab sends the problem only to this program on your computer, never online by itself, and asks it only when you use AI.',
    localMissing: 'AI on this computer: not chosen',
    localMissingHint:
      'You chose AI on this computer but no program and model yet, so nothing is sent. Click to choose in Settings → AI on this computer.',
    gemma: 'Gemma on this computer',
    gemmaHint:
      'Using local Gemma · model: {model}. The problem is processed right on this computer, not sent online.',
    gemmaMissing: 'Gemma: not downloaded',
    gemmaMissingHint:
      'You chose local Gemma but its model is not downloaded, so nothing is sent. Click to download it in Settings.',
  },
  sidebar: {
    regionLabel: 'Topic library',
    library: 'Library',
    history: 'History',
    search: 'Search topics…',
    noResults: 'No matching topics.',
    foundIn: '{count} in {subject}',
    clearSearch: 'Clear search',
    comingSoon: 'Coming soon',
    comingSoonHint: 'This topic will be built in a later phase.',
    historyEmpty: 'No simulations yet. Simulations you run will appear here.',
  },
  chapters: {
    kinematics: 'Kinematics',
    dynamics: 'Dynamics',
    energyMomentum: 'Energy & Momentum',
    oscillations: 'Oscillations',
    atoms: 'Atoms',
    molecules: 'Molecules',
    reactions: 'Chemical reactions',
    particles: 'Particle level',
    cell: 'Cell division',
    molecular: 'Molecular biology',
    genetics: 'Genetics',
    ecology: 'Ecology',
    cellPhysiology: 'Cell physiology',
  },
  topics: {
    uniformMotion: 'Uniform linear motion',
    uniformAcceleration: 'Uniformly accelerated motion',
    freeFall: 'Free fall',
    horizontalProjectile: 'Horizontal projectile',
    obliqueProjectile: 'Oblique projectile',
    newtonLaws: "Newton's laws",
    inclinedPlane: 'Inclined plane',
    pulley: 'Pulleys and strings',
    hookeSpring: "Springs (Hooke's law)",
    energyConservation: 'Conservation of mechanical energy',
    collisions: 'Elastic and inelastic collisions',
    springPendulum: 'Spring–mass oscillator',
    simplePendulum: 'Simple pendulum',
    periodicTable: 'Periodic table',
    electronConfiguration: 'Electron configuration',
    bohrModel: 'Bohr model',
    orbitals: 'Orbital shapes',
    molecule3d: '3D molecules',
    vsepr: 'Molecular geometry (VSEPR)',
    bondPolarity: 'Bond polarity',
    reactionLibrary: 'Verified reaction library',
    equationBalancing: 'Equation balancing',
    collisionTheory: 'Collision theory',
    maxwellBoltzmann: 'Maxwell–Boltzmann distribution',
    chemicalEquilibrium: "Chemical equilibrium & Le Chatelier's principle",
    mitosis: 'Mitosis',
    meiosis: 'Meiosis',
    centralDogma: 'DNA → mRNA → Protein',
    pointMutation: 'Point mutations',
    mendel: 'Mendelian genetics',
    hardyWeinberg: 'Hardy–Weinberg principle',
    geneticDrift: 'Genetic drift',
    logisticGrowth: 'Logistic growth',
    lotkaVolterra: 'Predator–prey (Lotka–Volterra)',
    michaelisMenten: 'Enzyme kinetics (Michaelis–Menten)',
    diffusionOsmosis: 'Diffusion & osmosis',
  },
  stage: {
    regionLabel: 'Simulation stage',
    emptyTitle: 'No simulation yet',
    emptyBody: 'Type a problem in the bar above, or pick a topic from the Library.',
    toolbarLabel: 'Simulation tools',
    toolUnavailable: 'not available yet',
    finished: 'Finished',
    replay: 'Replay',
    nonFinite:
      'The simulation hit an invalid value (NaN/infinity), stopped and restored the last valid state.',
    engineError: 'Simulation error',
    loading: 'Loading simulation…',
    canvasLabel:
      'Simulation canvas. Drag objects with the mouse, scroll to zoom, drag the background to pan.',
    tools: {
      select: 'Select (V)',
      drag: 'Drag / throw object (H)',
      ruler: 'Ruler (M)',
      protractor: 'Protractor (A)',
      stopwatch: 'Stopwatch (T)',
      vectors: 'Show force / velocity / acceleration vectors',
      trail: 'Trajectory trail',
      fitView: 'Fit view (F)',
      pinCompare: 'Pin this run to compare',
      unpinCompare: 'Unpin comparison',
    },
    compareLegend: 'Dashed: the pinned run',
    compareBefore: 'When pinned: {values}',
  },
  inspector: {
    regionLabel: 'Inspector',
    title: 'Properties',
    objectSection: 'Object',
    noSelection: 'Nothing selected.',
    paramsSection: 'Parameters',
    noParams: 'Parameter sliders appear when a simulation is open.',
    scienceCard: 'Science Card',
    scienceCardIntro:
      'Every simulation has a Science Card stating its model, equations, assumptions, data sources and confidence level:',
  },
  confidence: {
    exact: 'Exact quantitative',
    exactDesc: 'Matches the analytic solution within the stated tolerance.',
    approx: 'Approximate quantitative',
    approxDesc: 'Numerical integration, with an estimated error.',
    qualitative: 'Qualitative / illustrative',
    qualitativeDesc: 'Illustrates a concept only; do not read numbers from it.',
  },
  review: {
    pending: 'Awaiting teacher review',
    verified: 'Reviewed',
  },
  bottom: {
    moduleEmpty: 'This topic has no extra panel.',
    regionLabel: 'Graphs and solution panel',
    graphs: 'Graphs',
    solution: 'Solution',
    data: 'Data',
    challenge: 'Challenge',
    graphsEmpty:
      'x–t, v–t, a–t, energy, concentration… graphs appear here while a simulation runs.',
    solutionEmpty:
      'The step-by-step solution appears here. All numbers come from the program; AI only explains them in words.',
    dataEmpty: 'The data table (exportable to CSV) appears here.',
  },
  timeline: {
    regionLabel: 'Time controls',
    play: 'Play (Space)',
    pause: 'Pause (Space)',
    step: 'Step forward (.)',
    reset: 'Reset (R)',
    speed: 'Playback speed',
    scrubber: 'Scrub simulation',
    time: 'Simulation time',
  },
  layout: {
    resizeLeft: 'Drag to resize the Library',
    resizeRight: 'Drag to resize the Properties panel',
    resizeBottom: 'Drag to resize the Graphs panel',
    exitPresentation: 'Exit presentation (Esc)',
  },
  status: {
    ready: 'Ready',
    quality: 'Render quality',
    qualityNotMeasured: 'not measured',
    fps: 'FPS',
    version: 'Version',
    browserMode: 'browser mode',
  },
  settings: {
    nav: {
      label: 'Settings pages',
      groupGeneral: 'General',
      groupAi: 'AI',
      groupPrivacy: 'Privacy',
      appearance: 'Appearance',
      appearanceHint: 'Basic/Advanced mode, colours, text size, language and layout.',
      simulation: 'Simulation & performance',
      simulationHint: 'Display quality for this computer and the default gravity.',
      aiHint: 'Choose the online AI provider, enter the API key, set limits and the fallback.',
      teacher: 'AI Teacher',
      teacherHint: 'Think (a second API reviews the answer) and what data is sent.',
      local: 'Local AI (Gemma)',
      localHint:
        'Download, choose or delete the Gemma models that run on this computer: no network, no key.',
      gpu: 'GPU for Gemma',
      gpuHint: 'The graphics card in use, answer length and when to free the GPU memory.',
      knowledge: 'Knowledge library',
      knowledgeHint: 'Built-in notes, your own documents and the Wikipedia lookup.',
      memory: 'Conversation memory',
      memoryHint:
        'How many earlier messages AI Teacher remembers and whether the chat is kept on this computer.',
      voice: 'Voice',
      voiceHint: "AI Teacher's Vietnamese reading voice and how it reads.",
      safetyHint: 'Age confirmation, terms, the privacy page and the safety log.',
      shortcutsHint: 'The main keyboard shortcuts for simulations.',
      versions: 'Version history',
      versionsHint: 'What changed in each SimLab version and which versions were released.',
      runtimes: 'AI on this computer (Ollama, LM Studio, llama.cpp)',
      runtimesHint:
        'Find, test and choose an AI program you installed on this computer. Questions are not sent online.',
    },
    lookCard: 'Mode and colours',
    textCard: 'Text and language',
    layoutHint: 'Put the panels (library, controls, graphs) back to their original place and size.',
    aiProviderCard: 'Provider and API key',
    aiLimitsCard: 'Timeout and daily limit',
    aiFallback: 'Fallback when quota runs out',
    aiFallbackHint:
      'When the main provider runs out of free quota or credit, the app switches to this provider (if it has a key). The "AI-assisted content" label shows which model answered.',
    aiFallbackKey: 'API key for the fallback',
    aiFallbackModel: 'Fallback model',
    groqGuide: {
      title: 'How to get a Groq API key (free)',
      age: 'Under Groq terms, the account holder must be 18 or older.',
      step1:
        'Press "Open the key page" below (or type console.groq.com/keys in a browser) and sign in.',
      step2: 'Press "Create API Key", give it any name (e.g. "SimLab") and confirm.',
      step3: 'Copy the new key (it is shown only once).',
      step4:
        'Back here: paste it into the API key field (Ctrl+V), press "Save key", then "Test key".',
      open: 'Open the key page',
      free: 'The free tier has limits (about 1,000 calls a day and a per-minute token limit). When it says the quota is used up, wait a while and try again.',
      privacy:
        'Under Groq terms, submitted content is not used to train AI. If the account offers "Zero Data Retention", turn it on so Groq keeps no copy of the problems.',
    },
    aiStatusNotAllowed: 'AI is not enabled: confirm your age in Settings → Safety & privacy.',
    title: 'Settings',
    close: 'Close',
    appearance: 'Appearance',
    theme: 'Color theme',
    themeSystem: 'System',
    themeLight: 'Light',
    themeDark: 'Dark',
    fontSize: 'Font size',
    language: 'Language',
    layout: 'Layout',
    resetLayout: 'Restore default layout',
    ai: 'Connect AI',
    aiProvider: 'Provider',
    aiProviders: {
      gemini: 'Gemini (recommended)',
      claude: 'Claude',
      groq: 'Groq (free)',
      off: 'Off',
    },
    aiModel: 'Model',
    aiModelHint: 'Leave empty to use the default model. Change it only if your teacher says so.',
    aiTest: 'Test key',
    aiKeyShow: 'Show key',
    aiKeyHide: 'Hide key',
    aiKeyStoredHint: 'Saved key: {hint}',
    aiTimeout: 'Timeout (seconds)',
    aiDailyCap: 'Maximum AI calls per day',
    aiDailyCapHint:
      'Reading one problem uses about 2–4 calls. Set 0 for no limit. The limit avoids using up the free quota or spending money by accident. AI that runs on this computer (Gemma, Ollama, LM Studio, llama.cpp) does not count.',
    aiUsageToday: 'Used today: {count}/{cap} calls.',
    aiUsageTodayNoCap: 'Used today: {count} calls.',
    aiClearCache: 'Clear saved problems ({count})',
    aiClearCacheHint:
      'Confirmed problems are saved on this computer so the AI is not called again next time.',
    aiKey: 'API key',
    aiKeySave: 'Save key',
    aiKeyDelete: 'Delete key',
    aiKeyStored: 'A key is stored in the system keychain.',
    aiKeyNone: 'No key stored.',
    aiKeyHint:
      "The key is kept in the operating system's keychain (Windows Credential Manager), never in the app's files.",
    aiSessionKey:
      'In the browser/localhost, the key lives only in this page’s memory (gone on reload); the desktop app uses the system keychain.',
    aiPrivacy:
      "The problem text is sent to the AI provider's servers. On Gemini's free tier Google may use what you send to improve its products, so never put personal information (names, phone numbers, addresses…) in a problem.",
    aiRule:
      'The AI only reads the problem and explains in words. Every number comes from the program; numbers the AI adds that are not in the problem are rejected.',
    aiStatusOk: 'Connected — the key works.',
    aiStatusQuota:
      'Quota used up — the provider is not accepting more requests for now. Wait about a minute; if it persists, today’s quota is used up.',
    aiStatusBadModel:
      'The key works but the chosen model was not found — clear the "Model" field to use the default model.',
    aiStatusError: 'The AI server reported an error ({detail}). Try again in a few minutes.',
    aiStatusChecking: 'Checking…',
    aiStatusOffline: 'No Internet — check the connection and try again.',
    aiStatusBadKey: 'Invalid key — check it or create a new one.',
    geminiGuide: {
      title: 'How to get a Gemini API key (free)',
      age: "Google's terms require the person creating the API key to be 18 or older.",
      art: {
        create: 'Drawing: the key page, "Create API key" button at the bottom right.',
        copy: 'Drawing: the new key with the copy button next to it.',
        paste: 'Drawing: paste the key into API key, press Save key, then Test key.',
      },
      step1:
        'Press "Open the key page" below (or type aistudio.google.com/apikey in a browser) and sign in with a Google account.',
      step2: 'First time in Google AI Studio: read and accept the terms of use.',
      step3:
        'Press "Create API key". If asked to choose a project, pick an existing one or let Google create one.',
      step4: 'Press the copy icon next to the new key.',
      step5:
        'Come back here: paste the key into the "API key" field below (Ctrl+V) and press "Save key".',
      step6: 'Press "Test key". "Connected — the key works" means you are done.',
      open: 'Open the key page',
      free: 'The free tier needs no bank card but limits requests per minute and per day. When it says the quota is used up, wait a little or try again the next day.',
      safety:
        'Treat the key like a password: do not send it to friends or post it online. The app keeps it in the Windows keychain. If the key leaks, delete it in Google AI Studio and create a new one.',
    },
    shortcuts: 'Keyboard shortcuts',
    quality: 'Render quality',
    qualityHint: 'Affects visuals only (sharpness, shadows, particles drawn), never the numbers.',
  },
  command: {
    title: 'Quick search',
    openButton: 'Quick search (Ctrl+K)',
    placeholder: 'Type a topic, a Settings page or something to do…',
    empty: 'No results. Try fewer letters.',
    keys: '↑ ↓ to choose · Enter to open · Esc to close',
    groups: {
      go: 'Go to',
      topics: 'Topics',
      settings: 'Settings',
      actions: 'Actions',
    },
    home: 'Home',
    lab: 'Lab',
    teacherTalk: 'AI Teacher — chat',
    teacherBoard: 'AI Teacher — whiteboard lesson',
    theme: 'Switch light / dark theme',
    modeAdvanced: 'Switch to Advanced mode',
    modeBasic: 'Switch to Basic mode',
    language: 'Chuyển sang tiếng Việt',
    presentation: 'Presentation mode',
    save: 'Save simulation (.stemsim)',
    open: 'Open a .stemsim file',
    update: 'Check for updates',
  },
  progress: {
    etaSeconds: 'about {n} s left',
    etaMinutes: 'about {n} min left',
  },
  shortcuts: {
    playPause: 'Play / pause',
    reset: 'Reset simulation',
    step: 'Step forward',
    undo: 'Undo',
    redo: 'Redo',
    save: 'Save simulation (.stemsim)',
    open: 'Open .stemsim file',
    presentation: 'Presentation mode',
    fontLarger: 'Increase font size',
    fontSmaller: 'Decrease font size',
    analyze: 'Analyze problem (in the problem box)',
    commandPalette: 'Quick search: topics, Settings, actions',
  },
  science: {
    cardLabel: 'Science Card of the simulation',
    model: 'Model',
    equations: 'Equations',
    assumptions: 'Assumptions',
    validity: 'Validity range',
    method: 'Numerical method',
    sources: 'Sources',
    intervened: 'User intervention — results are a numerical simulation.',
    more: 'Equations, assumptions and sources',
    estimatedError: 'Estimated error: {value}',
  },
  quality: {
    low: 'Low',
    medium: 'Medium',
    high: 'High',
    auto: 'Auto',
    autoWith: 'Auto ({tier})',
    measuring: 'Measuring performance…',
    remeasure: 'Measure again',
    benchmarkSummary: 'CPU {cpu} · 2D draw {draw} · WebGL2: {webgl} · {cores} threads',
    yes: 'yes',
    no: 'no',
    slowMotion: 'Slow motion ×{factor} to keep accuracy',
  },
  physicsSettings: {
    title: 'Physics',
    defaultGravity: 'Default gravitational acceleration',
    defaultGravityHint:
      'Used only when the problem does not give g. Values from the problem always win, and defaults are always marked "default".',
    standard: 'standard',
  },
  stopwatch: {
    start: 'Start stopwatch',
    stop: 'Stop stopwatch',
    lap: 'Lap',
    reset: 'Reset stopwatch',
    simTimeHint: 'Measures simulated time',
  },
  params: {
    source: {
      problem: 'problem',
      default: 'default',
      user: 'edited',
    },
    sourceHint: {
      problem: 'Value taken from the problem',
      default: 'Default value filled in by the app (not given in the problem)',
      user: 'Value you changed',
    },
    liveHint: 'Can be changed while running (counts as an intervention)',
    allDefault: 'Using default values (not given by a problem). Drag a slider to try.',
    resetHint: 'Changing it restarts the simulation',
  },
  solution: {
    explainUnsafe:
      'The explanation was hidden because it contained unsuitable content. The program’s results are still correct.',
    answers: 'Answers',
    steps: 'Step-by-step solution',
    check: 'Numerical check',
    agree: 'agrees, deviation {value}',
    engineNote:
      'Every number here is computed by the program from formulas and cross-checked by numerical integration. AI produces no numbers.',
    intervenedNote:
      'The solution applies to the initial conditions. After an intervention use the simulation data (Data tab).',
    invalid: 'No solution: the parameters are not valid yet.',
    asked: 'asked',
    tryFirst:
      'The answers are hidden so you can try first. Use the step-by-step hints, or show the full solution to compare.',
    showAll: 'Show the solution now',
    nextHint: 'Hint {n}',
    fullSolution: 'Full solution',
    explain: 'AI explanation',
    explaining: 'The AI is writing an explanation…',
    explainTitle: 'Explanation in words by the AI',
    explainNote: 'Checked: every number in this text was computed by the program.',
    explainHidden:
      'Explanation hidden: the AI wrote numbers the program did not compute ({numbers}). Retry, or rely on the solution above.',
    explainError: 'Could not get an explanation: {message}',
  },
  graphs: {
    choose: 'Choose graph',
    time: 'Time t (s)',
    noData: 'Press Play to record data for the graphs.',
  },
  data: {
    exportCsv: 'Export CSV',
    rows: '{shown} / {total} rows',
    noData: 'No data yet. Press Play to record.',
  },
  object: {
    none: 'Click an object on the stage to see its properties.',
  },
  analyze: {
    personal: {
      phone: 'phone number',
      email: 'e-mail',
      idNumber: 'ID number',
      nameOrAddress: 'name or address',
    },
    title: 'Here is how I read the problem',
    manualTitle: 'Build a scene',
    intro: 'Check every row before simulating. You can edit any value.',
    manualIntro:
      'Pick a topic and enter the parameters. No AI: every value is a default or typed by you.',
    manualModuleIntro:
      'The topic is open behind this dialog. Adjust its inputs below (also in the Properties panel); every result is computed by the program.',
    manualNoInputs: 'This topic has no inputs to enter — work directly on the stage.',
    topic: 'Topic',
    problem: 'Problem',
    quantity: 'Quantity',
    quantities: 'Quantities in the problem',
    defaultValue: 'default value',
    value: 'Value',
    source: 'Source',
    inProblem: 'In the problem: {value}',
    quote: 'Quote: “{quote}”',
    missing: 'Needed',
    missingHint:
      'The problem does not give this value but the solution needs it. Enter it or keep the default.',
    keepDefault: 'Keep default',
    missingBlock: '{count} value(s) still need to be entered or confirmed.',
    questions: 'Asked',
    noQuestions: 'The AI found no specific question; every answer is still computed.',
    assumptions: 'Assumptions stated in the problem',
    clarifications: 'The AI needs you to clarify',
    unsupported: 'Not simulated',
    unsupportedNote: 'These parts will NOT be in the simulation. The program does not guess.',
    issues: 'Warnings from the checks',
    validation: 'Parameters are not valid',
    model: 'AI model: {model}',
    modelFallback: 'AI model: {model} (fallback — the main provider ran out of quota)',
    hintGroq: {
      missingKey:
        'No Groq API key yet. Open Settings → Connect AI and follow "How to get a Groq API key".',
      badKey:
        'The Groq API key was refused. Create a new key at console.groq.com/keys and paste it again.',
    },
    confirm: 'Simulate',
    cancel: 'Cancel',
    close: 'Close',
    retry: 'Retry',
    manual: 'Build a scene',
    openSettings: 'Open Connect AI',
    openRuntimes: 'Open AI on this computer',
    stage: {
      classify: 'Identifying the topic…',
      extract: 'Extracting the data…',
      validate: 'Checking the numbers…',
    },
    unsupportedTitle: 'This problem cannot be simulated yet',
    unsupportedBody:
      'The problem is outside the available topics. The program never builds a simulation it has not verified.',
    reason: 'Reason: {reason}',
    errorTitle: 'I couldn’t read this problem yet',
    crisisTitle: 'We want to check on you',
    error: {
      notAllowed: 'AI is not enabled on this computer.',
      personalData:
        'The problem seems to contain personal data ({detail}), so it was not sent to the AI.',
      unsafe: 'This content is not suitable for a learning app, so it was not sent to the AI.',
      crisis: 'The problem was not sent to the AI.',
      outputUnsafe: 'The AI answer was hidden because it contained unsuitable content.',
      timeout: 'The AI took too long, so I stopped waiting.',
      cancelled: 'Cancelled.',
      http: 'The AI server returned an error ({detail}).',
      network: 'I couldn’t reach the AI — the connection may be weak or down.',
      missingKey: 'AI is not connected yet (no API key).',
      badResponse: 'I couldn’t understand the AI’s reply.',
      keychain: 'Could not read the system keychain.',
      invalidJson: 'The AI answered in the wrong format three times in a row, so I stopped.',
      unavailable: 'This AI feature is not available here.',
      internal:
        'The app ran into a problem while asking the AI (not the connection). Please try again; if it keeps happening, install the latest version of the app.',
      quota: 'The free AI quota is used up for now (provider limit).',
      badKey: 'The AI provider refused the API key (wrong, deleted or disabled).',
      badModel: 'The selected AI model was not found.',
      dailyLimit: 'Today’s AI calls are used up ({detail}).',
      empty: 'Please type a problem first.',
      tooLong: 'The problem is too long (at most {max} characters) — please shorten it.',
      local: '{detail}',
    },
    hint: {
      notAllowed: 'AI needs the 18+ confirmation. Open Settings → Safety & privacy.',
      personalData:
        'Remove names, phone numbers, e-mails, addresses or ID numbers from the problem, then analyse again.',
      unsafe:
        'The app uses AI for lessons only. You can still build the scene yourself or use the library.',
      outputUnsafe:
        'This was recorded in the incident log (kind and time only). Build the scene yourself or ask your teacher.',
      timeout: 'Increase the timeout in Settings and retry, or build the scene manually.',
      network:
        'Check the Internet connection and retry. Without a network the manual builder and sample library still work.',
      missingKey:
        'Open Settings → Connect AI, follow "How to get a Gemini API key" and paste the key.',
      quota:
        'Wait about a minute and retry. If it persists, the daily quota is used up: try again tomorrow or build the scene manually.',
      badKey: 'Create a new key in Google AI Studio and paste it again in Settings → Connect AI.',
      badModel: 'In Settings → Connect AI, clear the "Model" field to use the default model.',
      invalidJson: 'Analyze again, or build the scene manually.',
      dailyLimit:
        'This limit is set in Settings → Connect AI ("Maximum AI calls per day") to avoid wasting calls. Today you can still build scenes manually and use the sample library.',
      other: 'You can still build the scene manually or use the sample library.',
      local:
        'The AI on this computer never switches to an API by itself. You can still build the scene manually or use the sample library.',
    },
    hintClaude: {
      missingKey:
        'No Claude API key yet. Create one at console.anthropic.com and enter it in Settings → Connect AI.',
      badKey: 'The Claude API key was refused. Check it in Settings → Connect AI.',
    },
    cached:
      'This problem was read and confirmed before, so the AI is not called again. Check the table as usual.',
    readAgain: 'Read again with AI',
  },
  project: {
    privacy: 'Privacy & safe AI use',
    file: 'File',
    save: 'Save simulation (.stemsim) — Ctrl+S',
    open: 'Open .stemsim file — Ctrl+O',
    exportPng: 'Export PNG image',
    sources: 'Sources & assumptions',
    tour: 'Quick tour',
    dismiss: 'Dismiss',
    nothingToSave: 'No topic is open.',
    saved: 'Saved: {name}',
    saveFailed: 'Could not save the file.',
    openFailed: 'Could not open the file.',
    opened: 'Opened: {name}',
    invalid: {
      json: '{name} is not valid JSON.',
      format: '{name} is not a .stemsim file.',
      topic: '{name} uses a topic that this version does not have.',
    },
    noCanvas:
      'This topic is shown as tables and text, so there is no image to export. Use Export CSV or a screenshot.',
    exportCsv: 'Export CSV',
  },
  history: {
    reopen: 'Reopen',
    delete: 'Delete this entry',
    clearAll: 'Clear all history',
    confirmClear: 'Click again to clear everything',
    fromProblem: 'From a problem',
  },
  perf: {
    degraded: 'Display quality lowered to keep things smooth (numbers unchanged)',
    memoryHigh:
      'Memory use is high ({mb} MB). Caches were released. Close some 3D topics or use fewer particles.',
    memory: 'RAM {mb} MB',
  },
  tour: {
    label: 'Quick tour',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    done: 'Get started',
    counter: '{i}/{n}',
    welcomeTitle: 'Welcome to SimLab',
    welcomeBody:
      'Physics, chemistry and biology simulations that run fully on this computer. Every number is computed by the program, with a Science Card stating the model and sources.',
    subjectTitle: 'Pick a subject',
    subjectBody: 'Switch between Physics, Chemistry and Biology.',
    libraryTitle: 'Topic library',
    libraryBody:
      'Pick a topic to open its simulation. The History tab keeps the simulations you opened.',
    problemTitle: 'Type a problem',
    problemBody:
      'Paste a physics problem and click Analyze: the AI reads it and you check the "I understood the problem as" table before running. Without AI, use Build manually.',
    stageTitle: 'Simulation stage',
    stageBody:
      'Space to run/pause, R to reset. Drag objects to intervene (the Science Card then switches to "approximate").',
    inspectorTitle: 'Properties & Science Card',
    inspectorBody:
      'Adjust parameters here. The Science Card shows the model, equations, assumptions, confidence and sources.',
    fileTitle: 'Save, open, export',
    fileBody:
      'Save a simulation as a .stemsim file, export PNG images, and open Sources & assumptions for the judges. F5: presentation mode.',
  },
  sourcesPage: {
    title: 'Sources & assumptions',
    intro:
      'Every data source, model and assumption used by the app. Items marked "pending" need a teacher\'s review (see docs/DATA_REVIEW.md).',
    principles: 'Principles',
    datasets: 'Datasets',
    references: 'References',
    current: 'Open topic',
    noCurrent: 'No topic is open.',
    pending: 'pending',
    verified: 'verified',
    items: '{n} items',
    close: 'Close',
  },
  update: {
    title: 'Software update',
    menu: 'Check for updates',
    close: 'Close',
    current: 'Running version {version} (core {native})',
    downloaded: 'updated in the app',
    checking: 'Checking for a new version…',
    downloading: 'Downloading and checking the signature…',
    upToDate: 'You have the latest version.',
    fromStore:
      'This copy was installed from the Microsoft Store, which updates it when a new version is out. You can also open the Store to update now.',
    openStore: 'Open Microsoft Store',
    newVersion: 'Version {version} is available',
    needsInstaller:
      'This version changes the core of the app (needs core {native}), so the new installer is needed once.',
    ready: 'Downloaded and verified. Restart to use the new version.',
    error: 'Update failed:',
    safety:
      'Updates are signed and verified before use; no new .exe is installed, so Windows does not block them.',
    install: 'Update now',
    openReleases: 'Open the download page',
    restart: 'Restart',
    reset: 'Back to the built-in version',
    checkAgain: 'Check again',
    later: 'Later',
    retry: 'Try again',
    requiredNote:
      'This update is required: update to keep using the app. Your history, files and settings are kept.',
    available: 'Update {version} available',
    browserOnly: 'In-app updates are only available in the installed app.',
  },
  whatsnew: {
    title: 'SimLab has been updated',
    intro: 'Here is what is new since you last opened SimLab.',
    notesLabel: 'Update notes',
    version: 'Version {version}',
    releasedOn: 'Release date: {date}',
    releaseDateUnknown: 'Release date: not verified',
    highlights: 'Highlights',
    allChanges: 'All changes',
    where: 'You can always find this again in Settings → Version history.',
    details: 'See details',
    later: 'Later',
    close: 'Close',
    menu: "What's new",
    menuButton: 'File (something new in SimLab)',
    category: {
      added: 'New features',
      improved: 'Improvements',
      fixed: 'Fixes',
      security: 'Safety and security',
      performance: 'Performance',
      changed: 'Changes',
      deprecated: 'Deprecated',
      knownIssues: 'Known issues',
    },
    status: {
      released: 'Released',
      mergedNotReleased: 'Not released on its own',
      inReview: 'In review',
      development: 'Test build',
      unverified: 'Unverified',
    },
    statusHint: {
      mergedNotReleased:
        'This version had no release of its own; its changes reached users in a later release.',
      inReview: 'This version is being reviewed and has not been released.',
      development: 'The first test build, never released.',
      unverified:
        'This version number appears only in documents or a ZIP file; no release confirms it.',
    },
    history: {
      current: 'You are using version {version}.',
      currentBadge: 'Your version',
      currentHint:
        "The version you are using. A version's release date is only recorded in the history of later versions.",
      draft: 'These notes are a draft and have not been reviewed for publication.',
      loading: 'Reading the version history…',
      unavailable:
        'The version history could not be read. Simulations and everything else still work.',
      listLabel: 'Versions, newest first',
      releasesPage: 'Open the releases page on GitHub',
      showWhatsNew: 'Show the "What\'s new" box again',
    },
  },
  safety: {
    aiLabel: 'AI-assisted content',
    aiLabelHint: 'This part was read or written by an AI. AI can be wrong: check it.',
    report: 'Report unsuitable content',
    aiModel: 'model {model}',
    aiFallback: 'fallback',
    reported: 'Report recorded (kind and time only). Thank you!',
    gate: {
      title: 'Before you start',
      mainIntro:
        'The simulations are for everyone. The AI features (reading problems, explanations) are for people aged 18 or older, because the AI providers only allow users aged 18+.',
      readTerms: 'I have read "Privacy & safe AI use" and accept the terms of use.',
      openTerms: 'Read privacy & terms',
      adult: 'I am 18 or older — turn on AI',
      minor: 'I am under 18',
      minorNote:
        'Under 18: you can still use every simulation, the library and manual scenes; AI stays off. You can answer again in Settings → Safety & privacy.',
    },
    settings: {
      ageCard: 'Age and terms',
      title: 'Safety & privacy',
      mainAdult: 'Confirmed: 18 or older, terms accepted (version {version}).',
      mainMinor: 'Answered: under 18 — AI is off.',
      unanswered: 'Age question not answered — AI is off.',
      answerAgain: 'Answer the age question again',
      privacy: 'Privacy & safe AI use',
      incidents: 'Incident log',
      incidentsHint:
        'Only the kind of incident and the time, never the problem text or the answer.',
      incidentsShow: 'Show incident log',
      incidentsEmpty: 'No incidents.',
      incidentsClear: 'Clear log',
      incidentKinds: {
        inputPersonalData: 'Problem with personal data — blocked, not sent',
        inputUnsafe: 'Unsuitable content — blocked, not sent',
        inputCrisis: 'Signs of distress — support lines shown',
        outputUnsafe: 'AI answer hidden by the filter',
        userReport: 'User reported unsuitable content',
      },
    },
    crisis: {
      title: 'You are not alone',
      body: 'It sounds like you are going through something very hard. Please talk to an adult you trust (parents, teachers, relatives) now, or call:',
      ngayMai: 'Ngày Mai support line: 096 306 1414 (13:00–20:30, Wednesday to Sunday).',
      emergency: 'If you or someone else is in danger right now: call emergency 115.',
      note: 'Numbers checked in October 2026. The app does not send this text anywhere.',
    },
    privacy: {
      title: 'Privacy & safe AI use',
      sendTitle: 'What does the app send?',
      send1:
        'Only when you press "Analyse" or "AI explanation", or ask AI Teacher with an online AI: the problem or question and the computed results go to the selected AI provider. No name, account or files are sent. The "Where does your data go?" box in Settings lists it for your current settings.',
      send2:
        'Update check: the app asks the project release page on GitHub whether a new version exists (no learning data is sent).',
      send3: 'No ads, no accounts, no usage statistics.',
      send4:
        'AI on this computer (Ollama, LM Studio, llama.cpp — installed by you): questions go only to that program on this computer, never automatically to an online AI. Only with Think on is the draft sent to an online AI for review (Wikipedia lookup and the Gemini voice also send only when you switch them on). That program has its own policy; its cloud features can take data off the computer (the app refuses Ollama cloud models).',
      send5:
        '"Circle to ask" on the board: the words and formulas inside the circle are sent with your question to the selected AI (and to the reviewer when Think is on). A picture of the circled area is made only when it holds no text, and goes only to a picture-reading AI running on this computer — never online.',
      storeTitle: 'What is stored on this computer?',
      store1: 'API key: in the operating system keychain; only the last 4 characters are shown.',
      store2:
        'Confirmed problems, simulation history and settings: in the app data folder; can be cleared in Settings.',
      store3: 'Incident log: only the kind and the time, never the content.',
      providerTitle: 'What does the AI provider do with the problem?',
      providerGemini:
        'Gemini free tier: under Google terms, content may be used to improve products and may be read by human reviewers; not on the paid tier. Users must be 18+.',
      providerGroq:
        'Groq (free fallback): under Groq terms, submitted content is not used to train AI; Groq may keep it up to 30 days for operations and abuse checks (Zero Data Retention available). The key holder must be 18+.',
      providerClaude:
        'Claude (paid API): under Anthropic published policy, API data is not used for training by default and is deleted after 30 days (flagged content may be kept longer).',
      checked:
        'Provider information checked in October 2026 and may change; details and sources in docs/LEGAL_COMPLIANCE.md.',
      rulesTitle: 'Terms of use (summary)',
      rule1:
        'The app is a learning aid. Every number is computed by the program; the AI only reads problems and explains in words, and can be wrong.',
      rule2:
        'Do not put personal data (names, phone numbers, addresses, e-mails, ID numbers) in a problem. The app blocks it when detected.',
      rule3:
        'Use the AI for lessons only. Unsuitable content is blocked and recorded in the incident log (kind and time only).',
      rule4: 'When using AI you must also follow the AI provider terms.',
      tipsTitle: 'Using AI to learn well and safely',
      tip1: 'Read the problem and try it yourself first. Use the AI to check your reading, not to copy answers.',
      tip2: 'Always check the "This is how I read the problem" table and fix any value read wrongly.',
      tip3: 'Read the explanation, then explain it again in your own words.',
      tip4: 'If an answer is strange, wrong or upsetting: press "Report unsuitable content" and ask your teacher.',
      tip5: 'Do not share the API key and do not enter personal data.',
      tip6: 'Take a break every 45–60 minutes at the computer.',
      close: 'Close',
    },
  },
  home: {
    regionLabel: 'Home',
    goHome: 'Back to home',
    title: 'What shall we learn today?',
    subtitle: 'Pick a subject, open a topic, or paste a problem to turn it into a simulation.',
    continue: 'Continue where you left off',
    problemLabel: 'Type a problem or a question…',
    problemPlaceholder:
      'Example: A ball is thrown at 20 m/s at 45°. Find the range.\n(Multi-line problems are fine. Ctrl+Enter to analyze.)',
    analyze: 'Analyze',
    manual: 'Build a scene',
    connectFirst: 'Connect AI to analyze problems',
    subjectsTitle: 'Subjects',
    subjectDesc: {
      physics: 'Motion, forces, energy, oscillations',
      chemistry: 'Atoms, molecules, reactions, particles',
      biology: 'Cell division, genetics, ecology, enzymes',
    },
    topicCount: '{count} topics',
    suggestedTitle: 'Suggested for the {level} level',
    noSuggestions:
      'This level is still being built. Choose the Foundation level in the Library to start now.',
    teacherTitle: 'AI Teacher',
    teacherBody:
      'Ask questions, get step-by-step hints and check your understanding. Simulation numbers still come from the app.',
    comingSoon: 'Coming soon',
    teacherOpen: 'Open AI Teacher',
    noAiNote: 'No AI or no internet? You can still learn: open a topic or build a scene.',
    cameraButton: 'Photograph the problem',
  },
  camera: {
    title: 'Photograph the problem',
    close: 'Close the camera',
    preview: 'What the camera sees',
    photoAlt: 'The photographed problem',
    capture: 'Capture',
    mirror: 'Mirror',
    retake: 'Retake',
    usePhoto: 'Use photo',
    reading: 'Reading the photo…',
    privacy:
      'The photo goes to the AI in use (on-device Gemma, the AI program you chose on this computer, or a cloud API) only to read the problem.',
    denied: 'Could not open the camera. Allow the browser/app to use the camera and try again.',
    retry: 'Try again',
    blockedHint:
      'If the browser blocked it permanently, click the lock/site-settings icon next to the address bar, set Camera to “Allow”, then press Try again.',
    unsupported: 'This device has no supported camera.',
    needGemma: 'No Gemma model yet. Download one in Settings → AI Teacher.',
    needVision:
      'Could not read the photo: need a cloud API (Gemini/Groq with a key) or a ready Gemma model.',
    readFailed: 'Could not read the problem in the photo. Please retake it more clearly.',
    outputUnsafe:
      'The text read from the photo has unsuitable content, so it was not put in the problem box. Please photograph another problem.',
    badKey: 'The API key was refused (wrong key or no permission). Check it in Settings.',
    badModel: 'The API model name is wrong. Check the Model field in Settings.',
    localNoVision:
      'The AI model you chose on this computer cannot read pictures (or this could not be verified). Reading a photo needs an API key or the picture-reading Gemma (E2B) in the app. While you use the AI on this computer, SimLab sends no photo online.',
    localNotSelected:
      'You chose the AI on this computer but no program and model yet, so the photo was not sent anywhere. Choose them in Settings → AI on this computer.',
  },
  landing: {
    eyebrow: 'Explore science by doing',
    title: 'Welcome to SimLab',
    subtitle:
      'Choose how you want to learn today. Simulations, data and learning support share one workspace.',
    labTitle: 'Laboratory',
    labBody:
      'Explore Physics, Chemistry and Biology simulations, adjust parameters and inspect results.',
    teacherTitle: 'AI Teacher',
    teacherBody:
      'Ask questions, get hints and check your understanding with an AI study assistant.',
    studioTitle: 'Science Studio',
    studioBody:
      'Guided lessons: predict, experiment, observe measurements, then explain and save a report.',
    privacy: 'You choose when to share screen context or use an online AI service.',
  },
  studio: {
    title: 'Science Studio',
    subtitle:
      'Guided lessons: predict, experiment, observe measurements, explain and conclude. Every number is computed by the simulation.',
    tabsLabel: 'Choose a Studio subject',
    tabs: {
      chemistry: 'Chemistry',
      biology: 'Biology',
      physics: 'Physics',
      authoring: 'Authoring',
    },
    pick: 'Choose a lesson',
    difficulty: {
      intro: 'Getting started',
      core: 'Core',
      stretch: 'Stretch',
    },
    review: {
      pending:
        'This lesson’s text has not been reviewed by a teacher yet — the numbers still come from the simulation.',
      verified: 'This lesson’s text has been reviewed by a teacher.',
    },
    preparing: {
      title: 'In preparation',
      chemistry:
        'The Chemistry Studio is being prepared. Meanwhile, you can use the Chemistry topics in the Laboratory.',
      biology:
        'The Biology Studio is being prepared. Meanwhile, you can use the Biology topics in the Laboratory.',
      physics: 'There is no Physics lesson in the Studio yet.',
      openLab: 'Open the Laboratory',
    },
    notes: {
      private:
        'Your notes stay on this computer. They are sent along only when you turn on “Use current screen information” in the AI Teacher chat and send a question yourself.',
    },
    flow: {
      label: 'Lesson steps',
      back: 'Back',
      next: 'Next: {step}',
      steps: {
        predict: 'Predict',
        interact: 'Experiment',
        observe: 'Observe',
        explain: 'Explain',
        conclude: 'Conclude',
        report: 'Report',
      },
      titles: {
        predict: 'What do you think will happen?',
        interact: 'Run the experiment',
        observe: 'Observe the measurements and the graph',
        explain: 'Explain with the data',
        conclude: 'Conclusion',
        report: 'Save and report',
      },
      leads: {
        predict: 'Choose a prediction before running the experiment. It is fine to be wrong.',
        interact:
          'Adjust the variable, then run the experiment. The simulation computes both conditions A and B.',
        observe: 'Every number and curve below is computed by the simulation.',
        explain: 'Use the measurements you just observed to explain in your own words.',
        conclude: 'Compare your prediction with the simulation result.',
        report: 'The report is built from this session. You can save it as a file or copy it.',
      },
      blockers: {
        prediction: 'Choose a prediction to continue.',
        observation: 'Run the experiment to get measurements.',
        explanation: 'Write an explanation of at least {n} characters.',
        activity: 'Finish the lesson activity to continue.',
        conclusion: 'Write your conclusion to continue.',
      },
    },
    explain: {
      label: 'Your explanation',
      placeholder: 'For example: The measurements show… so…',
      count: '{n}/{min} characters written (minimum).',
      hintN: 'Hint {n}:',
      showHint: 'Show hint {n}',
    },
    conclude: {
      predicted: 'You predicted: {label}',
      computed: 'Simulation result: {label}',
      match: 'Your prediction matches the simulation result.',
      miss: 'Your prediction does not match yet — this is where the most learning happens. Look at the measurements again.',
      none: 'The simulation result matches none of the choices, so they cannot be compared.',
      label: 'Your conclusion',
      placeholder: 'What did you learn from the experiment?',
      expected: 'Reference conclusion',
    },
    report: {
      done: 'You have completed this lesson.',
      preview: 'Report preview',
      save: 'Save report (.md)',
      restart: 'Start over',
      copy: 'Copy report',
      copied: 'Report copied.',
      copyFailed: 'Could not copy. Select the text in the preview and press Ctrl+C.',
      generated: 'Updated {time}',
      review: {
        pending: 'This scenario has not been reviewed by a teacher yet.',
        verified: 'This scenario has been reviewed by a teacher.',
      },
      objectives: 'Objectives',
      prediction: 'Prediction',
      predicted: 'The learner chose: {label}',
      noPrediction: 'No prediction yet.',
      engine: 'Measurements from the simulation',
      engineNote:
        'Every number in this section was computed by the "{title}" simulation (engine {model}); none was entered by an AI or the learner.',
      engineFacts: 'Results from the app’s data library',
      libraryNote:
        'Everything in this section is copied from the data library ("{title}", {model}) or is an automatic check made by the app; nothing was written by an AI or the learner, and there are no measurements.',
      noEngine: 'The experiment has not been run yet.',
      condition: 'Condition {id}: {inputs}',
      col: {
        quantity: 'Quantity',
        condition: 'Condition',
        value: 'Value (simulation)',
        check: 'Cross-check (analytic solution)',
      },
      checkOk: '{value} (matches)',
      checkDiff: '{value} (differs by {diff})',
      explanation: 'The learner’s explanation',
      empty: '(not written yet)',
      ai: 'Text written by AI',
      aiNote: 'AI-generated — not a measurement; check it against the data above.',
      conclusion: 'Conclusion',
      computed: 'Simulation result: {label}',
      verdictMatch: 'The prediction matches the simulation result.',
      verdictMiss: 'The prediction does not match the simulation result.',
      verdictNone: 'The simulation result matches none of the choices.',
      yourConclusion: 'The learner’s conclusion:',
      expected: 'The scenario’s reference conclusion: {text}',
      assumptions: 'Assumptions and limits',
      sources: 'Sources',
      noSources: 'No sources yet.',
      footer:
        'This report was made on this computer from the session; the app does not send it anywhere.',
      unverified: 'Data not yet reviewed',
      unverifiedNote:
        'The items below have not been reviewed yet; their sources are listed under “Sources”. Numbers computed by the simulation are not in this list.',
    },
    unverified: {
      scenario:
        'Lesson text of “{title}” (objectives, questions, hints, reference conclusion) — not yet reviewed',
      teacher: 'Lesson text of “{title}”, written by a teacher — not yet reviewed',
      record: 'Data “{title}” ({model}) — not yet reviewed',
    },
    ask: {
      button: 'Ask the teacher',
      hint: 'AI Teacher sees this lesson’s results and notes only when you turn on “{toggle}” in the chat.',
      questions: {
        predict:
          'I am doing the lesson “{title}”, Predict step. Can you help me think it through, without telling me the answer?',
        interact:
          'I am doing the lesson “{title}”, Experiment step. What should I do and what should I watch for?',
        observe:
          'I am doing the lesson “{title}”, Observe step. Can you help me read the simulation results I just got?',
        explain:
          'I am doing the lesson “{title}”, Explain step. Which results should I use in my explanation?',
        conclude:
          'I am doing the lesson “{title}”, Conclude step. Can you help me compare my prediction with the simulation result?',
        report:
          'I am doing the lesson “{title}”, Report step. Is anything important missing from my report?',
      },
    },
    ai: {
      header: '[Science Studio — data provided by the SimLab app]',
      lesson: 'Lesson: {title} — {subject}, {level}',
      step: 'The learner is at step {n}/{total}: {step}',
      rules:
        'Use only numbers from the FACTS COMPUTED BY THE SIMULATION section. The learner’s notes and AI text are not measurements. If data is missing, say so; never make up measurements, reactions or phenomena. Never present unreviewed data as verified.',
      unverified: 'DATA NOT YET REVIEWED:',
      engine: 'FACTS COMPUTED BY THE SIMULATION (or copied from the app’s data library):',
      noEngine: 'None yet: the learner has not run the experiment.',
      record: '- {title} (model {model}):',
      quantity: '{label} [{condition}] = {value}',
      learner: 'LEARNER’S NOTES (not facts):',
      prediction: 'Chosen prediction: {label}',
      noPrediction: 'Prediction: not chosen yet.',
      explanation: 'Explanation: “{text}”',
      conclusion: 'Conclusion: “{text}”',
      note: 'Note: “{text}”',
      aiText: 'TEXT AN AI WROTE EARLIER (not measurements, not checked):',
      cut: '(…shortened)',
    },
    physics: {
      conditions:
        'Condition A: the value you choose. Condition B: the same as A but with {param} multiplied by {factor}.',
      predictLabel: 'Your prediction',
      locked:
        'Your prediction was recorded when the experiment ran. To predict again, choose "Start over" in the Report step.',
      condition: 'Condition {id}',
      run: 'Run the experiment',
      running: 'Computing…',
      ran: 'Both conditions are measured. Change the variable and run again, or go on to Observe.',
      reset: 'Reset',
      errors: {
        invalid: 'The simulation cannot run with this value yet. Try adjusting the variable.',
        unfinished:
          'The simulation did not finish within the allowed time, so there are no measurements.',
        binding:
          'This lesson does not match the available simulation. Ask a teacher to check the scenario.',
      },
      loadFailed: 'This simulation could not be opened. Please try again later.',
      noRun: 'No measurements yet. Go back to the Experiment step and run it.',
      tableCaption: 'Measurements computed by the simulation (engine {model})',
      col: {
        quantity: 'Quantity',
      },
      input: 'input',
      crossCheck: 'Cross-check with the analytic solution: largest difference {gap}.',
      timeAxis: 'Time t',
      openInLab: 'Run {id} in the Laboratory',
      fact: '{q} (simulation {model}): {value}',
      ratioOf: 'B/A ratio — {q}',
    },
    chem: {
      choices: {
        precipitate: 'A precipitate forms',
        noPrecipitate: 'No precipitate is seen',
      },
      predictLabel: 'Your prediction',
      locked:
        'Your prediction was recorded when you first mixed solutions. To predict again, choose "Start over" in the Report step.',
      leads: {
        interact:
          'Pour solutions from the rack into the test tube, then shake to mix. The observation comes from the reaction library.',
        observe:
          'The observation, equation and sources below are copied from the reaction library — not written by AI, with no measurements.',
        explain: 'Use the observation and equation you just saw to explain in your own words.',
      },
      blockers: {
        observation: 'Mix the two solutions of the question to get an observation.',
      },
      rack: 'Reagent rack',
      solution: '{formula} solution',
      add: 'Add {formula} solution',
      mix: 'Shake to mix',
      empty: 'Wash the test tube',
      tube: 'Test tube',
      tubeEmpty: 'The test tube is empty.',
      tubeHas: 'In the tube: {list}.',
      tubeMixed: 'Mixed.',
      tubePrecipitate:
        'The library records a precipitate (the picture is only a symbol; colour and amount are not drawn).',
      procedureTitle: 'Steps',
      procedure: {
        first: 'Pour {formula} solution into the test tube.',
        second: 'Add {formula} solution.',
        mix: 'Shake gently to mix, then observe.',
        wash: 'Wash the tube before trying another pair of solutions.',
      },
      safety:
        'This is a virtual bench. Do not repeat it with real chemicals without a teacher and protective equipment.',
      errors: {
        unknownReagent: 'This substance is not on the lesson’s reagent rack.',
        sameReagent: 'The tube already holds {formula} solution — choose another solution.',
        tubeFull: 'The tube already holds two solutions. Shake to mix, or wash it to start again.',
        alreadyMixed: 'The tube is already mixed. Wash it before trying another pair.',
        emptyTube: 'The test tube is empty — add a solution first.',
        needTwo: 'The tube needs two solutions before they can be mixed.',
      },
      orderDiffers:
        'You added the solutions in a different order from the lesson’s steps. The library record does not state an order of addition.',
      targetDone:
        'You now have the observation for the prediction question. Try other pairs or go on to Observe.',
      notTarget:
        'This is not the pair of the prediction question — the result is still recorded so you can compare.',
      unsupported:
        'The bench does not compute amounts, concentrations, precipitate mass, limiting or excess reagent, pH, temperature, heat, gas volume or yield — the app gives none of these numbers.',
      mixes: 'Recorded mixes',
      targetTag: 'Pair of the question',
      noMix: 'No pair of solutions mixed yet. Go back to the Experiment step.',
      facts: {
        order: 'Order of addition',
        equation: 'Equation (library)',
        balance: 'Balance check',
        observation: 'Observation (library)',
        conditions: 'Conditions (library)',
        review: 'Review status',
        result: 'Result',
      },
      orderText: 'Added in turn: {list}',
      balanceOk: 'Elements and charge conserved: yes (automatic check).',
      balanceBad:
        'The library equation is not balanced ({list}) — a teacher must check it; do not use it for a conclusion.',
      review: {
        pending: 'The library record has not been reviewed yet.',
        verified: 'The library record has been reviewed.',
      },
      unknown:
        'This pair of solutions is not yet in the verified database — the app does not guess what happens. That does not mean they do not react.',
      ambiguous:
        'The library has {n} records for these substances that differ in their conditions. The bench cannot choose the conditions, so no observation is shown.',
      sources: 'Sources of the record',
      binding:
        'This lesson does not match the available reaction library. Ask a teacher to check the scenario.',
      factLine: 'Observation in the library: {text}',
    },
    bio: {
      predictLabel: 'Your prediction',
      locked:
        'Your prediction was recorded when you started working with the model. To predict again, choose "Start over" in the Report step.',
      leads: {
        interact:
          'Rotate and zoom the 3D picture and step through the stages. Record the stage you observe, then find the parts from their functions.',
        observe:
          'The counts below are made by the 3D model; stage descriptions and part functions are copied from the app’s data — not written by an AI.',
        explain:
          'Use the number of centromeres on the equatorial plane and the stage description to explain in your own words.',
      },
      blockers: {
        observation: 'Record the stage that answers the prediction question to get an observation.',
        activity: 'Answer every function, then press "Check".',
      },
      binding:
        'This lesson does not match the current 3D mitosis model. Ask a teacher to check the scenario.',
      pending: 'Stage descriptions and part functions have not been reviewed yet.',
      verified: 'Stage descriptions and part functions have been reviewed.',
      sources: 'Sources: {list}',
      q: {
        diploid: 'Chromosome set 2n',
        chromosomes: 'Chromosomes in the picture (one centromere each)',
        double: 'Double chromosomes',
        onPlane: 'Centromeres on the equatorial plane',
      },
      facts: {
        cell: 'Cell type',
        note: 'Stage description (data)',
        review: 'Review status',
      },
      stages: {
        title: 'Observe the stages',
        help: 'Change the stage with the ‹ › buttons or the stage strip under the 3D picture (in the 2D picture: "Previous step", "Next step" on the picture). Each time you record, the model counts the double chromosomes and the centromeres on the equatorial plane.',
        current: 'Stage shown: {stage}',
        record: 'Record this stage',
        answered:
          'You have an observation that answers the prediction question. You can record other stages to compare.',
        notAnswer:
          'This stage does not answer the prediction question — the result is still recorded so you can compare.',
        lockedCell:
          'This lesson keeps the model on the {cell}, 2n = {diploid}: the "Cell type" control is locked during the lesson. When you leave this step, the model goes back to your own settings.',
        otherCell:
          'The model is showing a different cell from the lesson, so this stage cannot be recorded.',
      },
      match: {
        title: 'Find the part from its function',
        help: 'Read each function, select that part in the 3D picture (or in the "Cell parts" list), then press the button of that function.',
        selected: 'Selected part: {name}',
        noSelection: 'No part of the model is selected.',
        task: 'Function {n}',
        assign: 'Answer: {name}',
        assignLabel: 'Answer function {n} with the selected part ({name})',
        answer: 'Your answer: {name}',
        unanswered: 'not answered',
        check: 'Check',
        score: '{correct}/{total} right.',
        retry: 'You can change your answers and check again.',
        right: 'Right',
        wrong: 'Not right',
        fact: '{result}. Your answer: {chosen}. Function in the data: {role}',
      },
      observe: {
        stages: 'Recorded stages',
        none: 'No stage recorded yet. Go back to the Experiment step.',
        answerTag: 'Answers the question',
        illustrative:
          'Sizes, positions and timing in the 3D picture are illustrative, not to scale. The numbers of chromosomes and of double chromosomes are counted by the model (exact). Centromeres on the equatorial plane follow what each stage means in the model (in metaphase, once the spindle has finished pulling, every double chromosome is held on the plane) — they are not measured from the picture.',
      },
      factLine:
        'In the model, in {stage}: {onPlane}/{total} centromeres are on the equatorial plane.',
    },
    teacher: 'Written by a teacher — not a result of the simulation.',
    authoring: {
      intro:
        'Create a learning scenario for a Studio. You can only pick what the simulations can run; every measurement is still computed by the simulation. Scenarios are stored on this computer only.',
      create: 'New scenario',
      pickSubject: 'Choose the subject of the new scenario',
      import: 'Import JSON file',
      empty: 'No scenarios yet. Press "New scenario" and choose a subject to start.',
      listLabel: 'Your scenarios',
      fileFilter: 'Science Studio scenario',
      saved: 'Saved "{title}".',
      imported: 'Imported "{title}".',
      exported: 'Exported {name}.',
      importFailed: 'This file could not be imported:',
      actionFailed: 'This could not be done:',
      actions: {
        preview: 'Preview',
        edit: 'Edit',
        duplicate: 'Duplicate',
        export: 'Export JSON',
        delete: 'Delete',
        confirmDelete: 'Delete this scenario',
        cancel: 'Cancel',
      },
      editor: {
        newTitle: 'New scenario — {subject}',
        editTitle: 'Edit scenario — {subject}',
        teacherPart: 'Text written by the teacher',
        teacherHint:
          'Objectives, hints, questions, the expected conclusion, sources and assumptions are teacher content: the Studio labels them as such and never presents them as simulation results.',
        enginePart: 'What the simulation will run',
        engineHint:
          'Only what the models already support can be picked, so the scenario always runs in the Studio.',
        vi: 'Vietnamese',
        en: 'English (optional)',
        perLine: 'One item per line.',
        save: 'Save scenario',
        saving: 'Checking…',
        cancel: 'Cancel',
        issues: 'Fix these before saving:',
        fields: {
          title: 'Title',
          objectives: 'Objectives',
          hints: 'Step-by-step hints',
          questions: 'Guiding questions',
          assumptions: 'Assumptions',
          limits: 'Limits of the simulation',
          expectedConclusion: 'Expected conclusion',
          question: 'Prediction question',
          sources: 'Scientific sources',
          sourcesHint: 'One source per line: "Title | https://…" (the link is optional).',
          level: 'Level',
          difficulty: 'Difficulty',
          minChars: 'Minimum characters of the explanation',
        },
        physics: {
          preset: 'Prediction question of the simulation scene',
          presetHint:
            'Only scenes whose engine measurements the Studio has checked. Run B = run A with {param} multiplied by {factor}.',
          loading: 'Loading the simulation scene…',
          failed: 'The simulation scene could not be loaded.',
          params: 'Scene quantities',
          control: 'Learner may change',
          start: 'Start value',
          range: 'From {min} to {max} {unit}',
          sceneDefault: 'Scene default: {value} {unit}',
        },
        chemistry: {
          target: 'Reaction of the question',
          targetHint:
            'Only precipitation reactions of the cited library: only they can confirm the answer "precipitate".',
          order: 'Order in the tube: {first} first, then {second}.',
          swap: 'Swap order',
          rack: 'Solutions on the rack',
          rackHint: '2 to 8 solutions; the two solutions of the question are always there.',
        },
        biology: {
          cellType: 'Cell type',
          pairs: 'Chromosome pairs',
          pairsValue: 'n = {n} (2n = {twoN})',
          parts: 'Parts the learner must find',
          partsHint: '2 to 8 parts that the 3D model has for this cell type.',
          answerNote:
            'The answer is computed from the model: the stage whose centromeres lie on the equatorial plane.',
        },
      },
      errors: {
        titleRequired: 'Give the scenario a title (Vietnamese).',
        objectiveRequired: 'Write at least one objective.',
        conclusionRequired: 'Write the expected conclusion (Vietnamese).',
        questionRequired: 'Write the prediction question (Vietnamese).',
        enLines: 'The English box of "{field}" has more lines than the Vietnamese one.',
        minChars: 'The minimum number of characters must be a whole number from 0 to {max}.',
        sourceUrl: 'The source on line {line} has an invalid link.',
        controlsRequired: 'Let the learner change at least one quantity.',
        initialNumber: 'The start value of {param} is not a number.',
        initialRange:
          '{param} must be from {min} to {max} {unit} (so run B stays within the scene range).',
        unknownParam: 'The scene has no adjustable quantity "{key}".',
        notPreset:
          'This scene and measurement set are not in the Physics Studio, so the scenario cannot run.',
        sceneMissing: 'The simulation scene of the scenario could not be loaded.',
        binding: 'The simulation scene does not match the scenario: {detail}',
        inventorySize: 'The rack needs 2 to 8 solutions.',
        reagentNotAllowed: '"{formula}" is not a library solution for the bench.',
        targetInInventory: 'The question must use two different solutions from the rack.',
        targetNotAllowed: 'The reaction of the question must be a precipitation in the library.',
        targetMismatch:
          'The two solutions of the question do not match the chosen library reaction.',
        partsSize: 'Choose 2 to 8 parts.',
        bioUnknownPart: 'A part is not in the 3D model.',
        bioWrongCell: 'A part does not belong to the chosen cell type.',
        bioNoAnswer: 'No stage of the model answers this question.',
        schema: 'The data does not have the right structure: {detail}',
        badJson: 'The file is not valid JSON.',
        notScenarioFile: 'The file is not a Science Studio scenario (version 1).',
        tooLarge: 'The file is too large: a scenario file can be at most {kb} KB.',
        readFailed: 'The file could not be read (it may be too large or locked).',
        lessonTooLarge:
          'The lesson is too long to store in the app (at most {kb} KB). Please shorten the texts.',
        textTooLong: '"{field}" has a passage longer than {max} characters. Please shorten it.',
        listTooLong: '"{field}" has more than {max} items.',
        tooMany:
          'The app already stores {max} authored lessons, the maximum. Export old lessons to files, then delete some.',
        storageFull:
          'The app storage could not be written (it may be full or blocked), so this change was not saved. Export old lessons to files, delete some, then try again.',
      },
    },
  },
  chat: {
    label: 'Chat with the AI teacher',
    title: 'AI Teacher',
    model: 'Gemma · {model}',
    clear: 'Clear conversation',
    voice: 'Teacher reads answers aloud',
    voiceHint: 'Turn the teacher’s voice on/off',
    close: 'Close chat',
    expand: 'Open AI Teacher page',
    contextToggle: 'Use current screen information',
    contextHint: 'Only shares SimLab data currently open',
    engineLabel: 'Choose AI model',
    cloud: 'API',
    gemma: 'Local Gemma',
    local: 'AI on this computer',
    localMissingNotice:
      'You chose the AI on this computer but no program and model yet, so no question was sent. Choose them in Settings → AI on this computer.',
    localOnlyRuntime:
      'SimLab sends questions only to {name} on this computer ({address}), never online by itself.',
    localRuntimeHere: 'SimLab sends questions to {name} on this computer ({address}).',
    voiceOnline:
      'The Gemini voice is on: the text of each answer is sent to Google to be read aloud.',
    noApi:
      'No API key is configured. Connect an API in Settings or choose a downloaded Gemma model.',
    gemmaMissingNotice:
      'Gemma is not ready: this model is not downloaded. Download it in Settings → AI Teacher, or choose “API”.',
    settings: 'Settings',
    localOnly: 'Questions are processed locally on this computer.',
    noWebgpuNotice:
      'This computer or browser does not support WebGPU, so Gemma cannot run here. Choose “API” and connect a key in Settings.',
    thinkNoVerifier:
      'Think needs a second API to cross-check, but it has no key yet. Choose a provider and enter its key in Settings → AI Teacher.',
    reviewTarget: '{name} (review)',
    fallbackTarget: '{name} (fallback when {provider} runs out)',
    sentTo: 'Your question and related library excerpts will be sent to: {targets}.',
    sentToWithScreen:
      'Your question, the screen context and related library excerpts will be sent to: {targets}.',
    sentToWithBoard:
      'Your question with the board text you circled and related library excerpts will be sent to: {targets}.',
    boardChip: 'About: «{excerpt}»',
    boardChipPicture: 'About: the drawing you circled on the board',
    boardChipPictureWords:
      'Asking in words about what you circled: the teacher cannot see the picture, only the steps around it',
    boardChipRemove: 'Remove what you circled',
    boardRef: 'About what you circled: «{excerpt}»',
    boardRefPicture: 'About the drawing you circled on the board',
    welcomeTitle: 'Ask questions your way',
    welcomeBody:
      'Turn on “Use current screen information” if your question is about the open simulation.',
    welcomeBodyTeacher:
      'Ask a question or choose a suggestion below. The AI teacher will explain step by step using the knowledge library.',
    starters: {
      one: 'Explain the main idea of this topic.',
      two: 'Where should I start solving this problem?',
      three: 'Give me an easier example.',
    },
    modelMeta: 'Model: {model}',
    checkedMeta: 'Reviewed by: {model}',
    continuedUnreviewed: 'The continued part was not reviewed.',
    reviewSkippedPicture:
      'Not reviewed: a question about the picture you circled is answered on this computer only, never sent online to be cross-checked.',
    notReadAloud:
      'I did not read this answer aloud: the chosen voice works online, and an answer about the picture you circled stays on this computer. To hear it, pick the on-device voice or a Windows voice in Settings → Voice.',
    voiceSettings: 'Choose a voice',
    continuePictureLocal:
      'An answer about the picture you circled can only be continued with “Local Gemma” or “AI on this computer”.',
    references: 'Knowledge sources',
    thinking: 'Thinking…',
    truncatedNote: 'This answer was long, so it stopped in the middle.',
    continue: 'Continue',
    reviewing: 'Answering and cross-checking…',
    inputLabel: 'Enter your question',
    placeholder: 'Type your question…',
    send: 'Send question',
    think: 'Think',
    thinkTitle: 'Use a second API to review the answer',
    twoApis: '· 2 APIs',
    oneApiReview: '· 1 API reviews',
    enterHint: 'Enter to send · Shift+Enter for a new line',
    footer: 'AI answers may be inaccurate. Check the Science Card and ask a teacher when needed.',
    openSimulation: 'Open the simulation: {title}',
    factsTitle: 'Computed by SimLab (exact, not the AI)',
    facts: {
      balanced: 'Balanced equation: {equation}',
      unbalanced: 'SimLab could not balance “{input}”: check the formulas in the problem.',
    },
    stop: 'Stop',
    stopLabel: 'Stop the answer being written',
    stopped: 'The answer was stopped. You can ask again or ask something else.',
    retry: 'Ask again',
    missingDataTitle: 'SimLab note (not the AI)',
    missingData:
      'This problem may be missing data: SimLab found no numbers in the question. If the problem gives values, add them (with units) and send it again.',
    unverifiedTitle: 'SimLab check (not the AI)',
    unverifiedNumbers: 'Numbers the AI brought in itself (not checked): {numbers}',
    unverifiedMore: '… and {count} more',
    unverifiedHint:
      'SimLab did not find these numbers in your question, the conversation, the reference notes or SimLab’s results. A calculation the board marks as right may still use a wrong formula. Check them yourself.',
    errors: {
      cloudOff: 'Online AI is off. Enable an AI provider in Settings or choose local Gemma.',
      notAllowed:
        'AI is not enabled for this profile. Complete the safety setup in Settings to continue.',
      noCloudKey: 'No API key is set for the answering model. Add one in Settings.',
      gemmaMissing:
        'Gemma is not downloaded, or this browser has no WebGPU. Check Settings → AI Teacher.',
      webgpu: 'This browser or device has no WebGPU support, so Gemma cannot run on it.',
      gemmaStalled:
        'Gemma wrote nothing for a long time, so it was stopped and restarted. Please ask again; if it stays slow, pick "Short" answers or a smaller model in Settings.',
      gemmaGpu:
        'The graphics card stopped Gemma (out of memory or a driver reset). You can ask again; if it happens again, close other apps or pick a smaller model.',
      gemmaGpuBlocked:
        'The graphics card hung while running Gemma. So the computer does not restart, Gemma stays off until you reopen the app. Pick the discrete card in Settings → GPU for Gemma, use a smaller model, or ask through an API.',
      gemmaFailed:
        'Gemma hit an error while answering. Please ask again; if it repeats, open Settings → AI Teacher.',
      crisis:
        'I’m sorry you are having a hard time. Please tell a trusted adult now. If you are in immediate danger in Vietnam, call 111 or 115. This message was not sent to AI.',
      personal:
        'This message may contain personal information. Remove names, addresses, email or phone numbers and try again.',
      unsafe: 'I can only help with appropriate learning content.',
      sameProvider:
        'Choose a different provider for Think so a second API can cross-check the answer.',
      noVerifierKey:
        'No second API key is configured. Open Settings → AI Teacher to connect a review provider.',
      filtered:
        'The answer was hidden because it did not pass the safety filter. Try again or ask a teacher.',
      noAnswer:
        'No lesson came back to show: the AI sent only its working notes or comments. Please ask again; if it repeats, turn Think off or pick another model in Settings.',
      screenPersonal:
        'The screen context may contain personal information, so it was not sent. Remove it or turn off screen context.',
      screenUnsafe: 'The screen context did not pass the safety check and was not sent.',
      boardPersonal:
        'The board text you circled may contain personal information, so it was not sent. Circle another part or type your question.',
      boardUnsafe:
        'The board text you circled did not pass the safety check, so it was not sent. Circle another part or type your question.',
      boardNoPicture:
        "The AI you are using can't read drawings or handwriting, so nothing was sent. Type what you want to ask about this part.",
      boardPicture:
        "I couldn't make a picture of the circled area, so nothing was asked. Type what you want to ask about this part.",
      continuePictureLocal:
        'An answer about the picture you circled can only be continued with “Local Gemma” or “AI on this computer”, so nothing was sent.',
      localDown:
        'I could not reach {name} on this computer: the program may not be open. Open {name} and ask again. The question was not sent anywhere else.',
      localModelMissing:
        '{name} does not have the model you chose. Download or load it in {name} itself, or pick another model in Settings → AI on this computer.',
      localLoading: '{name} is loading the model into memory. Wait a moment, then ask again.',
      localStalled:
        '{name} wrote nothing for a long time, so I stopped waiting. The computer may be busy or the model too heavy: ask again, or pick a smaller model.',
      localAuth:
        '{name} has key protection on and refused the question. SimLab stores no key for AI on this computer: turn the key off in {name} to use it with SimLab.',
      localContext:
        'The question with the earlier conversation is longer than the model can hold. Clear some of the conversation, choose Memory “Medium”, or pick a model with a larger context.',
      localContextTask:
        'This task is longer than the model you chose in {name} can hold. Pick a model with a larger context (or raise the context length in {name} itself) in Settings → AI on this computer.',
      localNoAnswer:
        '{name} wrote no answer: the model may have only reasoned in its notes, or stopped before writing. Please try again; if it repeats, pick another model in Settings → AI on this computer.',
      localRemote:
        'This model runs online, not on your computer, so SimLab does not send questions to it. Pick a model that runs on this computer.',
      localNotRuntime:
        'The chosen address does not answer as {name}. Press “Find on this computer” in Settings → AI on this computer to choose again.',
      localNotSelected:
        'You have not chosen a program and model on this computer yet, so no question was sent. Choose them in Settings → AI on this computer.',
      localFailed:
        '{name} reported an error while answering. Ask again; if it repeats, open Settings → AI on this computer to check.',
      localUpdate:
        'The app on this computer must be updated before it can use AI on this computer. Install the new SimLab version.',
      cloud: {
        reviewer: 'The reviewer ({name})',
        withFallback: '{name} (or the {fallback} fallback)',
        timeout:
          '{who} took too long to answer, so I stopped waiting. Please ask again; if it repeats, ask something shorter or raise the timeout in Settings → {page}.',
        stalled:
          '{who} slowed right down while writing, so I stopped the answer part-way. Press “Ask again”, or ask for a shorter answer.',
        network:
          '{who} could not answer because the network connection was interrupted. Check your Internet connection and ask again; if the network is fine and it repeats, open Settings → {page} to check the key.',
        quota:
          '{who} says its quota is used up (free limit reached or no credit left). Wait a while and ask again, or choose another provider in Settings → {page}.',
        badKey:
          '{who} does not accept the saved API key (it is wrong or was deleted). Open Settings → {page}, paste the right key and check it.',
        badModel:
          '{who} cannot find the chosen model. Open Settings → {page} and leave the model name empty to use the default model, or choose another one.',
        dailyLimit:
          'The maximum number of AI calls per day set on this computer is used up for today, so the question was not sent. Continue tomorrow, or raise the number in Settings → {page}.',
        missingKey:
          '{who} has no API key on this computer, so the question was not sent. Add the key in Settings → {page}.',
        notAllowed:
          'AI is not enabled for this profile, so the question was not sent. Complete the safety step in Settings → {page}, then ask again.',
        emptyAnswer:
          '{who} sent back no text for this question. Please ask again; if it repeats, try another model in Settings → {page}.',
        reasoningOnly:
          '{who} only wrote its working notes, not an answer. Please ask again; if it repeats, try another model in Settings → {page}.',
        tooLarge:
          '{who} says the question with the conversation sent along is too long. Clear some of the conversation or choose Memory “Medium” in Settings → {page}, then ask again.',
        server:
          '{who} is overloaded or has a server error. Wait a moment and ask again; if it lasts, choose another provider in Settings → {page}.',
        other:
          '{who} hit an error while answering. Please ask again; if it repeats, open Settings → {page} to check the connection.',
        internal:
          'The app ran into an internal problem while asking the AI. Please ask again; if it repeats, install the latest SimLab.',
      },
    },
  },
  chatSettings: {
    gemmaTermsCard: 'Gemma terms',
    gemmaTermsHint:
      'Gemma is a Google DeepMind model, used under the Gemma Terms of Use. Please read them before downloading.',
    thinkCard: 'Think · cross-check',
    thinkHint:
      'With Think on in the chat, a second API (not the one that answered) reads the draft and fixes mistakes before you see the answer.',
    builtInCard: 'Built-in notes',
    webCard: 'Online lookup',
    flowLocalChatSession:
      'The conversation is kept only until the app closes (history saving is off).',
    gemmaModel: 'Gemma version',
    gemma270m: '270M · lightest, for trying only (often off-topic, weak answers)',
    gemma1b: '1B · recommended on-device; often wrong on facts, double-check or turn on Think',
    gemmaE2b: 'E2B · strongest, reads photos',
    modelReady: 'Gemma is ready on this computer.',
    modelMissing: 'This model is not downloaded.',
    checking: 'Checking this model…',
    gemmaTerms: 'Read Gemma terms of use',
    gemmaWhere:
      'Gemma runs inside the app with WebGPU (no Ollama, no key). The model files are downloaded once from HuggingFace and kept in the app’s storage on this computer. Without WebGPU Gemma cannot run — use an API instead.',
    downloadingShort: 'Downloading…',
    cancelDownload: 'Cancel download',
    downloadCancelled: 'Download cancelled. The model is not marked as downloaded.',
    downloadNoSpace:
      'Not enough free space to store the model. Free some disk space or pick a smaller model.',
    downloadNetwork:
      'The download failed because of the network. Check the connection and press “Download model” again.',
    downloadMemory:
      'This computer does not have enough graphics memory for this model. Choose a smaller one (270M or 1B).',
    downloadGpuBlocked:
      'Gemma is paused because the graphics card hung while running it (so the computer does not restart). To try again: open Settings → GPU for Gemma, pick the discrete card if there is one, then press “Let Gemma run again anyway” — or reopen the app.',
    downloadFailed: 'The download did not finish ({detail}). The model is not marked as ready.',
    desktopOnly: 'desktop app only',
    webLookup: 'Also look up Wikipedia when online',
    webLookupHint:
      'Off by default. When on, your question is sent to Wikipedia to fetch one reference excerpt (community content, check it).',
    flowTitle: 'Where does your data go?',
    flowLocalTitle: 'Stays on this computer',
    flowLocalChat: 'Your AI Teacher chat history (clear it with the bin button).',
    flowLocalDocs: 'Files you added and the {count} built-in notes.',
    flowLocalModel: 'Downloaded Gemma models; with Gemma, answers are generated on this computer.',
    flowLocalSummary:
      'A summary of the older conversation (written by the AI that answers; sent with your questions to that AI, and to the reviewer when Think is on).',
    flowLocalKeyDesktop: 'API keys: in the operating-system keychain.',
    flowLocalKeyBrowser: 'API keys: only in this browser session, gone on reload.',
    flowSentTitle: 'May be sent online (with the current settings)',
    flowAnswer:
      'With “API”: question, the recent conversation, the summary of the older conversation (if any) and related library excerpts → {name}.',
    flowFallback:
      'When {name} is out of quota and Think is off: what was sent to {name} → {fallback} (the fallback, only if its key is saved).',
    flowThink:
      'With Think on: question, draft, related library excerpts, the summary of the older conversation (if any) and the screen context (if you turned it on) → {name} for review. Nothing goes to the fallback provider.',
    flowThinkOnly:
      'With Gemma: only when Think is on, the question, Gemma’s draft, related library excerpts, the summary of the older conversation (if any) and the screen context (if you turned it on) go → {name} for review. Nothing goes to the fallback provider.',
    flowWiki: 'Wikipedia lookup is on: question → Wikipedia.',
    flowVoice: 'Reading aloud with the Gemini voice is on: answer text → Google.',
    flowPhoto:
      'When you photograph a problem (browser): the downscaled photo → {name} to read the text.',
    flowModelDownload:
      'When you press “Download model”: files come from HuggingFace (no question is sent).',
    flowLocalRuntime:
      'With AI on this computer ({name}, {address}): the question goes only to that program on this computer.',
    flowLocalRuntimeNone:
      'With AI on this computer: the question goes only to the program you choose on this computer (none chosen yet).',
    flowNothingOnline:
      'Nothing is sent online when you ask the AI Teacher (Think and the Wikipedia lookup are off).',
    flowThinkLocal:
      'Think is on: the question, the draft of the AI on this computer, related library excerpts, the summary of older turns (if any) and the screen context (if you turned it on) → {name} for review. Nothing goes to a fallback provider.',
    flowScreen:
      'Screen context is sent only when you turn on “Use screen information” in the chat bubble; it is SimLab data, not a screenshot.',
    download: 'Download model',
    downloaded: 'Downloaded',
    deleteModel: 'Delete Gemma',
    downloading: 'Downloading the model. It can be large; keep the app open until it completes.',
    webgpuRequired: 'This browser or device has no WebGPU support, so Gemma cannot run on it.',
    openRepo: 'Open the model page',
    recommended: 'Recommended',
    progressPreparing: 'Preparing model download…',
    progressDownloading: 'Downloading model files…',
    progressVerifying: 'Verifying downloaded files…',
    progressSaving: 'Saving the model on this computer…',
    progressComplete: 'Gemma download complete.',
    progressLoading:
      'Files downloaded — loading the model onto the GPU (this can take a few dozen seconds)…',
    verifier: 'Answer review API',
    verifierModel: 'Review model name',
    verifierKey: 'Second API key',
    keyPlaceholder: 'Paste the selected provider’s API key',
    saveKey: 'Save key',
    testKey: 'Test key',
    deleteKey: 'Delete key',
    keySaved: 'The key was saved in the operating system credential store.',
    keyDeleted: 'The second API key was deleted.',
    keyPrivacy:
      'Think sends the question and draft to the second provider for review. The key stays in the operating system credential store and is shared with settings for that provider.',
    browserKeyNote:
      'In the browser, the second API key lives for this session only (gone on reload); Claude can review only in the desktop app. The desktop app keeps keys in the system keychain.',
    keyTest: {
      ok: 'Connection succeeded.',
      noKey: 'No key is set.',
      badKey: 'The API key is invalid.',
      quota: 'The provider reports its quota is used up.',
      badModel: 'The model was not found.',
      offline: 'No network connection.',
      error: 'Could not test the key.',
      notAllowed: 'Complete the safety setup before using AI.',
      failed: 'Could not test the key.',
    },
    library: 'Knowledge library',
    builtIn:
      '{count} built-in STEM notes for upper-secondary study; {pending} are still waiting for a teacher’s review, so check them against the textbook.',
    notes: 'notes',
    addFile: 'Add knowledge file',
    fileFilter: 'Text and data files',
    fileTooLarge: 'Each file is limited to 120,000 characters.',
    libraryFull: 'The personal library reached its 1.5-million-character limit.',
    supportedFiles: 'Supports .txt, .md, .csv, .json',
    noDocs: 'No personal files yet. Add one to use it as a reference.',
    characters: 'characters',
    removeFile: 'Remove',
    localLibraryPrivacy:
      'Files are stored on this computer. With online APIs, relevant excerpts may be sent with your question. Only add materials you have permission to use.',
    memory: {
      title: 'Conversation memory',
      intro:
        'How much of the latest conversation the teacher remembers. Older parts are summarised briefly by the AI so the teacher keeps track of the lesson.',
      medium: 'Medium',
      long: 'Long',
      mediumHint: 'Faster; suits slower computers and free API plans.',
      longHint:
        'Remembers more but is slower (especially Gemma on an integrated card) and uses free plans up faster (Groq, Gemini).',
    },
    gpu: {
      title: 'Graphics card (GPU) running Gemma',
      intro:
        'If this computer has several graphics cards, you can choose the one that runs Gemma. A dedicated card is usually much faster; an integrated card saves battery.',
      scanning: 'Looking for graphics cards…',
      scanFailed: 'Could not list the graphics cards ({detail}).',
      none: 'No hardware graphics card was found.',
      auto: 'Automatic (let Windows choose)',
      autoHint: 'On laptops this is usually the integrated card.',
      integrated: 'Integrated card · shares system RAM',
      discrete: 'Dedicated card · {vram} VRAM',
      unknownKind: 'Card type unknown',
      suggested: 'Best for Gemma',
      wholeApp:
        'The chosen card runs everything the app draws (simulations too), not only Gemma. A dedicated card uses more battery — plug in the charger when you can.',
      restartNeeded:
        'Restart the app to use the new card ({name}). Until then Gemma and the app keep running on the previous card.',
      restartNeededAuto:
        'Restart the app to go back to automatic. Until then Gemma keeps running on the previous card.',
      restartNow: 'Restart now',
      later: 'Later',
      saved: 'Graphics card choice saved. Restart the app to apply it.',
      saveFailed: 'Could not save the choice ({detail}).',
      missing:
        'When the app started, the chosen card ({name}) was not found — the dedicated card may be switched off (the laptop maker’s battery/Eco mode) or the hardware changed. The app is using the default card.',
      runningOn: 'The app’s WebGPU is running on: {name}',
      runningOnUnknown: 'Could not read which card WebGPU is using.',
      gemmaRanOn: 'Gemma last loaded on: {name}',
      mismatch:
        'The app asked for {wanted} but WebGPU is running on {actual}. Try restarting the app; if it stays this way, this card cannot be used for WebGPU on this computer.',
      vramLow:
        'This card has {vram} VRAM, which may not be enough for {model} ({size}). A smaller Gemma is a safer choice.',
      browserOnly:
        'In a browser, the browser picks the graphics card. Choosing a card is only available in the Windows desktop app.',
      unsupported: 'Choosing a graphics card is currently only available on Windows.',
      faultTitle: 'The graphics card hung while running Gemma',
      faultBody:
        'At {when}, the {card} card stopped responding while Gemma was answering. Windows had to reset it; if this repeats, the computer may restart.',
      faultBlocked: 'Gemma is paused until you reopen the app.',
      faultAdvice:
        'Pick the discrete card for Gemma, a smaller model, or ask through an online API.',
      useDiscrete: 'Use the discrete card: {name}',
      allowAgain: 'Let Gemma run again anyway',
      dismissFault: 'Hide this notice',
      unknownCard: 'graphics',
      integratedHint:
        'Gemma runs on the integrated card, which can hang on long questions; this computer has a discrete card ({name}): pick it for Gemma.',
    },
  },
  localRuntime: {
    intro:
      'SimLab can use an AI program you installed and opened on this computer. SimLab does not install or open that program, nor download models for it.',
    detectTitle: 'Find on this computer',
    detect: 'Find on this computer',
    detecting: 'Looking…',
    detectPrivacy:
      'Only the three usual addresses on this computer ({addresses}) and the addresses you added are asked. No file is read, no disk is scanned, nothing leaves the computer.',
    fallback:
      'Fallback: when the AI on this computer fails, SimLab tells you and sends nothing online (no automatic switch to an API). If the Wikipedia lookup is on, the question goes to Wikipedia only after SimLab has reached the AI program on this computer.',
    corsNote:
      'Running in a browser: the AI program must allow this page (CORS), otherwise SimLab shows “Not found”. The desktop app does not need this.',
    detectFailed: 'The search did not work. Please try again.',
    notAllowed: 'Finish the safety step (age confirmation) before using AI.',
    needsUpdate:
      'The app on this computer must be updated before it can find AI on this computer. Install the new SimLab version.',
    noneFound: 'No running AI program was found. See “Problems? What to do” below.',
    detectedAt: 'Result of the search at {time}.',
    detectedEarlier:
      'The program may have stopped or changed models since then: press “Find on this computer” to look again.',
    kinds: {
      ollama: 'Ollama',
      lmStudio: 'LM Studio',
      llamaCpp: 'llama.cpp',
      openAiCompatible: 'OpenAI-compatible server',
    },
    unknownKind: 'Unknown program',
    usualFor: 'usual address of {name}',
    status: {
      unreachable: 'Not found',
      found: 'Running',
      foundVersion: 'Running · version {version}',
      loading: 'Loading a model',
      needsAuth: 'Needs a key',
      notRuntime: 'Not an AI program',
    },
    statusHint: {
      unreachable: 'The program is not open, or uses another address.',
      loading: 'Wait until it has loaded, then press “Find on this computer” again.',
      needsAuth: 'The program has key protection on: SimLab stores no key for AI on this computer.',
      notRuntime: 'Another program uses this address.',
    },
    modelsTitle: 'Models of {name}',
    modelsLoading: 'Getting the model list…',
    modelsEmpty: 'No model yet. Download one in that program itself.',
    modelsMore: 'The program has more models; SimLab shows the first {count}.',
    modelsFailed: 'Could not get the model list: {reason}',
    modelsAgain: 'Press “Find on this computer” to see the model list again.',
    chooseModel: 'Choose a model',
    badges: {
      detected: 'Detected',
      listed: 'Listed',
      loaded: 'Loaded in memory',
      notLoaded: 'Not loaded in memory',
      selected: 'Chosen for the AI Teacher',
      selectedIdle: 'Chosen · the AI Teacher uses {engine}',
      tested: 'Answer tested · {time}',
      testFailed: 'Last test got no answer · {time}',
      incompatible: 'Cannot be used: {reason}',
      unavailable: 'Not usable now',
    },
    reasons: {
      remote: 'runs online',
      smallContext: 'context too small ({context})',
      testFailed: 'the last answer test failed',
    },
    facts: {
      size: 'File size: {value}',
      context: 'Context length: {value}',
      memory: 'RAM/VRAM needed: {value}',
      vision: 'Reads pictures: {value}',
      params: 'Model size: {value}',
      quant: 'Compression: {value}',
    },
    contextUnit: '{count} text pieces',
    unverified: 'Not verified',
    yes: 'Yes',
    no: 'No',
    memoryUnknown: 'Not verified (the program does not say)',
    detailsTitle: 'Model shown: {model}',
    pickHint: 'Pick a model in the list above to test it and use it for the AI Teacher.',
    checkConnection: 'Check connection',
    checkingConnection: 'Checking the connection…',
    connectionOk: 'Connected. Model details read at {time}.',
    testAnswer: 'Test an answer',
    testing: 'Waiting for the model to answer…',
    testWarning:
      'Testing an answer makes the program write a few words: it loads the model into RAM/VRAM, which can be slow and warm the computer. It runs only when you press it; one press is one request, never retried by itself.',
    test: {
      ok: 'The model answered (first words after {seconds} s).',
      okNoTime: 'The model answered.',
      unreachable: 'No connection: the program is not open or was closed.',
      notRuntime: 'This address does not answer as the chosen program.',
      needsAuth: 'The program has key protection on and refused.',
      modelMissing: 'The program does not have this model.',
      loading: 'The program is loading the model. Wait a moment and try again.',
      remoteModel: 'This model runs online, so SimLab does not send to it.',
      stalled: 'No words in time: the computer may be busy or the model too heavy.',
      error: 'The program reported an error while answering: {detail}',
      notAllowed: 'Finish the safety step before using AI, or the address is not on this computer.',
    },
    useForTeacher: 'Use for the AI Teacher',
    currentTitle: 'Chosen for the AI Teacher',
    savedTitle: 'Model chosen on this page',
    currentBody: '{label} at {address}',
    currentLocal: 'The AI Teacher answers with this model, right on your computer.',
    currentLocalUnchecked:
      'The AI Teacher will send questions to this model, right on your computer. SimLab has not checked this session whether the program is running: press “Find on this computer” to check.',
    relayNote:
      'Note: an OpenAI-compatible server may be an intermediary that forwards questions online by itself; SimLab cannot control that.',
    currentLocalUnavailable:
      'The AI Teacher is still set to this model, but the last search found it cannot be used (reason below). Questions then only show an error and are not sent anywhere else. Fix it with the help below, pick another model in the list, or press “Unselect”.',
    currentOther:
      'This model is chosen, but the AI Teacher does not use it. {now} Press “Use for the AI Teacher” to switch.',
    now: {
      cloud: 'Questions for the AI Teacher are sent online to {provider}.',
      cloudOff: 'The AI Teacher is set to the API, but the API is off, so no question is sent.',
      cloudNoKey:
        'The AI Teacher is set to the {provider} API, but no key is saved, so no question is sent until you add one.',
      gemma: 'The AI Teacher answers with local Gemma, right on your computer.',
      gemmaMissing:
        'The AI Teacher is set to local Gemma, but its model is not downloaded, so no question is sent.',
    },
    waiting: 'The AI Teacher waits for you to pick a model below; until then no question is sent.',
    restoredNote:
      'SimLab has not asked the program this time: it asks only when you ask a question or press a button on this page.',
    neverTested: 'No answer tested yet.',
    testedAt: 'Answer tested at {time}.',
    testFailedAt: 'The last answer test (at {time}) did not succeed.',
    unselect: 'Unselect',
    unselected: 'Unselected. {now}',
    capsTitle: 'Capabilities (only what was seen on this computer)',
    capsName: 'Capability',
    capsSeen: 'On this computer',
    capsDeclared: 'Program documentation',
    capsDeclaredYes: 'says yes (not seen on this computer)',
    caps: {
      listModels: 'Lists its models',
      contextLength: 'Tells its context length',
      vision: 'Reads pictures',
      streaming: 'Answers piece by piece',
      cancel: 'Stops midway',
      jsonSchema: 'Fills the form exactly when reading a problem',
      loadState: 'Tells whether the model is loaded',
    },
    resourcesTitle: 'Resources',
    moreTitle: 'Show advanced options',
    addTitle: 'Add an address',
    addLabel: 'Address on this computer',
    add: 'Add',
    addRefused:
      'SimLab accepts only addresses on this computer itself (127.0.0.1, localhost or [::1]) with a port, for example http://127.0.0.1:11435. Another address could take the question off the computer, so it is not used.',
    added: 'Added {address}. Press “Find on this computer” to ask it.',
    addedList: 'Addresses you added',
    remove: 'Remove {address}',
    helpTitle: 'Problems? What to do',
    help: {
      notRunning:
        'Not found: open the program, then press “Find on this computer” again. Ollama runs in the background once installed; LM Studio needs its Local Server switched on in the Developer tab; llama.cpp needs llama-server running.',
      modelMissing:
        'Model missing: download the model in that program itself (Ollama: the “ollama pull” command with the model name; LM Studio: download and load it in the app).',
      loading: 'Loading: wait until the program has loaded the model, then try again.',
      needsAuth:
        'Needs a key: the program has key protection on. SimLab stores no key for AI on this computer, so turn the key off in that program to use it with SimLab.',
      cors: 'Browser only: the program must allow this page (CORS). The desktop app does not need this.',
      notAi:
        'Not an AI program: port 8080 is often used by other programs. Check the port llama-server uses and add that address.',
    },
    honestTitle: 'What SimLab does not control',
    honest: {
      gpu: 'SimLab does not choose the graphics card of that program. On a laptop with an integrated card, choose the discrete card in that program’s own settings.',
      logs: 'SimLab does not know what that program records (logs, chat history).',
      internet:
        'SimLab sends only to addresses on this computer, but a relay program running on it can still forward questions online. Models that “run online” are always disabled here.',
    },
    resetTitle: 'Restore defaults',
    resetBody:
      'Removes the added addresses, the test results and the chosen model on this page. Other settings stay as they are.',
    reset: 'Restore defaults',
    resetConfirm: 'Remove',
    resetCancel: 'Cancel',
    resetDone: 'Defaults restored.',
    resetEngineNote:
      'The AI Teacher is still set to AI on this computer: no question is sent until you choose a model again or press “Unselect”.',
  },
  gpuSettings: {
    cardTitle: 'Graphics card (WebGPU)',
    card: 'Card',
    checking: 'Reading the card details…',
    none: 'No WebGPU-capable card was found.',
    unnamed: 'A WebGPU card is available (the browser does not tell its name).',
    f16: 'Half-precision maths (shader-f16)',
    maxBuffer: 'Largest buffer',
    loaded: 'Loaded on the GPU',
    notLoaded: 'No model loaded',
    yes: 'Yes',
    no: 'No',
    fallbackWarning: 'This is a CPU-emulated card: Gemma still runs, but very slowly.',
    privacy: 'The browser reads this on this computer; nothing is sent.',
    powerTitle: 'Which card on a two-GPU computer',
    power: 'Prefer',
    powerHigh: 'Powerful card (faster)',
    powerLow: 'Battery-saving card',
    powerHint:
      'Only matters on computers with both a discrete and an integrated card; the browser may ignore it. Applies from the next question.',
    lengthTitle: "Length of Gemma's answers",
    length: 'At most',
    lengths: {
      short: 'Short',
      medium: 'Medium',
      long: 'Long',
    },
    lengthHint:
      'At most about {tokens} tokens per answer. Longer means waiting longer, and a small model tends to ramble.',
    memoryTitle: 'GPU memory',
    unload: 'Free it',
    keep: 'Keep loaded',
    after: 'After {minutes} min',
    unloadHint:
      'The model stays in GPU memory to answer quickly. Freeing it makes the computer lighter; the next question loads it again from disk (seconds to tens of seconds).',
    freeNow: 'Free the GPU memory now',
  },
  memorySettings: {
    storeTitle: 'Keep the conversation',
    save: 'Save the chat history on this computer',
    saveOn: 'The conversation is still there after reopening the app (the last {max} messages).',
    saveOff: 'The conversation is kept only until the app closes.',
    count: '{count} messages so far.',
    clear: 'Clear the conversation',
    confirmClear: 'Clear for good',
    cancel: 'Cancel',
    hasSummary: 'Older turns have been summarised briefly (also kept on this computer).',
  },
  board: {
    label: "AI Teacher's whiteboard",
    controls: 'Board controls',
    pause: 'Pause',
    resume: 'Resume',
    replay: 'Teach again',
    finish: 'Write it all',
    finishHint: 'Write the rest on the board at once, without reading it',
    speed: 'Writing speed',
    myPen: 'My pen',
    penHint: 'Turn on to write or draw on the board with the mouse or touch',
    penArea: 'Your writing area',
    clearPen: 'Clear your strokes on this board',
    zoom: 'Board size',
    zoomIn: 'Zoom in on the board',
    zoomOut: 'Zoom out of the board',
    zoomFit: 'Fit',
    zoomFitHint: 'Fit the board to the view, its whole width in sight',
    history: 'Board faces',
    face: 'Board {n}',
    teacherHere: 'the teacher is writing on this board',
    preparing: 'Preparing the board…',
    empty:
      'Ask AI Teacher a question: it will explain while writing formulas, underlining, circling and drawing on this board.',
    nothingToWrite: 'This answer has nothing to write on the board — read it in the chat.',
    checked: 'Arithmetic re-checked by the app',
    unverified: 'Contains numbers the AI computed itself, not verified: check them yourself',
    axes: 'Coordinate axes',
    plotOf: 'Graph of {fn}',
    plotUnreadable: 'Could not read the expression to plot',
    codeInMessage: '(code in the message)',
    ask: {
      tool: 'Circle to ask',
      toolHint:
        'Turn on, then circle, underline or tap the part of the board to ask the teacher about',
      area: 'Area to circle and ask',
      barLabel: 'What you circled on the board',
      excerpt: 'You circled:',
      ask: 'Ask about this',
      again: 'Circle again',
      clear: 'Clear',
      none: "I can't see any writing or drawing inside what you circled. Circle closer to what you want to ask about, or type your question.",
      many: 'You circled quite a lot: ask about all of it, or one part?',
      unsure: 'You circled part of this. Did you mean…?',
      all: 'All of it',
      picture: 'The drawing you circled',
      pictureLocal:
        'With a picture of the circled area — on this computer only, never sent online.',
      pictureLocalQuiet:
        'With a picture of the circled area — on this computer only, never sent online. The Gemini voice will not read this answer aloud.',
      pictureUnreadable:
        "The AI you are using can't read drawings or handwriting. Type in the chat what you want to ask about this part: the teacher only knows the steps around it, not the picture.",
      resume: 'Back to the lesson',
      defaultQuestion: 'Could you explain the part I just circled, please?',
      describe: {
        plot: 'graph of {label}',
        plotOn: 'graph of {label} on [{from}; {to}]',
        axes: 'axes ({labels})',
        freeBody: 'free-body diagram: {body}; forces: {forces}',
        flow: 'diagram: {steps}',
        table: 'table: {cells}',
        vector: 'vector {label}',
      },
    },
  },
  voice: {
    readAloudCard: 'Read aloud',
    readAloud: "Read AI Teacher's answers aloud",
    onCpuAfterGpuFault:
      'For this session the on-device voice runs on the CPU because the graphics card failed (slower but safe for the computer).',
    readAloudHint: 'Also switched with the speaker button in the chat. No audio is recorded.',
    sourceCard: 'Voice source',
    engines: {
      system: {
        title: 'Windows voice',
        hint: 'Free and offline. Sounds right once Windows has a Vietnamese voice installed.',
      },
      gemini: {
        title: 'Gemini voice (online)',
        hint: 'Most natural, with human-like pauses. Needs the Internet and a Gemini key; counts towards the daily AI limit.',
      },
      local: {
        title: 'Vietnamese voice on this computer',
        hint: 'Downloaded once, then reads offline with correct Vietnamese tones; sounds more synthetic than the other two.',
      },
    },
    systemFound: 'Vietnamese voice found: {names}.',
    noVietnameseOnEnable:
      'This computer has no Vietnamese voice, so the teacher will mispronounce. Open Settings → Voice to add a Windows Vietnamese voice or pick the on-device Vietnamese voice.',
    systemMissing:
      'No Vietnamese voice on this computer, so Windows reads with an English voice and gets the tones wrong. Install the free Vietnamese voice:',
    installStep1: 'Open Windows Settings → Time & language → Speech.',
    installStep2: 'Under "Manage voices", press "Add voices".',
    installStep3:
      'Type "Vietnamese", choose "Vietnamese (Vietnam)" and press Add. Windows downloads the voice "Microsoft An".',
    installStep4: 'Close and reopen SimLab: the new voice appears in the list below.',
    openWindowsSpeech: 'Open the Windows speech settings',
    voiceLabel: 'Voice',
    auto: 'Automatic (Vietnamese first)',
    groupVietnamese: 'Vietnamese',
    groupOther: 'Other languages (wrong Vietnamese tones)',
    noSpeech: 'This computer has no speech engine. Choose the Gemini voice or the on-device voice.',
    geminiNoKey: 'No Gemini key yet. The Gemini voice uses the same key as Connect AI.',
    openConnect: 'Open Connect AI',
    geminiVoice: 'Gemini voice',
    geminiModel: 'Voice model',
    traits: {
      friendly: 'friendly',
      warm: 'warm',
      knowledgeable: 'knowledgeable',
      informative: 'clear, informative',
      firm: 'firm',
      upbeat: 'upbeat',
      breezy: 'breezy',
      gentle: 'gentle',
    },
    modelFlash: 'Flash (best)',
    modelLite: 'Flash-Lite (cheaper)',
    geminiPrivacy:
      "With the Gemini voice, the answer's text (not your question) is sent to Google to be read. On the free tier Google may use content to improve its services. The audio carries a SynthID watermark.",
    localLicence:
      "Meta's MMS-TTS Vietnamese model ({size}), licence {licence}: non-commercial use only, with attribution.",
    localReady: 'Downloaded and ready.',
    localDelete: 'Delete voice',
    localDownload: 'Download voice ({size})',
    localDownloading: 'Downloading…',
    localPreparing: 'Preparing…',
    localModelPage: 'Model page',
    localLicencePage: 'Read the licence',
    downloadCancelled: 'Download cancelled. The voice is not marked as downloaded.',
    downloadFailed:
      'The download did not finish. Check the network and free disk space, then retry.',
    localHint:
      'Runs on the graphics card (WebGPU) when there is one, else on the CPU (slower, may pause between phrases). The first sentence waits a few seconds while the model loads.',
    howCard: 'How it reads',
    style: 'Style',
    styles: {
      vui: 'Cheerful',
      am: 'Warm',
      lanh: 'Brisk',
      hai: 'Playful',
    },
    speed: 'Speed',
    howHint:
      'Numbers, units, formulas and chemical symbols are read as Vietnamese words (9,81 m/s² → "chín phẩy tám mốt mét trên giây bình phương"); long sentences pause at punctuation like a teacher.',
    previewCard: 'Preview',
    preview: 'Preview',
    stop: 'Stop reading',
    showText: 'Show the words it will read',
    errors: {
      noKey: 'The Gemini voice needs a Gemini key: the Windows voice read the last answer instead.',
      noModel:
        'The on-device Vietnamese voice is not downloaded: the Windows voice read the last answer instead.',
      quota: 'Gemini reported no quota left: the Windows voice read the last answer instead.',
      dailyLimit:
        "Today's AI limit (set in Settings) is used up: the Windows voice read the last answer instead.",
      timeout:
        'The chosen voice took too long to answer: the Windows voice read the rest of the lesson instead.',
      systemVoice:
        "The Windows voice could not read the last sentence (the computer's speech engine reported an error). Try another voice.",
      offline: 'No network: the Windows voice read the last answer instead.',
      notAllowed:
        'The Gemini voice needs the 18+ confirmation: the Windows voice read the last answer instead.',
      other: 'The chosen voice could not read: the Windows voice read the last answer instead.',
      lessonRest:
        'The on-device voice could not read: the Windows voice read the rest of the lesson instead.',
      gpuToCpu:
        'The graphics card failed while reading: the on-device voice now runs on the CPU (slower, but safe for the computer), and the Windows voice read what was left unread.',
      movedToCpu:
        'The on-device voice just moved to the CPU (slower, but safe for the computer): the Windows voice finished what it was reading.',
    },
  },
  levels: {
    label: 'Level',
    foundation: 'Foundation',
    general: 'University',
    foundationDesc: 'Core knowledge, about upper-secondary level — a solid refresher.',
    generalDesc: 'First-year university physics, chemistry and biology.',
    soon: 'coming soon',
    plannedHint: 'The University level comes in a later phase.',
    mappingPending: 'Mapping topics to curriculum lessons is waiting for a teacher’s review.',
  },
  onboarding: {
    label: 'Getting started with SimLab',
    step: 'Step {i}/{n}',
    levelTitle: 'Which level do you want to study?',
    levelBody: 'Choose a level so the app can suggest topics. You can change it at any time.',
    subjectsTitle: 'Which subjects interest you?',
    subjectsBody: 'Choose one or more — they will be suggested first. Not sure? Just skip.',
    next: 'Next',
    back: 'Back',
    skip: 'Skip',
    finish: 'Done',
    connectTitle: 'Connect AI (optional)',
    connectBody:
      'AI reads the problems you paste and explains results in words. You need a free Gemini API key (its creator must be 18+); Settings has a step-by-step guide with pictures.',
    connectNote: 'Without AI, every simulation, sample and the manual scene builder still work.',
    connectNow: 'Connect now',
    later: 'Later',
  },
  mode: {
    label: 'Display mode',
    basic: 'Basic',
    advanced: 'Advanced',
    basicHint: 'Basic: only what the lesson needs.',
    advancedHint:
      'Advanced: the selected object, every parameter, the protractor, the data table and CSV export.',
    moreParams: 'More parameters ({count})',
    fewerParams: 'Fewer parameters',
  },
  learn: {
    empty: 'Open a Physics topic for a prediction question and challenges.',
    none: 'This topic has no challenge yet.',
    predictTitle: 'Predict first',
    poeSteps: 'Predict → Observe → Explain',
    observe: 'Run to check',
    observeFailed: 'Could not compute the check result. Adjust the parameters and try again.',
    predictRight: 'Your prediction was right!',
    predictOther: 'The result differs from your prediction — well worth thinking about.',
    observed: 'Changing {param}: {quantity} went from {before} to {after}.',
    explainYours: 'How would you explain it?',
    explainPlaceholder: 'Write a few lines in your own words (for you only: not saved, not sent).',
    explainHint: 'Tip: compare with the formulas in the Solution tab or the Science Card.',
    predictAgain: 'Predict again',
    dir: { up: 'Increases', down: 'Decreases', same: 'Stays the same' },
    ratio: {
      same: 'Stays the same',
      half: 'Halves',
      sqrt2: 'Grows √2 ≈ 1.41 times',
      times: 'Grows {n} times',
    },
    challenge: 'Challenge',
    completed: 'Completed',
    start: 'Start the challenge',
    tryAgain: 'Do it again',
    restart: 'Start again',
    controls: 'Only change: {controls} (in the Properties panel). Keep the other values.',
    changed: 'You changed another parameter — this challenge only lets you change the one named.',
    invalid: 'The current values are not valid; please adjust them.',
    now: 'Now',
    goal: 'Goal',
    goalMax: 'as large as possible',
    goalMin: 'as small as possible',
    successTarget: 'Exactly! {quantity} = {value}, on target {goal} (only {diff} off).',
    successBest: 'Great! {quantity} = {value} — the largest possible is {best}.',
    showHint: 'Show a hint',
    progress: 'Progress: {done}/{total}',
    topicDone: 'Topic completed',
    badgesTitle: 'Your badges',
    noBadges: 'Open a topic, try a prediction or a challenge to earn your first badge.',
    badges: {
      firstSteps: 'First steps',
      firstStepsDesc: 'Opened your first topic.',
      explorer: 'Explorer',
      explorerDesc: 'Opened {count} different topics.',
      allSubjects: 'All three subjects',
      allSubjectsDesc: 'Studied Physics, Chemistry and Biology.',
      predictor: 'Predictor',
      predictorDesc: 'Made predictions in {count} topics — right or wrong, both count.',
      challenger: 'Challenger',
      challengerDesc: 'Completed your first challenge.',
      chapter: 'Chapter completed',
      chapterDesc: 'Finished every challenge in {chapter}.',
    },
    breakReminder:
      'You have been studying for about 45 minutes. Rest your eyes for a few minutes: stand up, look into the distance — the simulation will wait for you.',
  },
  teacher: {
    regionLabel: 'Learn with an AI teacher',
    title: 'Learn with an AI teacher',
    sketchBadge: 'Study assistant',
    sketchNote:
      'Ask questions, request hints and learn at your pace. Choose an online API or Gemma running on this computer.',
    back: 'Back to home',
    layoutLabel: 'Preview layout',
    layoutTalk: 'Conversation',
    layoutBoard: 'Board lesson',
    aiLabel: 'AI teacher',
    talkCaption: 'Hi! What shall we learn today?',
    boardCaption: 'Let’s put the key ideas on the board and reason through them step by step.',
    startTitle: 'What do you want to learn today?',
    startHint: 'Pick a topic, speak, type or paste a problem',
    durationLabel: 'How long?',
    minutes: '{n} min',
    boardLabel: 'Whiteboard',
    boardHeading: 'Step 1: Forces acting',
    boardFormula: 'P = m·g',
    boardNote: 'pointing straight down',
    progressLabel: 'Lesson progress',
    controlsLabel: 'Lesson controls',
    mic: 'Hold to talk',
    raiseHand: 'Raise hand',
    pause: 'Pause',
    speed: 'Speaking speed',
    captions: 'Captions',
    transcript: 'Transcript',
    chipsLabel: 'Quick requests',
    chips: {
      hint: 'Step hint',
      again: 'Explain again',
      slower: 'Slower',
      example: 'Another example',
      simpler: 'Simpler',
      lost: 'I do not get this part',
    },
    chipPrompts: {
      hint: 'Do not solve it all. Give me one small hint for the next step only (no final answer yet), then ask me to try that step.',
      again: 'Explain your last answer again in a different, easier way, keeping the same content.',
      slower:
        'Teach your last answer again more slowly: split it into small steps, one idea per step, and explain each step.',
      example: 'Give me one more concrete, everyday example of exactly what you just explained.',
      simpler:
        'Say what you just explained more simply: fewer technical words, short sentences, as for a beginner.',
      lost: 'I do not understand what you just explained. Ask me which step I am stuck on, then give hints one at a time.',
    },
    connectTitle: 'Connect AI to learn with the teacher',
    connectBody:
      'The AI teacher needs an AI key. It takes about 2 minutes, with step-by-step help.',
    connect: 'Open Connect AI',
    notYet: 'This feature will be added later',
    askMitosisPart: 'Ask the teacher about this part',
    askMitosisPartShort: 'Ask the teacher',
    askMitosisPartQuestion:
      'Could you explain what the “{part}” does at the “{stage}” stage (mitosis model, {cell})?',
    askMitosisPartHiddenQuestion:
      'At the “{stage}” stage (mitosis model, {cell}) I can’t clearly see the “{part}”. Is it there at that point, and when does it appear or disappear?',
  },
  languages: {
    vi: 'Tiếng Việt',
    en: 'English',
  },
};

export default en;
