
import React, { useState, useEffect, useMemo, FC } from 'react';
import { Course, Module, Discipline, OfficialSummary, QuestionSet } from '../types';
import * as academicService from '../services/academicService';
import * as geminiService from '../services/geminiService';
import * as questionBankService from '../services/questionBankService';
import { FileTextIcon, ChevronRightIcon, XIcon, EditIcon, TrashIcon, SaveIcon, BrainCircuitIcon, PlusCircleIcon, SearchIcon, RefreshCwIcon, DownloadIcon } from './IconComponents';
import { jsPDF } from 'jspdf';

// --- Helper Components ---

// Renders a single hidden word for study mode
const HiddenWord: FC<{ word: string }> = ({ word }) => {
    const [isRevealed, setIsRevealed] = useState(false);
    if (isRevealed) {
        return <strong className="text-primary animate-pulse">{word}</strong>;
    }
    return (
        <button
            onClick={() => setIsRevealed(true)}
            className="px-2 py-0.5 bg-gray-300 rounded-md text-gray-300 hover:bg-gray-400 hover:text-gray-400 transition-colors"
            style={{ minWidth: `${word.length * 0.5}rem` }}
        >
            {word}
        </button>
    );
};

// Renders the summary content, parsing markdown for bold and handling study mode
const SummaryContent: FC<{ content: string; isStudyMode: boolean }> = ({ content, isStudyMode }) => {
    const processContent = (text: string) => {
        if (isStudyMode) {
            const parts = text.split(/(\*\*.*?\*\*)/g);
            return parts.map((part, index) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                    const word = part.slice(2, -2);
                    return <HiddenWord key={index} word={word} />;
                }
                return <span key={index}>{part}</span>;
            });
        }
        // Simple markdown to HTML for bold and lists
        const htmlContent = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/<\/li>\n<li>/g, '</li><li>') // Join list items
            .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>'); // Wrap in ul

        return <div dangerouslySetInnerHTML={{ __html: htmlContent }} />;
    };

    return <div className="prose prose-lg max-w-none whitespace-pre-wrap">{processContent(content)}</div>;
};

// The modal for reading, studying, and editing a summary
const SummaryReaderModal: FC<{
    summary: OfficialSummary;
    onClose: () => void;
    onSave: (id: string, updates: { title: string; content: string }) => Promise<void>;
    onDelete: (id: string) => void;
    isEditable: boolean;
}> = ({ summary, onClose, onSave, onDelete, isEditable }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [isStudyMode, setIsStudyMode] = useState(false);
    const [title, setTitle] = useState(summary.title);
    const [content, setContent] = useState(summary.content);
    const [isSaving, setIsSaving] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const handleSave = async () => {
        setIsSaving(true);
        await onSave(summary.id, { title, content });
        setIsSaving(false);
        setIsEditing(false);
    };

    const handleDelete = () => {
        if (window.confirm("Tem certeza que deseja excluir este resumo?")) {
            onDelete(summary.id);
            onClose();
        }
    };

    const handleDownloadPDF = () => {
        setIsDownloading(true);
        try {
            const doc = new jsPDF({
                orientation: 'p',
                unit: 'mm',
                format: 'a4',
            });

            // Prepara o HTML para o PDF (converter markdown simples para tags HTML)
            // Isso garante que o texto fique visível e formatado (negrito), sem "esconder" nada.
            const htmlContent = content
                .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Negrito
                .replace(/^\* (.*$)/gm, '<li>$1</li>') // Listas
                .replace(/<\/li>\n<li>/g, '</li><li>') 
                .replace(/(<li>.*<\/li>)/gs, '<ul>$1</ul>')
                .replace(/\n/g, '<br>'); // Quebras de linha

            const printableElement = document.createElement('div');
            printableElement.innerHTML = `
                <div style="width: 170mm; font-family: Helvetica, Arial, sans-serif; font-size: 12pt; line-height: 1.5; color: #333;">
                    <h1 style="color: #0D9488; font-size: 18pt; margin-bottom: 10px; border-bottom: 2px solid #0D9488; padding-bottom: 5px;">${title}</h1>
                    <div style="text-align: justify;">
                        ${htmlContent}
                    </div>
                    <div style="margin-top: 20px; border-top: 1px solid #ccc; padding-top: 5px; text-align: center; font-size: 9pt; color: #888;">
                        Gerado por AprovaMed IA
                    </div>
                </div>
            `;
            
            // CORREÇÃO: Posiciona o elemento em 0,0 mas atrás de tudo (z-index negativo).
            // Mover para left: -9999px costuma causar renderização em branco no html2canvas.
            printableElement.style.position = 'absolute';
            printableElement.style.top = '0';
            printableElement.style.left = '0';
            printableElement.style.zIndex = '-9999';
            printableElement.style.backgroundColor = '#ffffff'; // Fundo branco explícito
            
            document.body.appendChild(printableElement);

            doc.html(printableElement, {
                callback: (doc) => {
                    doc.save(`${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.pdf`);
                    document.body.removeChild(printableElement);
                    setIsDownloading(false);
                },
                x: 20,
                y: 20,
                width: 170, // Largura útil A4 (210mm) - margens (20mm * 2) = 170mm
                windowWidth: 1000, // Largura da janela virtual aumentada para garantir renderização correta
            });

        } catch (error) {
            console.error("Erro ao gerar PDF:", error);
            alert("Não foi possível gerar o PDF. Tente novamente.");
            setIsDownloading(false);
        }
    };
    
    return (
         <div className="fixed inset-0 bg-black/50 z-40 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-4xl h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b bg-gray-50 flex-shrink-0 flex justify-between items-center">
                    {isEditing ? (
                        <input value={title} onChange={e => setTitle(e.target.value)} className="text-xl font-bold text-gray-800 bg-white border-b-2 border-primary focus:outline-none w-full mr-4"/>
                    ) : (
                        <h2 className="text-xl font-bold text-gray-800 truncate flex-1 mr-4">{title}</h2>
                    )}
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={handleDownloadPDF} 
                            disabled={isDownloading}
                            className="p-2 rounded-lg hover:bg-gray-200 text-gray-600 disabled:opacity-50"
                            title="Baixar PDF"
                        >
                            {isDownloading ? (
                                <div className="w-5 h-5 border-2 border-gray-500 border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <DownloadIcon className="w-5 h-5" />
                            )}
                        </button>
                        <button onClick={() => setIsStudyMode(!isStudyMode)} className={`px-3 py-1.5 text-sm font-semibold rounded-lg flex items-center gap-2 transition-colors ${isStudyMode ? 'bg-primary/20 text-primary' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}>
                           <BrainCircuitIcon className="w-4 h-4" /> Modo Estudo
                        </button>
                        <button onClick={onClose} className="p-2 rounded-full hover:bg-gray-200"><XIcon className="w-5 h-5 text-gray-600" /></button>
                    </div>
                </header>
                <main className="flex-grow p-6 overflow-y-auto">
                     {isEditing ? (
                        <textarea value={content} onChange={e => setContent(e.target.value)} className="w-full h-full p-2 border rounded-md resize-none"/>
                    ) : (
                        <SummaryContent content={content} isStudyMode={isStudyMode} />
                    )}
                </main>
                 {isEditable && (
                    <footer className="p-3 bg-gray-100 border-t flex-shrink-0 flex justify-end items-center gap-3">
                        {isEditing ? (
                             <button onClick={handleSave} disabled={isSaving} className="px-4 py-2 bg-primary text-white font-semibold rounded-lg flex items-center gap-2 disabled:bg-gray-400">
                                <SaveIcon className="w-5 h-5" /> {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        ) : (
                            <>
                                <button onClick={handleDelete} className="px-4 py-2 bg-red-100 text-red-700 font-semibold rounded-lg flex items-center gap-2 hover:bg-red-200">
                                    <TrashIcon className="w-5 h-5" /> Excluir
                                </button>
                                <button onClick={() => setIsEditing(true)} className="px-4 py-2 bg-gray-200 text-gray-800 font-semibold rounded-lg flex items-center gap-2 hover:bg-gray-300">
                                    <EditIcon className="w-5 h-5" /> Editar
                                </button>
                            </>
                        )}
                    </footer>
                )}
            </div>
        </div>
    );
};

// --- Create Summary Modal ---
interface CreateSummaryModalProps {
    onClose: () => void;
    onSave: (details: { disciplineId: string; title: string; content: string }) => Promise<void>;
}
const CreateSummaryModal: FC<CreateSummaryModalProps> = ({ onClose, onSave }) => {
    const [title, setTitle] = useState('');
    const [content, setContent] = useState('');
    const [courses, setCourses] = useState<Course[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedModuleId, setSelectedModuleId] = useState('');
    const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
    const [error, setError] = useState('');
    const [isSaving, setIsSaving] = useState(false);
    
    const [contentSource, setContentSource] = useState<'manual' | 'ai'>('manual');
    const [availableQuestionSets, setAvailableQuestionSets] = useState<QuestionSet[]>([]);
    const [selectedQuestionSetIds, setSelectedQuestionSetIds] = useState<Set<string>>(new Set());
    const [isLoadingSets, setIsLoadingSets] = useState(false);

    useEffect(() => {
        // Fetch structure for dropdowns
        const loadStructure = async () => {
            const coursesData = await academicService.getCourses();
            setCourses(coursesData);
        };
        loadStructure();
    }, []);

    useEffect(() => {
        if (selectedCourseId) {
            academicService.getModules(selectedCourseId).then(setModules);
            setSelectedModuleId('');
            setDisciplines([]);
            setSelectedDisciplineId('');
        }
    }, [selectedCourseId]);

    useEffect(() => {
        if (selectedModuleId) {
            academicService.getDisciplines(selectedModuleId).then(setDisciplines);
            setSelectedDisciplineId('');
        }
    }, [selectedModuleId]);

    // Fetch Question Sets when discipline changes
    useEffect(() => {
        if (selectedDisciplineId) {
            const fetchSets = async () => {
                setIsLoadingSets(true);
                const sets = await questionBankService.getQuestionSetsByDiscipline(selectedDisciplineId);
                setAvailableQuestionSets(sets);
                setIsLoadingSets(false);
                setSelectedQuestionSetIds(new Set());
            };
            fetchSets();
        } else {
            setAvailableQuestionSets([]);
        }
    }, [selectedDisciplineId]);

    const handleToggleQuestionSet = (id: string) => {
        setSelectedQuestionSetIds(prev => {
            const next = new Set(prev);
            if (next.has(id)) {
                next.delete(id);
            } else {
                next.add(id);
            }
            return next;
        });
    };

    const handleSaveClick = async () => {
        setError('');
        if (!title.trim() || !selectedDisciplineId) {
            setError('Título e disciplina são obrigatórios.');
            return;
        }

        setIsSaving(true);
        let finalContent = content;

        try {
            if (contentSource === 'ai') {
                if (selectedQuestionSetIds.size === 0) {
                    throw new Error('Por favor, selecione ao menos um assunto para gerar o resumo.');
                }
                
                const selectedSets = availableQuestionSets.filter(qs => selectedQuestionSetIds.has(qs.id));
                const allQuestions = selectedSets.flatMap(qs => qs.questions);

                if (allQuestions.length === 0) {
                    throw new Error('Os assuntos selecionados não contêm questões para gerar o resumo.');
                }

                const context = allQuestions.map((q, i) =>
                    `Questão ${i + 1}: ${q.question}\n` +
                    q.options.map((opt, oi) => `  Opção ${String.fromCharCode(65 + oi)}: ${opt}`).join('\n') +
                    `\nResposta Correta: ${q.correctAnswerIndex !== null ? q.options[q.correctAnswerIndex] : 'N/A'}` +
                    (q.explanation ? `\nExplicação: ${q.explanation}\n` : '\n')
                ).join('\n---\n');
                
                finalContent = await geminiService.generateSummaryFromQuestions(context);
            
            } else { // manual
                if (!content.trim()) {
                    throw new Error('O conteúdo do resumo não pode estar vazio.');
                }
            }

            await onSave({ disciplineId: selectedDisciplineId, title: title.trim(), content: finalContent });
        } catch(err) {
            setError((err as Error).message);
        } finally {
            setIsSaving(false);
        }
    };

    const renderSelect = (id: string, value: string, onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void, options: {id: string, name: string}[], placeholder: string) => (
        <select id={id} value={value} onChange={onChange} className="w-full p-2 border border-gray-300 rounded-md bg-white">
            <option value="">{placeholder}</option>
            {options.map(opt => <option key={opt.id} value={opt.id}>{opt.name}</option>)}
        </select>
    );

    return (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl" onClick={e => e.stopPropagation()}>
                <header className="p-4 border-b flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800">Criar Novo Resumo</h2>
                    <button onClick={onClose} className="p-1 rounded-full hover:bg-gray-200"><XIcon className="w-5 h-5"/></button>
                </header>
                <main className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vincular a:</label>
                        <div className="space-y-2 p-2 bg-gray-50 border rounded-md">
                            {renderSelect("course-select", selectedCourseId, e => setSelectedCourseId(e.target.value), courses, "Selecione um curso")}
                            {renderSelect("module-select", selectedModuleId, e => setSelectedModuleId(e.target.value), modules, "Selecione um módulo")}
                            {renderSelect("discipline-select", selectedDisciplineId, e => setSelectedDisciplineId(e.target.value), disciplines, "Selecione uma disciplina")}
                        </div>
                    </div>
                    <div>
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 mb-1">Título do Resumo</label>
                        <input id="title" type="text" value={title} onChange={e => setTitle(e.target.value)} className="w-full p-2 border rounded-md"/>
                    </div>
                     <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Fonte do Conteúdo</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 cursor-pointer">
                                <input type="radio" name="contentSource" value="manual" checked={contentSource === 'manual'} onChange={() => setContentSource('manual')} className="h-4 w-4 text-primary focus:ring-primary"/>
                                Manual
                            </label>
                            <label className={`flex items-center gap-2 ${!selectedDisciplineId ? 'cursor-not-allowed text-gray-400' : 'cursor-pointer'}`}>
                                <input type="radio" name="contentSource" value="ai" checked={contentSource === 'ai'} onChange={() => setContentSource('ai')} disabled={!selectedDisciplineId} className="h-4 w-4 text-primary focus:ring-primary"/>
                                Gerar com IA a partir de Assuntos
                            </label>
                        </div>
                    </div>

                    {contentSource === 'manual' ? (
                        <div>
                            <label htmlFor="content" className="block text-sm font-medium text-gray-700 mb-1">Conteúdo</label>
                            <textarea id="content" value={content} onChange={e => setContent(e.target.value)} rows={8} className="w-full p-2 border rounded-md"/>
                        </div>
                    ) : (
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Selecione os Assuntos para Basear o Resumo</label>
                            {isLoadingSets ? (
                                <div className="p-4 text-center text-gray-500 border rounded-md">
                                    <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                    Carregando assuntos...
                                </div>
                            ) : availableQuestionSets.length > 0 ? (
                                <div className="max-h-48 overflow-y-auto border rounded-md p-2 space-y-1 bg-white">
                                    {availableQuestionSets.map(qs => (
                                        <label key={qs.id} className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 cursor-pointer border-b last:border-0 border-gray-50">
                                            <input
                                                type="checkbox"
                                                checked={selectedQuestionSetIds.has(qs.id)}
                                                onChange={() => handleToggleQuestionSet(qs.id)}
                                                className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                            <div>
                                                <p className="text-sm font-medium text-gray-800">{qs.subjectName}</p>
                                                <p className="text-xs text-gray-500">{qs.questions.length} questões</p>
                                            </div>
                                        </label>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500 italic p-3 border rounded-md bg-gray-50">
                                    {!selectedDisciplineId ? "Selecione uma disciplina acima." : "Esta disciplina não possui assuntos (conjuntos de questões) cadastrados."}
                                </p>
                            )}
                        </div>
                    )}
                    {error && <p className="text-red-500 text-sm">{error}</p>}
                </main>
                <footer className="p-4 bg-gray-50 flex justify-end gap-3">
                    <button onClick={onClose} className="px-4 py-2 text-gray-700 font-semibold hover:bg-gray-200 rounded-lg">Cancelar</button>
                    <button onClick={handleSaveClick} disabled={isSaving} className="px-6 py-2 bg-primary text-white rounded-lg font-semibold hover:bg-primary-dark disabled:bg-gray-400 flex items-center gap-2">
                         {isSaving ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <SaveIcon className="w-5 h-5" />}
                        {isSaving ? 'Gerando e Salvando...' : 'Salvar Resumo'}
                    </button>
                </footer>
            </div>
        </div>
    );
};

// --- Main Page Component ---
type ExtendedSummary = OfficialSummary & { disciplineName: string, moduleName: string, courseName: string };

const OfficialSummariesPage: React.FC = () => {
    const [summaries, setSummaries] = useState<ExtendedSummary[]>([]);
    const [filteredSummaries, setFilteredSummaries] = useState<ExtendedSummary[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [viewingSummary, setViewingSummary] = useState<OfficialSummary | null>(null);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    const loadData = async () => {
        setIsLoading(true);
        const data = await academicService.getAllSummariesWithContext();
        setSummaries(data);
        setFilteredSummaries(data);
        setIsLoading(false);
    };

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        if (!searchTerm) {
            setFilteredSummaries(summaries);
        } else {
            const lowerSearch = searchTerm.toLowerCase();
            setFilteredSummaries(summaries.filter(s => 
                s.title.toLowerCase().includes(lowerSearch) || 
                s.disciplineName.toLowerCase().includes(lowerSearch)
            ));
        }
    }, [searchTerm, summaries]);

    const handleCreateSummary = async (details: { disciplineId: string; title: string; content: string }) => {
        try {
            const success = await academicService.saveSummary(details.disciplineId, details.title, details.content);
            if (success) {
                alert('Resumo criado com sucesso!');
                setIsCreateModalOpen(false);
                await loadData(); 
            } else {
                throw new Error("A operação de salvar o resumo falhou no servidor.");
            }
        } catch (error) {
            alert(`Falha ao criar o resumo: ${(error as Error).message}`);
            console.error(error);
        }
    };

    const handleSave = async (id: string, updates: { title: string, content: string }) => {
        await academicService.updateSummary(id, updates);
        setViewingSummary(prev => prev ? { ...prev, ...updates } : null);
        await loadData();
    };

    const handleDelete = async (id: string) => {
        await academicService.deleteSummary(id);
        await loadData();
    };

    return (
        <>
            <div className="h-full w-full flex flex-col bg-gray-50 overflow-y-auto">
                {/* Header */}
                <header className="p-6 border-b border-gray-200 bg-white flex justify-between items-center sticky top-0 z-10">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800">Resumos Oficiais</h1>
                        <p className="text-gray-500 mt-1">Todos os resumos disponíveis para estudo na plataforma.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button 
                            onClick={loadData}
                            className="p-2 rounded-lg hover:bg-gray-100 text-gray-500 transition-colors"
                            title="Atualizar Lista"
                        >
                            <RefreshCwIcon className="w-5 h-5" />
                        </button>
                        <button
                            onClick={() => setIsCreateModalOpen(true)}
                            className="px-4 py-2 bg-primary text-white font-semibold rounded-lg hover:bg-primary-dark transition-colors flex items-center gap-2"
                        >
                            <PlusCircleIcon className="w-5 h-5" />
                            Criar Novo Resumo
                        </button>
                    </div>
                </header>

                {/* Filter Bar */}
                <div className="px-6 py-4 border-b border-gray-200 bg-white flex items-center gap-4">
                    <div className="relative flex-grow max-w-md">
                        <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input 
                            type="text" 
                            placeholder="Buscar por título ou disciplina..." 
                            value={searchTerm}
                            onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none"
                        />
                    </div>
                    <p className="text-sm text-gray-500 ml-auto">{filteredSummaries.length} resumos encontrados</p>
                </div>

                {/* Main Grid Content */}
                <main className="flex-grow p-6">
                    {isLoading ? (
                        <div className="flex justify-center items-center h-64">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                        </div>
                    ) : filteredSummaries.length > 0 ? (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                            {filteredSummaries.map(summary => (
                                <div key={summary.id} className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col hover:shadow-md transition-shadow">
                                    <div className="p-5 flex-grow">
                                        <div className="flex justify-between items-start mb-2">
                                            <div className="bg-primary/10 text-primary p-2 rounded-lg">
                                                <FileTextIcon className="w-6 h-6" />
                                            </div>
                                            <span className="text-[10px] text-gray-400 font-mono">{new Date(summary.created_at).toLocaleDateString()}</span>
                                        </div>
                                        <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-2" title={summary.title}>{summary.title}</h3>
                                        
                                        <div className="mt-4 space-y-1">
                                            <p className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Contexto Acadêmico</p>
                                            <div className="text-xs text-gray-600 bg-gray-50 p-2 rounded border border-gray-100">
                                                <span className="font-bold text-gray-700">{summary.courseName}</span>
                                                <span className="mx-1 text-gray-400">/</span>
                                                <span>{summary.moduleName}</span>
                                                <span className="mx-1 text-gray-400">/</span>
                                                <span className="text-primary font-medium">{summary.disciplineName}</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="p-4 border-t bg-gray-50">
                                        <button 
                                            onClick={() => setViewingSummary(summary)}
                                            className="w-full py-2 bg-white border border-gray-200 text-gray-700 font-semibold rounded-lg hover:bg-primary hover:text-white hover:border-primary transition-colors shadow-sm"
                                        >
                                            Ler Resumo
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-20">
                            <div className="bg-gray-100 p-4 rounded-full inline-block mb-4">
                                <FileTextIcon className="w-12 h-12 text-gray-400" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-600">Nenhum resumo encontrado</h2>
                            <p className="text-gray-500 mt-2">Tente ajustar sua busca ou crie um novo resumo.</p>
                        </div>
                    )}
                </main>
            </div>

            {viewingSummary && (
                <SummaryReaderModal 
                    summary={viewingSummary} 
                    onClose={() => setViewingSummary(null)} 
                    onSave={handleSave}
                    onDelete={handleDelete}
                    isEditable={true}
                />
            )}
            
            {isCreateModalOpen && (
                <CreateSummaryModal
                    onClose={() => setIsCreateModalOpen(false)}
                    onSave={handleCreateSummary}
                />
            )}
        </>
    );
};

export default OfficialSummariesPage;
