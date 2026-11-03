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

// Initialize GoogleGenAI SDK with required telemetry header
let aiClient: GoogleGenAI | null = null;
function getAiClient(): GoogleGenAI | null {
  if (aiClient) return aiClient;
  const apiKey = process.env.GEMINI_API_KEY || process.env.API_KEY;
  if (apiKey) {
    try {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    } catch (err) {
      console.error('Failed to initialize GoogleGenAI client:', err);
    }
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
    'gemini-3-flash-preview',
    'gemini-flash-latest',
    'gemini-2.5-flash',
    'gemini-3.8-flash',
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
        framedThought: `I notice my mind is generating the thought that "${rawText.trim()}"`,
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

// Endpoint 1: Deconstruct and unpack worry using Gemini 3.8 Flash
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
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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
    const { messages, currentStep, currentState } = req.body;

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
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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

    // Fallback generator directly synthesizing the prior 3 nodes in simple human terms
    const generateSimpleDefaults = () => {
      return [
        cleanSit 
          ? `Am I truly ${cleanWorry || 'wrong'}, or am I just comparing ${cleanSit} to an impossible standard?`
          : `Am I ${cleanWorry || 'good enough'}, or do I need to become better before I can feel confident in ${cleanContext.toLowerCase()}?`,
        `Am I actually ${cleanWorry || 'failing'}, or can I handle this one realistic step at a time?`,
        `Is this situation truly about ${cleanWorry || 'not being good enough'}, or is my mind overthinking ${cleanSit || cleanContext.toLowerCase()}?`
      ];
    };

    const defaultReframes = generateSimpleDefaults();
    const cacheKey = `reframe:${cleanWorry.toLowerCase()}:${cleanSit.toLowerCase()}:${cleanContext.toLowerCase()}`;
    const cached = getCached<string[]>(cacheKey);
    if (cached && cached.length > 0) {
      res.json({ reframes: cached, source: 'cache' });
      return;
    }

    if (!aiClient) {
      res.json({ reframes: defaultReframes, source: 'fallback' });
      return;
    }

    const prompt = `You are a cognitive restructuring and decision worksheet guide based on the "Make a Decision: Fear of Not Being Good Enough" worksheet dilemma model.

User's prior 3 nodes:
1. Root Worry: "${rootWorry}"
2. Context: "${context || 'General'}"
3. Situation / Event: "${situation || 'General'}"

YOUR TASK:
Synthesize all 3 prior nodes into exactly 3 simple, human, one-liner dilemma inquiry questions.

STRICT REQUIREMENTS:
1. LENGTH: Must be a single short sentence (under 16 words max).
2. TONE: Simple, everyday conversational English. Absolutely NO academic, clinical, or corporate jargon (NEVER use "evidence", "meaningful initiative", "capabilities", "paradigms", "constructive inquiry").
3. PATTERN: Frame as a clean, honest one-liner dilemma directly comparing the fear against reality, exactly like the classic worksheet example:
   "Am I good enough, or do I need to become better before I can feel confident in myself?"
   or
   "Am I actually doing wrong, or am I just comparing ${cleanSit || 'this'} to someone else's highlight reel?"
   or
   "Is ${cleanSit || 'this'} really proof that ${cleanWorry || 'I am failing'}, or can I take one calm step forward in ${cleanContext}?"

Return JSON with a "reframes" array containing 3 short, punchy string questions.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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

    // High quality clinical heuristics fallback seamlessly
    setCache(cacheKey, defaultReframes);
    res.json({ reframes: defaultReframes, source: 'clinical-heuristics' });
  } catch (error) {
    res.json({
      reframes: [
        "Am I good enough, or do I need to become better before I can feel confident in myself?",
        "Am I actually unprepared, or is my mind just overthinking this moment?",
        "Can I take one calm, realistic step forward right now?"
      ],
      source: 'fallback'
    });
  }
});

// Endpoint 6: PRD v1.0 Adaptive Node Question & Quick-Chips Generator
app.post('/api/generate-node-question', async (req: Request, res: Response) => {
  try {
    const { stepId, rootWorry, category, situationEvent, mindStory, pathway, previousAnswers } = req.body;

    // Fallback dictionary for instant responsive chips
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
      // Non-Actionable Pathway
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
      // Action Plan Pathway
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
      // Make a Decision Pathway
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

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-3.8-flash',
      ['gemini-flash-latest', 'gemini-3.1-flash-lite'],
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


// Endpoint 7: AI Contextual Worry Trio Suggestions (What? How? When?) + AI Positive Reaffirmations + AI Auto-Detected Context
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

  // High-signal phrase boosts
  if (/weight\s*(gain|loss)|gaining\s*weight|losing\s*weight|body\s*image|out\s*of\s*shape|blood\s*pressure|hair\s*loss|back\s*pain|chest\s*pain|mental\s*health|panic\s*attack/i.test(text)) {
    scores.Health += 4;
  }
  if (/fights?\s+in\s+(the\s+)?house|at\s+home|mad\s+at\s+me|left\s+out|no\s+friends|break\s*up|relationship|family\s+tension/i.test(text)) {
    scores.Relationships += 4;
  }
  if (/lifestyle|status|social\s+status|good\s+life|society|expectations|pressure\s+to|peer\s+pressure|comparing\s+myself|keep\s+up\s+with|what\s+people\s+think|reputation|prestig|self[- ]worth|indecis|overthink|procrastinat|falling\s+behind/i.test(text)) {
    scores['Personal Growth'] += 4;
  }
  if (/can'?t\s+afford|cost\s+of\s+living|credit\s+card|bank\s+account|student\s+loan|pay\s+rent|pay\s+bills/i.test(text)) {
    scores.Finances += 4;
  }
  if (/job\s+interview|laid\s+off|work\s+deadline|final\s+exam|boss\s+is|performance\s+review/i.test(text)) {
    scores.Work += 4;
  }

  // Keyword matching per category
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

function buildContextualFallbackSuggestions(rootWorry: string, category: string = 'General'): {
  detectedCategory: GentleContextCategory;
  what: string[];
  how: string[];
  when: string[];
  reaffirmations: ReaffirmationItem[];
} {
  const raw = (rootWorry || '').trim();
  const text = raw.toLowerCase();
  const detectedCategory = detectLocalWorryCategory(raw, category);
  const cat = detectedCategory.toLowerCase();

  // 0. Self-Worth / Fear of Not Being Good Enough / Impostor Syndrome / Confidence / Fear of Failure
  if (
    /good\s*enough|not\s*enough|worthy|unworthy|self[- ]worth|self[- ]doubt|self[- ]esteem|imposter|impostor|inadequate|inadequacy|inferior|insecure|insecurity|confidence|confident|fear\s+of\s+(not\s+being|failing|failure|rejection|being\s+judged)|falling\s+short|measure\s+up|mediocre/i.test(
      text
    )
  ) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['name 1 real strength', 'write 1 honest fact', 'do 1 small step', 'drop 1 harsh rule'],
      how: ['as a learner', 'without proving', 'kindly to myself'],
      when: ['right now', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Am I good enough, or do I need to become better before I can feel confident in myself?”',
          sub: 'Confidence does not wait for perfection—you are allowed to trust yourself while you are still growing.',
        },
        {
          quote: '“Is this fear proof that I am falling short, or am I measuring myself against an impossible standard?”',
          sub: 'Being hard on yourself only hides how far you have already come; your honest effort today is enough.',
        },
        {
          quote: '“Do I have to prove my worth through every outcome, or am I already worthy before I begin?”',
          sub: 'When your self-worth is not on trial, you can take small steps with curiosity instead of fear.',
        },
        {
          quote: '“What if being a work in progress is not a flaw, but the most human way to grow?”',
          sub: 'Give yourself permission to learn at a steady pace without treating every moment like a test.',
        },
      ],
    };
  }

  // 0A. Weight / Body Image / Diet / Fitness / Appearance
  if (
    /\b(weight|gain|gaining|overweight|underweight|bmi|fat|chubby|skinny|calories|calorie|diet|dieting|binge|eating|appetite|bloated|physique|shape|workout|gym|exercise|fitness)\b|weight\s*(gain|loss)|body\s*image|out\s*of\s*shape/i.test(
      text
    )
  ) {
    return {
      detectedCategory: 'Health',
      what: ['go for 10m walk', 'drink a glass water', 'plan 1 nourishing meal', 'stretch gently 5m'],
      how: ['with body kindness', 'no harsh judgment', 'one small habit'],
      when: ['right now', 'next mealtime', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Do I need to punish my body to change it, or can I care for it kindly one small habit at a time?”',
          sub: 'Lasting wellbeing grows from patience and steady care rather than harsh self-judgment today.',
        },
        {
          quote: '“Is my worth as a person measured by a scale, or do I deserve respect and kindness right now?”',
          sub: 'Treat your body like a dear friend you are gently supporting one day at a time.',
        },
        {
          quote: '“Do I have to fix my entire routine today, or is one ten-minute walk or nourishing meal enough?”',
          sub: 'Sustainable change happens quietly and peacefully, one calm choice at a time.',
        },
        {
          quote: '“Can I accept where my body is today while still taking gentle care of my health?”',
          sub: 'Let go of all-or-nothing pressure and focus on feeling cared for in this moment.',
        },
      ],
    };
  }

  // 0B. Lifestyle Pressure / Status / Expectations / Comparison / Proving Yourself
  if (
    /\b(lifestyle|status|prestige|prestigious|reputation|image|expectations|expectation|pressure|pressured|society|standards|comparison|comparing|compare|judged|impress|proving)\b/i.test(
      text
    )
  ) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['define my own enough', 'mute comparison feeds', 'name 1 real value', 'drop 1 expectation'],
      how: ['at my own pace', 'without comparing', 'honestly & simply'],
      when: ['right now', 'this evening', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Am I chasing what genuinely brings me peace, or exhausting myself to look successful to others?”',
          sub: 'A good life is measured by how calm and honest it feels inside, not how impressive it looks outside.',
        },
        {
          quote: '“Do I need higher status to feel worthy, or am I already enough without performing?”',
          sub: 'Stepping off the treadmill of comparison gives you back your own quiet joy.',
        },
        {
          quote: '“Whose timeline am I trying to satisfy—my own heart’s, or society’s shifting expectations?”',
          sub: 'Release the pressure to impress anyone today and breathe into what truly nourishes you.',
        },
        {
          quote: '“What if having peace of mind today is a higher achievement than keeping up with everyone else?”',
          sub: 'You already have enough and are enough in this present moment.',
        },
      ],
    };
  }

  // 1. Indecision / Decision-making / Torn / Unsure / Doubt
  if (
    /indecis|decid|decision|choos|choice|option|torn|unsure|dilemma|hesitat|uncertain what to pick|second[- ]guess/i.test(
      text
    )
  ) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['list 2 options', 'write pros & cons', 'pick 1 small choice', 'flip a coin test'],
      how: ['good enough choice', '5-min timer', 'without overthinking'],
      when: ['in 5 mins', 'after a deep breath', 'before tonight'],
      reaffirmations: [
        {
          quote: '“Do I need to find the one flawless choice, or can I pick a good-enough path and adjust as I go?”',
          sub: 'Clarity rarely comes from standing still—it grows after you take the first small step.',
        },
        {
          quote: '“Am I truly stuck, or am I just afraid of not being able to predict the whole future before I choose?”',
          sub: 'Choosing a good-enough option today sets your mind free from spinning in circles.',
        },
        {
          quote: '“Does a good decision require zero doubt, or can I move forward gently even while feeling unsure?”',
          sub: 'Give yourself permission to decide lightly and treat your choice as an experiment, not a verdict.',
        },
        {
          quote: '“What if both options can teach me something useful, and neither one will ruin my story?”',
          sub: 'Even a tiny decision unlocks momentum you cannot find by overthinking.',
        },
      ],
    };
  }

  // 2. Fights / Arguments / Home Tension / Household or Family Conflict
  if (
    /fight|fights|fighting|arguing|argument|yell|shouting|conflict|tension|mad at|angry|house|home|roommate|family|parents|mom|dad|sister|brother|partner|spouse|husband|wife|boyfriend|girlfriend/i.test(
      text
    )
  ) {
    return {
      detectedCategory: 'Relationships',
      what: ['take 5m quiet space', 'speak softly & briefly', 'write how i feel', 'step outside 5 mins'],
      how: ['calmly, low voice', 'listening first', 'without escalating'],
      when: ['right now', 'once things cool down', 'after a deep breath'],
      reaffirmations: [
        {
          quote: '“Do I have to absorb every loud emotion in the house, or can I step back and protect my calm first?”',
          sub: 'Taking five quiet minutes of space is not avoidance—it is how you keep your inner peace intact.',
        },
        {
          quote: '“Does a hard argument today mean everything is broken, or do heated moments just need quiet air first?”',
          sub: 'Choosing a calm pause or gentle boundary is an act of care for everyone in the room.',
        },
        {
          quote: '“Am I responsible for fixing everyone’s mood right now, or am I allowed to pause and breathe?”',
          sub: 'A few minutes of quiet space can soften even the sharpest disagreement.',
        },
        {
          quote: '“Can I care deeply about the people at home while still holding a boundary around my peace?”',
          sub: 'You can return to the conversation when hearts and voices feel more settled.',
        },
      ],
    };
  }

  // 3. Overthinking / Rumination / Racing thoughts / Spiraling
  if (/overthink|ruminat|spiral|racing mind|looping|can'?t stop thinking|analyz|obsess/i.test(text)) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['brain-dump on paper', 'name 1 true fact', 'step away 5 mins', 'focus on 1 task'],
      how: ['without judging it', 'on 1 small page', 'gently & slowly'],
      when: ['right now', 'for 5 mins only', 'before bed tonight'],
      reaffirmations: [
        {
          quote: '“Is replaying this thought ten more times helping me prepare, or is it just stealing my peace tonight?”',
          sub: 'You can notice your mind chattering without having to solve every "what if" right now.',
        },
        {
          quote: '“Are my anxious what-ifs proven facts, or just loud stories my tired mind is spinning?”',
          sub: 'Rest your attention on what is physically in front of you; that is enough for now.',
        },
        {
          quote: '“Do I need to solve the whole future in my head tonight, or can I set these thoughts down on paper?”',
          sub: 'You do not have to figure everything out in a single sitting.',
        },
        {
          quote: '“What if I noticed this worry like a cloud drifting past instead of an urgent command?”',
          sub: 'Stillness returns the moment you stop arguing with your thoughts and soften your shoulders.',
        },
      ],
    };
  }

  // 4. Procrastination / Stuck / Putting off / Unmotivated / Lazy
  if (/procrastinat|putting off|avoid|stuck|unmotivat|behind on|delay|lazy|can'?t start/i.test(text)) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['do just 2 mins', 'open the file', 'write 1 rough line', 'clear desk space'],
      how: ['ugly draft first', '5-min timer', 'zero perfection'],
      when: ['in 2 mins', 'right after water', 'this afternoon'],
      reaffirmations: [
        {
          quote: '“Am I actually lazy, or is my mind freezing because I think I have to do this perfectly?”',
          sub: 'Starting imperfectly for two minutes breaks paralysis far better than waiting for motivation.',
        },
        {
          quote: '“Do I have to finish the whole task right now, or can I just touch the first corner for two minutes?”',
          sub: 'Give yourself permission to make a messy, pressure-free start right now.',
        },
        {
          quote: '“Will beating myself up for delaying make it easier to start, or will self-kindness get me moving?”',
          sub: 'Even five focused minutes changes the direction and weight of your whole day.',
        },
        {
          quote: '“What if doing ten percent of this imperfectly today is enough to loosen the knot?”',
          sub: 'Lower the bar until starting feels light, easy, and kind.',
        },
      ],
    };
  }

  // 5. Overwhelmed / Burnout / Too much to do / Stressed
  if (/overwhelm|burnout|burned out|too much|swamped|exhaust|drowning|everything at once|stressed/i.test(text)) {
    return {
      detectedCategory: detectedCategory === 'General' ? 'Personal Growth' : detectedCategory,
      what: ['pick only 1 thing', 'cross off 1 item', 'take 10-min pause', 'ask for extension'],
      how: ['one piece at a time', 'slowly, no rush', 'dropping perfection'],
      when: ['right now', 'in 10 mins', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Do I really have to carry the whole mountain at once, or just the single next step in front of me?”',
          sub: 'Set everything else down for the next ten minutes and let yourself breathe.',
        },
        {
          quote: '“Does resting when I am exhausted mean I am failing, or is rest how I stay whole?”',
          sub: 'You are human, not a machine; doing one gentle thing today is enough.',
        },
        {
          quote: '“Is everything asking for my urgency today truly worth trading away my inner peace?”',
          sub: 'Choose the single smallest step and let the rest wait patiently.',
        },
        {
          quote: '“Can I give myself permission to move slowly today and still trust that I will arrive?”',
          sub: 'Soften your jaw, drop your shoulders, and take things one piece at a time.',
        },
      ],
    };
  }

  // 6. Loneliness / Social anxiety / Fitting in / Left out
  if (/lonely|loneliness|alone|left out|awkward|social|no friends|isolated|ignored/i.test(text)) {
    return {
      detectedCategory: 'Relationships',
      what: ['text 1 warm hello', 'visit a cozy cafe', 'call someone kind', 'join 1 small group'],
      how: ['no pressure', 'warmly & briefly', 'just saying hi'],
      when: ['in 15 mins', 'this evening', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Does feeling alone tonight mean I am unlovable, or am I just in a quiet season between connections?”',
          sub: 'Feeling lonely right now is a tender passing season, never a permanent truth about your worth.',
        },
        {
          quote: '“Do I need to be effortlessly outgoing to belong, or is my quiet, honest presence already enough?”',
          sub: 'Treat yourself with the same gentle companionship you offer to others.',
        },
        {
          quote: '“What if one small, low-pressure hello is all it takes to open a door to warmth?”',
          sub: 'Connection grows in small, unhurried moments—be gentle with your heart today.',
        },
        {
          quote: '“Can I be a comforting friend to myself tonight instead of judging myself for feeling alone?”',
          sub: 'Meaningful bonds are still ahead of you, one genuine moment at a time.',
        },
      ],
    };
  }

  // 7. Future / Direction / Life path / Career uncertainty
  if (/future|direction|purpose|where i'?m going|life path|falling behind|next chapter|career/i.test(text)) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['plan just this week', 'list 2 curiosities', 'read 1 story', 'talk to a mentor'],
      how: ['one week ahead', 'with curiosity', 'no 5-year pressure'],
      when: ['this evening', 'tomorrow morning', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Am I truly falling behind, or am I measuring my own chapter against someone else’s timeline?”',
          sub: 'You only need enough light for the next small step, not the whole five-year map.',
        },
        {
          quote: '“Do I need the whole future figured out tonight, or can I just follow one honest curiosity this week?”',
          sub: 'Uncertainty about the future is also open space for new possibilities to take shape.',
        },
        {
          quote: '“Is a meaningful life built by rushing, or by showing up calmly one day at a time?”',
          sub: 'Stop comparing your quiet beginning to someone else’s highlight reel.',
        },
        {
          quote: '“What if not knowing every answer yet is a normal part of growing into my next chapter?”',
          sub: 'Every small skill and kindness you practice today carries you forward.',
        },
      ],
    };
  }

  // 8. Mistake / Regret / Guilt / Messed up / Embarrassed
  if (/mistake|messed up|guilt|regret|embarrass|ashamed|wrong|apolog|failed/i.test(text)) {
    return {
      detectedCategory: 'Personal Growth',
      what: ['send brief apology', 'note 1 lesson', 'fix 1 small part', 'forgive yourself'],
      how: ['kindly & honestly', 'like a good friend', 'without self-blame'],
      when: ['in 10 mins', 'today', 'after a quiet walk'],
      reaffirmations: [
        {
          quote: '“Does making a mistake mean I am broken, or does it simply mean I am human and learning?”',
          sub: 'Speak to yourself right now with the same grace you would offer a dear friend.',
        },
        {
          quote: '“Does one imperfect moment erase all the good I bring, or can I repair what I can and forgive the rest?”',
          sub: 'Self-kindness heals and teaches far better than harsh self-criticism ever could.',
        },
        {
          quote: '“Will punishing myself change what happened, or am I allowed to take the lesson and move forward lighter?”',
          sub: 'You can make amends where needed without putting your whole self-worth on trial.',
        },
        {
          quote: '“What if this stumble is something I will look back on with gentler eyes and wiser perspective?”',
          sub: 'Take a deep breath and let go of punishing yourself for being human.',
        },
      ],
    };
  }

  // 9. Exams / Studying / School / Grades
  if (/exam|test|study|class|grade|homework|assignment|thesis|lecture|school|college/i.test(text)) {
    return {
      detectedCategory: 'Work',
      what: ['review 1 topic', 'practice 3 questions', 'summarize 1 page', 'ask a classmate'],
      how: ['20-min timer', 'one page at a time', 'without multitasking'],
      when: ['in 10 mins', 'after a short break', 'tonight at 7 pm'],
      reaffirmations: [
        {
          quote: '“Does this single test define my intelligence, or can I focus calmly on learning one topic at a time?”',
          sub: 'Twenty calm minutes of focus is far stronger than hours of anxious rumination.',
        },
        {
          quote: '“Do I have to master the entire syllabus tonight, or is reviewing one page right now enough?”',
          sub: 'Open just one section, breathe steadily, and trust your preparation.',
        },
        {
          quote: '“Am I actually unprepared, or is my anxious mind just magnifying the pressure?”',
          sub: 'You know more than your worry is telling you right now.',
        },
        {
          quote: '“What if I measured today by twenty honest minutes of effort instead of a perfect score?”',
          sub: 'Step by step, you are building understanding at a steady pace.',
        },
      ],
    };
  }

  // 10. Work / Interview / Job / Deadlines / Presentation
  if (
    /interview|job|resume|presentation|meeting|boss|client|deadline|project|work|email/i.test(text) ||
    cat === 'work'
  ) {
    return {
      detectedCategory: 'Work',
      what: ['draft 3 bullet points', 'send 1 brief reply', 'outline next step', 'practice 1 answer'],
      how: ['rough draft first', '10-min focus block', 'one step at a time'],
      when: ['in 15 mins', 'before lunch', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Does this single work task define my worth, or can I handle it calmly one small step at a time?”',
          sub: 'Done calmly is far better than chasing an exhausting perfection.',
        },
        {
          quote: '“Am I truly unprepared for this, or is my mind just rehearsing worst-case scenarios?”',
          sub: 'Draft three simple points, take a breath, and trust the capability you have built.',
        },
        {
          quote: '“Do I have to solve the whole week’s workload right now, or just the next ten-minute block?”',
          sub: 'You have navigated demanding work days before and found your footing.',
        },
        {
          quote: '“What if a clear, good-enough draft today is far better than carrying perfectionist stress?”',
          sub: 'Let go of the whole week’s pressure and focus only on the next small piece.',
        },
      ],
    };
  }

  // 11. Money / Finances / Bills / Budget
  if (/money|bill|rent|budget|debt|afford|saving|expense|bank|cost|pay/i.test(text) || cat === 'finances') {
    return {
      detectedCategory: 'Finances',
      what: ['check 1 balance', 'list 3 main bills', 'pause 1 subscription', 'plan 1 week spend'],
      how: ['just the numbers', 'calmly with tea', 'one item at a time'],
      when: ['in 10 mins', 'this evening', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Will panicking tonight change the numbers, or can I look at one practical piece calmly?”',
          sub: 'Your worth as a person is never measured by a balance sheet—you can navigate this step by step.',
        },
        {
          quote: '“Do I need to solve my entire financial future today, or just make one steady adjustment this week?”',
          sub: 'Clarity replaces fear the moment you look at one item at a time.',
        },
        {
          quote: '“Does a tight season mean I am failing, or am I learning to manage what I have with care?”',
          sub: 'Be gentle with yourself while you plan the next practical step.',
        },
        {
          quote: '“What if checking just this week’s numbers without self-judgment is enough for today?”',
          sub: 'Pour a cup of tea, check one item, and leave the rest for tomorrow.',
        },
      ],
    };
  }

  // 12. Sleep / Health / Body / Tired / Doctor
  if (/sleep|insomnia|tired|pain|doctor|sick|health|symptom|workout|body|eat/i.test(text) || cat === 'health') {
    return {
      detectedCategory: 'Health',
      what: ['drink warm water', 'book checkup', 'stretch 5 mins', 'rest eyes 10 mins'],
      how: ['slowly & kindly', 'screens off', 'one breath at a time'],
      when: ['right now', 'before bed tonight', 'tomorrow morning'],
      reaffirmations: [
        {
          quote: '“Will worrying harder heal my body faster, or does my body need patience and gentle care today?”',
          sub: 'Even resting your eyes and breathing slowly gives your nervous system real relief.',
        },
        {
          quote: '“Are my anxious health what-ifs helping me, or can I take one calm, practical step for my body?”',
          sub: 'One kind gesture toward your wellbeing today is a meaningful step.',
        },
        {
          quote: '“Is resting when I feel drained a waste of time, or is rest how my body restores itself?”',
          sub: 'Let your shoulders drop and allow yourself to slow down tonight.',
        },
        {
          quote: '“Can I listen to what my body needs right now with kindness instead of panic?”',
          sub: 'Drink some water, soften your breath, and be gentle with yourself.',
        },
      ],
    };
  }

  // 13. Relationships general
  if (cat === 'relationships' || /relationship|dating|breakup|trust|love/i.test(text)) {
    return {
      detectedCategory: 'Relationships',
      what: ['send a kind text', 'write down feelings', 'ask for a chat', 'give gentle space'],
      how: ['honestly & softly', 'listening first', 'without rushing'],
      when: ['in an hour', 'this evening', 'this weekend'],
      reaffirmations: [
        {
          quote: '“Do I need to force an instant answer right now, or can I express my heart honestly and give us grace?”',
          sub: 'Healthy connection happens at a calm pace—sometimes a little breathing room brings clarity.',
        },
        {
          quote: '“Am I trying to read someone else’s mind, or can I focus on what I can communicate kindly?”',
          sub: 'Start by writing down what you truly feel before rushing into words.',
        },
        {
          quote: '“Do I have to lose my own peace to keep connection, or do I deserve honesty and warmth?”',
          sub: 'Your feelings are valid, and you can hold them with gentleness today.',
        },
        {
          quote: '“What if patience and a soft, honest conversation can untangle what overthinking cannot?”',
          sub: 'Trust that clarity will come when you speak from a grounded place.',
        },
      ],
    };
  }

  // 14. Dynamic worry-tailored fallback for any custom worry text
  const cleanSnippet = raw
    .replace(/^(the\s+)?(fear|worry|anxiety|feeling)\s+(of|about|that)\s+/i, '')
    .replace(/^i\s+(am\s+|feel\s+)?(worried|worrying|anxious|scared|afraid)\s+(about|of|that)?\s*/i, '')
    .trim();
  const displayTopic = cleanSnippet.length > 0 && cleanSnippet.length <= 42 ? cleanSnippet.toLowerCase() : 'this situation';

  return {
    detectedCategory,
    what: ['write 2 key thoughts', 'pick 1 tiny step', 'take 5m quiet pause', 'talk it through'],
    how: ['one tiny piece', '5-min timer', 'without perfection'],
    when: ['in 5 mins', 'before bed tonight', 'tomorrow morning'],
    reaffirmations: [
      {
        quote: `“Do I need to have ${displayTopic} completely solved right now, or can I take just one calm step first?”`,
        sub: 'You do not have to carry the whole weight of this at once—setting it on paper is already a beginning.',
      },
      {
        quote: `“Is my mind showing me the whole truth about ${displayTopic}, or just the loudest worst-case story?”`,
        sub: 'Even when things feel uncertain, you can choose one small, grounded response today.',
      },
      {
        quote: '“Am I good enough to handle this one step at a time, or am I demanding instant perfection from myself?”',
        sub: `You have navigated hard moments before, and you will find your footing with ${displayTopic} too.`,
      },
      {
        quote: `“What if I stopped fighting the uncertainty around ${displayTopic} and focused only on what is in my hands today?”`,
        sub: 'Release the pressure to fix everything right now and be kind to your mind.',
      },
    ],
  };
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

    const cacheKey = `cat:v2:${cleanWorry.toLowerCase()}`;
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
Examples:
- "Weight gain", "diet", "insomnia", "back pain", "workout" -> "Health"
- "the fear of not being good enough", "over pressure for good lifestyle and status", "indecisive", "overthinking", "comparison", "future direction", "procrastinating" -> "Personal Growth"
- "fights in house", "argument with mom", "lonely", "breakup", "friends" -> "Relationships"
- "rent is due", "credit card debt", "can't afford", "bills" -> "Finances"
- "job interview", "deadline", "boss", "final exam", "presentation" -> "Work"

Worry: "${cleanWorry}"`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-3-flash-preview',
      ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.8-flash'],
      async (modelName) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 0 },
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
    const { rootWorry = '', category = 'General', force = false } = req.body || {};
    const cleanWorry = String(rootWorry).trim();
    const cleanCat = String(category || 'General').trim();

    const fallback = buildContextualFallbackSuggestions(cleanWorry, cleanCat);

    if (!cleanWorry) {
      res.json({ ...fallback, source: 'default' });
      return;
    }

    const cacheKey = `trio:v6:${cleanWorry.toLowerCase()}`;
    if (!force) {
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
      res.json({ ...fallback, source: 'heuristics' });
      return;
    }

    const prompt = `You are a perceptive CBT cognitive-reframing and micro-action guide.
The user wrote this worry:
User's Worry: "${cleanWorry}"

Perform THREE tasks specifically tailored to "${cleanWorry}":

PART 1 — Auto-Detect Context Category ("detectedCategory"):
Classify "${cleanWorry}" into the single most accurate category from this exact list:
["Relationships", "Work", "Health", "Finances", "Personal Growth"]
(Only use "General" if the input is completely meaningless gibberish).
- "Relationships": fights in house, family/partner/roommate/friend conflict, arguments, loneliness, social anxiety, dating, breakup, tension at home.
- "Work": job, career, boss, deadline, interview, presentation, meetings, exams, school, study, college, projects.
- "Health": weight gain, weight loss, body image, diet, calories, fitness, gym, sleep, insomnia, tired, doctor, pain, illness, physical exhaustion.
- "Finances": money, bills, rent, debt, budget, savings, expenses, affording things, cost of living.
- "Personal Growth": fear of not being good enough, self-doubt, imposter syndrome, over pressure for good lifestyle and status, social status, expectations, comparison, indecisive, decision-making, overthinking, procrastination, habits, confidence, future direction, purpose, mistakes/regret.

PART 2 — Insightful Dilemma Reframes ("reaffirmations"):
Write 4 distinct, non-repetitive, deeply perceptive cognitive reframes for "${cleanWorry}".
CRITICAL STYLE RULE:
Instead of vague self-help clichés (NEVER write generic lines like "I give myself full permission to pause and breathe through this moment's uncertainty"), reframe "${cleanWorry}" into a clear, honest, self-reflective dilemma question that exposes the hidden anxious rule or assumption, exactly like these examples:
- For "the fear of not being good enough":
  quote: “Am I good enough, or do I need to become better before I can feel confident in myself?”
  sub: Confidence does not wait for perfection—you are allowed to trust yourself while you are still growing.
- For "indecisive":
  quote: “Do I need to find the one flawless choice, or can I pick a good-enough path and adjust as I go?”
  sub: Clarity rarely comes from standing still—it grows after you take the first small step.
- For "over pressure for good lifestyle and status":
  quote: “Am I chasing what genuinely brings me peace, or exhausting myself to look successful to others?”
  sub: A good life is measured by how calm and honest it feels inside, not how impressive it looks outside.

Each of the 4 objects in "reaffirmations" must have:
- "quote": A clear, human, 1-sentence dilemma question wrapped in curly quotes “...” (10 to 18 words) directly unpacking "${cleanWorry}".
- "sub": A warm, grounded 1-sentence perspective (12 to 18 words) that answers the dilemma with compassion and clarity.

PART 3 — Suggestion Chips ("what", "how", "when"):
Generate ultra-short, lowercase suggestion chips SPECIFICALLY addressing "${cleanWorry}" (keep each chip 2 to 3 words max so it fits cleanly on a single left-aligned line):
1. "what": 4 concrete, tiny micro-actions that directly help with "${cleanWorry}" (2 to 3 words max each).
2. "how": 3 gentle, realistic ways or mindsets to approach "${cleanWorry}" (2 to 3 words max each).
3. "when": 3 realistic timing anchors suited to "${cleanWorry}" (1 to 3 words max each, e.g. "right now", "before bed tonight", "tomorrow morning").

Return ONLY valid JSON.`;

    const { result, usedModel } = await executeWithQuotaProtection(
      'gemini-3-flash-preview',
      ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-3.8-flash', 'gemini-3.1-flash-lite'],
      async (modelName) => {
        const response = await client.models.generateContent({
          model: modelName,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingBudget: 0 },
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
                        description: 'First-person positive reaffirmation wrapped in curly quotes “...” specific to the worry',
                      },
                      sub: {
                        type: Type.STRING,
                        description: 'Gentle 1-sentence grounding support specific to the worry',
                      },
                    },
                    required: ['quote', 'sub'],
                  },
                },
                what: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4 short (2-3 words max) concrete micro-actions directly tailored to the user worry',
                },
                how: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 short (2-3 words max) gentle ways to do the action tailored to the worry',
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
      const cleanedReaffirmations: ReaffirmationItem[] =
        Array.isArray(result.reaffirmations) && result.reaffirmations.length > 0
          ? result.reaffirmations
              .slice(0, 4)
              .map((r: any) => {
                const rawQuote = String(r?.quote || '').trim().replace(/^["“”']+/, '').replace(/["“”']+$/, '');
                return {
                  quote: rawQuote ? `“${rawQuote}”` : fallback.reaffirmations[0].quote,
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
        what: result.what.slice(0, 4).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        how: result.how.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        when: result.when.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        reaffirmations: cleanedReaffirmations.length > 0 ? cleanedReaffirmations : fallback.reaffirmations,
      };
      setCache(cacheKey, cleaned);
      setCache(`cat:v2:${cleanWorry.toLowerCase()}`, { detectedCategory });
      res.json({ ...cleaned, source: usedModel || 'gemini' });
      return;
    }

    res.json({ ...fallback, source: 'fallback' });
  } catch (error) {
    const fallback = buildContextualFallbackSuggestions(
      (req.body as any)?.rootWorry || '',
      (req.body as any)?.category || 'General'
    );
    res.json({ ...fallback, source: 'fallback' });
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
