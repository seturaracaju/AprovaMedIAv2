import { GoogleGenAI } from "@google/genai";
import { UserRole, DashboardAnalytics, StudentAnalytics } from '../types';
import * as dashboardService from './dashboardService';
import * as analyticsService from './analyticsService';

// Helper para obter a instância da IA apenas quando necessário
const getAI = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

const getTeacherContext = async (): Promise<string> => {
    const analytics = await dashboardService.getDashboardAnalytics();
    let context = `
        **Visão Geral da Plataforma:**
        - Total de Alunos: ${analytics.totalStudents}
        - Total de Cursos: ${analytics.totalCourses}
        - Total de Módulos: ${analytics.totalModules}
        - Total de Disciplinas: ${analytics.totalDisciplines}
        - Total de Questões: ${analytics.totalQuestions}
        - Média Geral em Testes: ${analytics.platformAverageScore}%
        - Precisão Geral em Flashcards: ${analytics.platformFlashcardAccuracy}%

        **Análise de Desempenho:**
        - Top Alunos (Desempenho): ${analytics.topPerformingStudents.map(s => `${s.name} (${s.score} pts)`).join(', ')}
        - Alunos Mais Ativos: ${analytics.mostActiveStudents.map(s => `${s.name} (${s.activityCount} ações)`).join(', ')}
        - Desempenho por Curso: ${analytics.coursePerformance.map(c => `${c.name} (${c.averageScore}%)`).join(', ')}

        **Análise de Conteúdo:**
        - Assuntos Mais Difíceis (menor precisão): ${analytics.hardestSubjects.map(s => `${s.name} (${s.accuracy}%)`).join(', ')}
        - Assuntos Mais Fáceis (maior precisão): ${analytics.easiestSubjects.map(s => `${s.name} (${s.accuracy}%)`).join(', ')}
    `;
    return context;
};

const getStudentContext = async (studentId: string): Promise<string> => {
    const analytics = await analyticsService.getStudentComprehensiveAnalytics(studentId);
    if (!analytics) return "Não foi possível carregar os dados deste aluno.";
    
    let context = `
        **Dados do Aluno:**
        - Progresso Geral no Curso: ${analytics.overallProgress}%
        - Média em Testes: ${analytics.testAverage}%
        - Precisão em Flashcards: ${analytics.flashcardAccuracy}%
        - Dias de Estudo (constância): ${analytics.studyDays}
        - Total de Sessões de Estudo: ${analytics.totalSessions}

        **Análise de Desempenho Pessoal:**
        - Pontos Fortes (Assuntos com maior precisão): ${analytics.strengths.map(s => `${s.subjectName} em ${s.disciplineName} (${s.accuracy}%)`).join(', ')}
        - Pontos Fracos (Assuntos com menor precisão): ${analytics.weaknesses.map(w => `${w.subjectName} em ${w.disciplineName} (${w.accuracy}%)`).join(', ')}
    `;
    return context;
};


export const getTutorResponse = async (userMessage: string, userRole: UserRole): Promise<string> => {
    try {
        const ai = getAI();
        let systemInstruction = '';
        let contextData = '';

        if (userRole.role === 'teacher') {
            systemInstruction = `Você é o Tutor IA, um coordenador acadêmico especialista. Sua função é ajudar o professor a analisar o desempenho da plataforma e dos alunos. Use os dados de contexto para fornecer insights, identificar problemas e sugerir planos de ação. Seja analítico e direto.`;
            contextData = await getTeacherContext();
        } else {
            systemInstruction = `Você é o Tutor IA, um mentor de estudos amigável e incentivador. Sua função é ajudar o aluno ${userRole.studentName} em sua jornada. Use os dados de contexto sobre o progresso e desempenho dele para responder a dúvidas, sugerir o que estudar (focando nos pontos fracos), criar planos de estudo e manter a motivação. Não invente informações sobre o desempenho do aluno; baseie-se estritamente nos dados fornecidos.`;
            contextData = await getStudentContext(userRole.studentId);
        }

        const prompt = `
            ${systemInstruction}

            ---
            **DADOS DE CONTEXTO ATUALIZADOS:**
            ${contextData}
            ---

            **PERGUNTA DO USUÁRIO:**
            "${userMessage}"
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Não consegui gerar uma resposta.";

    } catch (error: any) {
        console.error("Erro ao obter resposta do Tutor IA:", error.message || error);
        return "Desculpe, não consegui processar sua solicitação no momento. Tente novamente mais tarde.";
    }
};

export const getInitialTutorMessage = async (userRole: UserRole): Promise<string> => {
     if (userRole.role === 'teacher') {
        const analytics = await dashboardService.getDashboardAnalytics();
        if (analytics.hardestSubjects.length > 0) {
            const subject = analytics.hardestSubjects[0];
            return `Olá! Notei que o assunto "${subject.name}" está com a menor média de acertos (${subject.accuracy}%). Que tal analisarmos o desempenho dos alunos neste tópico?`;
        }
        return "Olá! Estou pronto para ajudar a analisar os dados da plataforma. O que você gostaria de saber?";
    } else {
        const analytics = await analyticsService.getStudentComprehensiveAnalytics(userRole.studentId);
        if (analytics && analytics.weaknesses.length > 0) {
            const weakness = analytics.weaknesses[0];
            return `Olá, ${userRole.studentName}! Vi que você está indo bem. Notei que o assunto "${weakness.subjectName}" (${weakness.accuracy}%) é um ponto a ser melhorado. Gostaria de focar nele hoje ou prefere outro tópico?`;
        }
        return `Olá, ${userRole.studentName}! Estou aqui para ajudar. O que vamos estudar hoje?`;
    }
};