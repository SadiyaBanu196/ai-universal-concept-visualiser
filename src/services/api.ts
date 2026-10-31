/**
 * Client-Side API Service
 * Handles communication with the server-side Gemini and SQLite endpoints
 */

import { VisualizationPlan, VisualizationSession, ChatMessage, QuizQuestion } from '../types/visualization';
import { validateAndNormalizePlan } from '../utils/planValidator';

export interface RetryProgress {
  isRetrying: boolean;
  attempt: number;
  maxAttempts: number;
  message: string;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function isTransientClientError(status: number, errData: any): boolean {
  if (status === 400 || status === 401 || status === 403 || status === 404) {
    return false;
  }

  const errType = errData?.error?.type || '';
  if (
    errType === 'CONFIG_ERROR' ||
    errType === 'INVALID_INPUT' ||
    errType === 'AI_PLANNING_FAILED' ||
    errType === 'AI_INVALID_RESPONSE'
  ) {
    return false;
  }

  if (
    status === 503 ||
    status === 429 ||
    status === 502 ||
    status === 504 ||
    errType === 'AI_SERVICE_UNAVAILABLE'
  ) {
    return true;
  }

  const msg = (errData?.error?.message || errData?.error || '').toString().toLowerCase();
  if (
    msg.includes('503') ||
    msg.includes('429') ||
    msg.includes('unavailable') ||
    msg.includes('high demand') ||
    msg.includes('temporarily') ||
    msg.includes('overloaded') ||
    msg.includes('rate limit') ||
    msg.includes('quota')
  ) {
    return true;
  }

  return false;
}

export async function generateVisualizationPlan(
  prompt: string,
  imageBase64?: string,
  onRetryProgress?: (progress: RetryProgress) => void
): Promise<{ plan: VisualizationPlan; error?: string }> {
  const maxRetries = 3;
  const backoffDelays = [1000, 2000, 4000]; // 1s, 2s, 4s

  for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
    try {
      const res = await fetch('/api/generate-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, imageBase64 }),
      });

      if (res.ok) {
        const data = await res.json();
        const validated = validateAndNormalizePlan(data.plan);

        if (validated.error || !validated.plan) {
          return { plan: null as any, error: validated.error || 'Invalid visualization plan structure received.' };
        }

        return { plan: validated.plan };
      }

      // Handle non-ok status
      const errData = await res.json().catch(() => ({
        error: { message: `HTTP ${res.status} error` },
      }));

      const isTransient = isTransientClientError(res.status, errData);

      if (isTransient && attempt <= maxRetries) {
        const delay = backoffDelays[attempt - 1] || 4000;
        onRetryProgress?.({
          isRetrying: true,
          attempt,
          maxAttempts: maxRetries,
          message: `AI service is temporarily busy. Retrying... ${attempt}/${maxRetries}`,
        });
        await sleep(delay);
        continue;
      }

      // If permanent or max retries reached
      if (isTransient) {
        return {
          plan: null as any,
          error: 'The AI service is temporarily unavailable. Please try again.',
        };
      }

      const errMsg =
        errData.error?.message ||
        (typeof errData.error === 'string' ? errData.error : 'Failed to generate visual plan.');
      return { plan: null as any, error: errMsg };
    } catch (networkErr: any) {
      if (attempt <= maxRetries) {
        const delay = backoffDelays[attempt - 1] || 4000;
        onRetryProgress?.({
          isRetrying: true,
          attempt,
          maxAttempts: maxRetries,
          message: `AI service is temporarily busy. Retrying... ${attempt}/${maxRetries}`,
        });
        await sleep(delay);
        continue;
      }

      return {
        plan: null as any,
        error: 'The AI service is temporarily unavailable. Please try again.',
      };
    }
  }

  return {
    plan: null as any,
    error: 'The AI service is temporarily unavailable. Please try again.',
  };
}

export async function askFollowUpTutor(
  plan: VisualizationPlan,
  history: ChatMessage[],
  question: string
): Promise<{ answer: string; error?: string }> {
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan, history, question }),
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({ error: 'Error processing chat query' }));
      return { answer: '', error: errData.error || 'Server error occurred' };
    }

    const data = await res.json();
    return { answer: data.answer };
  } catch (err: any) {
    return { answer: '', error: err.message || 'Chat service communication error' };
  }
}

export async function fetchHistory(): Promise<VisualizationSession[]> {
  try {
    const res = await fetch('/api/history');
    if (!res.ok) return [];
    const data = await res.json();
    return data.sessions || [];
  } catch {
    return [];
  }
}

export async function saveSession(session: VisualizationSession): Promise<boolean> {
  try {
    const res = await fetch('/api/history', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(session),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function deleteSession(id: string): Promise<boolean> {
  try {
    const res = await fetch(`/api/history/${id}`, {
      method: 'DELETE',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function checkServerHealth(): Promise<{ status: string; hasApiKey: boolean }> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return { status: 'error', hasApiKey: false };
    return await res.json();
  } catch {
    return { status: 'offline', hasApiKey: false };
  }
}
