import express, { type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.disable('x-powered-by');

// Website-Level Security Headers (CSP, Permissions-Policy, HSTS, Clickjacking & MIME Sniffing Protection)
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  next();
});

// In-Memory Per-IP Rate Limiter for /api/* Endpoints (60 requests / minute)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT_WINDOW_MS = 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 60;

app.use('/api', (req, res, next) => {
  const clientIp = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const entry = rateLimitStore.get(clientIp);

  if (!entry || now > entry.resetAt) {
    rateLimitStore.set(clientIp, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    next();
    return;
  }

  if (entry.count >= RATE_LIMIT_MAX_REQUESTS) {
    res.status(429).json({ error: 'Too many requests. Please pause briefly and try again.' });
    return;
  }

  entry.count += 1;
  next();
});

app.use(express.json({ limit: '100kb' }));

// Input Sanitization Middleware (strips dangerous script/iframe/object tags and caps string length)
function sanitizeInput(value: any): any {
  if (typeof value === 'string') {
    return value
      .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
      .replace(/<\s*(iframe|object|embed|link|meta)[^>]*>/gi, '')
      .replace(/javascript\s*:/gi, '')
      .replace(/on\w+\s*=/gi, '')
      .slice(0, 2000);
  }
  if (Array.isArray(value)) {
    return value.slice(0, 50).map(sanitizeInput);
  }
  if (value && typeof value === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k !== '__proto__' && k !== 'constructor' && k !== 'prototype') {
        cleaned[k] = sanitizeInput(v);
      }
    }
    return cleaned;
  }
  return value;
}

app.use('/api', (req, _res, next) => {
  if (req.body && typeof req.body === 'object') {
    req.body = sanitizeInput(req.body);
  }
  next();
});

// Initialize GoogleGenAI SDK with required telemetry header (re-checks env key dynamically)
let aiClient: GoogleGenAI | null = null;
let lastApiKey: string | undefined = undefined;
function getAiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (!apiKey) return null;
  if (aiClient && lastApiKey === apiKey) return aiClient;
  try {
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
    lastApiKey = apiKey;
  } catch (err) {
    console.error('Failed to initialize GoogleGenAI client:', err);
  }
  return aiClient;
}
getAiClient();

// In-memory cache for API endpoints to prevent redundant model calls
const apiCache = new Map<string, { data: any; expiry: number }>();
function getCached<T = any>(key: string): T | null {
  const item = apiCache.get(key);
  if (item && item.expiry > Date.now()) {
    return item.data as T;
  }
  return null;
}
function setCache(key: string, data: any, ttlMs: number = 30 * 60 * 1000) {
  apiCache.set(key, { data, expiry: Date.now() + ttlMs });
}

// Quota circuit-breaker per model
const modelBlockedUntil: Record<string, number> = {};
function isModelAvailable(model: string): boolean {
  return (modelBlockedUntil[model] || 0) <= Date.now();
}
function markModelQuotaExhausted(model: string, retryDelaySec: number = 8) {
  modelBlockedUntil[model] = Date.now() + retryDelaySec * 1000;
}

// Helper to safely execute a Gemini call with alternate model fallbacks and silent quota handling
async function executeWithQuotaProtection<T>(
  preferredModel: string,
  alternateModels: string[],
  fn: (modelName: string) => Promise<T>
): Promise<{ result: T | null; usedModel?: string }> {
  const client = getAiClient();
  if (!client) return { result: null };

  const defaultFallbacks = [
    'gemini-4-hydrogen',
    'gemini-3.1-flash-lite',
  ];
  const candidates = [preferredModel, ...alternateModels, ...defaultFallbacks].filter(
    (m, idx, arr) => Boolean(m) && arr.indexOf(m) === idx && isModelAvailable(m)
  );

  for (const model of candidates) {
    try {
      const result = await fn(model);
      if (result !== null && result !== undefined) {
        return { result, usedModel: model };
      }
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isQuota =
        err?.status === 429 ||
        err?.code === 429 ||
        /quota|RESOURCE_EXHAUSTED|rate-limit|exceeded your current quota|429/i.test(errMsg);

      if (isQuota) {
        // Brief cooldown (8s) so per-minute rate limits recover quickly
        markModelQuotaExhausted(model, 8);
      } else if (err?.status === 404 || /not found|not supported/i.test(errMsg)) {
        // Model alias not available in this project/region; block for 10 mins and try next candidate
        markModelQuotaExhausted(model, 600);
      }
      continue;
    }
  }

  return { result: null };
}

// Panic detection regex from PRD Section 4.1 & 4.4
const PANIC_REGEX = /(can'?t\s+breathe|heart\s+pounding|hyperventilat|chest\s+pain|suffocat|going\s+to\s+pass\s+out|choking|dying\s+right\s+now)/i;

// Type 2 Meta-worry regex from PRD Section 1.1 & 4.4
const METAWORRY_REGEX = /(going\s+crazy|worry\s+will\s+kill\s+me|losing\s+control\s+of\s+my\s+mind|cannot\s+control\s+my\s+worrying|can'?t\s+stop\s+this\s+thinking|losing\s+my\s+mind)/i;

// Abstract indicators from PRD Section 2.1 & 3.2
const ABSTRACT_KEYWORDS = [
  'always', 'never', 'ruined', 'disaster', 'impossible', 'everything', 'nothing',
  'completely failed', 'everyone', 'catastrophe', 'terrible', 'hopeless', 'pointless',
  'mess', 'ruin', 'destroy', 'broken'
];

interface UnpackRequest {
  raw_worry_text: string;
  context?: string;
  timestamp_anchor?: string;
}

// Local fallback analysis if Gemini API is unavailable or returns an error
function localAnalysis(rawText: string, context: string = 'General') {
  const lower = rawText.toLowerCase();
  const panicDetected = PANIC_REGEX.test(rawText);
  const metaworryDetected = METAWORRY_REGEX.test(rawText);

  // Calculate abstractness index
  const words = lower.split(/\s+/).filter(Boolean);
  let matchedAbstractTerms: string[] = [];
  for (const kw of ABSTRACT_KEYWORDS) {
    if (lower.includes(kw)) {
      matchedAbstractTerms.push(kw);
    }
  }

  const abstractnessIndex = words.length > 0 ? Math.min(1.0, (matchedAbstractTerms.length * 2.5) / words.length) : 0;
  const isTooAbstract = abstractnessIndex > 0.35 || words.length < 4;

  // Split into manageable situational elements
  const sentences = rawText.split(/[.?!;\n]+/).map(s => s.trim()).filter(s => s.length > 3);
  const elements = sentences.length > 0 ? sentences.map((s, idx) => ({
    id: `item-${Date.now()}-${idx}`,
    description: s,
    initialSliderValue: s.toLowerCase().includes('i will') || s.toLowerCase().includes('i can') ? 0.75 : 0.25,
    suggestedCategory: (s.toLowerCase().includes('i will') || s.toLowerCase().includes('i can')) ? 'CONTROLLABLE' : 'UNCONTROLLABLE'
  })) : [
    {
      id: `item-${Date.now()}-0`,
      description: rawText,
      initialSliderValue: 0.3,
      suggestedCategory: 'UNCONTROLLABLE'
    }
  ];

  return {
    panicDetected,
    metaworryDetected,
    abstractnessIndex,
    isTooAbstract,
    matchedAbstractTerms,
    concreteFactSummary: `In the context of ${context}: User noted concern regarding "${rawText.slice(0, 150)}". Stripped of hyperbolic adjectives.`,
    sensoryGroundingSuggestions: [
      'Feel of feet grounded firmly on the floor',
      'Ambient sound in the room right now',
      'Contact of hands on the desk or chair',
      'Temperature of the air on skin'
    ],
    situationalElements: elements,
    defusionReframings: [
      {
        type: 'THOUGHT_OBSERVATION',
        framedThought: `You notice your mind is generating the thought that "${rawText.trim()}"`,
        metaphorPrompt: 'Observe this sentence as text appearing across a billboard, separate from who is reading it.'
      },
      {
        type: 'PASSENGERS_ON_BUS',
        framedThought: `An unruly passenger in the back row is shouting: "${rawText.trim()}"`,
        metaphorPrompt: 'You remain in the driver\'s seat. Passengers can shout, but they do not hold the steering wheel.'
      },
      {
        type: 'LEAVES_ON_STREAM',
        framedThought: `Placing this thought on a leaf and watching it float gently past: "${rawText.trim()}"`,
        metaphorPrompt: 'You do not need to push the leaf faster or jump into the water. Just watch it drift.'
      }
    ]
  };
}

// Endpoint 1: Deconstruct and unpack worry using Gemini 4 Hydrogen
const handleUnpack = async (req: Request, res: Response) => {
  try {
    const { raw_worry_text, context = 'General' } = req.body as UnpackRequest;

    if (!raw_worry_text || typeof raw_worry_text !== 'string') {
      res.status(400).json({ error: 'raw_worry_text is required' });
      return;
    }

    const fallback = localAnalysis(raw_worry_text, context);

    if (!aiClient) {
      res.json({ ...fallback, source: 'heuristics-engine' });
      return;
    }

    const prompt = `You are a clinical metacognitive assistant trained in Adrian Wells' Metacognitive Therapy (MCT), Thomas Borkovec's avoidance theory, and Acceptance and Commitment Therapy (ACT).
Analyze the following user's raw worry entry:
Context: "${context}"
Raw Worry Text: "${raw_worry_text}"

Perform:
1. Detect acute panic (e.g. shortness of breath, somatic terror, fainting fears).
2. Detect Type 2 Meta-Worry (e.g. fear of going crazy, losing mental control, worry causing illness).
3. Identify abstract, catastrophizing, or overgeneralized words (e.g., always, never, ruined, disaster, completely).
4. Calculate an abstractness_index (0.0 to 1.0).
5. Extract 2-4 concrete, verifiable situational sub-components stripped of subjective distortion, each with a proposed control_spectrum_slider_value (0.0 = totally uncontrollable external/future outcome, 1.0 = totally controllable direct personal behavioral action).
6. Provide an objective concrete_fact_summary.
7. Provide 3 cognitive defusion reframings (THOUGHT_OBSERVATION, PASSENGERS_ON_BUS, LEAVES_ON_STREAM).`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                panicDetected: { type: Type.BOOLEAN },
                metaworryDetected: { type: Type.BOOLEAN },
                abstractnessIndex: { type: Type.NUMBER },
                isTooAbstract: { type: Type.BOOLEAN },
                matchedAbstractTerms: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                concreteFactSummary: { type: Type.STRING },
                sensoryGroundingSuggestions: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                situationalElements: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      id: { type: Type.STRING },
                      description: { type: Type.STRING },
                      initialSliderValue: { type: Type.NUMBER },
                      suggestedCategory: { type: Type.STRING }
                    },
                    required: ['id', 'description', 'initialSliderValue', 'suggestedCategory']
                  }
                },
                defusionReframings: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      framedThought: { type: Type.STRING },
                      metaphorPrompt: { type: Type.STRING }
                    },
                    required: ['type', 'framedThought', 'metaphorPrompt']
                  }
                }
              },
              required: [
                'panicDetected',
                'metaworryDetected',
                'abstractnessIndex',
                'isTooAbstract',
                'matchedAbstractTerms',
                'concreteFactSummary',
                'sensoryGroundingSuggestions',
                'situationalElements',
                'defusionReframings'
              ]
            }
          }
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (result) {
      res.json({ ...result, source: usedModel || 'gemini' });
      return;
    }

    res.json({ ...fallback, source: 'clinical-fallback' });
  } catch (error) {
    const fallback = localAnalysis((req.body as any)?.raw_worry_text || '', 'General');
    res.json({ ...fallback, source: 'clinical-fallback' });
  }
};

app.post('/api/metacognitive/unpack', handleUnpack);
app.post('/api/unpack-worry', handleUnpack);

// Endpoint 2: Conversational AI Metacognitive Guide
app.post('/api/metacognitive/chat', async (req: Request, res: Response) => {
  try {
    const { messages, currentStep } = req.body;

    if (!Array.isArray(messages) || messages.length === 0) {
      res.status(400).json({ error: 'messages array is required' });
      return;
    }

    const defaultReply = "I hear you. Let's look at this objectively on the canvas. What is the single most verifiable fact of this situation right now?";

    if (!aiClient) {
      let reply = "I'm listening. As we map this on the canvas, let's step back from 'Object Mode' (treating the worry as direct urgent reality) into 'Metacognitive Mode' (observing the thought as a transient event in the mind). What is the concrete, verifiable physical fact in front of you right now?";
      if (currentStep === 1) {
        reply = "Let's strip away any catastrophic words. Can you specify: who specifically said or did what, where were you physically situated, and what time was it?";
      } else if (currentStep === 2) {
        reply = "Notice who is asking that question. You are the context holding the thought, not the thought itself. How does the thought feel when you preface it with 'I notice my mind having the thought that...'?";
      } else if (currentStep === 3) {
        reply = "Let's distinguish what is within your behavioral agency right now versus what belongs to the external world or future. Drag the control slider on the canvas for each element.";
      } else if (currentStep === 4) {
        reply = "We're forming an objective Implementation Intention: 'If [trigger], Then I will [action], until [external stop signal]'. Notice that the stop signal must be an external milestone, not a vague internal feeling of security.";
      }
      res.json({ reply, source: 'heuristics-engine' });
      return;
    }

    const systemInstruction = `You are an expert clinical Metacognitive Therapy (MCT) and Acceptance and Commitment Therapy (ACT) guide embedded in a desktop problem-framing web app.
Your goals:
- Help users shift from Object Mode (cognitive fusion) to Metacognitive Mode (cognitive defusion).
- Counteract Thomas Borkovec's avoidance theory by replacing abstract verbal rumination with concrete, sensory-grounded situational data.
- Help users distinguish Type 1 worry (external threats/somatic sensations) from Type 2 meta-worry (worrying about worrying, feeling thoughts are uncontrollable/dangerous).
- Keep responses concise, compassionate, grounded, and non-prescriptive.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: [
            ...messages.map((m: any) => ({
              role: m.role === 'assistant' ? 'model' : 'user',
              parts: [{ text: m.content }]
            }))
          ],
          config: {
            systemInstruction,
          }
        });
        return response.text;
      }
    );

    if (result) {
      res.json({ reply: result, source: usedModel || 'gemini' });
      return;
    }

    res.json({ reply: defaultReply, source: 'clinical-fallback' });
  } catch (error) {
    res.json({
      reply: "I hear you. Let's look at this objectively on the canvas. What is the single most verifiable fact of this situation right now?",
      source: 'clinical-fallback'
    });
  }
});

// Endpoint 3: AI Micro-Actions Generator (Path 1: Right Now)
app.post('/api/micro-actions', async (req: Request, res: Response) => {
  try {
    const { rootWorry, situation, context } = req.body;
    const fallbackActions = [
      {
        label: '🪞 Practice 1 key answer (5m)',
        action: 'Practice 1 answer or key sentence in front of the mirror',
        ifThenRule: `IF I notice anxiety about ${situation || rootWorry || 'this'}, THEN I will practice 1 key point out loud for 3 minutes.`
      },
      {
        label: '📝 Write 2 verifiable facts (3m)',
        action: 'Write down 2 concrete facts you know for certain right now',
        ifThenRule: `IF my mind starts spinning, THEN I will write down 2 observable facts on paper.`
      },
      {
        label: '🚶‍♂️ 2-min physical ground reset',
        action: 'Stand up, drop your shoulders, and drink a glass of water',
        ifThenRule: `IF my chest feels tight, THEN I will take a 2-minute water break and breathe slowly.`
      }
    ];

    if (!aiClient) {
      res.json({ microActions: fallbackActions, source: 'fallback' });
      return;
    }

    const prompt = `You are a clinical anxiety and metacognitive therapy engine.
User Worry: "${rootWorry}"
Situation/Event: "${situation}"
Context: "${context}"

Generate 3 tiny, ultra-concrete 2-5 minute micro-actions that the user can do RIGHT NOW to ground themselves and protect against their worry.
For each action, include a clear IF-THEN implementation intention rule.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                microActions: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      label: { type: Type.STRING },
                      action: { type: Type.STRING },
                      ifThenRule: { type: Type.STRING }
                    },
                    required: ['label', 'action', 'ifThenRule']
                  }
                }
              },
              required: ['microActions']
            }
          }
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (result && Array.isArray(result.microActions) && result.microActions.length > 0) {
      res.json({ microActions: result.microActions, source: usedModel || 'gemini' });
      return;
    }

    res.json({ microActions: fallbackActions, source: 'fallback' });
  } catch (error) {
    res.status(200).json({ microActions: [], source: 'fallback' });
  }
});

// Endpoint 4: AI Prioritiser Node (Path 3: I'm Stuck)
app.post('/api/prioritise', async (req: Request, res: Response) => {
  try {
    const { rootWorry, situation, mindStory, bestCase, worstCase, gutVote } = req.body;

    const fallbackPriorities = {
      topPriority: {
        action: `Write down 1 concrete story or defense against "${worstCase || 'freezing up'}" (5 mins).`,
        why: 'This directly shields against your worst-case fear while keeping effort minimal.'
      },
      secondary: {
        action: `Review what you already have in place once, then close the tab.`
      },
      letGo: {
        action: `Stop trying to control what other people think or predict the future. You cannot control that.`
      }
    };

    if (!aiClient) {
      res.json({ priorities: fallbackPriorities, source: 'fallback' });
      return;
    }

    const prompt = `You are a clinical decision & cognitive defusion prioritiser.
The user is stuck ruminating over a worry:
- Root Worry: "${rootWorry}"
- Specific Event/Situation: "${situation}"
- Mind's Scary Prediction: "${mindStory}"
- Best Case Outcome: "${bestCase}"
- Worst Case Outcome: "${worstCase}"
- Gut Intuition Vote: "${gutVote}"

Generate a clear 3-tier rational conclusion:
1. Top Priority (1 small task < 10 mins that protects directly against the worst case). Include a 1-sentence "why".
2. Secondary Task (only if they have energy left).
3. Low Priority / Let Go (things they cannot control and must let go of).`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                topPriority: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING },
                    why: { type: Type.STRING }
                  },
                  required: ['action', 'why']
                },
                secondary: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING }
                  },
                  required: ['action']
                },
                letGo: {
                  type: Type.OBJECT,
                  properties: {
                    action: { type: Type.STRING }
                  },
                  required: ['action']
                }
              },
              required: ['topPriority', 'secondary', 'letGo']
            }
          }
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (result && result.topPriority) {
      res.json({ priorities: result, source: usedModel || 'gemini' });
      return;
    }

    res.json({ priorities: fallbackPriorities, source: 'fallback' });
  } catch (error) {
    res.status(200).json({ priorities: {}, source: 'fallback' });
  }
});

// Endpoint 5: Positive Reframe Inquiry Generator (Node T3)
app.post('/api/positive-reframe', async (req: Request, res: Response) => {
  try {
    const { rootWorry, situation, context } = req.body;
    
    // Clean inputs for natural synthesis
    const cleanWorry = (rootWorry || '').replace(/^I worry about\s*/i, '').trim().replace(/\.+$/, '');
    const cleanSit = (situation || '').trim();
    const cleanContext = (context || 'Work').trim();

    // Fallback generator directly synthesizing the prior 3 nodes in second person
    const generateSimpleDefaults = () => {
      return [
        cleanSit 
          ? `Are you truly ${cleanWorry || 'falling short'}, or are you just comparing ${cleanSit} to an impossible standard?`
          : `Are you already good enough, or is your mind telling you to be perfect before you can feel calm in ${cleanContext.toLowerCase()}?`,
        `Are you actually ${cleanWorry || 'failing'}, or can you handle this one realistic step at a time?`,
        `Is this situation truly proof of ${cleanWorry || 'falling short'}, or is your mind overthinking ${cleanSit || cleanContext.toLowerCase()}?`
      ];
    };

    const defaultReframes = generateSimpleDefaults();
    const cacheKey = `reframe:v2:${cleanWorry.toLowerCase()}:${cleanSit.toLowerCase()}:${cleanContext.toLowerCase()}`;
    const cached = getCached<string[]>(cacheKey);
    if (cached && cached.length > 0) {
      res.json({ reframes: cached, source: 'cache' });
      return;
    }

    if (!aiClient) {
      res.json({ reframes: defaultReframes, source: 'fallback' });
      return;
    }

    const prompt = `You are a cognitive restructuring and decision worksheet guide.

User's prior 3 nodes:
1. Root Worry: "${rootWorry}"
2. Context: "${context || 'General'}"
3. Situation / Event: "${situation || 'General'}"

YOUR TASK:
Synthesize all 3 prior nodes into exactly 3 simple, human, SECOND-PERSON ("you" / "your") one-liner dilemma inquiry questions.

STRICT REQUIREMENTS:
1. LENGTH: Must be a single short sentence (under 16 words max).
2. SECOND PERSON ONLY: Address the user as "you" / "your" (NEVER use first-person "I" / "my").
3. TONE: Simple, everyday conversational English.
4. PATTERN: Frame as a clean, honest second-person dilemma directly comparing the fear against reality:
   "Are you truly unprepared for this, or is your mind just rehearsing worst-case scenarios?"
   or
   "Do you have to solve all of ${cleanSit || 'this'} tonight, or can you take one calm step in ${cleanContext}?"

Return JSON with a "reframes" array containing 3 short, punchy second-person string questions.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                reframes: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ['reframes']
            }
          }
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (result && Array.isArray(result.reframes) && result.reframes.length > 0) {
      setCache(cacheKey, result.reframes);
      res.json({
        reframes: result.reframes,
        source: usedModel || 'gemini'
      });
      return;
    }

    setCache(cacheKey, defaultReframes);
    res.json({ reframes: defaultReframes, source: 'clinical-heuristics' });
  } catch (error) {
    res.json({
      reframes: [
        "Are you already capable of handling this, or is your mind demanding perfection first?",
        "Are you truly unprepared, or is your mind just overthinking this moment?",
        "Can you take one calm, realistic step forward right now?"
      ],
      source: 'fallback'
    });
  }
});

// Endpoint 6: PRD v1.0 Adaptive Node Question & Quick-Chips Generator
app.post('/api/generate-node-question', async (req: Request, res: Response) => {
  try {
    const { stepId, rootWorry, category, situationEvent, mindStory, pathway, previousAnswers } = req.body;

    const localDefaults: Record<string, { question: string; chips: string[]; helper: string }> = {
      'situation': {
        question: 'What happened?',
        chips: ['Critique on work', 'Deadline moved up', 'Tough conversation', 'Unexpected bad news'],
        helper: 'What happened in 2-3 words?'
      },
      'fear': {
        question: "What's the fear?",
        chips: ['I might fail', 'Everyone will judge', 'I will freeze', 'I lose everything'],
        helper: 'What scary thought is mind making?'
      },
      'influence': {
        question: 'What to influence?',
        chips: ['My own breathing', 'How I respond', 'My attitude', 'My rest tonight'],
        helper: 'Focus on your own sphere'
      },
      'helps_now': {
        question: 'What helps now?',
        chips: ['Step away 10 mins', 'Drink water & breathe', 'Listen to music', 'Call trusted friend'],
        helper: 'Immediate somatic grounding'
      },
      'revisit': {
        question: 'Revisit when?',
        chips: ['Tomorrow morning', 'Friday at 4 PM', 'After next standup', 'Next Monday'],
        helper: 'Set a worry parking window'
      },
      'changeable': {
        question: 'What to change?',
        chips: ['My draft notes', 'My tone of voice', 'The project schedule', 'My preparation'],
        helper: 'What is directly within agency?'
      },
      'action': {
        question: 'What to do?',
        chips: ['Draft 3 key points', 'Send clarification email', 'Rehearse slide 1', 'Ask teammate feedback'],
        helper: 'One concrete task'
      },
      'timing': {
        question: 'When to act?',
        chips: ['Right now 10 mins', 'Today by 2 PM', 'Tomorrow 9 AM', 'Before next review'],
        helper: 'Specific time anchor'
      },
      'next_step': {
        question: 'First tiny step?',
        chips: ['Open notebook', 'Write 1 sentence', 'Set 5-min timer', 'Send single message'],
        helper: 'Under 2 minutes effort'
      },
      'decision_facing': {
        question: 'What decision?',
        chips: ['Push forward or wait', 'Ask for help or solo', 'Decline or accept', 'Re-do or submit as-is'],
        helper: 'State the fork in the road'
      },
      'best_case': {
        question: 'What goes right?',
        chips: ['It succeeds smoothly', 'They appreciate effort', 'I learn and grow', 'Relief and clarity'],
        helper: 'Best possible outcome'
      },
      'worst_case': {
        question: 'What goes wrong?',
        chips: ['Temporary awkwardness', 'Have to revise again', 'Mild disappointment', 'Uncomfortable feedback'],
        helper: 'Worst possible realistic case'
      },
      'gut_feeling': {
        question: 'How you feel?',
        chips: ['Quietly confident', 'Tired but willing', 'Hesitant and cautious', 'Ready to move on'],
        helper: 'Your intuitive gut read'
      },
      'intuitive_conclusion': {
        question: 'Instinct says?',
        chips: ['Trust your preparation', 'Keep it simple', 'Ask before deciding', 'Take the leap'],
        helper: 'Fast instinctive verdict'
      },
      'rational_conclusion': {
        question: 'Evidence says?',
        chips: ['Facts support moving ahead', 'Wait for key info', 'Break into two phases', 'Risk is manageable'],
        helper: 'Verifiable objective verdict'
      },
      'the_decision': {
        question: 'Your decision?',
        chips: ['Proceed with plan', 'Pause until tomorrow', 'Choose option A', 'Simplify scope'],
        helper: 'Your clear chosen path'
      },
      'decision_next_step': {
        question: 'First step now?',
        chips: ['Write 1 paragraph', 'Schedule 15m review', 'Send 1 email', 'Close laptop & rest'],
        helper: 'Action to lock in decision'
      }
    };

    const defaultItem = localDefaults[stepId] || {
      question: 'What next?',
      chips: ['Take 1 small step', 'Pause and breathe', 'Write 1 point', 'Revisit later'],
      helper: 'Keep answer under 5 words'
    };

    if (!aiClient) {
      res.json(defaultItem);
      return;
    }

    const prompt = `You are the adaptive questioning engine for a worry-mapping and decision worksheet app.
Rules:
1. Question MUST be exactly 2 to 3 words long (maximum 5 words if essential for grammatical sense).
2. Chips MUST be 3 to 4 quick answer suggestions (each 2 to 4 words maximum).
3. Do NOT talk like a chatbot. Output only structured JSON.

User context:
- Worry: "${rootWorry || ''}"
- Category: "${category || ''}"
- Event/Situation: "${situationEvent || ''}"
- Fear: "${mindStory || ''}"
- Current Step: "${stepId}"
- Pathway: "${pathway || ''}"
- Previous answers: ${JSON.stringify(previousAnswers || {})}`;

    const { result } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await aiClient!.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                chips: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                helper: { type: Type.STRING }
              },
              required: ['question', 'chips', 'helper']
            }
          }
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (result) {
      res.json({
        question: result.question || defaultItem.question,
        chips: Array.isArray(result.chips) && result.chips.length > 0 ? result.chips : defaultItem.chips,
        helper: result.helper || defaultItem.helper,
      });
      return;
    }

    res.json(defaultItem);
  } catch (error) {
    res.json({
      question: 'What next?',
      chips: ['Take 1 small step', 'Pause and breathe', 'Write 1 point', 'Revisit later'],
      helper: 'Keep answer under 5 words'
    });
  }
});


// Endpoint 7: AI Contextual Worry Trio Suggestions (What? How? When?) + AI Second-Person Perspectives + AI Auto-Detected Context
interface ReaffirmationItem {
  quote: string;
  sub: string;
}

type GentleContextCategory =
  | 'General'
  | 'Work'
  | 'Health'
  | 'Relationships'
  | 'Finances'
  | 'Personal Growth';

const VALID_CATEGORIES: GentleContextCategory[] = [
  'General',
  'Work',
  'Health',
  'Relationships',
  'Finances',
  'Personal Growth',
];

function normalizeDetectedCategory(rawCat: string | undefined, fallbackCat: GentleContextCategory = 'General'): GentleContextCategory {
  if (!rawCat) return fallbackCat;
  const lower = rawCat.trim().toLowerCase();
  if (lower === 'social' || lower === 'family' || lower === 'love' || lower === 'home') return 'Relationships';
  if (lower === 'money' || lower === 'financial' || lower === 'finance') return 'Finances';
  if (lower === 'school' || lower === 'education' || lower === 'career' || lower === 'academic') return 'Work';
  if (lower === 'body' || lower === 'fitness' || lower === 'medical' || lower === 'wellness' || lower === 'mental health') return 'Health';
  if (lower === 'self' || lower === 'growth' || lower === 'mindset' || lower === 'life' || lower === 'status' || lower === 'lifestyle') return 'Personal Growth';
  const matched = VALID_CATEGORIES.find((c) => c.toLowerCase() === lower);
  return matched || fallbackCat;
}

function detectLocalWorryCategory(rootWorry: string, currentCat: string = 'General'): GentleContextCategory {
  const text = (rootWorry || '').toLowerCase().trim();
  if (!text) return normalizeDetectedCategory(currentCat, 'General');

  const scores: Record<Exclude<GentleContextCategory, 'General'>, number> = {
    Health: 0,
    Relationships: 0,
    Finances: 0,
    Work: 0,
    'Personal Growth': 0,
  };

  if (/weight\s*(gain|loss)|gaining\s*weight|losing\s*weight|body\s*image|out\s*of\s*shape|blood\s*pressure|hair\s*loss|back\s*pain|chest\s*pain|mental\s*health|panic\s*attack/i.test(text)) {
    scores.Health += 4;
  }
  if (/fights?\s+in\s+(the\s+)?house|at\s+home|mad\s+at\s+me|left\s+out|no\s+friends|break\s*up|relationship|family\s+tension/i.test(text)) {
    scores.Relationships += 4;
  }
  if (/lifestyle|status|social\s+status|good\s+life|society|expectations|pressure\s+to|peer\s+pressure|comparing\s+myself|keep\s+up\s+with|what\s+people\s+think|reputation|prestig|self[- ]worth|indecis|overthink|procrastinat|falling\s+behind/i.test(text)) {
    scores['Personal Growth'] += 4;
  }
  if (/can'?t\s+afford|cost\s+of\s+living|credit\s+card|bank\s+account|student\s+loan|pay\s+rent|pay\s+bills|unnecessary\s+expense|budget\s+room/i.test(text)) {
    scores.Finances += 4;
  }
  if (/job\s+interview|laid\s+off|work\s+deadline|final\s+exam|boss\s+is|performance\s+review/i.test(text)) {
    scores.Work += 4;
  }

  const healthTerms = text.match(
    /\b(weight|gain|gaining|overweight|underweight|bmi|fat|chubby|skinny|thin|calories|calorie|diet|dieting|binge|eating|appetite|food|sugar|carbs|metabolism|bloated|bloating|body|physique|shape|workout|gym|exercise|exercising|fitness|cardio|running|sedentary|sleep|sleeping|insomnia|oversleep|tired|exhausted|exhaustion|fatigue|drained|pain|ache|aching|sore|hurt|injury|injured|headache|migraine|stomach|nausea|dizzy|fever|flu|cold|cough|virus|infection|allergy|asthma|breathing|heart|cholesterol|diabetes|thyroid|hormone|period|cramps|pregnancy|pregnant|cancer|surgery|hospital|clinic|doctor|dentist|tooth|vision|eyes|hearing|skin|acne|rash|eczema|hair|balding|aging|knee|joint|muscle|medication|medicine|pills|checkup|diagnosis|scan|therapy|therapist|depression|depressed|panic|ptsd|adhd|health|healthy|unhealthy|sick|illness|symptom|symptoms|energy)\b/gi
  );
  if (healthTerms) scores.Health += healthTerms.length * 2;

  const relationshipTerms = text.match(
    /\b(fight|fights|fighting|fought|argue|arguing|argument|arguments|quarrel|yell|yelling|shout|shouting|conflict|tension|angry|upset|house|household|home|roommate|roommates|neighbor|family|parents|parent|mom|mother|dad|father|sister|brother|sibling|son|daughter|kids|child|children|baby|partner|spouse|husband|wife|boyfriend|girlfriend|fiance|ex|crush|date|dating|relationship|relationships|marriage|married|divorce|breakup|cheating|betrayal|jealous|jealousy|trust|ghosted|ignored|ignoring|friend|friends|friendship|social|awkward|lonely|loneliness|alone|isolated|excluded|rejected|rejection|abandon|boundaries|toxic|apologize|love)\b/gi
  );
  if (relationshipTerms) scores.Relationships += relationshipTerms.length * 2;

  const financeTerms = text.match(
    /\b(money|finance|finances|financial|bill|bills|rent|mortgage|lease|utilities|budget|budgeting|debt|debts|loan|loans|credit|interest|afford|affording|saving|savings|retirement|invest|investing|investment|stocks|crypto|expense|expenses|spending|overspending|bank|overdraft|balance|cost|costs|inflation|price|prices|expensive|broke|poor|bankrupt|paycheck|payday|salary|wage|income|tax|taxes|tuition|fee|fees|fine|insurance|refund|wealth|rich)\b/gi
  );
  if (financeTerms) scores.Finances += financeTerms.length * 2;

  const workTerms = text.match(
    /\b(work|working|job|jobs|career|profession|office|workplace|company|startup|business|boss|manager|supervisor|coworker|coworkers|colleague|team|client|clients|customer|interview|interviews|resume|cv|hiring|hired|fired|layoff|layoffs|unemployed|quit|quitting|resign|promotion|raise|deadline|deadlines|project|projects|task|tasks|deliverable|presentation|pitch|slides|demo|meeting|meetings|standup|slack|email|emails|inbox|report|code|coding|deployment|launch|workload|overtime|shift|commute|school|college|university|campus|degree|major|class|classes|course|lecture|professor|teacher|student|exam|exams|midterm|test|quiz|study|studying|homework|assignment|essay|thesis|research|grade|grades|gpa|scholarship|internship)\b/gi
  );
  if (workTerms) scores.Work += workTerms.length * 2;

  const growthTerms = text.match(
    /\b(lifestyle|status|prestige|prestigious|reputation|image|expectations|expectation|pressure|pressured|society|standards|standard|comparison|comparing|compare|judged|judging|impress|proving|success|successful|ambition|ambitious|indecisive|indecision|decide|deciding|decision|decisions|choose|choosing|choice|choices|option|options|torn|unsure|uncertain|uncertainty|dilemma|hesitate|hesitating|doubt|doubting|overthink|overthinking|ruminate|ruminating|spiral|spiraling|looping|procrastinate|procrastinating|procrastination|avoid|avoiding|stuck|unmotivated|motivation|lazy|laziness|discipline|willpower|focus|distracted|overwhelmed|overwhelm|burnout|stressed|stress|future|direction|purpose|meaning|falling|behind|lost|mistake|mistakes|regret|regrets|guilt|guilty|embarrassed|shame|ashamed|failure|failing|failed|imposter|inadequate|insecure|insecurity|confidence|perfectionism|perfectionist|habit|habits|routine|goal|goals|growth|improvement|change|changing|identity|potential|wasting)\b/gi
  );
  if (growthTerms) scores['Personal Growth'] += growthTerms.length * 2;

  let bestCat: GentleContextCategory = 'General';
  let bestScore = 0;
  for (const [catName, score] of Object.entries(scores) as Array<[Exclude<GentleContextCategory, 'General'>, number]>) {
    if (score > bestScore) {
      bestScore = score;
      bestCat = catName;
    }
  }

  if (bestScore > 0) {
    return bestCat;
  }

  return 'General';
}

function extractCleanTopic(raw: string): string {
  const cleaned = raw
    .replace(/^(the\s+)?(fear|worry|anxiety|feeling|stress|pressure)\s+(of|about|that|over|around)\s+/i, '')
    .replace(/^i\s+(am\s+|feel\s+|have\s+to\s+|need\s+to\s+|want\s+to\s+|can'?t\s+)?(worried|worrying|anxious|scared|afraid|stressed|trying\s+to)?\s*(about|of|that|to)?\s*/i, '')
    .replace(/\bmy\b/gi, 'your')
    .replace(/\bmyself\b/gi, 'yourself')
    .replace(/[.?!]+$/, '')
    .trim();
  if (!cleaned) return 'this situation';
  const words = cleaned.split(/\s+/);
  const shortPhrase = words.length > 6 ? words.slice(0, 6).join(' ') : cleaned;
  return shortPhrase.toLowerCase();
}

// Converts any accidental first-person phrasing in a reframe quote into second-person ("you" / "your")
function ensureSecondPersonQuote(rawQuote: string): string {
  let q = rawQuote.trim().replace(/^["“”']+/, '').replace(/["“”']+$/, '');
  q = q
    .replace(/\bAm I\b/g, 'Are you')
    .replace(/\bam I\b/g, 'are you')
    .replace(/\bDo I\b/g, 'Do you')
    .replace(/\bdo I\b/g, 'do you')
    .replace(/\bCan I\b/g, 'Can you')
    .replace(/\bcan I\b/g, 'can you')
    .replace(/\bWill I\b/g, 'Will you')
    .replace(/\bwill I\b/g, 'will you')
    .replace(/\bShould I\b/g, 'Should you')
    .replace(/\bshould I\b/g, 'should you')
    .replace(/\bHave I\b/g, 'Have you')
    .replace(/\bhave I\b/g, 'have you')
    .replace(/\bI am\b/g, 'you are')
    .replace(/\bI'm\b/g, "you're")
    .replace(/\bI’m\b/g, 'you’re')
    .replace(/\bI have\b/g, 'you have')
    .replace(/\bI need\b/g, 'you need')
    .replace(/\bI can\b/g, 'you can')
    .replace(/\bI will\b/g, 'you will')
    .replace(/\bI feel\b/g, 'you feel')
    .replace(/\bI think\b/g, 'you think')
    .replace(/\bI\b/g, 'you')
    .replace(/\bMy\b/g, 'Your')
    .replace(/\bmy\b/g, 'your')
    .replace(/\bMyself\b/g, 'Yourself')
    .replace(/\bmyself\b/g, 'yourself')
    .replace(/\bme\b/g, 'you');
  if (q.length > 0) {
    q = q.charAt(0).toUpperCase() + q.slice(1);
  }
  return `“${q}”`;
}

function hashWorryString(str: string): number {
  let hash = 0;
  const clean = str.trim().toLowerCase();
  for (let i = 0; i < clean.length; i++) {
    hash = (hash * 31 + clean.charCodeAt(i)) >>> 0;
  }
  return hash;
}

// Extracts a constructive, positive subject from a worry (strips negative prefixes like "not getting", "can't find", "failing")
function extractConstructiveSubject(raw: string): string {
  const cleaned = raw
    .replace(/^(the\s+)?(fear|worry|anxiety|feeling|stress|pressure|thought)\s+(of|about|that|over|around)\s+/i, '')
    .replace(/^i\s+(am\s+|feel\s+|have\s+to\s+|need\s+to\s+|want\s+to\s+|can'?t\s+)?(worried|worrying|anxious|scared|afraid|stressed|trying\s+to|struggling\s+to)?\s*(about|of|that|to|with)?\s*/i, '')
    .replace(/^(not\s+(getting|finding|having|landing|passing|making|being\s+able\s+to|knowing\s+how\s+to)|can'?t\s+(get|find|land|pass|make|do|finish|start|handle|stop)|unable\s+to\s+(get|find|land|pass|do|finish|start)|failing\s+(to\s+|at\s+|in\s+)?|losing\s+|missing\s+|lack\s+of\s+|having\s+no\s+|no\s+)/i, '')
    .replace(/\b(a|an|the|my|your|our|some|any)\b/gi, ' ')
    .replace(/[.?!,;]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

  if (!cleaned || /^(it|this|that|everything|anything|nothing|something)$/i.test(cleaned)) {
    return '';
  }
  const words = cleaned.split(/\s+/).filter(Boolean);
  return words.slice(0, 3).join(' ');
}

function isMalformedActionChip(chip: string): boolean {
  const lower = chip.trim().toLowerCase();
  if (!lower || lower.length < 4) return true;
  // Reject broken negative fragments like "for not getting", "on not getting", "for can't", "of failing"
  return /\b(for|on|of|about)\s+(not\b|no\b|can'?t\b|cannot\b|never\b|unable\b|failing\b|being\b|having\b)/i.test(
    lower
  );
}

function deduplicateAndRotateSessionItems(
  candidate: {
    detectedCategory: GentleContextCategory;
    what: string[];
    how: string[];
    when: string[];
    reaffirmations: ReaffirmationItem[];
  },
  rawWorry: string,
  excludeWhat: string[] = [],
  excludeQuotes: string[] = []
) {
  const topic = extractCleanTopic(rawWorry);
  const constructiveGoal = extractConstructiveSubject(rawWorry);

  const dynamicReframe: ReaffirmationItem = {
    quote: `“Do you need to have ${topic} completely figured out right now, or can you handle one small piece calmly first?”`,
    sub: `You do not have to solve every detail of ${topic} in a single sitting—one grounded step today is enough.`,
  };

  const excludeQuoteSet = new Set(excludeQuotes.map((q) => q.trim().toLowerCase()));
  const excludeWhatSet = new Set(excludeWhat.map((w) => w.trim().toLowerCase()));

  const secondPersonReaffirmations = candidate.reaffirmations.map((r) => ({
    quote: ensureSecondPersonQuote(r.quote),
    sub: r.sub,
  }));

  let filteredReaffirmations = secondPersonReaffirmations.filter(
    (r) => !excludeQuoteSet.has(r.quote.trim().toLowerCase())
  );

  const hash = hashWorryString(rawWorry);
  if (filteredReaffirmations.length === 0) {
    filteredReaffirmations = [dynamicReframe, ...secondPersonReaffirmations];
  } else if (
    excludeQuoteSet.size > 0 &&
    secondPersonReaffirmations[0] &&
    excludeQuoteSet.has(secondPersonReaffirmations[0].quote.trim().toLowerCase())
  ) {
    filteredReaffirmations = [dynamicReframe, ...filteredReaffirmations];
  } else if (rawWorry.trim().length > 0 && filteredReaffirmations.length > 1) {
    const startIdx = hash % filteredReaffirmations.length;
    filteredReaffirmations = [
      ...filteredReaffirmations.slice(startIdx),
      ...filteredReaffirmations.slice(0, startIdx),
    ];
  }

  let filteredWhat = candidate.what
    .filter((w) => !isMalformedActionChip(w))
    .filter((w) => !excludeWhatSet.has(w.trim().toLowerCase()));

  if (filteredWhat.length < 4) {
    const constructiveBackupPool = constructiveGoal
      ? [
          `prepare 1 part of ${constructiveGoal}`,
          `list 2 options for ${constructiveGoal}`,
          `15m focus on ${constructiveGoal}`,
          `ask 1 tip on ${constructiveGoal}`,
        ]
      : [
          'write 2 concrete options',
          'do 15 mins focused prep',
          'pick 1 controllable piece',
          'ask 1 trusted person',
        ];
    for (const item of constructiveBackupPool) {
      if (
        !isMalformedActionChip(item) &&
        !excludeWhatSet.has(item.toLowerCase()) &&
        !filteredWhat.includes(item)
      ) {
        filteredWhat.push(item);
      }
    }
  }

  return {
    detectedCategory: candidate.detectedCategory,
    what: filteredWhat.slice(0, 4),
    how: candidate.how.slice(0, 3),
    when: candidate.when.slice(0, 3),
    reaffirmations: filteredReaffirmations.slice(0, 4),
  };
}

function buildContextualFallbackSuggestions(
  rootWorry: string,
  category: string = 'General',
  excludeWhat: string[] = [],
  excludeQuotes: string[] = []
): {
  detectedCategory: GentleContextCategory;
  what: string[];
  how: string[];
  when: string[];
  reaffirmations: ReaffirmationItem[];
} {
  const raw = (rootWorry || '').trim();
  const text = raw.toLowerCase();
  const detectedCategory = detectLocalWorryCategory(raw, category);
  const displayTopic = extractCleanTopic(raw);
  const constructiveSubject = extractConstructiveSubject(raw);

  const finalize = (res: {
    detectedCategory: GentleContextCategory;
    what: string[];
    how: string[];
    when: string[];
    reaffirmations: ReaffirmationItem[];
  }) => deduplicateAndRotateSessionItems(res, raw, excludeWhat, excludeQuotes);

  // 1. Job Search / Fresher / Getting a Job / Placement / Unemployment / Resume / Career Entry
  if (
    /\b(fresher|not\s+getting\s+(a\s+|any\s+)?(job|role|offer|work|placement|internship)|can'?t\s+(find|get|land)\s+(a\s+)?(job|role|work|internship)|no\s+job|unemploy|job\s*hunt|job\s*search|looking\s+for\s+(a\s+)?job|apply(ing)?\s+for\s+jobs?|placement|campus\s+drive|career\s+start|entry[- ]level|resume|cv|job\s+market|hiring|job\s+application|job\s+opening|getting\s+hired|\bjob\b)\b/i.test(
      text
    )
  ) {
    const isFresher = /\b(fresher|campus|entry[- ]level|graduate|first\s+job|college|internship|placement)\b/i.test(text);
    return finalize({
      detectedCategory: 'Work',
      what: isFresher
        ? [
            'tailor 1 fresher resume',
            'apply to 2 entry roles',
            'practice 1 intro answer',
            'message 1 alum for tips',
            'build 1 mini portfolio item',
          ]
        : [
            'update 1 resume section',
            'apply to 2 matching roles',
            'practice 1 interview story',
            'reach out to 1 contact',
            'shortlist 3 target roles',
          ],
      how: ['one role at a time', '25-min focused block', 'without comparing timelines'],
      when: ['right now', 'this afternoon', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: isFresher
            ? '“Does waiting for your first job offer mean you lack talent, or are you still on the path to your first match?”'
            : '“Does a slow job search erase your capability, or does it just mean you have not met the right team yet?”',
          sub: 'Every career starts with one door opening—refining one resume section or applying to two roles today is real progress.',
        },
        {
          quote: '“Do you need to solve your entire career tonight, or just take one calm step in your job search today?”',
          sub: 'You cannot control hiring timelines, but you can control twenty focused minutes on your resume or skills right now.',
        },
        {
          quote: '“Are unanswered applications a verdict on your worth, or just a normal numbers game before your first yes?”',
          sub: 'You only need one offer to begin—treat yourself kindly and focus on one thoughtful application at a time.',
        },
        {
          quote: '“What if you focused on two quality applications today and gave yourself permission to rest afterward?”',
          sub: 'Steady, calm daily effort will carry you further than exhausting yourself with worry.',
        },
      ],
    });
  }

  // 2. Job Interview / Technical Round / Coding Test / Viva / Pitch
  if (
    /\b(interview|interviews|technical\s+round|coding\s+round|coding\s+test|hr\s+round|mock\s+interview|recruiter\s+call|pitch|demo|viva|assessment)\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Work',
      what: [
        'rehearse 2 key stories',
        'review 3 common questions',
        'write 2 questions to ask',
        'do 1 5-min mock answer',
      ],
      how: ['speaking slowly out loud', 'bullet points only', 'calmly with water'],
      when: ['in 10 mins', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Are you truly unprepared for this interview, or is your mind just rehearsing worst-case scenarios?”',
          sub: 'Reviewing two honest examples of your work and speaking slowly will ground your confidence when you begin.',
        },
        {
          quote: '“Do you need to memorize every possible answer, or just show how you think clearly and honestly?”',
          sub: 'Interviewers connect with genuine problem-solving, not robotic perfection—one calm breath before speaking is enough.',
        },
      ],
    });
  }

  // 3. Exams / Studying / Grades / Academic / Thesis / Failing a Class
  if (
    /\b(exam|exams|midterm|finals?|quiz|test|syllabus|study|studying|revision|chapter|lecture|grade|grades|gpa|semester|assignment|homework|essay|thesis|dissertation|paper|failing\s+(my\s+)?(class|course|exam|test))\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Work',
      what: [
        'study 1 core topic now',
        'solve 3 practice questions',
        'summarize 1 page of notes',
        'review 1 weak concept',
      ],
      how: ['25-min study timer', 'phone in another room', 'one chapter at a time'],
      when: ['right now', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Do you have to master the entire syllabus in one hour, or can you learn one core topic right now?”',
          sub: 'Studying one focused section for twenty-five minutes builds real retention and quiets exam panic.',
        },
        {
          quote: '“Does feeling overwhelmed by this exam mean you will fail, or does your mind just need a smaller starting point?”',
          sub: 'Open your notes to a single page, set a short timer, and let momentum build naturally.',
        },
      ],
    });
  }

  // 4. Work Deadlines / Boss / Workload / Projects / Layoffs
  if (
    /\b(deadline|workload|backlog|project|client|boss|manager|coworker|colleague|standup|meeting|email|inbox|report|deliverable|presentation|slides|promotion|performance\s+review|laid\s+off|layoff|fired)\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Work',
      what: [
        'list top 2 priorities',
        'draft rough first version',
        'send 1 clear status note',
        'do 15m on first section',
      ],
      how: ['rough draft first', '15-min focus block', 'one task at a time'],
      when: ['right now', 'in 15 mins', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Do you have to finish the entire workload perfectly right now, or just complete the first rough piece?”',
          sub: 'Starting with an imperfect 15-minute draft breaks the paralysis and puts you back in control.',
        },
        {
          quote: '“Does this single work pressure define your worth, or is it one task you can handle step by step?”',
          sub: 'Pick the single most important item, give it fifteen calm minutes, and let the rest wait its turn.',
        },
      ],
    });
  }

  // 5. Housing / Room Hunt / Apartment Search
  if (
    /\b(room\s*hunt|house\s*hunt|apartment|flat|studio|housing|landlord|sublet|neighborhood|viewing|listings?|roommate\s*search|place\s+to\s+live|find\s+a\s+(room|place|flat|apartment)|rent\s+a\s+(room|place|flat|apartment))\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: /budget|rent|afford|cost|cheap|price|money|deposit/i.test(text) ? 'Finances' : 'Personal Growth',
      what: ['set max rent cap', 'list 3 room must-haves', 'message 2 listings', 'book 1 room viewing'],
      how: ['within your rent cap', 'one listing at a time', 'comparing calmly'],
      when: ['this evening', 'tomorrow morning', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Do you have to find the perfect room tonight, or just shortlist two safe, affordable options first?”',
          sub: 'Finding the right space is a step-by-step search—sending two messages or booking one viewing today is real progress.',
        },
        {
          quote: '“Will rushing out of fear help your room hunt, or can you filter calmly by your budget and top three needs?”',
          sub: 'Setting a clear rent ceiling and three non-negotiables protects both your wallet and your peace of mind.',
        },
      ],
    });
  }

  // 6. Impulse Spending / Cravings to Spend / Unnecessary Expenses
  if (
    /\b(craving|impulse|unnecessary\s+expense|unnecessary\s+spend|overspend|shopping|splurg|temptation|control\s+my\s+(craving|spending|expense)|stop\s+buying|spending\s+habit)\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Finances',
      what: ['wait 24h before buying', 'remove saved card', 'move $10 to savings', 'write 1 true need'],
      how: ['24-hour pause rule', 'without self-blame', 'one urge at a time'],
      when: ['right now', 'before checkout', 'for 24 hours'],
      reaffirmations: [
        {
          quote: '“Is this craving asking for another purchase, or is your mind just looking for a quick moment of comfort?”',
          sub: 'Pausing for twenty-four hours lets the wave of impulse pass while keeping your financial goals gently intact.',
        },
        {
          quote: '“Does feeling an urge to spend mean you lack discipline, or is noticing it right now proof of self-awareness?”',
          sub: 'Every time you pause between a craving and a checkout button, you build real freedom and self-trust.',
        },
      ],
    });
  }

  // 7. General Finances / Bills / Debt / Money / Budget
  if (
    /\b(money|finance|finances|financial|bill|bills|rent|mortgage|budget|debt|loan|credit\s+card|afford|saving|savings|expense|expenses|bank|balance|broke|paycheck|salary|income|tax|tuition|fee|fees)\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Finances',
      what: [
        'check 1 account balance',
        'list 3 upcoming bills',
        'set 1 weekly spend limit',
        'pause 1 unused subscription',
      ],
      how: ['just the numbers', 'calmly with tea', 'one item at a time'],
      when: ['this evening', 'tomorrow morning', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Will panicking tonight change the numbers, or can you look at one practical piece calmly?”',
          sub: 'Your worth as a person is never measured by a balance sheet—facing one small number today builds clarity.',
        },
        {
          quote: '“Do you need to solve every financial goal this week, or just plan your next seven days of spending?”',
          sub: 'One clear weekly plan is enough to steady your footing right now.',
        },
      ],
    });
  }

  // 8. Sleep / Insomnia / Tiredness / Exhaustion / Burnout
  if (
    /\b(sleep|sleeping|insomnia|awake|oversleep|tired|exhausted|exhaustion|fatigue|drained|burnout|rest)\b/i.test(
      text
    )
  ) {
    return finalize({
      detectedCategory: 'Health',
      what: [
        'put screens away 20m',
        'do 5 slow belly breaths',
        'write tomorrow worries down',
        'sip warm water calmly',
      ],
      how: ['lights dimmed low', 'phone face down', 'without forcing sleep'],
      when: ['right now', 'tonight before bed', 'for 15 mins'],
      reaffirmations: [
        {
          quote: '“Will forcing yourself to sleep make rest come faster, or can you let your body simply rest quietly?”',
          sub: 'Even resting with your eyes closed and breathing slowly restores your nervous system.',
        },
      ],
    });
  }

  // 9. Health / Body / Weight / Fitness / Medical
  if (detectedCategory === 'Health') {
    return finalize({
      detectedCategory: 'Health',
      what: [
        'take a 15-min gentle walk',
        'drink 1 glass of water',
        'prep 1 nourishing meal',
        'book 1 checkup or rest',
      ],
      how: ['kindly to your body', 'at an easy pace', 'one habit today'],
      when: ['right now', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Will harsh worry heal your body faster, or does your body need steady, gentle care today?”',
          sub: 'One small supportive choice today does far more for your wellbeing than hours of self-criticism.',
        },
      ],
    });
  }

  // 10. Relationships / Family / Partner / Breakup / Friends / Loneliness
  if (detectedCategory === 'Relationships') {
    return finalize({
      detectedCategory: 'Relationships',
      what: [
        'write unsent thoughts first',
        'send 1 calm honest message',
        'ask for a 10-min talk',
        'take 30m quiet space',
      ],
      how: ['with calm "I" statements', 'listening without rush', 'with kind boundaries'],
      when: ['once things cool', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Do you have to fix this entire relationship tonight, or can you hold your part with calm boundaries?”',
          sub: 'Giving both yourself and the other person a little breathing room allows honest clarity to return.',
        },
      ],
    });
  }

  // 11. Personal Growth / Overthinking / Procrastination / Comparison / Future
  if (detectedCategory === 'Personal Growth') {
    return finalize({
      detectedCategory: 'Personal Growth',
      what: constructiveSubject
        ? [
            `do 10m on ${constructiveSubject}`,
            `list 2 steps for ${constructiveSubject}`,
            'write 1 controllable fact',
            'put phone away for 20m',
          ]
        : [
            'do just 5 mins of starter work',
            'write 2 pros and cons',
            'pick 1 small priority today',
            'step away from comparisons',
          ],
      how: ['imperfectly on purpose', '10-min starter timer', 'without comparing timelines'],
      when: ['right now', 'in 10 mins', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Are you truly falling behind, or are you just comparing your own chapter to someone else’s timeline?”',
          sub: 'You do not need perfection before you begin—one small, honest step today is enough.',
        },
      ],
    });
  }

  // 12. Constructive Goal Fallback for any other custom worry (never slices negative words like "not getting")
  return finalize({
    detectedCategory,
    what: constructiveSubject
      ? [
          `list 2 options for ${constructiveSubject}`,
          `do 15m prep on ${constructiveSubject}`,
          `take 1 step toward ${constructiveSubject}`,
          `ask 1 tip on ${constructiveSubject}`,
        ]
      : [
          'write 2 concrete options',
          'pick 1 controllable step',
          'do 10m focused prep',
          'ask 1 person for input',
        ],
    how: ['one small piece', '15-min calm block', 'without perfection'],
    when: ['in 10 mins', 'this evening', 'tomorrow morning'],
    reaffirmations: [
      {
        quote: `“Do you need to have ${displayTopic} completely solved right now, or can you take just one calm step first?”`,
        sub: 'You do not have to carry the whole weight of this at once—setting it on paper is already a beginning.',
      },
      {
        quote: `“Are you truly unprepared for ${displayTopic}, or is your mind just rehearsing worst-case scenarios?”`,
        sub: 'Even when things feel uncertain, you can choose one small, grounded response today.',
      },
      {
        quote: `“Is your mind showing you the whole truth about ${displayTopic}, or just the loudest anxious story?”`,
        sub: `You have navigated hard moments before, and you will find your footing with ${displayTopic} too.`,
      },
      {
        quote: `“What if you stopped fighting the uncertainty around ${displayTopic} and focused only on what is in your hands today?”`,
        sub: 'Release the pressure to fix everything right now and be kind to your mind.',
      },
    ],
  });
}

// Ultra-fast AI Category Detection Endpoint for Step 1 ("What is worrying you right now?")
app.post('/api/detect-worry-category', async (req: Request, res: Response) => {
  try {
    const { rootWorry = '' } = req.body || {};
    const cleanWorry = String(rootWorry).trim();
    const localCat = detectLocalWorryCategory(cleanWorry, 'General');

    if (!cleanWorry) {
      res.json({ detectedCategory: 'General', source: 'empty' });
      return;
    }

    const cacheKey = `cat:v5:${cleanWorry.toLowerCase()}`;
    const cached = getCached<{ detectedCategory: GentleContextCategory }>(cacheKey);
    if (cached?.detectedCategory) {
      res.json({ detectedCategory: cached.detectedCategory, source: 'cache' });
      return;
    }

    const client = getAiClient();
    if (!client) {
      res.json({ detectedCategory: localCat, source: 'local' });
      return;
    }

    const prompt = `Classify the user's worry into the single best matching theme from:
["Health", "Work", "Relationships", "Finances", "Personal Growth"]
(Only use "General" if the text is meaningless gibberish).
Worry: "${cleanWorry}"`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedCategory: {
                  type: Type.STRING,
                  description: 'One of: Health, Work, Relationships, Finances, Personal Growth, General',
                },
              },
              required: ['detectedCategory'],
            },
          },
        });
        return JSON.parse(response.text || '{}');
      }
    );

    const detectedCategory = normalizeDetectedCategory(
      result?.detectedCategory,
      localCat
    );
    setCache(cacheKey, { detectedCategory });
    res.json({ detectedCategory, source: usedModel || 'local' });
  } catch {
    const cleanWorry = String((req.body as any)?.rootWorry || '').trim();
    res.json({
      detectedCategory: detectLocalWorryCategory(cleanWorry, 'General'),
      source: 'fallback',
    });
  }
});

app.post('/api/worry-trio-suggestions', async (req: Request, res: Response) => {
  try {
    const {
      rootWorry = '',
      category = 'General',
      force = false,
      excludeWhat = [],
      excludeQuotes = [],
    } = req.body || {};
    const cleanWorry = String(rootWorry).trim();
    const cleanCat = String(category || 'General').trim();
    const safeExcludeWhat = Array.isArray(excludeWhat)
      ? excludeWhat.map((s) => String(s).trim()).filter(Boolean)
      : [];
    const safeExcludeQuotes = Array.isArray(excludeQuotes)
      ? excludeQuotes.map((s) => String(s).trim()).filter(Boolean)
      : [];

    const fallback = buildContextualFallbackSuggestions(
      cleanWorry,
      cleanCat,
      safeExcludeWhat,
      safeExcludeQuotes
    );

    if (!cleanWorry) {
      res.json({ ...fallback, source: 'default' });
      return;
    }

    const cacheKey = `trio:v12:${cleanWorry.toLowerCase()}`;
    if (!force && safeExcludeWhat.length === 0 && safeExcludeQuotes.length === 0) {
      const cached = getCached<{
        detectedCategory: GentleContextCategory;
        what: string[];
        how: string[];
        when: string[];
        reaffirmations: ReaffirmationItem[];
      }>(cacheKey);
      if (
        cached &&
        Array.isArray(cached.what) &&
        cached.what.length > 0 &&
        Array.isArray(cached.reaffirmations) &&
        cached.reaffirmations.length > 0
      ) {
        res.json({ ...cached, source: 'cache' });
        return;
      }
    }

    const client = getAiClient();
    if (!client) {
      res.json({ ...fallback, source: 'semantic-engine' });
      return;
    }

    const exclusionNotice =
      safeExcludeWhat.length > 0 || safeExcludeQuotes.length > 0
        ? `\nCRITICAL SESSION ISOLATION RULE:
The user is working on a brand-new, independent worry session for "${cleanWorry}".
Do NOT repeat or echo any of these previous session suggestions or quotes:
- Previously used steps to avoid: ${JSON.stringify(safeExcludeWhat.slice(0, 8))}
- Previously used quotes to avoid: ${JSON.stringify(safeExcludeQuotes.slice(0, 4))}`
        : '';

    const prompt = `You are a perceptive CBT cognitive-reframing and practical problem-solving guide for the app "Untangle".
The user wrote this exact worry:
User's Worry: "${cleanWorry}"
Selected/Initial Category: "${cleanCat}"${exclusionNotice}

Perform THREE tasks specifically tailored to the real-world meaning and solution of "${cleanWorry}":

PART 1 — Auto-Detect Context Category ("detectedCategory"):
Classify "${cleanWorry}" into the single most accurate category from:
["Relationships", "Work", "Health", "Finances", "Personal Growth"]
(Only use "General" if the input is meaningless gibberish).

PART 2 — Second-Person Dilemma Perspectives ("reaffirmations"):
Write 4 distinct, perceptive cognitive reframes specifically about "${cleanWorry}".
CRITICAL SECOND-PERSON RULE:
- MUST be written in SECOND PERSON ("you", "your", "yourself") speaking gently to the user—NEVER use first person ("I", "my", "me", "Am I", "Do I").
- Each object in "reaffirmations" must have:
  - "quote": A clear, human, 1-sentence SECOND-PERSON dilemma question wrapped in curly quotes “...” (10 to 18 words) directly addressing "${cleanWorry}".
  - "sub": A warm, grounded 1-sentence second-person reassurance (12 to 18 words) that answers the dilemma with practical clarity and compassion.

PART 3 — Constructive Worry-Solving Action Chips ("what", "how", "when"):
IMPORTANT: Users often state worries negatively (e.g., "not getting a job as a fresher", "failing my exam", "can't sleep", "no money").
You MUST invert the negative worry into CONSTRUCTIVE, REAL-WORLD SOLUTIONS:
- NEVER repeat negative words like "for not getting", "on not getting", "about failing".
- Example: If worry is "not getting a job as a fresher" or "not getting job":
  - GOOD "what": ["tailor 1 fresher resume", "apply to 2 entry roles", "practice 1 intro answer", "message 1 alum for tips"]
  - BAD "what": ["map 2 steps for not getting", "10m focus on not getting"] (NEVER DO THIS!)
1. "what": 4 concrete, tiny, practical micro-actions (2 to 4 words each, lowercase) that constructively help solve "${cleanWorry}".
2. "how": 3 gentle, realistic ways or mindsets (2 to 4 words each, lowercase) tailored to doing that specific action for "${cleanWorry}".
3. "when": 3 realistic timing anchors suited to "${cleanWorry}" (1 to 3 words each, lowercase, e.g. "right now", "this afternoon", "tomorrow morning").

Return ONLY valid JSON.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-4-hydrogen',
      ['gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                detectedCategory: {
                  type: Type.STRING,
                  description:
                    'Must be one of: Relationships, Work, Health, Finances, Personal Growth, General',
                },
                reaffirmations: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      quote: {
                        type: Type.STRING,
                        description: 'Second-person ("you"/"your") dilemma question wrapped in curly quotes “...” specific to the worry',
                      },
                      sub: {
                        type: Type.STRING,
                        description: 'Gentle 1-sentence second-person grounding reassurance specific to the worry',
                      },
                    },
                    required: ['quote', 'sub'],
                  },
                },
                what: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4 short (2-4 words max) constructive micro-actions that help solve the worry',
                },
                how: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 short (2-4 words max) gentle ways to do the action tailored to the worry',
                },
                when: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 short (1-3 words max) realistic timing suggestions',
                },
              },
              required: ['detectedCategory', 'reaffirmations', 'what', 'how', 'when'],
            },
          },
        });
        return JSON.parse(response.text || '{}');
      }
    );

    if (
      result &&
      Array.isArray(result.what) &&
      result.what.length > 0 &&
      Array.isArray(result.how) &&
      result.how.length > 0 &&
      Array.isArray(result.when) &&
      result.when.length > 0
    ) {
      const validWhat = result.what
        .map((s: string) => String(s).toLowerCase().trim())
        .filter((s: string) => Boolean(s) && !isMalformedActionChip(s));

      const finalWhat =
        validWhat.length >= 3
          ? validWhat.slice(0, 4)
          : [...validWhat, ...fallback.what].filter((v, i, a) => a.indexOf(v) === i).slice(0, 4);

      const cleanedReaffirmations: ReaffirmationItem[] =
        Array.isArray(result.reaffirmations) && result.reaffirmations.length > 0
          ? result.reaffirmations
              .slice(0, 4)
              .map((r: any) => {
                const rawQuote = String(r?.quote || '').trim();
                return {
                  quote: rawQuote ? ensureSecondPersonQuote(rawQuote) : fallback.reaffirmations[0].quote,
                  sub: String(r?.sub || fallback.reaffirmations[0].sub).trim(),
                };
              })
              .filter((r: ReaffirmationItem) => Boolean(r.quote && r.sub))
          : fallback.reaffirmations;

      const detectedCategory = normalizeDetectedCategory(
        result.detectedCategory,
        fallback.detectedCategory
      );

      const cleaned = {
        detectedCategory,
        what: finalWhat,
        how: result.how.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        when: result.when.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        reaffirmations: cleanedReaffirmations.length > 0 ? cleanedReaffirmations : fallback.reaffirmations,
      };
      setCache(cacheKey, cleaned);
      setCache(`cat:v5:${cleanWorry.toLowerCase()}`, { detectedCategory });
      res.json({ ...cleaned, source: usedModel || 'gemini' });
      return;
    }

    res.json({ ...fallback, source: 'semantic-engine' });
  } catch (error) {
    const fallback = buildContextualFallbackSuggestions(
      (req.body as any)?.rootWorry || '',
      (req.body as any)?.category || 'General',
      (req.body as any)?.excludeWhat || [],
      (req.body as any)?.excludeQuotes || []
    );
    res.json({ ...fallback, source: 'semantic-engine' });
  }
});

// Endpoint 8: Google Search Grounding for Real-World Worry Insights & Action Steps (uses gemini-4-hydrogen with googleSearch tool)
app.post('/api/worry-search-grounding', async (req: Request, res: Response) => {
  try {
    const { rootWorry = '', category = 'General' } = req.body || {};
    const cleanWorry = String(rootWorry).trim();
    const fallback = buildContextualFallbackSuggestions(cleanWorry, category);

    const buildLocalSearchFallback = () => {
      const lower = cleanWorry.toLowerCase();
      if (/\b(fresher|job|career|resume|cv|interview|placement|internship|unemploy|hiring)\b/i.test(lower)) {
        return {
          summary:
            'For freshers navigating a competitive job market, recruiters consistently recommend focusing on proof-of-work projects, tailoring your resume keywords to each entry-level role, and sending short, direct messages to alumni or hiring managers alongside formal applications.',
          what: fallback.what,
          how: fallback.how,
          sources: [
            { title: 'LinkedIn Jobs — Entry Level & Fresher Roles', uri: 'https://www.linkedin.com/jobs/' },
            { title: 'Harvard OCS — Resume & Action Verbs Guide', uri: 'https://ocs.fas.harvard.edu/resumes-cvs-cover-letters/' },
            { title: 'Wellfound — Startup & Entry Tech Roles', uri: 'https://wellfound.com/jobs' },
          ],
          source: 'curated-search-fallback',
        };
      }
      if (/\b(room\s*hunt|apartment|flat|rent|housing|lease|move)\b/i.test(lower)) {
        return {
          summary:
            'When searching for a budget room, set a firm all-in monthly cap (including utilities), prepare a brief intro message with your move-in date, and verify listings in person or via live video tour before paying any deposit.',
          what: fallback.what,
          how: fallback.how,
          sources: [
            { title: 'ConsumerFTC — Avoiding Rental Listing Scams', uri: 'https://consumer.ftc.gov/articles/rental-listing-scams' },
            { title: 'SpareRoom — Room & Flatshare Search Tips', uri: 'https://www.spareroom.com/' },
          ],
          source: 'curated-search-fallback',
        };
      }
      if (/\b(craving|impulse|expense|spend|money|budget|debt|finance|bill|saving)\b/i.test(lower)) {
        return {
          summary:
            'Behavioral finance research shows that adding a 24-hour cooling-off rule before non-essential purchases and removing saved payment autofill reduces impulse spending by over 60% without feeling restrictive.',
          what: fallback.what,
          how: fallback.how,
          sources: [
            { title: 'CFPB — Budgeting & Saving Practical Tools', uri: 'https://www.consumerfinance.gov/consumer-tools/educator-tools/adult-financial-education/tools-and-resources/' },
          ],
          source: 'curated-search-fallback',
        };
      }
      return {
        summary: `Breaking "${cleanWorry || 'this worry'}" down into one 10-to-15 minute concrete step reduces cognitive overload and shifts your brain from anxious rumination into calm problem-solving.`,
        what: fallback.what,
        how: fallback.how,
        sources: [
          { title: 'NHS Every Mind Matters — How to Deal with Worry', uri: 'https://www.nhs.uk/every-mind-matters/mental-wellbeing-tips/how-to-deal-with-worry/' },
          { title: 'CCI — Using the Worry Tree Effectively', uri: 'https://www.cci.health.wa.gov.au/Resources/Looking-After-Yourself/Worry-and-Rumination' },
        ],
        source: 'curated-search-fallback',
      };
    };

    if (!cleanWorry) {
      res.json(buildLocalSearchFallback());
      return;
    }

    const client = getAiClient();
    if (!client) {
      res.json(buildLocalSearchFallback());
      return;
    }

    const prompt = `The user is using the "Untangle" worry-tree app and wrote this worry:
"${cleanWorry}" (Category: ${category})

Use Google Search to find practical, up-to-date, real-world strategies for someone facing "${cleanWorry}".
Provide:
1. A warm, practical 2-sentence summary of the most effective real-world approach to "${cleanWorry}" in second person ("you").
2. After the summary, list 4 ultra-short constructive micro-actions (2 to 4 words each, lowercase) under the exact heading "WHAT_STEPS:" (one per line, prefixed with "- ").
3. List 3 gentle approaches (2 to 4 words each, lowercase) under the exact heading "HOW_STEPS:" (one per line, prefixed with "- ").`;

    const response = await client.models.generateContent({
      model: 'gemini-4-hydrogen',
      contents: prompt,
      config: {
        tools: [{ googleSearch: {} }],
      },
    });

    const rawText = (response.text || '').trim();
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
    const sources: Array<{ title: string; uri: string }> = [];
    for (const chunk of chunks as any[]) {
      if (chunk?.web?.uri) {
        sources.push({
          title: String(chunk.web.title || chunk.web.uri).trim(),
          uri: String(chunk.web.uri).trim(),
        });
      }
    }

    const whatPart = rawText.split(/WHAT_STEPS:/i)[1]?.split(/HOW_STEPS:/i)[0] || '';
    const howPart = rawText.split(/HOW_STEPS:/i)[1] || '';
    const summaryPart = rawText.split(/WHAT_STEPS:/i)[0]?.trim() || rawText.slice(0, 280);

    const parsedWhat = whatPart
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim().toLowerCase())
      .filter((l) => l.length >= 4 && l.length <= 36 && !isMalformedActionChip(l))
      .slice(0, 4);

    const parsedHow = howPart
      .split('\n')
      .map((l) => l.replace(/^[-*•\d.)\s]+/, '').trim().toLowerCase())
      .filter((l) => l.length >= 4 && l.length <= 32)
      .slice(0, 3);

    const localFallback = buildLocalSearchFallback();

    res.json({
      summary: summaryPart || localFallback.summary,
      what: parsedWhat.length >= 2 ? parsedWhat : fallback.what,
      how: parsedHow.length >= 2 ? parsedHow : fallback.how,
      sources: sources.length > 0 ? sources.slice(0, 4) : localFallback.sources,
      source: 'gemini-4-hydrogen-search',
    });
  } catch {
    const cleanWorry = String((req.body as any)?.rootWorry || '').trim();
    const category = String((req.body as any)?.category || 'General').trim();
    const fallback = buildContextualFallbackSuggestions(cleanWorry, category);
    res.json({
      summary: `Here are grounded, practical steps tailored to "${cleanWorry || 'your worry'}" so you can focus on one small piece at a time.`,
      what: fallback.what,
      how: fallback.how,
      sources: [
        { title: 'LinkedIn Jobs & Career Guides', uri: 'https://www.linkedin.com/jobs/' },
        { title: 'CCI — Practical Worry & Problem Solving', uri: 'https://www.cci.health.wa.gov.au/Resources/Looking-After-Yourself/Worry-and-Rumination' },
      ],
      source: 'fallback',
    });
  }
});

// Endpoint 9: Multi-Turn Gemini Untangle Companion Chatbot (supports gemini-3.1-flash-lite, gemini-4-hydrogen, gemini-4-argon, gemini-4-carbon, and Google Search Grounding)
app.post('/api/untangle-chat', async (req: Request, res: Response) => {
  try {
    const {
      messages = [],
      rootWorry = '',
      category = 'General',
      currentWhat = '',
      currentHow = '',
      modelTier = 'gemini-4-hydrogen',
      useSearchGrounding = false,
    } = req.body || {};

    const cleanWorry = String(rootWorry || '').trim();
    const lastUserMessage =
      Array.isArray(messages) && messages.length > 0
        ? String(messages[messages.length - 1]?.content || '').trim()
        : '';

    const effectiveTopic = cleanWorry || lastUserMessage || 'your current worry';
    const fallbackSuggestions = buildContextualFallbackSuggestions(effectiveTopic, category);

    const buildSmartContextualReply = () => {
      const lower = `${cleanWorry} ${lastUserMessage}`.toLowerCase();
      if (/\b(fresher|job|career|resume|cv|interview|placement|internship|unemploy|hiring)\b/i.test(lower)) {
        return {
          reply:
            `Not getting a job yet as a fresher is one of the most stressful positions to be in, because "not getting a job" feels like one giant wall. Instead of trying to solve "getting hired" all at once, let's break it into tiny inputs you control today:\n\n` +
            `1. **One Resume Tweak**: Pick 1 entry-level job description and match 3 of its skill keywords in your resume's top project bullet.\n` +
            `2. **Two Targeted Applications**: Apply to just 2 fresher/associate roles today—then give yourself permission to stop.\n` +
            `3. **One Direct Warm Message**: Send a polite 3-line note to a college alum or recruiter asking for 1 tip on their team's hiring.\n\n` +
            `Tap any of the action chips below to place it directly into your **what?** box on the canvas.`,
          suggestedWhat: fallbackSuggestions.what,
          suggestedHow: fallbackSuggestions.how,
          sources: [
            { title: 'LinkedIn Jobs — Entry Level Roles', uri: 'https://www.linkedin.com/jobs/' },
            { title: 'Harvard OCS — Resume Action Verbs & Templates', uri: 'https://ocs.fas.harvard.edu/resumes-cvs-cover-letters/' },
          ],
          usedModel: 'semantic-coach',
        };
      }

      return {
        reply:
          `When we state a worry like "${effectiveTopic}", our mind often frames it as what we *don't* want to happen, which makes it hard to act on. Let's flip it into a tiny, concrete step you can actually do in 10–15 minutes:\n\n` +
          `• **What you can do**: ${fallbackSuggestions.what.slice(0, 3).join(' · ')}\n` +
          `• **How to approach it**: ${fallbackSuggestions.how.slice(0, 2).join(' · ')}\n\n` +
          `You can click any suggestion chip below to fill your canvas step, or tell me a bit more about what feels hardest right now.`,
        suggestedWhat: fallbackSuggestions.what,
        suggestedHow: fallbackSuggestions.how,
        sources: [],
        usedModel: 'semantic-coach',
      };
    };

    const client = getAiClient();
    if (!client) {
      res.json(buildSmartContextualReply());
      return;
    }

    const allowedModels = [
      'gemini-3.1-flash-lite',
      'gemini-4-hydrogen',
      'gemini-4-argon',
      'gemini-4-carbon',
    ];
    const requestedModel = allowedModels.includes(modelTier) ? modelTier : 'gemini-4-hydrogen';

    const systemInstruction = `You are the "Untangle Companion", a warm, perceptive CBT and practical problem-solving coach built into the Untangle worry-tree journal.
Current User Context:
- Active Worry on Canvas: "${cleanWorry || 'Not entered yet'}"
- Category: "${category}"
- Current "what?" step: "${currentWhat || 'None selected yet'}"
- Current "how?" approach: "${currentHow || 'None selected yet'}"

Your Role & Rules:
1. Speak in warm, clear, grounded SECOND PERSON ("you" / "your").
2. When a user shares a negatively phrased worry (like "not getting a job as a fresher"), explain gently why "not getting" isn't an action verb—and help them invert it into 2–3 tiny, concrete, controllable micro-actions they can take today (e.g., tailoring 1 resume project bullet, applying to 2 fresher roles, messaging 1 alum).
3. Keep responses concise (under 130 words), structured, and reassuring.
4. At the end of your message, always include 3 short (2-4 word) actionable "what?" chips and 2 short (2-3 word) "how?" chips formatted on two lines like:
SUGGESTED_WHAT: chip one | chip two | chip three
SUGGESTED_HOW: approach one | approach two`;

    const formattedHistory = Array.isArray(messages)
      ? messages.slice(-12).map((m: any) => ({
          role: m.role === 'assistant' || m.role === 'model' ? 'model' : 'user',
          parts: [{ text: String(m.content || '') }],
        }))
      : [{ role: 'user', parts: [{ text: cleanWorry || 'Help me break down this worry.' }] }];

    if (useSearchGrounding) {
      const searchResponse = await client.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: formattedHistory,
        config: {
          systemInstruction,
          tools: [{ googleSearch: {} }],
        },
      });

      const rawReply = (searchResponse.text || '').trim();
      const chunks = searchResponse.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
      const sources: Array<{ title: string; uri: string }> = [];
      for (const chunk of chunks as any[]) {
        if (chunk?.web?.uri) {
          sources.push({
            title: String(chunk.web.title || chunk.web.uri).trim(),
            uri: String(chunk.web.uri).trim(),
          });
        }
      }

      const whatMatch = rawReply.match(/SUGGESTED_WHAT:\s*(.+)/i);
      const howMatch = rawReply.match(/SUGGESTED_HOW:\s*(.+)/i);
      const cleanReply = rawReply
        .replace(/SUGGESTED_WHAT:\s*.+/gi, '')
        .replace(/SUGGESTED_HOW:\s*.+/gi, '')
        .trim();

      const parsedWhat = whatMatch?.[1]
        ? whatMatch[1]
            .split('|')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length >= 4 && !isMalformedActionChip(s))
        : fallbackSuggestions.what;

      const parsedHow = howMatch?.[1]
        ? howMatch[1]
            .split('|')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length >= 4)
        : fallbackSuggestions.how;

      res.json({
        reply: cleanReply || buildSmartContextualReply().reply,
        suggestedWhat: parsedWhat.length > 0 ? parsedWhat.slice(0, 4) : fallbackSuggestions.what,
        suggestedHow: parsedHow.length > 0 ? parsedHow.slice(0, 3) : fallbackSuggestions.how,
        sources: sources.slice(0, 4),
        usedModel: 'gemini-4-hydrogen (googleSearch)',
      });
      return;
    }

    const { result, usedModel } = await executeWithQuotaProtection(
      requestedModel,
      ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: formattedHistory,
          config: {
            systemInstruction,
          },
        });
        return response.text;
      }
    );

    if (result) {
      const rawReply = result.trim();
      const whatMatch = rawReply.match(/SUGGESTED_WHAT:\s*(.+)/i);
      const howMatch = rawReply.match(/SUGGESTED_HOW:\s*(.+)/i);
      const cleanReply = rawReply
        .replace(/SUGGESTED_WHAT:\s*.+/gi, '')
        .replace(/SUGGESTED_HOW:\s*.+/gi, '')
        .trim();

      const parsedWhat = whatMatch?.[1]
        ? whatMatch[1]
            .split('|')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length >= 4 && !isMalformedActionChip(s))
        : fallbackSuggestions.what;

      const parsedHow = howMatch?.[1]
        ? howMatch[1]
            .split('|')
            .map((s) => s.trim().toLowerCase())
            .filter((s) => s.length >= 4)
        : fallbackSuggestions.how;

      res.json({
        reply: cleanReply || buildSmartContextualReply().reply,
        suggestedWhat: parsedWhat.length > 0 ? parsedWhat.slice(0, 4) : fallbackSuggestions.what,
        suggestedHow: parsedHow.length > 0 ? parsedHow.slice(0, 3) : fallbackSuggestions.how,
        sources: [],
        usedModel: usedModel || requestedModel,
      });
      return;
    }

    res.json(buildSmartContextualReply());
  } catch {
    const cleanWorry = String((req.body as any)?.rootWorry || '').trim();
    const category = String((req.body as any)?.category || 'General').trim();
    const fallbackSuggestions = buildContextualFallbackSuggestions(cleanWorry, category);
    res.json({
      reply: `Let's turn "${cleanWorry || 'this worry'}" into one small, concrete step you can take today without pressure. Tap any of the steps below to use it on your canvas.`,
      suggestedWhat: fallbackSuggestions.what,
      suggestedHow: fallbackSuggestions.how,
      sources: [],
      usedModel: 'semantic-coach',
    });
  }
});

// Setup Vite middleware in dev or static files in production
async function startServer() {
  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  app.listen(port, '0.0.0.0', () => {
    console.log(`Decenter Metacognitive App running on http://0.0.0.0:${port}`);
  });
}

startServer();
