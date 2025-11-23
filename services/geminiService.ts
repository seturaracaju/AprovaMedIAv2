
import { GoogleGenAI, Type } from "@google/genai";
import { QuizQuestion, TrueFlashcard } from '../types';

// Helper para obter a instância da IA apenas quando necessário
const getAI = () => {
    if (!process.env.API_KEY) {
        throw new Error("API_KEY environment variable not set");
    }
    return new GoogleGenAI({ apiKey: process.env.API_KEY });
};

// Helper to clean JSON string from Markdown formatting
const cleanJson = (text: string): string => {
    if (!text) return "";
    let cleaned = text.trim();
    // Remove markdown code blocks if present
    if (cleaned.startsWith("```")) {
        cleaned = cleaned.replace(/^```(json)?/, "").replace(/```$/, "");
    }
    return cleaned.trim();
};

const quizQuestionSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING, description: "O texto completo do enunciado da questão." },
        options: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Uma lista contendo as opções de resposta (A, B, C, D, E)."
        },
        correctAnswerIndex: { 
            type: Type.INTEGER, 
            description: "O índice (0-4) da resposta correta. OMITA se não encontrar." 
        },
        explanation: {
            type: Type.STRING,
            description: "A explicação detalhada ou comentário do professor associado a esta questão."
        },
        mediaUrl: {
            type: Type.STRING,
            description: "URL de imagem se houver."
        }
    },
    required: ['question', 'options']
};

// --- Helper para converter File em Base64 para o Gemini ---
const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => {
            const result = reader.result as string;
            // Remove o prefixo "data:image/jpeg;base64," para enviar apenas os bytes
            const base64 = result.split(',')[1];
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
};


export const answerQuestion = async (pdfText: string, userQuestion: string): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Com base estritamente no conteúdo do documento a seguir, responda à pergunta do usuário. Se a informação não estiver no documento, afirme que não consegue encontrar a resposta no texto fornecido.
        
        CONTEÚDO DO DOCUMENTO:
        """
        ${pdfText}
        """

        PERGUNTA DO USUÁRIO: "${userQuestion}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Não consegui gerar uma resposta.";
    } catch (error: any) {
        console.error("Erro ao responder pergunta:", error.message || error);
        return "Desculpe, encontrei um erro ao processar sua solicitação. Verifique a configuração da API Key.";
    }
};

// Helper function to process a single chunk
const extractQuestionsFromChunk = async (chunkText: string): Promise<QuizQuestion[] | null> => {
    let jsonString = '';
    try {
        const ai = getAI();
        
        const prompt = `Você é um especialista em processamento de provas médicas e concursos. Sua tarefa é analisar o texto abaixo e extrair questões estruturadas.

        O texto pode estar em dois formatos principais. Identifique qual está sendo usado e extraia de acordo:

        FORMATO 1 (Questão e Comentário Vinculados por ID):
        - As questões aparecem no início com um número identificador (ex: "9107)", "105.").
        - Os gabaritos/comentários aparecem no final do texto com O MESMO número identificador (ex: "9107.", "105.").
        - AÇÃO: Você DEVE cruzar essas informações. Extraia a questão do início e procure o comentário correspondente no final.
        - Coloque o texto do comentário no campo 'explanation'.
        - Extraia a resposta correta do texto do comentário (ex: "Resposta letra B") e preencha o 'correctAnswerIndex'.

        FORMATO 2 (Padrão):
        - Questões seguidas imediatamente pelo gabarito ou com gabarito em tabela.

        DIRETRIZES DE EXTRAÇÃO:
        1. 'question': O texto do enunciado. Mantenha o ID (ex: "9107)") no início do texto da pergunta para facilitar a identificação.
        2. 'options': Array com as alternativas.
        3. 'explanation': O texto completo do "Comentário" do professor, se houver vínculo pelo ID.
        4. 'correctAnswerIndex': O índice (0 para A, 1 para B...) da resposta correta. Tente inferir isso do bloco de comentários (ex: "Gabarito: A", "Resposta correta: B").

        TEXTO PARA ANÁLISE:
        """
        ${chunkText}
        """`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: quizQuestionSchema,
                },
            },
        });

        jsonString = response.text || "";
        if (!jsonString) {
             console.error("Erro ao extrair questões de um chunk: A IA retornou uma resposta vazia.");
             return [];
        }

        const parsed = JSON.parse(cleanJson(jsonString));
        
        // Post-process to ensure correctAnswerIndex is number or null, and other fields exist
        const processedQuestions: QuizQuestion[] = parsed.map((q: any) => ({
            question: q.question || '',
            options: q.options || [],
            correctAnswerIndex: q.correctAnswerIndex === undefined ? null : q.correctAnswerIndex,
            explanation: q.explanation || '',
            mediaUrl: q.mediaUrl || undefined,
        }));

        return processedQuestions;

    } catch (error: any) {
        console.error("Erro ao extrair questões de um chunk:", error.message || error);
        if(jsonString) {
            const errorMsg = (error as Error).message;
            console.error(`Falha ao analisar o seguinte texto da IA do chunk: ${errorMsg}`);
        }
        return [];
    }
};

export const extractQuestionsFromPdf = async (pdfText: string): Promise<QuizQuestion[] | null> => {
    // Aumentamos significativamente o CHUNK_SIZE para 100.000 caracteres (aprox 25k tokens).
    // O Gemini 2.5 Flash suporta contextos de até 1M tokens.
    // Isso permite que a IA veja a "Pergunta" (página 1) e a "Resposta" (página 50) no mesmo contexto,
    // possibilitando o vínculo pelo ID (ex: 9107) e a extração do comentário.
    const CHUNK_SIZE = 100000; 
    const CHUNK_OVERLAP = 2000; // Sobreposição para evitar corte no meio de uma questão

    const chunks: string[] = [];
    if (pdfText.length < CHUNK_SIZE) {
        chunks.push(pdfText);
    } else {
        for (let i = 0; i < pdfText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            chunks.push(pdfText.substring(i, i + CHUNK_SIZE));
        }
    }
    
    if (chunks.length > 1) {
        alert(`Documento extenso processado em ${chunks.length} partes para garantir precisão máxima na extração de gabaritos.`);
    }

    try {
        const allQuestions: QuizQuestion[] = [];
        // Process chunks sequentially to avoid rate limits and for easier debugging.
        for (const chunk of chunks) {
            const result = await extractQuestionsFromChunk(chunk);
            if (result) {
                allQuestions.push(...result);
            } else {
                 console.error("Um chunk do documento não pôde ser processado. O resultado pode estar incompleto.");
            }
        }
        
        // Remove duplicate questions that might have been extracted from overlapping chunks
        // We use the question text as the unique key
        const uniqueQuestions = Array.from(new Map(allQuestions.map(q => [q.question.trim(), q])).values());
        
        return uniqueQuestions;

    } catch (error: any) {
        console.error("Erro ao processar chunks de PDF:", error.message || error);
        return null;
    }
};

export const generateSummary = async (pdfText: string): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Crie um resumo conciso e informativo do seguinte documento. O resumo deve ser bem estruturado, usando cabeçalhos, listas e negrito para destacar os pontos-chave. O público-alvo são estudantes de medicina, então mantenha a terminologia técnica apropriada. O resumo deve ser útil para uma revisão rápida do material.

        CONTEÚDO DO DOCUMENTO:
        """
        ${pdfText.substring(0, 60000)} 
        """`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Não foi possível gerar o resumo.";
    } catch (error: any) {
        console.error("Erro ao gerar resumo:", error.message || error);
        return "Desculpe, encontrei um erro ao tentar gerar o resumo.";
    }
};

export const generateSummaryFromQuestions = async (context: string): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Com base no seguinte conjunto de perguntas, opções e explicações de um material de estudo, gere um resumo didático e bem estruturado. O resumo deve conectar os conceitos apresentados nas questões, explicando os tópicos de forma coesa e clara. Use formatação como negrito (**palavra**) e listas com asteriscos (* item) para organizar a informação.

        MATERIAL DE ESTUDO (PERGUNTAS E RESPOSTAS):
        """
        ${context}
        """

        RESUMO GERADO:`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Não foi possível gerar o resumo.";
    } catch (error: any) {
        console.error("Erro ao gerar resumo a partir de questões:", error.message || error);
        return "Desculpe, encontrei um erro ao tentar gerar o resumo a partir das questões selecionadas.";
    }
};


// --- ATUALIZAÇÃO FLASHCARDS INOVADORES ---

const flashcardSchema = {
    type: Type.OBJECT,
    properties: {
        question: { type: Type.STRING, description: "A pergunta concisa do flashcard." },
        answer: { type: Type.STRING, description: "A resposta direta e informativa." },
        tag: { type: Type.STRING, description: "Uma etiqueta curta (1-2 palavras) do conceito central (ex: 'Cardio', 'Farmaco')." },
        mnemonic: { type: Type.STRING, description: "Uma frase mnemônica curta ou dica criativa para ajudar a memorizar a resposta (Opcional)." }
    },
    required: ['question', 'answer', 'tag']
};


export const extractTrueFlashcards = async (pdfText: string): Promise<TrueFlashcard[]> => {
    try {
        const ai = getAI();
        const prompt = `Analise o texto a seguir, material de estudo de medicina. Sua missão é criar "Neuro-Flashcards" de alto impacto para memorização ativa.
        
        Diretrizes:
        1. Extraia os conceitos vitais.
        2. Formato Pergunta/Resposta direto.
        3. **Mnemônico**: Sempre que possível, crie uma dica de memorização criativa ou macete.
        4. **Tag**: Categorize o card com uma tag curta.

        Exemplos:
        - Q: "Tríade de Beck?" A: "Hipotensão, abafamento de bulhas, estase jugular." Tag: "Cardio" Mnemônico: "H.A.E. - Hoje A Bulha Estoura"
        
        Crie pelo menos 10 a 15 cards.

        CONTEÚDO DO DOCUMENTO:
        """
        ${pdfText.substring(0, 60000)}
        """`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: flashcardSchema,
                },
            },
        });
        
        const jsonString = response.text;
        if (!jsonString) return [];
        
        // Mapeia para incluir propriedades opcionais se a IA as gerar
        const rawData = JSON.parse(cleanJson(jsonString));
        return rawData.map((card: any) => ({
            question: card.question,
            answer: card.answer,
            tag: card.tag,
            mnemonic: card.mnemonic
        }));

    } catch (error: any) {
        console.error("Erro ao extrair flashcards:", error.message || error);
        return [];
    }
};

export const refineFlashcardText = async (text: string, type: 'question' | 'answer'): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Atue como um editor sênior de materiais didáticos. Melhore o seguinte texto de um flashcard (${type === 'question' ? 'Pergunta' : 'Resposta'}). Torne-o mais claro, conciso e fácil de memorizar, mantendo o conteúdo técnico correto. Retorne APENAS o texto melhorado.
        
        Texto Original: "${text}"`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });
        return response.text?.trim() || text;
    } catch {
        return text;
    }
};

const answerKeyUpdateSchema = {
    type: Type.OBJECT,
    properties: {
        questionIdentifier: {
            type: Type.STRING,
            description: "O número ou identificador da questão (ex: '9107'). Extraia SOMENTE os dígitos."
        },
        correctOptionLetter: {
            type: Type.STRING,
            description: "A letra da opção correta (ex: 'A', 'B')."
        },
        explanation: {
            type: Type.STRING,
            description: "O texto completo do comentário ou justificativa do gabarito."
        }
    },
    required: ['questionIdentifier', 'correctOptionLetter']
};

// Nova função para processar chunks de gabarito
const processAnswerKeyChunk = async (chunkText: string): Promise<{ identifier: string; option: string; explanation?: string }[]> => {
    let jsonString = '';
    try {
       const ai = getAI();
       const prompt = `Analise o texto de gabarito comentado abaixo.
       
       Sua missão: Extrair o ID da questão, a letra da resposta correta e o comentário explicativo.

       FORMATO DO TEXTO ESPERADO:
       "9107. Comentário: O texto explica o porquê... Resposta letra B."
       
       INSTRUÇÕES:
       1. **Identificador**: Extraia apenas o número (ex: '9107' de '9107.').
       2. **Comentário/Explicação**: Extraia todo o texto após 'Comentário:' até o final do bloco.
       3. **Letra Correta**: Identifique a letra final (ex: "Resposta letra B" -> "B", "Gabarito C" -> "C").

       IMPORTANTE: 
       - Ignore cabeçalhos ou rodapés.
       - Foque nos blocos que começam com número seguido de ponto e "Comentário".
       
       Retorne um JSON Array com objetos contendo: questionIdentifier, correctOptionLetter, explanation.

       TEXTO:
       """
       ${chunkText}
       """`;
       
       const response = await ai.models.generateContent({
           model: 'gemini-2.5-flash',
           contents: prompt,
           config: {
               responseMimeType: "application/json",
               responseSchema: {
                   type: Type.ARRAY,
                   items: answerKeyUpdateSchema,
               },
           },
       });
       
       jsonString = response.text || "";
       if (!jsonString) return [];

       const parsed = JSON.parse(cleanJson(jsonString));
       return parsed.map((item: any) => ({
           identifier: item.questionIdentifier ? item.questionIdentifier.replace(/[^0-9]/g, '') : '', // Keep only digits
           option: item.correctOptionLetter.trim().toUpperCase(),
           explanation: item.explanation || ''
       }));

    } catch (error) {
       console.error("Erro ao processar chunk de gabarito:", error);
       return [];
    }
};

export const processAnswerKey = async (answerKeyText: string): Promise<{ identifier: string; option: string; explanation?: string }[] | null> => {
    // Reduzimos o CHUNK_SIZE para garantir que a saída JSON (que agora inclui comentários longos) não estoure o limite de tokens de saída.
    const CHUNK_SIZE = 25000; 
    const CHUNK_OVERLAP = 500;

    const chunks: string[] = [];
    if (answerKeyText.length < CHUNK_SIZE) {
        chunks.push(answerKeyText);
    } else {
        for (let i = 0; i < answerKeyText.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
            chunks.push(answerKeyText.substring(i, i + CHUNK_SIZE));
        }
    }

    try {
        const allAnswers: { identifier: string; option: string; explanation?: string }[] = [];
        
        for (const chunk of chunks) {
            const chunkResults = await processAnswerKeyChunk(chunk);
            allAnswers.push(...chunkResults);
        }

        // Deduplicar resultados baseados no identificador (mantendo o último/mais completo se houver sobreposição)
        const uniqueAnswers = Array.from(new Map(allAnswers.map(item => [item.identifier, item])).values());
        
        return uniqueAnswers;

    } catch (error) {
        console.error("Erro fatal no processamento do gabarito:", error);
        return null;
    }
};


export const getAIHint = async (question: string, options: string[]): Promise<string> => {
    try {
        const ai = getAI();
        const prompt = `Para a seguinte questão de múltipla escolha, forneça uma dica sutil que guie o aluno para a resposta correta sem revelá-la diretamente. A dica deve ser concisa e focada no conceito chave.

        Questão: "${question}"
        Opções:
        ${options.map((opt, i) => `- ${String.fromCharCode(65 + i)}: ${opt}`).join('\n')}
        
        Dica:`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Dica indisponível.";
    } catch (error: any) {
        console.error("Erro ao gerar dica da IA:", error.message || error);
        return "Não foi possível gerar uma dica neste momento.";
    }
};

// --- NOVAS FUNÇÕES FASE 2 ---

export const generateSimilarQuestion = async (originalQuestion: QuizQuestion): Promise<QuizQuestion | null> => {
    try {
        const ai = getAI();
        const prompt = `Com base na questão de múltipla escolha abaixo, crie uma **nova questão similar** que teste o mesmo conceito fundamental, mas com um cenário, valores ou contexto diferentes. A nova questão deve ter 5 alternativas e indicar a correta. Se possível, adicione uma explicação breve.

        QUESTÃO ORIGINAL:
        "${originalQuestion.question}"
        Opções:
        ${originalQuestion.options.map((opt, i) => `- ${opt}`).join('\n')}
        Resposta Correta: ${originalQuestion.options[originalQuestion.correctAnswerIndex || 0]}

        Retorne APENAS o JSON no formato especificado.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        question: { type: Type.STRING },
                        options: { type: Type.ARRAY, items: { type: Type.STRING } },
                        correctAnswerIndex: { type: Type.INTEGER },
                        explanation: { type: Type.STRING }
                    },
                    required: ['question', 'options', 'correctAnswerIndex']
                }
            }
        });

        const jsonString = response.text;
        if (!jsonString) return null;
        return JSON.parse(cleanJson(jsonString)) as QuizQuestion;

    } catch (error) {
        console.error("Erro ao gerar questão similar:", error);
        return null;
    }
};

export const generateStudyInsights = async (analyticsData: any): Promise<string> => {
    try {
        const ai = getAI();
        if (!analyticsData || analyticsData.totalSessions === 0) {
            return "Comece a estudar para que eu possa analisar seu desempenho e gerar estratégias personalizadas!";
        }

        const prompt = `Você é um mentor de estudos de medicina de alta performance e ultra-estratégico. Analise os dados de desempenho do aluno abaixo e gere um "Diagnóstico Estratégico" curto (máx 3 parágrafos).
        
        DADOS DO ALUNO:
        - Média Geral em Testes: ${analyticsData.testAverage}%
        - Precisão em Flashcards: ${analyticsData.flashcardAccuracy}%
        - Pontos Fortes: ${analyticsData.strengths.map((s: any) => `${s.subjectName} (${s.accuracy}%)`).join(', ')}
        - Pontos Fracos: ${analyticsData.weaknesses.map((w: any) => `${w.subjectName} (${w.accuracy}%)`).join(', ')}
        
        Sua resposta deve:
        1. Analisar criticamente os pontos fracos (se houver).
        2. Sugerir uma ação concreta para HOJE.
        3. Manter um tom motivador mas exigente, focado em aprovação.
        
        Não use saudações genéricas. Vá direto ao ponto.`;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        return response.text || "Continue estudando para gerar insights.";
    } catch (error) {
        console.error("Erro ao gerar insights:", error);
        return "Não foi possível gerar insights de estudo no momento.";
    }
};

// --- NOVA FUNÇÃO FASE 3: OCR / Visão ---
export const transcribeImage = async (file: File): Promise<string> => {
    try {
        const ai = getAI();
        const base64Data = await fileToBase64(file);
        
        const prompt = `
            Analise esta imagem. Ela pode conter anotações manuscritas, trechos de livros, slides de aula ou provas escaneadas.
            
            Sua tarefa é:
            1. Transcrever TODO o texto legível da imagem com alta precisão.
            2. Se houver diagramas ou tabelas, descreva-os em texto estruturado.
            3. Mantenha a formatação original (tópicos, parágrafos) tanto quanto possível.
            4. Ignore ruídos visuais ou marcas de dobra.
            
            Retorne apenas o texto transcrito.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: [
                { text: prompt },
                { inlineData: { mimeType: file.type, data: base64Data } }
            ]
        });

        return response.text || "Não foi possível ler o texto da imagem.";

    } catch (error: any) {
        console.error("Erro ao transcrever imagem:", error.message || error);
        return "Ocorreu um erro ao tentar ler a imagem. Verifique se o arquivo é válido.";
    }
};

// --- NOVA FUNÇÃO FASE 5: Gerar Explicações Automáticas ---
export const generateExplanationsForQuestions = async (questions: QuizQuestion[]): Promise<QuizQuestion[]> => {
    try {
        const ai = getAI();
        
        // Mapear apenas o necessário para o prompt e garantir que não haja undefined
        const promptQuestions = questions.map((q, i) => ({
            id: i,
            question: q.question || "",
            options: q.options || [],
            correctAnswer: q.correctAnswerIndex !== null && q.options && q.options[q.correctAnswerIndex] ? q.options[q.correctAnswerIndex] : 'Não especificado'
        }));

        const prompt = `Você é um professor de medicina de elite. Abaixo estão questões de prova.
        
        Sua missão: Para cada questão, crie um "Comentário" (explicação) didático, completo e conciso.
        
        O comentário deve:
        1. Explicar POR QUE a resposta correta está correta.
        2. Explicar brevemente por que as outras alternativas estão incorretas (se aplicável).
        3. Ser direto ao ponto e fácil de entender para um estudante.
        
        QUESTÕES:
        ${JSON.stringify(promptQuestions, null, 2)}
        
        Retorne um JSON Object estritamente com o formato: 
        {
            "explanations": [
                { "id": number, "explanation": string }
            ]
        }
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        explanations: {
                            type: Type.ARRAY,
                            items: {
                                type: Type.OBJECT,
                                properties: {
                                    id: { type: Type.INTEGER },
                                    explanation: { type: Type.STRING }
                                },
                                required: ['id', 'explanation']
                            }
                        }
                    },
                    required: ['explanations']
                },
            },
        });

        const jsonString = response.text;
        if (!jsonString) return questions;

        // Try parsing with cleaning (handles markdown wrapping)
        const parsedData = JSON.parse(cleanJson(jsonString));
        
        // Handle potential response variations (root object vs array)
        let explanations: any[] = [];
        if (parsedData.explanations && Array.isArray(parsedData.explanations)) {
            explanations = parsedData.explanations;
        } else if (Array.isArray(parsedData)) {
            explanations = parsedData;
        }
        
        if (explanations.length === 0) return questions;

        // Merge explanations back into original questions
        const updatedQuestions = [...questions];
        explanations.forEach((item: any) => {
            // Ensure item.id is within bounds
            if (typeof item.id === 'number' && updatedQuestions[item.id]) {
                updatedQuestions[item.id] = {
                    ...updatedQuestions[item.id],
                    explanation: item.explanation
                };
            }
        });

        return updatedQuestions;

    } catch (error) {
        console.error("Erro ao gerar explicações automáticas:", error);
        return questions; // Retorna sem alterações em caso de erro
    }
};
