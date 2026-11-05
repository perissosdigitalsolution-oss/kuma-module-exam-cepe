// ============================================================================
// KUMA Module: Examens CEPE/BEPC — Hono sub-app (mountable, self-contained).
//
// Embedded mode (host worker):
//   import { createExamModule } from '../../modules/exam-cepe/server/examModule';
//   app.route('/api/v1/modules/exam', createExamModule());
//
// Standalone mode: server/standalone/index.ts mounts the SAME factory.
// Only external dependency: hono (peer dependency of the module).
//
// NOTE: predictions are transparent heuristics over real mod_exam_* aggregates.
// Never present a predicted score as a certainty in user-facing UI.
// ============================================================================
import { Hono, type Context } from 'hono';

const ALLOWED_ROLES = new Set([
    'admin', 'director', 'directeur', 'directrice', 'founder', 'fondatrice',
    'manager', 'gestionnaire', 'teacher', 'enseignant',
]);

/** Minimal D1 surface used by the module (works with Cloudflare D1). */
export interface ModuleDB {
    prepare(sql: string): {
        bind(...vals: unknown[]): {
            first<T = Record<string, unknown>>(): Promise<T | null>;
            all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
            run(): Promise<unknown>;
        };
        first<T = Record<string, unknown>>(): Promise<T | null>;
        all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
    };
    batch(stmts: unknown[]): Promise<unknown>;
}

interface ModPayload { sub?: string; role?: string; schoolId?: string; tenantId?: string; email?: string }

export type ModEnv = {
    Bindings: { DB: ModuleDB; [k: string]: unknown };
    Variables: { tenantId: string; jwtPayload: ModPayload | null };
};

type ModContext = Context<ModEnv>;

function resolveContext(c: ModContext): { tenantId: string; role: string; userId: string } {
    const payload = (c.get('jwtPayload') || {}) as ModPayload;
    const tenantId = String(c.get('tenantId') || payload.schoolId || payload.tenantId || 'default');
    return { tenantId, role: String(payload.role || '').toLowerCase(), userId: String(payload.sub || '') };
}

function genId(prefix: string): string {
    return `${prefix}_${crypto.randomUUID().slice(0, 8)}`;
}

const EXAM_TYPES = ['blanc', 'blanc_2', 'anime', 'oral', 'dissertation'] as const;

export function createExamModule() {
    const app = new Hono<ModEnv>();

    // ── GET /v1/health — unauthenticated capability probe ───────────────────
    app.get('/v1/health', (c: ModContext) => c.json({
        module: 'kuma-module-exam-cepe',
        version: '1.0.0',
        status: 'ready',
        capabilities: ['exam-bank', 'results', 'statistics', 'risk-heuristics'],
        time: new Date().toISOString(),
    }));

    // ── POST /v1/question — add an exam to the bank (staff only) ────────────
    app.post('/v1/question', async (c: ModContext) => {
        try {
            const { tenantId, role, userId } = resolveContext(c);
            if (!ALLOWED_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);

            const body = await c.req.json<{
                title: string; subject: string; gradeLevel: string; examType: string;
                coefficient?: number; questionData?: unknown;
            }>();
            if (!body.title || !body.subject || !body.gradeLevel || !EXAM_TYPES.includes(body.examType as typeof EXAM_TYPES[number])) {
                return c.json({ error: 'title, subject, gradeLevel and a valid examType are required' }, 400);
            }

            const qId = genId('q');
            const now = new Date().toISOString();
            await c.env.DB.prepare(`
                INSERT INTO mod_exam_questions (id, school_id, title, subject, grade_level, exam_type, coefficient, question_data, published_date, created_by, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                qId, tenantId, body.title, body.subject, body.gradeLevel, body.examType,
                body.coefficient ?? 1, JSON.stringify(body.questionData ?? {}), now, userId, now
            ).run();

            return c.json({ success: true, questionId: qId }, 201);
        } catch (e) {
            console.error('[exam-module] question error:', e);
            return c.json({ error: 'Failed to add question' }, 500);
        }
    });

    // ── GET /v1/questions?subject=&grade=&type=&limit= ──────────────────────
    app.get('/v1/questions', async (c: ModContext) => {
        try {
            const { tenantId } = resolveContext(c);
            const subject = c.req.query('subject');
            const grade = c.req.query('grade');
            const type = c.req.query('type');
            const limit = Math.max(1, Math.min(200, Number(c.req.query('limit') || '50')));

            let sql = 'SELECT * FROM mod_exam_questions WHERE school_id = ?';
            const binds: unknown[] = [tenantId];
            if (subject) { sql += ' AND subject = ?'; binds.push(subject); }
            if (grade) { sql += ' AND grade_level = ?'; binds.push(grade); }
            if (type) { sql += ' AND exam_type = ?'; binds.push(type); }
            sql += ' ORDER BY published_date DESC LIMIT ?';
            binds.push(limit);

            const { results } = await c.env.DB.prepare(sql).bind(...binds).all();
            return c.json({ success: true, questions: results || [] });
        } catch (e) {
            console.error('[exam-module] questions error:', e);
            return c.json({ error: 'Failed to fetch questions' }, 500);
        }
    });

    // ── POST /v1/result — record a white-exam result (staff only) ───────────
    app.post('/v1/result', async (c: ModContext) => {
        try {
            const { tenantId, role, userId } = resolveContext(c);
            if (!ALLOWED_ROLES.has(role)) return c.json({ error: 'Forbidden' }, 403);

            const body = await c.req.json<{ studentId: string; questionId: string; score: number; maxScore?: number; notes?: string }>();
            if (!body.studentId || !body.questionId || typeof body.score !== 'number' || body.score < 0) {
                return c.json({ error: 'studentId, questionId and a non-negative score are required' }, 400);
            }

            const resId = genId('res');
            await c.env.DB.prepare(`
                INSERT INTO mod_exam_results (id, school_id, student_id, question_id, score, max_score, notes, teacher_id, evaluated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).bind(
                resId, tenantId, body.studentId, body.questionId, body.score,
                body.maxScore ?? 20, body.notes || null, userId, new Date().toISOString()
            ).run();

            return c.json({ success: true, resultId: resId }, 201);
        } catch (e) {
            console.error('[exam-module] result error:', e);
            return c.json({ error: 'Failed to save result' }, 500);
        }
    });

    // ── GET /v1/statistics/:classId — aggregates over real results ──────────
    app.get('/v1/statistics/:classId', async (c: ModContext) => {
        try {
            const { tenantId } = resolveContext(c);
            const classId = c.req.param('classId');

            const stats = await c.env.DB.prepare(`
                SELECT
                    COUNT(DISTINCT r.student_id) AS total_students,
                    ROUND(AVG(r.score * 100.0 / NULLIF(r.max_score, 0)), 1) AS avg_pct,
                    ROUND(SUM(CASE WHEN r.score * 100.0 / NULLIF(r.max_score, 0) >= 50 THEN 1 ELSE 0 END) * 100.0 / NULLIF(COUNT(r.id), 0), 1) AS pass_rate,
                    COUNT(r.id) AS result_count
                FROM mod_exam_results r
                JOIN students s ON s.id = r.student_id
                WHERE s.school_id = ?1 AND s.class_id = ?2
            `).bind(tenantId, classId).first<Record<string, number | null>>();

            return c.json({
                success: true,
                classId,
                statistics: {
                    totalStudents: Number(stats?.total_students ?? 0),
                    averagePct: Number(stats?.avg_pct ?? 0),
                    passRatePct: Number(stats?.pass_rate ?? 0),
                    resultCount: Number(stats?.result_count ?? 0),
                },
                basis: 'transparent-aggregate', // rule-based stats, never an opaque model score
            });
        } catch (e) {
            console.error('[exam-module] statistics error:', e);
            return c.json({ error: 'Failed to compute statistics' }, 500);
        }
    });

    // ── GET /v1/prediction/:studentId — transparent risk heuristic ──────────
    app.get('/v1/prediction/:studentId', async (c: ModContext) => {
        try {
            const { tenantId } = resolveContext(c);
            const studentId = c.req.param('studentId');

            const perf = await c.env.DB.prepare(`
                SELECT
                    COUNT(r.id) AS attempts,
                    ROUND(AVG(r.score * 100.0 / NULLIF(r.max_score, 0)), 1) AS avg_pct
                FROM mod_exam_results r
                WHERE r.school_id = ?1 AND r.student_id = ?2
            `).bind(tenantId, studentId).first<{ attempts: number; avg_pct: number | null }>();

            const attempts = Number(perf?.attempts ?? 0);
            const avgPct = Number(perf?.avg_pct ?? 0);

            if (attempts === 0) {
                return c.json({ success: true, studentId, configured: false, note: 'No white-exam results yet' });
            }

            // Transparent heuristic bands (NOT an ML model output).
            const riskLevel = avgPct < 40 ? 'critical' : avgPct < 60 ? 'high' : avgPct < 80 ? 'medium' : 'low';

            return c.json({
                success: true,
                studentId,
                configured: true,
                prediction: {
                    attempts,
                    averagePct: avgPct,
                    riskLevel,
                    method: 'heuristic-band', // qualified: rule-based bands over real aggregates
                },
            });
        } catch (e) {
            console.error('[exam-module] prediction error:', e);
            return c.json({ error: 'Failed to compute prediction' }, 500);
        }
    });

    return app;
}