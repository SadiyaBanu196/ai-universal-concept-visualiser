import express from 'express';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';
import initSqlJs from 'sql.js';
import { GoogleGenAI } from '@google/genai';
import { extractAndParseJson } from './src/utils/jsonParser';
import { validateAndNormalizePlan } from './src/utils/planValidator';
import { resolveModelConfig } from './src/utils/modelConfig';

dotenv.config();

const app = express();
const PORT = 3000;
const isProd = process.env.NODE_ENV === 'production';

app.use(express.json({ limit: '20mb' }));

// SQLite Database Setup with sql.js
let db: any = null;
const DB_PATH = path.resolve(process.cwd(), 'visualizations.sqlite');

async function initDatabase() {
  try {
    const SQL = await initSqlJs();
    if (fs.existsSync(DB_PATH)) {
      const fileBuffer = fs.readFileSync(DB_PATH);
      db = new SQL.Database(fileBuffer);
    } else {
      db = new SQL.Database();
      db.run(`
        CREATE TABLE IF NOT EXISTS sessions (
          id TEXT PRIMARY KEY,
          user_query TEXT,
          concept_type TEXT,
          plan_json TEXT,
          created_at TEXT
        );
      `);
      saveDbToFile();
    }
    console.log('[Database] SQLite initialized successfully');
  } catch (err) {
    console.error('[Database] Failed to initialize SQLite:', err);
  }
}

function saveDbToFile() {
  if (!db) return;
  try {
    const data = db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('[Database] Error saving SQLite database to disk:', err);
  }
}

initDatabase();

// Initialize Gemini Client
const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

if (apiKey) {
  ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    hasApiKey: Boolean(apiKey && apiKey.length > 5),
    database: Boolean(db),
  });
});

// System Prompt for Universal Visualization Planner
const VISUALIZATION_SYSTEM_PROMPT = `
You are the AI Universal Concept Visualiser Engine.
Your job is to analyze any educational concept, question, textbook content, mathematical equation, or diagram, and produce a structured DECLARATIVE visualization plan in JSON that is exceptionally clear and friendly for complete beginners.

CRITICAL RULES:
1. NEVER generate hardcoded or topic-specific hacks. Produce a clean, generic declarative plan with standard types.
2. TEACH THE ENTIRE WALKTHROUGH FROM START TO FINISH:
   - Start with complete initial state / inputs / baseline before execution starts.
   - For algorithms: show every required execution step in exact order (e.g. Setup, each comparison step, each bound narrowing, until target is found or confirmed absent). Never stop halfway or skip transitions!
   - Mark the final step with "is_final_step": true, and declare the exact final answer / outcome in "result_badge" and explanation "final_result".
   - For science/math (e.g., projectile motion, gradient descent, orbital mechanics): start at initial conditions (e.g. t = 0, starting weights), proceed through governing calculations/stages, and conclude at the final result / equilibrium / convergence.
3. PRESERVE USER-PROVIDED INPUTS ACCURATELY:
   - If the user specifies an array, a target value, an initial velocity, launch angle, learning rate, or equation, you MUST preserve and use those exact values in "parameters", "discrete_blocks.blocks", "equations", and steps. Never invent arbitrary replacements for user-specified numbers.
4. BEGINNER-FRIENDLY EXPLANATION FOR EVERY STEP:
   - For every single step, provide a complete "guidance" object with:
     * "what_is_happening": Simple English description of the immediate action (no unexplained jargon).
     * "why_it_happens": The clear reason or rule driving this action.
     * "what_changed": Concrete values, indices, positions, or states updated in this step.
     * "what_to_notice": Specific visual detail to observe on the canvas.
     * "what_next": Brief preview of the next transition.
   - For comparisons/decisions, provide "comparison_detail" with left_label, left_value, operator, right_label, right_value, and decision.
5. EXACT STEP & COMPARISON COUNT CONSISTENCY:
   - Do NOT claim in the final summary or conclusion that a target was found or an answer was reached in N comparisons or N steps unless the walkthrough literally contains that exact number of comparison steps or execution steps. Every comparison must be its own step.
6. The visualization plan must be one of:
   - "coordinate_graph": For continuous math functions, physics trajectories, 2D curves, vectors, loss curves, gradient descent, wave harmonics, sigmoid activations, etc.
   - "node_network": For systems, architectures, transformers, neural network layers, TCP 3-way handshake, state machines, chemical structures, biological pathways, or process flows.
   - "discrete_blocks": For algorithms, binary search arrays, sorting, CPU pipeline stages (IF, ID, EX, MEM, WB), memory slots, stacks, queues.
   - "particle_system": For particle physics, kinetic theory of gases, molecular diffusion, Brownian motion, orbital gravitation, electrostatic attraction.
7. For "discrete_blocks":
   - Provide "blocks" with clean initial values and index labels [0], [1], etc.
   - In each step, specify "block_states" explicitly ({ "b0": "eliminated", "b3": "matched" }) and "pointer_positions" ({ "p_low": 0, "p_mid": 3, "p_high": 7 }).
   - Valid block states: "default", "active", "comparing", "eliminated", "matched", "sorted".
8. For "coordinate_graph":
   - Provide "curves" with mathematical "expression" strings using variables declared in "parameters".
   - Provide "markers" with x_expr / y_expr or x / y coordinates, and optional "marker_positions" overrides per step.
9. Provide rich educational overview, step-by-step breakdown, key points, real-world application, and a 2-question quiz.

OUTPUT FORMAT:
Return ONLY valid JSON matching this schema:
{
  "id": "concept_identifier_string",
  "title": "Clear Conceptual Title",
  "summary": "1-2 sentence core idea summary in beginner-friendly English",
  "concept_type": "physics" | "mathematics" | "computer_science" | "machine_learning" | "system_process" | "chemistry" | "engineering" | "general",
  "learning_objective": "What the student will master visually",
  "tags": ["tag1", "tag2"],
  "parameters": [
    {
      "id": "param_id",
      "name": "Parameter Name",
      "description": "What this slider controls",
      "type": "number",
      "min": 1,
      "max": 50,
      "step": 1,
      "default": 14,
      "unit": "units"
    }
  ],
  "equations": [
    {
      "id": "eq_1",
      "name": "Governing Equation",
      "latex": "y = mx + b",
      "formula_text": "y = m*x + b",
      "description": "Explanation of formula in plain English",
      "variables": [
        { "symbol": "m", "meaning": "Slope rate of change", "unit": "" }
      ]
    }
  ],
  "entities": [
    { "id": "ent_1", "name": "Key Entity", "type": "Object", "role": "Role", "description": "Entity description", "color": "#738276" }
  ],
  "relationships": [
    { "source": "ent_1", "target": "Target", "relation": "interacts with", "description": "Relationship description" }
  ],
  "steps": [
    {
      "step_number": 1,
      "title": "Setup & Initial State",
      "description": "Observe the starting state before execution.",
      "highlight_element_ids": ["elem_1"],
      "parameter_overrides": { "t": 0 },
      "block_states": { "b0": "default" },
      "pointer_positions": { "p_low": 0, "p_high": 7 },
      "guidance": {
        "what_is_happening": "We prepare the input and define initial boundary positions.",
        "why_it_happens": "Every algorithm or physical model begins with a known baseline.",
        "what_changed": "Initial boundaries set to start index 0 and end index 7.",
        "what_to_notice": "Notice how all candidate items are initially active and available.",
        "what_next": "Calculate the pivot or transition point."
      },
      "comparison_detail": {
        "left_label": "Value at Mid",
        "left_value": 12,
        "operator": "<",
        "right_label": "Target",
        "right_value": 23,
        "decision": "Target is greater, so discard left half"
      },
      "is_final_step": false,
      "result_badge": "In Progress"
    }
  ],
  "visualization": {
    "type": "coordinate_graph" | "node_network" | "discrete_blocks" | "particle_system",
    "coordinate_graph": {
      "x_axis": { "label": "X Axis", "min": 0, "max": 100, "unit": "m", "grid_steps": 5 },
      "y_axis": { "label": "Y Axis", "min": 0, "max": 50, "unit": "m", "grid_steps": 5 },
      "curves": [
        { "id": "curve_1", "label": "Curve", "color": "#738276", "expression": "x * 0.5" }
      ],
      "markers": [
        { "id": "marker_1", "label": "Point", "x": 0, "y": 0, "color": "#dc2626" }
      ]
    },
    "discrete_blocks": {
      "kind": "array",
      "title": "Search Space Elements",
      "blocks": [
        { "id": "b0", "value": 2, "state": "default", "index_label": "[0]" }
      ],
      "pointers": [
        { "id": "p_low", "label": "low", "target_index": 0, "color": "#22c55e", "position": "top" }
      ]
    }
  },
  "explanation": {
    "overview": "Comprehensive educational overview in beginner-friendly language.",
    "step_by_step": [
      {
        "step": 1,
        "title": "Initial Setup",
        "explanation": "Clear beginner explanation of this step.",
        "takeaway": "Key intuition to remember."
      }
    ],
    "key_points": [
      "Key point 1.",
      "Key point 2."
    ],
    "real_world_example": "Everyday real world parallel.",
    "final_result": {
      "summary": "Step-by-step walkthrough completed successfully.",
      "final_answer": "Target found at index 5",
      "conclusion": "How the final outcome was reached from the starting inputs."
    }
  },
  "quiz": [
    {
      "id": "q1",
      "question": "Beginner question testing conceptual intuition?",
      "type": "multiple_choice",
      "options": ["Option A", "Option B", "Option C", "Option D"],
      "correct_index": 1,
      "explanation": "Clear explanation of why option B is correct."
    }
  ]
}
`;

// Model Configuration: Resolve active primary and fallback models with automatic override of gemini-3.8-flash
const { primaryModel: PRIMARY_MODEL, fallbackModel: FALLBACK_MODEL, candidates: MODEL_CANDIDATES } = resolveModelConfig();

// 30 seconds timeout per single Gemini request attempt
const GEMINI_REQUEST_TIMEOUT_MS = 30000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, modelName: string): Promise<T> {
  let timer: NodeJS.Timeout;
  const timeoutPromise = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      console.warn(`[AI] Model ${modelName} timed out after ${timeoutMs / 1000}s`);
      const err: any = new Error(`Model ${modelName} timed out after ${timeoutMs / 1000}s`);
      err.code = 'ETIMEDOUT';
      err.status = 504;
      err.isTimeout = true;
      reject(err);
    }, timeoutMs);
  });

  return Promise.race([
    promise.finally(() => clearTimeout(timer)),
    timeoutPromise,
  ]);
}

function isDailyQuotaExhausted(err: any): boolean {
  if (!err) return false;
  const msg = (err.message || err.error?.message || err.toString() || '').toLowerCase();
  return (
    msg.includes('generaterequestsperday') ||
    msg.includes('retry in') ||
    msg.includes('daily') ||
    msg.includes('quota exceeded for metric')
  );
}

function isTransientGeminiError(err: any): boolean {
  if (!err) return false;
  const status = err.status || err.code || err.statusCode || err.response?.status;
  const message = (err.message || err.error?.message || err.toString() || '').toLowerCase();
  const statusStr = (err.status || err.error?.status || '').toString().toUpperCase();

  // Check for permanent errors first - do NOT retry or switch models for these
  if (
    status === 400 ||
    status === 401 ||
    status === 403 ||
    status === 404 ||
    message.includes('api key') ||
    message.includes('api_key') ||
    message.includes('invalid_argument') ||
    message.includes('permission_denied') ||
    message.includes('unauthenticated') ||
    message.includes('not found') ||
    message.includes('unsupported model')
  ) {
    return false;
  }

  // Check for transient errors - retry and fallback for these
  if (
    err.isTimeout ||
    err.code === 'ETIMEDOUT' ||
    status === 503 ||
    status === 429 ||
    status === 500 ||
    status === 502 ||
    status === 504 ||
    statusStr === 'UNAVAILABLE' ||
    statusStr === 'RESOURCE_EXHAUSTED' ||
    message.includes('503') ||
    message.includes('429') ||
    message.includes('504') ||
    message.includes('timed out') ||
    message.includes('timeout') ||
    message.includes('unavailable') ||
    message.includes('high demand') ||
    message.includes('temporarily') ||
    message.includes('overloaded') ||
    message.includes('rate limit') ||
    message.includes('quota') ||
    message.includes('spikes in demand') ||
    message.includes('econnreset') ||
    message.includes('etimedout') ||
    message.includes('fetch failed')
  ) {
    return true;
  }

  return false;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ModelExecutionResult =
  | { success: true; response: any; modelUsed: string }
  | { success: false; error: any; isTransient: boolean; modelUsed?: string };

async function executeModelCall(
  modelName: string,
  contents: any,
  maxAttempts = 2,
  delays = [1000, 2000]
): Promise<ModelExecutionResult> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      if (!ai) {
        throw new Error('GEMINI_API_KEY is not configured on the server.');
      }

      console.log(`[AI] Attempting model: ${modelName} (attempt ${attempt}/${maxAttempts})`);
      
      const response = await withTimeout(
        ai.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction: VISUALIZATION_SYSTEM_PROMPT,
            responseMimeType: 'application/json',
            temperature: 0.3,
          },
        }),
        GEMINI_REQUEST_TIMEOUT_MS,
        modelName
      );

      return { success: true, response, modelUsed: modelName };
    } catch (err: any) {
      const isTransient = isTransientGeminiError(err);
      const isDailyQuota = isDailyQuotaExhausted(err);
      const isHighDemand =
        err.status === 503 ||
        err.statusCode === 503 ||
        err.error?.code === 503 ||
        (err.message && err.message.toLowerCase().includes('high demand'));

      console.warn(
        `[AI] Model ${modelName} attempt ${attempt} error (transient=${isTransient}, dailyQuota=${isDailyQuota}, highDemand=${isHighDemand}):`,
        err.message || err
      );

      // If daily quota or upstream high demand is encountered for this model, switch candidate immediately!
      if (isDailyQuota || isHighDemand || !isTransient || attempt >= maxAttempts) {
        return { success: false, error: err, isTransient, modelUsed: modelName };
      }

      const delayMs = delays[attempt - 1] || 2000;
      console.log(`[AI] Backoff waiting ${delayMs}ms before retry on ${modelName}...`);
      await sleep(delayMs);
    }
  }

  return {
    success: false,
    error: new Error('Model retry attempts exhausted'),
    isTransient: true,
    modelUsed: modelName,
  };
}

async function generatePlanWithFailover(contents: any): Promise<ModelExecutionResult> {
  let lastResult: ModelExecutionResult = {
    success: false,
    error: new Error('No models available'),
    isTransient: true,
  };

  for (let i = 0; i < MODEL_CANDIDATES.length; i++) {
    const model = MODEL_CANDIDATES[i];
    const isPrimary = i === 0;

    if (isPrimary) {
      console.log(`[AI] Primary model attempt: ${model}`);
    } else {
      console.log(`[AI] Switching to fallback model: ${model}`);
      console.log(`[AI] Fallback model attempt: ${model}`);
    }

    const result = await executeModelCall(model, contents, 2, [1000, 2000]);

    if (result.success) {
      console.log(`[AI] Visualization plan generated successfully using model: ${model}`);
      return result;
    }

    lastResult = result;

    // Permanent errors should abort immediately without unnecessary fallback attempts
    if (!result.isTransient) {
      console.warn(`[AI] Model ${model} encountered permanent error, aborting failover.`);
      return result;
    }

    console.warn(`[AI] Model ${model} temporarily unavailable, checking next candidate model...`);
  }

  console.error(`[AI] All candidate models temporarily unavailable.`);
  return lastResult;
}

// Endpoint: Generate Plan
app.post('/api/generate-plan', async (req, res) => {
  const { prompt, imageBase64 } = req.body;

  if (!prompt && !imageBase64) {
    return res.status(400).json({
      error: {
        type: 'INVALID_INPUT',
        message: 'Please provide a concept prompt or image.',
      },
    });
  }

  if (!ai) {
    return res.status(500).json({
      error: {
        type: 'CONFIG_ERROR',
        message: 'GEMINI_API_KEY is not configured on the server. Please check your environment variables.',
      },
    });
  }

  try {
    let contents: any;

    if (imageBase64) {
      // Extract mime type and base64 payload
      const matches = imageBase64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
      const mimeType = matches ? matches[1] : 'image/png';
      const data = matches ? matches[2] : imageBase64;

      contents = {
        parts: [
          {
            inlineData: {
              mimeType,
              data,
            },
          },
          {
            text: `Analyze this educational image (diagram, equation, textbook snippet, or handwritten notes) alongside the user query: "${prompt || 'Explain this concept visually'}". Extract the underlying principles, entities, variables, equations, and steps, and generate a complete structured visualization plan JSON.`,
          },
        ],
      };
    } else {
      contents = `User Concept Request: "${prompt}". Generate a complete, highly accurate, interactive structured visualization plan JSON for this concept.`;
    }

    const result = await generatePlanWithFailover(contents);

    if (!result.success) {
      if (result.isTransient) {
        return res.status(503).json({
          error: {
            type: 'AI_SERVICE_UNAVAILABLE',
            message: 'The AI service is temporarily busy. Please try again.',
          },
        });
      }

      return res.status(500).json({
        error: {
          type: 'AI_PLANNING_FAILED',
          message: 'Unable to process the visualization request. Please verify your prompt or try again.',
        },
      });
    }

    const responseText = result.response?.text || '';
    const extractionResult = extractAndParseJson(responseText);

    if (!extractionResult.success || !extractionResult.data) {
      console.error('[JSON Extraction Error]:', extractionResult.error);
      return res.status(422).json({
        error: {
          type: 'AI_INVALID_RESPONSE',
          message: 'The AI returned an invalid visualization plan. Please try again.',
        },
      });
    }

    const { plan: normalizedPlan, error: validationError } = validateAndNormalizePlan(extractionResult.data);

    if (validationError || !normalizedPlan) {
      console.error('[Plan Validation Error]:', validationError);
      return res.status(422).json({
        error: {
          type: 'AI_INVALID_RESPONSE',
          message: 'The AI generated an incomplete visualization plan. Please try again.',
        },
      });
    }

    // Save to SQLite
    if (db && normalizedPlan && normalizedPlan.title) {
      try {
        const stmt = db.prepare(`
          INSERT OR REPLACE INTO sessions (id, user_query, concept_type, plan_json, created_at)
          VALUES (?, ?, ?, ?, ?);
        `);
        stmt.run([
          normalizedPlan.id || `session_${Date.now()}`,
          prompt || 'Image Analysis',
          normalizedPlan.concept_type || 'general',
          JSON.stringify(normalizedPlan),
          new Date().toISOString(),
        ]);
        stmt.free();
        saveDbToFile();
      } catch (dbErr) {
        console.error('[Database] Failed to auto-save session:', dbErr);
      }
    }

    return res.json({ plan: normalizedPlan });
  } catch (err: any) {
    console.error('[Server Error in /api/generate-plan]:', err);
    return res.status(500).json({
      error: {
        type: 'INTERNAL_ERROR',
        message: 'The AI service encountered an unexpected error. Please try again.',
      },
    });
  }
});

// Endpoint: AI Follow-up Tutor Chat
app.post('/api/chat', async (req, res) => {
  const { plan, history = [], question } = req.body;

  if (!question) {
    return res.status(400).json({ error: 'Question is required' });
  }

  if (!ai) {
    return res.status(500).json({ error: 'Gemini API not configured' });
  }

  try {
    const contextPrompt = `
You are the AI Universal Concept Tutor assisting a student with the concept: "${plan?.title || 'Educational Concept'}".
Current Concept Summary: ${plan?.summary || ''}
Equations in this model: ${JSON.stringify(plan?.equations || [])}
Parameters available: ${JSON.stringify(plan?.parameters || [])}
Steps in this visualization: ${JSON.stringify(plan?.steps || [])}

Conversation history:
${history.map((h: any) => `${h.role === 'user' ? 'Student' : 'Tutor'}: ${h.content}`).join('\n')}

Student question: "${question}"

Provide a clear, engaging, pedagogically rigorous explanation directly referencing the visualization, its parameters, and equations. Keep response concise (under 250 words) with clear intuition and formatting.
`;

    let chatResponse: any = null;
    let lastChatError: any = null;

    for (const model of MODEL_CANDIDATES) {
      try {
        chatResponse = await withTimeout(
          ai.models.generateContent({
            model,
            contents: contextPrompt,
          }),
          GEMINI_REQUEST_TIMEOUT_MS,
          model
        );
        if (chatResponse?.text) break;
      } catch (chatErr: any) {
        lastChatError = chatErr;
        if (!isTransientGeminiError(chatErr)) {
          throw chatErr;
        }
        console.warn(`[AI Chat] Model ${model} unavailable, trying next candidate...`);
      }
    }

    if (!chatResponse?.text && lastChatError) {
      throw lastChatError;
    }

    res.json({ answer: chatResponse?.text || 'I could not generate an answer at this time.' });
  } catch (err: any) {
    console.error('[Chat Error]:', err);
    res.status(500).json({ error: err.message || 'Chat service error' });
  }
});

// Endpoint: History List
app.get('/api/history', (req, res) => {
  if (!db) {
    return res.json({ sessions: [] });
  }

  try {
    const results = db.exec('SELECT id, user_query, concept_type, plan_json, created_at FROM sessions ORDER BY created_at DESC LIMIT 30;');
    if (results.length === 0 || !results[0].values) {
      return res.json({ sessions: [] });
    }

    const sessions = results[0].values.map((row: any[]) => {
      let planObj = {};
      try {
        planObj = JSON.parse(row[3]);
      } catch {}
      return {
        id: row[0],
        user_query: row[1],
        concept_type: row[2],
        plan: planObj,
        created_at: row[4],
      };
    });

    res.json({ sessions });
  } catch (err: any) {
    console.error('[Database Read Error]:', err);
    res.json({ sessions: [] });
  }
});

// Endpoint: Delete History Item
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  if (!db) return res.json({ success: true });

  try {
    const stmt = db.prepare('DELETE FROM sessions WHERE id = ?;');
    stmt.run([id]);
    stmt.free();
    saveDbToFile();
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dev & Production Server Setup
async function startServer() {
  if (!isProd) {
    // Dynamically mount Vite middlewares in development
    // Explicitly set hmr: false because HMR WebSockets are disabled in the AI Studio preview proxy
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false, watch: null },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    // Serve production static build
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Universal Visualiser] Server listening on http://0.0.0.0:${PORT} (${isProd ? 'production' : 'development'})`);
    console.log(`[AI] Primary configured model: ${PRIMARY_MODEL}, Fallback model: ${FALLBACK_MODEL}`);
    console.log(`[AI] Active model candidates list: ${JSON.stringify(MODEL_CANDIDATES)}`);
  });
}

startServer();
