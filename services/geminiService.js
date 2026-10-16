const fs = require('fs');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');

// Ensure environment variables from .env are loaded if not already present
if (!process.env.GEMINI_API_KEY && typeof process.loadEnvFile === 'function') {
  const envPath = path.resolve(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    try {
      process.loadEnvFile(envPath);
    } catch (_) {}
  }
}

const ALLOWED_SEVERITIES = new Set(['CRITICAL', 'HIGH', 'MODERATE', 'LOW', 'INFO']);

/**
 * Checks if the Gemini API key is configured in environment variables.
 * Ensures placeholder text in .env.example is not treated as a valid key.
 */
function isConfigured() {
  const key = process.env.GEMINI_API_KEY;
  if (!key || typeof key !== 'string') return false;
  const trimmed = key.trim();
  if (trimmed.length < 10) return false;
  if (trimmed.toLowerCase().includes('your_gemini') || trimmed.toLowerCase().includes('placeholder')) return false;
  return true;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Sanitize and validate the structured JSON response from the AI model.
 * Enforces strict typing, length bounding, UUID formatting, and allowed severities.
 */
function validateAndSanitizeInsights(parsed) {
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('AI response is not a valid JSON object.');
  }

  // 1. Validate executive summary (bounded to 1000 characters)
  let summary = typeof parsed.summary === 'string' ? parsed.summary.trim() : '';
  if (!summary) {
    summary = 'Inventory analysis synthesized from current operational catalog data.';
  }
  if (summary.length > 1000) {
    summary = summary.slice(0, 1000);
  }

  // 2. Validate findings array (bounded to max 25 findings)
  const rawFindings = Array.isArray(parsed.findings) ? parsed.findings.slice(0, 25) : [];
  const findings = rawFindings.map((f, idx) => {
    if (!f || typeof f !== 'object' || Array.isArray(f)) {
      return {
        title: `Inventory Finding #${idx + 1}`,
        severity: 'INFO',
        product_id: null,
        evidence: 'Data reviewed from catalog metrics.',
        explanation: 'Factual status based on current stock balance.',
        recommended_action: 'Review current stock level in the inventory catalog.'
      };
    }

    let severity = typeof f.severity === 'string' ? f.severity.trim().toUpperCase() : 'INFO';
    if (!ALLOWED_SEVERITIES.has(severity)) {
      severity = 'INFO';
    }

    // Strictly validate product_id as a UUID format to prevent script or garbage strings
    let productId = null;
    if (typeof f.product_id === 'string' && UUID_REGEX.test(f.product_id.trim())) {
      productId = f.product_id.trim();
    }

    const title = typeof f.title === 'string' && f.title.trim()
      ? f.title.trim().slice(0, 150)
      : `Inventory Observation #${idx + 1}`;

    const evidence = typeof f.evidence === 'string' && f.evidence.trim()
      ? f.evidence.trim().slice(0, 300)
      : 'Operational telemetry reviewed.';

    const explanation = typeof f.explanation === 'string' && f.explanation.trim()
      ? f.explanation.trim().slice(0, 500)
      : 'Evaluation based on deterministic stock metrics.';

    const recommendedAction = typeof f.recommended_action === 'string' && f.recommended_action.trim()
      ? f.recommended_action.trim().slice(0, 300)
      : 'Review stock policy and demand trends.';

    return {
      title,
      severity,
      product_id: productId,
      evidence,
      explanation,
      recommended_action: recommendedAction
    };
  });

  // 3. Validate limitations array (bounded to max 10 items, 300 chars each)
  let limitations = [];
  if (Array.isArray(parsed.limitations)) {
    limitations = parsed.limitations
      .filter(l => typeof l === 'string' && l.trim())
      .map(l => l.trim().slice(0, 300))
      .slice(0, 10);
  } else if (typeof parsed.limitations === 'string' && parsed.limitations.trim()) {
    limitations = [parsed.limitations.trim().slice(0, 300)];
  }

  if (limitations.length === 0) {
    limitations = [
      'Analysis is grounded in historical completed dispatch velocity and active purchase orders over the evaluated lookback window.'
    ];
  }

  return {
    summary,
    findings,
    limitations
  };
}

/**
 * Construct safe, prompt-minimized text for the AI analyst.
 * Strips all secrets, auth tokens, customer names, supplier emails, and phone numbers.
 */
function buildAnalystPrompt(sanitizedData) {
  const { business, summary, products } = sanitizedData;

  const header = [
    `BUSINESS WORKSPACE CONTEXT:`,
    `- Business Name: ${business.name || 'Small Business Workspace'}`,
    `- Operating Currency: ${business.currency || 'INR'}`,
    `- Total Evaluated Products: ${summary.total_evaluated_products || 0}`,
    `- Depleted Stock Items (0 on-hand): ${summary.critical_depleted_count || 0}`,
    `- High Stockout Risk Items: ${summary.high_risk_count || 0}`,
    `- Moderate Risk Items: ${summary.moderate_risk_count || 0}`,
    `- Calibrating / Insufficient History Items: ${summary.insufficient_data_count || 0}`,
    `- Healthy Items: ${summary.healthy_count || 0}`,
    `- Total Reorder Capital Required: ${business.currency || 'INR'} ${summary.total_estimated_reorder_cost || 0}`
  ].join('\n');

  const productList = products.map((p, i) => {
    return [
      `Product #${i + 1}: ${p.name} (SKU: ${p.sku || 'N/A'}, Category: ${p.category || 'General'})`,
      `  - product_id: ${p.product_id}`,
      `  - Stock: on-hand=${p.current_stock}, min_safety_level=${p.minimum_stock}, inbound_po=${p.incoming_stock}`,
      `  - Demand: avg_daily_sales=${p.average_daily_sales}/day, runway_days=${p.days_of_stock_remaining !== null ? p.days_of_stock_remaining : 'uncalibrated'}`,
      `  - Historical Sufficiency: ${p.has_sufficient_history ? 'SUFFICIENT_HISTORY' : 'INSUFFICIENT_HISTORY (<14d catalog age or <2 completed orders)'}`,
      `  - Velocity Trend: ${p.demand_trend || 'N/A'}`,
      `  - Deterministic Risk: ${p.risk_category}`,
      `  - Suggested Replenishment: +${p.suggested_reorder_qty} units (Est. Cost: ${business.currency || 'INR'} ${p.estimated_reorder_cost})`
    ].join('\n');
  }).join('\n\n');

  return `
You are the StockPilot AI Inventory Analyst. Analyze the following verified, deterministic inventory data for this business.

${header}

EVALUATED PRODUCT INVENTORY DATA:
${productList || 'No products in catalog.'}

INSTRUCTIONS:
1. Provide a concise, high-impact executive summary (2-3 sentences) evaluating the business's inventory health, immediate cash liabilities, and exposure to stockouts.
2. Generate a prioritized list of findings (ordered by severity: CRITICAL, HIGH, MODERATE, LOW, INFO):
   - Highlight depleted products (stock = 0) and high-risk products (runway <= 7 days or below min safety stock).
   - When evaluating demand or slow-moving stock: Differentiate low sales velocity from INSUFFICIENT HISTORY. If has_sufficient_history is false, explicitly label it as calibrating rather than assuming poor demand.
   - Factor in incoming purchase orders: if an inbound PO satisfies the deficit, acknowledge it so capital is not double-spent.
   - For each finding, provide:
     * title: clear, professional headline
     * severity: CRITICAL | HIGH | MODERATE | LOW | INFO
     * product_id: the exact product_id from the data when referencing a specific item, or null for general findings
     * evidence: brief factual metrics (e.g. "Stock 0 / Min 15, burn rate 1.2/day, 0 inbound")
     * explanation: root cause or operational consequence
     * recommended_action: concrete next step (e.g. "Issue purchase order for 25 units immediately")
3. Include limitations noting that newly listed items require ongoing order volume before runway calculations calibrate.
4. Output MUST be strictly valid JSON according to this schema:
{
  "summary": "...",
  "findings": [
    {
      "title": "...",
      "severity": "CRITICAL",
      "product_id": "...",
      "evidence": "...",
      "explanation": "...",
      "recommended_action": "..."
    }
  ],
  "limitations": [
    "..."
  ]
}
`.trim();
}

/**
 * Generate AI-powered inventory insights using Google Gemini.
 * Enforces server-side timeout, input minimization, and strict schema validation.
 */
async function generateInventoryInsights(sanitizedData, options = {}) {
  if (!isConfigured()) {
    const err = new Error('AI Inventory Analyst is not configured. Please set the GEMINI_API_KEY server environment variable to enable AI insights.');
    err.code = 'AI_NOT_CONFIGURED';
    err.status = 503;
    throw err;
  }

  const apiKey = process.env.GEMINI_API_KEY.trim();
  const modelName = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';
  const timeoutMs = options.timeoutMs || 25000;

  const ai = new GoogleGenAI({ apiKey });
  const prompt = buildAnalystPrompt(sanitizedData);

  // Setup strict server-side timeout race
  let timerId = null;
  const timeoutPromise = new Promise((_, reject) => {
    timerId = setTimeout(() => {
      const err = new Error(`AI synthesis timed out after ${timeoutMs / 1000} seconds.`);
      err.code = 'AI_TIMEOUT';
      err.status = 504;
      reject(err);
    }, timeoutMs);
  });

  let actualModelUsed = modelName;

  async function executeGeneration() {
    try {
      actualModelUsed = modelName;
      return await ai.models.generateContent({
        model: modelName,
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          temperature: 0.2,
          maxOutputTokens: 2048
        }
      });
    } catch (err) {
      if ((err.status === 503 || (err.message && err.message.includes('503'))) && modelName !== 'gemini-flash-lite-latest') {
        console.warn(`[Gemini] Model ${modelName} returned 503 capacity spike. Retrying with fallback gemini-flash-lite-latest...`);
        actualModelUsed = 'gemini-flash-lite-latest';
        return await ai.models.generateContent({
          model: 'gemini-flash-lite-latest',
          contents: prompt,
          config: {
            responseMimeType: 'application/json',
            temperature: 0.2,
            maxOutputTokens: 2048
          }
        });
      }
      throw err;
    }
  }

  try {
    const apiCall = executeGeneration();
    const response = await Promise.race([apiCall, timeoutPromise]);
    clearTimeout(timerId);

    const rawText = response.text || '';
    if (!rawText.trim()) {
      throw new Error('AI provider returned an empty response.');
    }

    // Clean any accidental markdown wrap
    const cleanedText = rawText
      .replace(/^```json\s*/i, '')
      .replace(/^```\s*/i, '')
      .replace(/\s*```$/i, '')
      .trim();

    let parsed = null;
    try {
      parsed = JSON.parse(cleanedText);
    } catch (parseErr) {
      const err = new Error('Failed to parse AI response as valid JSON.');
      err.code = 'AI_MALFORMED_OUTPUT';
      err.status = 502;
      err.rawResponse = cleanedText.slice(0, 300);
      throw err;
    }

    const validated = validateAndSanitizeInsights(parsed);
    return {
      model: actualModelUsed,
      insights: validated
    };
  } catch (err) {
    if (timerId) clearTimeout(timerId);

    // Sanitize any potential API key leakage in error messages using literal replacement
    if (err.message && apiKey && err.message.includes(apiKey)) {
      err.message = err.message.replaceAll(apiKey, '[REDACTED_API_KEY]');
    }

    // Pass through status and code if already set
    if (!err.status) {
      if (err.message && err.message.includes('429')) {
        err.status = 429;
        err.code = 'AI_RATE_LIMIT';
      } else {
        err.status = 502;
        err.code = 'AI_PROVIDER_ERROR';
      }
    }
    throw err;
  }
}

module.exports = {
  isConfigured,
  generateInventoryInsights,
  validateAndSanitizeInsights,
  buildAnalystPrompt
};
