// ─── Fortress AI — Swytchcode AI Adapter ─────────────────────────────
// Controlled execution layer connecting Fortress AI to Swytchcode v2.20.15 kernel
// Integration: vibewright.openai@1.0.0 (openai.responsesbetatrue.create)

import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

export class SwytchcodeAIAdapter {
  constructor(options = {}) {
    this.canonicalId = options.canonicalId || 'openai.responsesbetatrue.create';
    this.timeoutMs = options.timeoutMs || 10000;
    this.isAvailable = true;
  }

  /**
   * Execute model response generation capability through the Swytchcode CLI kernel
   * @param {string} instructions - System instructions / doctrine guidelines
   * @param {string|Object} input - Input context / serialized game state
   * @param {Object} options - Additional options
   * @returns {Promise<Object>} Parsed JSON response content
   */
  async executeModelResponse(instructions, input, options = {}) {
    const model = options.model || 'gpt-4o-mini';
    const tempFileName = `swy_resp_${Date.now()}_${Math.random().toString(36).substring(2, 7)}.json`;
    const tempFilePath = path.join(os.tmpdir(), tempFileName);

    const inputString = typeof input === 'string' ? input : JSON.stringify(input);

    const payload = {
      model,
      instructions: String(instructions || ''),
      input: inputString,
    };

    console.log(`[SWYTCHCODE] AI execution started (tool: ${this.canonicalId}, model: ${model})`);

    // Write payload to a temporary file for swytchcode exec --body
    fs.writeFileSync(tempFilePath, JSON.stringify(payload, null, 2), 'utf-8');

    return new Promise((resolve, reject) => {
      const cmd = `swytchcode exec ${this.canonicalId} --json --body "${tempFilePath}"`;
      
      exec(cmd, {
        cwd: process.cwd(),
        timeout: this.timeoutMs,
        windowsHide: true,
      }, (err, stdout, stderr) => {
        // Cleanup temp file safely
        try {
          if (fs.existsSync(tempFilePath)) {
            fs.unlinkSync(tempFilePath);
          }
        } catch (cleanupErr) {
          // ignore cleanup error
        }

        if (err) {
          console.warn(`[SWYTCHCODE] fallback used (${err.message})`);
          return reject(err);
        }

        if (!stdout || stdout.trim().length === 0) {
          console.warn('[SWYTCHCODE] fallback used (empty stdout)');
          return reject(new Error('Swytchcode returned empty output'));
        }

        try {
          const responseObj = JSON.parse(stdout);
          
          if (responseObj.error) {
            console.warn(`[SWYTCHCODE] fallback used (${responseObj.error})`);
            return reject(new Error(`Swytchcode error: ${responseObj.error}`));
          }

          // Extract content from BetaResponse text or output item text
          let rawText = responseObj.text;
          if (!rawText && Array.isArray(responseObj.output) && responseObj.output.length > 0) {
            const firstOutput = responseObj.output[0];
            if (Array.isArray(firstOutput.content) && firstOutput.content.length > 0) {
              rawText = firstOutput.content[0].text;
            } else if (firstOutput.text) {
              rawText = firstOutput.text;
            }
          }

          if (!rawText) {
            console.warn('[SWYTCHCODE] fallback used (missing response text)');
            return reject(new Error('No text or output text found in Swytchcode response'));
          }

          console.log(`[SWYTCHCODE] AI execution completed (response length: ${rawText.length} chars)`);
          const parsed = JSON.parse(rawText);
          resolve(parsed);
        } catch (parseErr) {
          console.warn(`[SWYTCHCODE] fallback used (${parseErr.message})`);
          reject(parseErr);
        }
      });
    });
  }
}
