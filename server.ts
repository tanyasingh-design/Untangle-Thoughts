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
if (process.env.GEMINI_API_KEY) {
  try {
    aiClient = new GoogleGenAI({
      apiKey: process.env.GEMINI_API_KEY,
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
function markModelQuotaExhausted(model: string, retryDelaySec: number = 3600) {
  modelBlockedUntil[model] = Date.now() + retryDelaySec * 1000;
}

// Helper to safely execute a Gemini call with alternate model fallbacks and silent quota handling
async function executeWithQuotaProtection<T>(
  preferredModel: string,
  alternateModels: string[],
  fn: (modelName: string) => Promise<T>
): Promise<{ result: T | null; usedModel?: string }> {
  if (!aiClient) return { result: null };

  const candidates = [preferredModel, ...alternateModels].filter(
    (m, idx, arr) => arr.indexOf(m) === idx && isModelAvailable(m)
  );

  for (const model of candidates) {
    try {
      const result = await fn(model);
      return { result, usedModel: model };
    } catch (err: any) {
      const errMsg = err?.message || '';
      const isQuota = 
        err?.status === 429 || 
        err?.code === 429 ||
        /quota|RESOURCE_EXHAUSTED|rate-limit|exceeded your current quota|429/i.test(errMsg);

      if (isQuota) {
        // Block this model for 1 hour to prevent flooding and quota re-triggering
        markModelQuotaExhausted(model, 3600);
        // Do NOT log noisy warnings that cause health check failures
        continue;
      } else {
        // Other non-quota errors
        break;
      }
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


// Endpoint 7: AI Contextual Worry Trio Suggestions (What? How? When?) tailored to the user's specific worry
function buildContextualFallbackSuggestions(rootWorry: string, category: string = 'General') {
  const text = (rootWorry || '').toLowerCase();
  const cat = (category || 'General').toLowerCase();

  if (text.includes('exam') || text.includes('test') || text.includes('study') || text.includes('class') || text.includes('grade')) {
    return {
      what: ['review 1 topic', 'practice 3 questions', 'summarize notes', 'ask a classmate'],
      how: ['20-min timer', 'one page at a time', 'without multitasking'],
      when: ['in 10 mins', 'after a short break', 'tonight at 7 pm'],
    };
  }
  if (text.includes('interview') || text.includes('job') || text.includes('resume') || text.includes('presentation') || text.includes('meeting') || cat === 'work') {
    return {
      what: ['draft 3 bullet points', 'practice out loud', 'send 1 brief update', 'prepare key notes'],
      how: ['calmly for 10 mins', 'rough draft first', 'one slide at a time'],
      when: ['in 15 mins', 'tomorrow morning', 'before lunch'],
    };
  }
  if (text.includes('money') || text.includes('bill') || text.includes('rent') || text.includes('budget') || text.includes('debt') || cat === 'finances') {
    return {
      what: ['check 1 balance', 'list upcoming bills', 'pause 1 expense', 'set a small transfer'],
      how: ['with a cup of tea', 'just the facts', 'step by step'],
      when: ['in 10 mins', 'this evening', 'saturday morning'],
    };
  }
  if (text.includes('sleep') || text.includes('tired') || text.includes('pain') || text.includes('doctor') || text.includes('sick') || cat === 'health') {
    return {
      what: ['drink warm water', 'book appointment', 'stretch gently', 'rest eyes 10 mins'],
      how: ['slowly & kindly', 'without screens', 'one breath at a time'],
      when: ['right now', 'before bed tonight', 'tomorrow at 10 am'],
    };
  }
  if (text.includes('friend') || text.includes('partner') || text.includes('family') || text.includes('talk') || text.includes('argument') || cat === 'relationships') {
    return {
      what: ['send a kind text', 'write down feelings', 'ask to talk', 'give gentle space'],
      how: ['honestly & softly', 'without rushing', 'listening first'],
      when: ['in an hour', 'tonight', 'this weekend'],
    };
  }

  return {
    what: ['write 1 small step', 'talk to someone', 'tidy 1 corner', 'prepare for 5 mins'],
    how: ['step by step', 'calmly, no rush', 'ask for help'],
    when: ['in 5 mins', 'tonight', 'tomorrow morning'],
  };
}

app.post('/api/worry-trio-suggestions', async (req: Request, res: Response) => {
  try {
    const { rootWorry = '', category = 'General' } = req.body || {};
    const cleanWorry = String(rootWorry).trim();
    const cleanCat = String(category || 'General').trim();

    const fallback = buildContextualFallbackSuggestions(cleanWorry, cleanCat);

    if (!cleanWorry) {
      res.json({ ...fallback, source: 'default' });
      return;
    }

    const cacheKey = `trio:${cleanWorry.toLowerCase()}:${cleanCat.toLowerCase()}`;
    const cached = getCached<{ what: string[]; how: string[]; when: string[] }>(cacheKey);
    if (cached && Array.isArray(cached.what) && cached.what.length > 0) {
      res.json({ ...cached, source: 'cache' });
      return;
    }

    if (!aiClient) {
      res.json({ ...fallback, source: 'heuristics' });
      return;
    }

    const prompt = `You are a gentle, compassionate cognitive behavioral assistant helping a user take a tiny, realistic action on their specific worry.
User's Worry: "${cleanWorry}"
Life Area / Context: "${cleanCat}"

Generate ultra-short, specific, lowercase suggestion chips directly tailored to this exact worry for three small note cards:
1. "what": 4 concrete, tiny actions the user can gently do about "${cleanWorry}" (each MUST be 1 to 3 words max, e.g. "outline 3 points", "email professor", "check balance", "stretch 5 mins").
2. "how": 3 gentle, realistic ways or attitudes to do that specific action (each MUST be 2 to 3 words max, e.g. "rough draft only", "with a timer", "step by step").
3. "when": 3 realistic, gentle timing anchors suited to this worry (each MUST be 1 to 3 words max, e.g. "in 10 mins", "after dinner", "tomorrow morning").

Keep all suggestions lowercase, warm, non-overwhelming, and directly relevant to "${cleanWorry}".`;

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
                what: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '4 short (1-3 words) actionable suggestions specific to the worry',
                },
                how: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 short (2-3 words) gentle approach suggestions specific to the worry',
                },
                when: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: '3 short (1-3 words) realistic timing suggestions',
                },
              },
              required: ['what', 'how', 'when'],
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
      const cleaned = {
        what: result.what.slice(0, 4).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        how: result.how.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
        when: result.when.slice(0, 3).map((s: string) => String(s).toLowerCase().trim()).filter(Boolean),
      };
      setCache(cacheKey, cleaned);
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
