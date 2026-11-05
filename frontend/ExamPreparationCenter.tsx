// ============================================================================
// KUMA Module: Examens — Frontend Autonome
// ============================================================================
import React from 'react';
import { ExamService } from './exam.service';

interface Props {
    lang?: 'fr' | 'en';
    apiBase?: string;
}

export default function ExamPreparationCenter({ lang = 'fr', apiBase }: Props) {
    const [loading, setLoading] = React.useState(false);
    const [message, setMessage] = React.useState<string | null>(null);
    const [statistics, setStatistics] = React.useState<any>(null);

    const fetchStatistics = async () => {
        setLoading(true);
        try {
            const stats = await ExamService.getStatistics('class_001', apiBase);
            setStatistics(stats);
        } catch (e) {
            setMessage(lang === 'fr' ? 'Erreur de chargement' : 'Load error');
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => { fetchStatistics(); }, []);

    const handleAddQuestion = async () => {
        const title = prompt(lang === 'fr' ? 'Titre de la question:' : 'Question title:');
        if (!title) return;
        
        try {
            await ExamService.addQuestion({
                title,
                subject: 'Mathématiques',
                gradeLevel: 'CM2',
                examType: 'blanc'
            }, apiBase);
            setMessage(lang === 'fr' ? 'Question ajoutée' : 'Question added');
            fetchStatistics();
        } catch (e) {
            setMessage(lang === 'fr' ? 'Erreur' : 'Error');
        }
    };

    return (
        <div className="p-6 bg-white rounded-lg shadow-md">
            <h2 className="text-xl font-bold mb-4">
                {lang === 'fr' ? 'Préparation aux Examens' : 'Exam Preparation'}
            </h2>
            
            {message && <div className="mb-4 p-3 rounded bg-blue-50 text-blue-700">{message}</div>}

            {loading ? (
                <p>{lang === 'fr' ? 'Chargement...' : 'Loading...'}</p>
            ) : statistics && (
                <div className="grid grid-cols-3 gap-4 mb-4">
                    <div className="p-4 bg-blue-100 rounded">
                        <div className="font-bold">{statistics.avg_score?.toFixed(1)}%</div>
                        <div className="text-xs">{lang === 'fr' ? 'Moyenne générale' : 'Avg Score'}</div>
                    </div>
                    <div className="p-4 bg-green-100 rounded">
                        <div className="font-bold">{statistics.pass_rate?.toFixed(1)}%</div>
                        <div className="text-xs">{lang === 'fr' ? 'Taux de réussite' : 'Pass Rate'}</div>
                    </div>
                    <div className="p-4 bg-purple-100 rounded">
                        <div className="font-bold">{statistics.total_students}</div>
                        <div className="text-xs">{lang === 'fr' ? 'Élèves' : 'Students'}</div>
                    </div>
                </div>
            )}

            <button onClick={handleAddQuestion} className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700">
                {lang === 'fr' ? 'Ajouter Question' : 'Add Question'}
            </button>
        </div>
    );
}