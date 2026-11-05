// ============================================================================
// KUMA Module: Examens — API Client Autonome
// ============================================================================
const DEFAULT_API_BASE = '/api/v1/modules/exam';

export const ExamService = {
    async addQuestion(data: { title: string; subject: string; gradeLevel: string; examType: string; coefficient?: number }): Promise<{ success: boolean; questionId: string }> {
        const res = await fetch(`${DEFAULT_API_BASE}/question`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getQuestions(filters?: { subject?: string; grade?: string; type?: string }): Promise<any[]> {
        const params = new URLSearchParams();
        if (filters?.subject) params.set('subject', filters.subject);
        if (filters?.grade) params.set('grade', filters.grade);
        if (filters?.type) params.set('type', filters.type);
        
        const res = await fetch(`${DEFAULT_API_BASE}/questions?${params}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` }
        });
        const data = await res.json();
        return data.success ? data.questions : [];
    },

    async saveResult(data: { studentId: string; questionId: string; score: number; maxScore?: number; notes?: string }): Promise<{ success: boolean; resultId: string }> {
        const res = await fetch(`${DEFAULT_API_BASE}/result`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` },
            body: JSON.stringify(data)
        });
        return res.json();
    },

    async getStatistics(classId: string, subject?: string): Promise<any> {
        const url = new URL(`/v1/statistics/${classId}`, DEFAULT_API_BASE);
        if (subject) url.searchParams.set('subject', subject);
        const res = await fetch(url.toString(), {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` }
        });
        const data = await res.json();
        return data.success ? data.statistics : null;
    },

    async getPrediction(studentId: string): Promise<any> {
        const res = await fetch(`${DEFAULT_API_BASE}/prediction/${studentId}`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` }
        });
        const data = await res.json();
        return data.success ? data.prediction : null;
    },

    async computePredictions(classId: string): Promise<{ success: boolean; message: string }> {
        const res = await fetch(`${DEFAULT_API_BASE}/compute-predictions`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('authToken') || ''}` },
            body: JSON.stringify({ classId })
        });
        return res.json();
    }
};