// ============================================================================
// KUMA Module: Examens — API Client Autonome
// ============================================================================
const MODULE_API_PATH = '/api/v1/modules/exam';
const DEFAULT_TOKEN_KEY = 'kuma_token';

/**
 * API base resolution — per-site correctness, NO foreign fallback:
 *   1. an explicit apiBase (injected by the host) always wins
 *   2. local proxy-served (localhost / LAN) → the local Worker (:8787),
 *      because the module routes live on the Worker (the NestJS gateway
 *      does not mount them)
 *   3. VITE_API_URL (build-time, set per site) → absolute
 *   4. otherwise → same-origin relative
 * A module that WRITES (question bank, results) must never silently
 * target another school's API: there is deliberately no hardcoded
 * worker URL here.
 */
export function resolveApiBase(apiBase?: string): string {
    if (apiBase) return apiBase.replace(/\/$/, '');
    if (typeof window === 'undefined') return MODULE_API_PATH;
    const host = window.location.hostname;
    const isProxyServed = host === 'localhost' || host === '127.0.0.1' || host === '::1'
        || host.startsWith('192.168.') || host.startsWith('10.')
        || /^172\.(1[6-9]|2\d|3[01])\./.test(host);
    if (isProxyServed) return `${window.location.protocol}//${host}:8787${MODULE_API_PATH}`;
    const envBase = (import.meta.env.VITE_API_URL || '').replace(/\/api\/v1$/, '');
    return envBase ? `${envBase}${MODULE_API_PATH}` : MODULE_API_PATH;
}

/**
 * Token resolver — injectable (the host passes its own provider), default:
 * the KUMA platform key `kuma_token`. The old `authToken` key was never
 * written by the platform, so every module call was unauthenticated.
 */
export function resolveToken(getToken?: () => string | null): string {
    if (getToken) return getToken() || '';
    try { return localStorage.getItem(DEFAULT_TOKEN_KEY) || ''; } catch { return ''; }
}

export interface ExamOptions {
    /** Explicit module API base (host injects it). */
    apiBase?: string;
    /** Token provider (host injects it). */
    getToken?: () => string | null;
}

export const ExamService = {
    async addQuestion(data: { title: string; subject: string; gradeLevel: string; examType: string; coefficient?: number }, opts?: ExamOptions): Promise<{ success: boolean; questionId: string }> {
        const res = await fetch(`${resolveApiBase(opts?.apiBase)}/v1/question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolveToken(opts?.getToken)}` },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getQuestions(filters?: { subject?: string; grade?: string; type?: string }, opts?: ExamOptions): Promise<any[]> {
        const params = new URLSearchParams();
        if (filters?.subject) params.set('subject', filters.subject);
        if (filters?.grade) params.set('grade', filters.grade);
        if (filters?.type) params.set('type', filters.type);

        const res = await fetch(`${resolveApiBase(opts?.apiBase)}/v1/questions?${params}`, {
            headers: { 'Authorization': `Bearer ${resolveToken(opts?.getToken)}` }
        });
        const data = await res.json();
        return data.success ? data.questions : [];
    },

    async saveResult(data: { studentId: string; questionId: string; score: number; maxScore?: number; notes?: string }, opts?: ExamOptions): Promise<{ success: boolean; resultId: string }> {
        const res = await fetch(`${resolveApiBase(opts?.apiBase)}/v1/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${resolveToken(opts?.getToken)}` },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getStatistics(classId: string, subject?: string, opts?: ExamOptions): Promise<any> {
        // NOTE: a leading '/' path passed to `new URL(path, base)` REPLACES the
        // base path — the /api/v1/modules/exam prefix was being dropped
        // (the call answered 404). The path is now appended to the base.
        const url = new URL(`${resolveApiBase(opts?.apiBase)}/v1/statistics/${classId}`);
        if (subject) url.searchParams.set('subject', subject);
        const res = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${resolveToken(opts?.getToken)}` }
        });
        const data = await res.json();
        return data.success ? data.statistics : null;
    },

    async getPrediction(studentId: string, opts?: ExamOptions): Promise<any> {
        const res = await fetch(`${resolveApiBase(opts?.apiBase)}/v1/prediction/${studentId}`, {
            headers: { 'Authorization': `Bearer ${resolveToken(opts?.getToken)}` }
        });
        const data = await res.json();
        return data.success ? data.prediction : null;
    },
    // NOTE: the module server exposes NO '/v1/compute-predictions' route —
    // the old frontend method called a path that could only ever 404, so it
    // was dead code and has been removed rather than kept as a trap.
};
