
import { supabase } from './supabaseClient';
import { Course, Module, Discipline, QuestionSet, QuestionBank, QuizQuestion } from '../types';

export const getQuestionBank = async (): Promise<QuestionBank> => {
    // Mudança: Busca direta na tabela em vez de RPC para evitar erros de função não encontrada
    const { data, error } = await supabase
        .from('question_sets')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Erro ao ler a tabela question_sets:", error.message || error);
        return {};
    }
    if (!data) return {};

    const bank: QuestionBank = {};
    for (const set of data) {
        // Mapeamento manual para garantir que o frontend receba camelCase
        bank[set.id] = {
            id: set.id,
            disciplineId: set.discipline_id,
            subjectName: set.subject_name, // O banco retorna subject_name
            questions: set.questions,
            image_url: set.image_url,
            createdAt: set.created_at,
            relevance: set.relevance,
            incidence: set.incidence,
            difficulty: set.difficulty
        };
    }
    return bank;
};

export const getQuestionSetById = async (id: string): Promise<QuestionSet | null> => {
    const { data, error } = await supabase
        .from('question_sets')
        .select('*')
        .eq('id', id)
        .single();
    
    if (error) {
        console.error(`Error fetching question set ${id}:`, error.message);
        return null;
    }
    
    // Map snake_case to camelCase manually
    return {
        id: data.id,
        disciplineId: data.discipline_id,
        subjectName: data.subject_name,
        questions: data.questions,
        image_url: data.image_url,
        createdAt: data.created_at,
        relevance: data.relevance,
        incidence: data.incidence,
        difficulty: data.difficulty
    } as QuestionSet;
};

export const getQuestionSetsByDiscipline = async (disciplineId: string): Promise<QuestionSet[]> => {
    const { data, error } = await supabase
        .from('question_sets')
        .select('*')
        .eq('discipline_id', disciplineId)
        .order('created_at', { ascending: false });

    if (error) {
        console.error("Error fetching question sets by discipline:", error.message);
        return [];
    }

    return (data || []).map((set: any) => ({
        id: set.id,
        disciplineId: set.discipline_id,
        subjectName: set.subject_name,
        questions: set.questions,
        image_url: set.image_url,
        createdAt: set.created_at,
        relevance: set.relevance,
        incidence: set.incidence,
        difficulty: set.difficulty
    }));
};


export const getStructuredQuestionBank = async (): Promise<Course[]> => {
    const { data, error } = await supabase.rpc('get_structured_academic_content');
    if (error) {
        console.error("Error fetching structured question bank from RPC:", error.message || error);
        return [];
    }
    return data || [];
};

export const saveQuestionSet = async (disciplineId: string, subjectName: string, questions: QuizQuestion[]): Promise<QuestionSet | null> => {
    const { data, error } = await supabase.rpc('save_question_set', {
        p_discipline_id: disciplineId,
        p_subject_name: subjectName,
        p_questions: questions,
    }).select().single();

    if (error) {
        console.error('Error saving question set:', error.message || error);
        return null;
    }
    return data;
};

export const updateQuestionSetDetails = async (id: string, updates: { subjectName?: string; imageUrl?: string }): Promise<QuestionSet | null> => {
    const updatePayload: { subject_name?: string; image_url?: string } = {};
    if (updates.subjectName) {
        updatePayload.subject_name = updates.subjectName;
    }
    if (updates.imageUrl !== undefined) {
        updatePayload.image_url = updates.imageUrl;
    }

    if (Object.keys(updatePayload).length === 0) {
        const { data } = await supabase.from('question_sets').select().eq('id', id).single();
        return data;
    }

    const { data, error } = await supabase
        .from('question_sets')
        .update(updatePayload)
        .eq('id', id)
        .select()
        .single();
    
    if (error) { 
        console.error('Error updating question set details:', error.message || error); 
        return null; 
    }
    return data;
};

export const updateQuestionSetQuestions = async (id: string, questions: QuizQuestion[]): Promise<boolean> => {
    // Ensure the questions array is valid JSON
    if (!Array.isArray(questions)) {
        console.error("Invalid questions format provided to updateQuestionSetQuestions");
        return false;
    }

    const { error } = await supabase
        .from('question_sets')
        .update({ questions: questions })
        .eq('id', id);

    if (error) { 
        console.error('CRITICAL: Error updating question set questions:', error.message || error); 
        console.error('Set ID:', id);
        return false; 
    }
    
    console.log(`Question set ${id} updated successfully. Question count: ${questions.length}`);
    return true;
};

export const deleteQuestionSet = async (id: string): Promise<void> => {
    // Tenta realizar a exclusão em cascata manualmente para garantir limpeza
    console.log(`Iniciando exclusão robusta do assunto ${id}...`);

    try {
        // 1. Encontrar sessões de estudo vinculadas a este assunto
        const { data: sessions } = await supabase
            .from('flashcard_sessions')
            .select('id')
            .eq('question_set_id', id);

        if (sessions && sessions.length > 0) {
            const sessionIds = sessions.map(s => s.id);
            console.log(`Encontradas ${sessionIds.length} sessões vinculadas. Limpando dados...`);

            // 1.1 Deletar respostas dessas sessões
            await supabase.from('flashcard_responses').delete().in('session_id', sessionIds);
            
            // 1.2 Deletar as sessões
            await supabase.from('flashcard_sessions').delete().in('id', sessionIds);
        }

        // 2. Deletar avaliações de dificuldade (ratings)
        await supabase.from('student_question_ratings').delete().eq('question_set_id', id);
        
        // 3. Remover da biblioteca de alunos
        await supabase.from('student_library').delete().eq('question_set_id', id);
        
        // 4. Remover progresso de flashcards
        await supabase.from('flashcard_progress').delete().eq('question_set_id', id);

        // 5. Remover do Marketplace se estiver lá (Novo passo crucial)
        await supabase.from('marketplace_items').delete().match({ content_id: id, content_type: 'question_set' });

        // 6. Finalmente, deletar o assunto principal
        const { error } = await supabase.from('question_sets').delete().eq('id', id);
        
        if (error) {
            console.error('Erro final ao deletar question_set:', error.message);
            throw new Error(`Erro de banco de dados: ${error.message}`);
        }
        
        console.log(`Assunto ${id} excluído com sucesso.`);

    } catch (error: any) {
        console.error('Erro crítico durante a exclusão:', error);
        throw new Error(`Falha na exclusão: ${error.message || 'Erro desconhecido'}`);
    }
};

export const moveQuestionSet = async (questionSetId: string, newDisciplineId: string): Promise<boolean> => {
    const { error } = await supabase
        .from('question_sets')
        .update({ discipline_id: newDisciplineId })
        .eq('id', questionSetId);
    
    if (error) {
        console.error('Error moving question set:', error.message || error);
        return false;
    }
    return true;
};
