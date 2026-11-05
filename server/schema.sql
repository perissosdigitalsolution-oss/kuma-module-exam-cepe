-- ============================================================================
-- KUMA Module: Examens CEPE/BEPC v1.0.0 — Autonome & Bridge Mode
-- ============================================================================

-- Épreuves blanches et sujets d'années antérieures
CREATE TABLE IF NOT EXISTS mod_exam_questions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    grade_level TEXT NOT NULL,
    exam_type TEXT NOT NULL CHECK(exam_type IN ('blanc', 'blanc_2', 'anime', 'oral', 'dissertation')),
    file_path TEXT,                        -- R2 pour fichier PDF si besoin
    file_size INTEGER,
    file_type TEXT DEFAULT 'pdf',
    question_data TEXT,                    -- JSON pour questions interactives
    coefficient REAL DEFAULT 1.0,
    published_date TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_q_subject ON mod_exam_questions(school_id, subject);
CREATE INDEX IF NOT EXISTS idx_mod_q_level ON mod_exam_questions(grade_level);
CREATE INDEX IF NOT EXISTS idx_mod_q_type ON mod_exam_questions(exam_type);

-- Bulletins blancs (résultats des entraînements)
CREATE TABLE IF NOT EXISTS mod_exam_results (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    question_id TEXT NOT NULL REFERENCES mod_exam_questions(id),
    score REAL NOT NULL CHECK(score BETWEEN 0 AND 100),
    max_score REAL DEFAULT 20,
    notes TEXT,
    teacher_id TEXT,
    evaluated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_results_student ON mod_exam_results(student_id);
CREATE INDEX IF NOT EXISTS idx_mod_results_question ON mod_exam_results(question_id);

-- Statistiques de réussite par matière/classe
CREATE TABLE IF NOT EXISTS mod_exam_statistics (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_id TEXT NOT NULL,
    period TEXT NOT NULL,                    -- 'trimestre_1', 'semestre', 'annuel'
    avg_score REAL DEFAULT 0,
    pass_rate REAL DEFAULT 0,               -- % d'élèves >= 50% ou >= 500/1000 selon barème
    total_students INTEGER DEFAULT 0,
    median REAL DEFAULT 0,
    std_deviation REAL DEFAULT 0,
    prediction_model TEXT,                  -- 'linear_regression', 'random_forest', 'heuristic'
    computed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_stats_class ON mod_exam_statistics(school_id, class_id);
CREATE INDEX IF NOT EXISTS idx_mod_stats_subject ON mod_exam_statistics(subject);

-- Prédiction de réussite pour chaque élève
CREATE TABLE IF NOT EXISTS mod_exam_predictions (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    student_id TEXT NOT NULL,
    subject TEXT NOT NULL,
    predicted_score REAL,
    risk_level TEXT CHECK(risk_level IN ('low', 'medium', 'high', 'critical')),
    confidence REAL CHECK(confidence BETWEEN 0 AND 1),
    factors TEXT,                           -- JSON: absence_rate, avg_grade, etc.
    computed_at TEXT NOT NULL DEFAULT (datetime('now')),
    model_version TEXT DEFAULT 'heuristic_v1'
);

CREATE INDEX IF NOT EXISTS idx_mod_pred_student ON mod_exam_predictions(student_id);
CREATE INDEX IF NOT EXISTS idx_mod_pred_risk ON mod_exam_predictions(risk_level);

-- Activity Log
CREATE TABLE IF NOT EXISTS mod_exam_activity_log (
    id TEXT PRIMARY KEY,
    school_id TEXT NOT NULL,
    action TEXT NOT NULL,
    category TEXT DEFAULT 'exam',
    details TEXT,
    user_id TEXT,
    timestamp TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_mod_exam_activity_timestamp ON mod_exam_activity_log(timestamp);