
import React, { useState, useEffect } from 'react';
import { LayersIcon, PlusCircleIcon, TrashIcon, SparklesIcon, BrainCircuitIcon, SaveIcon, XIcon, EditIcon, TrendingUpIcon } from './IconComponents';
import * as flashcardService from '../services/flashcardService';
import * as geminiService from '../services/geminiService';
import * as academicService from '../services/academicService';
import { FlashcardSet, TrueFlashcard, Course, Module, Discipline } from '../types';
import TrueFlashcardStudyModal from './TrueFlashcardStudyModal';

// --- MODAL: Detalhes do Baralho ---
const FlashcardSetDetailModal: React.FC<{ deck: FlashcardSet; onClose: () => void; onStudy: () => void; onDelete: () => void }> = ({ deck, onClose, onStudy, onDelete }) => {
    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl h-[85vh] flex flex-col overflow-hidden animate-fadeIn" onClick={e => e.stopPropagation()}>
                {/* Header */}
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <div>
                        <h2 className="text-2xl font-bold text-gray-800">{deck.subject_name}</h2>
                        <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                            <LayersIcon className="w-4 h-4" /> {deck.flashcards.length} Cartas de Neuro-Repetição
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                         <button onClick={onDelete} className="p-2 hover:bg-red-100 text-red-500 rounded-lg transition-colors" title="Excluir Baralho">
                            <TrashIcon className="w-5 h-5" />
                        </button>
                        <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                            <XIcon className="w-6 h-6 text-gray-500" />
                        </button>
                    </div>
                </div>

                {/* Content List */}
                <div className="flex-grow overflow-y-auto p-6 bg-gray-100 custom-scrollbar space-y-4">
                    {deck.flashcards.map((card, idx) => (
                        <div key={idx} className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm hover:shadow-md transition-shadow">
                            <div className="flex justify-between items-start mb-3">
                                <span className="bg-blue-50 text-blue-700 text-xs font-bold px-2 py-1 rounded uppercase tracking-wide border border-blue-100">
                                    {card.tag || 'Conceito'}
                                </span>
                                <span className="text-gray-300 font-mono text-xs">#{idx + 1}</span>
                            </div>
                            
                            <div className="mb-4">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Pergunta</p>
                                <p className="text-lg font-semibold text-gray-800 leading-snug">{card.question}</p>
                            </div>
                            
                            <div className="bg-gray-50 p-3 rounded-lg border-l-4 border-green-500">
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Resposta</p>
                                <p className="text-gray-700 text-sm leading-relaxed">{card.answer}</p>
                            </div>

                            {card.mnemonic && (
                                <div className="mt-3 flex items-start gap-2 bg-purple-50 p-3 rounded-lg border border-purple-100">
                                    <BrainCircuitIcon className="w-5 h-5 text-purple-600 flex-shrink-0 mt-0.5" />
                                    <div>
                                        <p className="text-xs font-bold text-purple-800 uppercase tracking-wider">Neuro-Dica (Mnemônico)</p>
                                        <p className="text-sm text-purple-700 font-medium italic">{card.mnemonic}</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>

                {/* Footer Actions */}
                <div className="p-5 border-t bg-white flex justify-between items-center gap-4">
                     <p className="text-xs text-gray-400 italic">
                        Criado em {new Date(deck.created_at).toLocaleDateString()}
                    </p>
                    <button 
                        onClick={onStudy}
                        className="px-6 py-3 bg-gray-900 text-white font-bold rounded-xl hover:bg-black transition-all shadow-lg hover:-translate-y-1 flex items-center gap-2"
                    >
                        <TrendingUpIcon className="w-5 h-5" />
                        Simular Estudo (Preview)
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- MODAL: AI Generator ---
const FlashcardGeneratorModal: React.FC<{ onClose: () => void; onCreated: () => void; }> = ({ onClose, onCreated }) => {
    const [step, setStep] = useState<1 | 2>(1);
    const [inputText, setInputText] = useState('');
    const [isGenerating, setIsGenerating] = useState(false);
    const [generatedCards, setGeneratedCards] = useState<TrueFlashcard[]>([]);
    
    // Selection State
    const [courses, setCourses] = useState<Course[]>([]);
    const [modules, setModules] = useState<Module[]>([]);
    const [disciplines, setDisciplines] = useState<Discipline[]>([]);
    const [selectedCourseId, setSelectedCourseId] = useState('');
    const [selectedModuleId, setSelectedModuleId] = useState('');
    const [selectedDisciplineId, setSelectedDisciplineId] = useState('');
    const [subjectName, setSubjectName] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        academicService.getCourses().then(setCourses);
    }, []);

    useEffect(() => {
        if (selectedCourseId) {
            academicService.getModules(selectedCourseId).then(setModules);
            setSelectedModuleId(''); setDisciplines([]); setSelectedDisciplineId('');
        }
    }, [selectedCourseId]);

    useEffect(() => {
        if (selectedModuleId) {
            academicService.getDisciplines(selectedModuleId).then(setDisciplines);
            setSelectedDisciplineId('');
        }
    }, [selectedModuleId]);

    const handleGenerate = async () => {
        if (!inputText.trim()) return alert("Insira um texto para gerar os cards.");
        setIsGenerating(true);
        const cards = await geminiService.extractTrueFlashcards(inputText);
        setGeneratedCards(cards);
        setIsGenerating(false);
        setStep(2);
    };

    const handleSave = async () => {
        if (!subjectName || !selectedDisciplineId) return alert("Preencha o nome e a disciplina.");
        setIsSaving(true);
        await flashcardService.saveFlashcardSet(selectedDisciplineId, subjectName, generatedCards);
        setIsSaving(false);
        onCreated();
        onClose();
    };
    
    const handleRefine = async (index: number, type: 'question' | 'answer', text: string) => {
        const refined = await geminiService.refineFlashcardText(text, type);
        const newCards = [...generatedCards];
        newCards[index] = { ...newCards[index], [type]: refined };
        setGeneratedCards(newCards);
    };

    return (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col overflow-hidden">
                <div className="p-6 border-b bg-gray-50 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <SparklesIcon className="w-6 h-6 text-primary" />
                        Gerador de Neuro-Flashcards
                    </h2>
                    <button onClick={onClose}><XIcon className="w-6 h-6 text-gray-500"/></button>
                </div>
                
                <div className="flex-grow p-6 overflow-y-auto">
                    {step === 1 ? (
                        <div className="space-y-4 h-full flex flex-col">
                            <p className="text-gray-600">Cole seu resumo, anotações ou texto de aula abaixo. A IA criará cards otimizados com mnemônicos.</p>
                            <textarea 
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                className="flex-grow w-full p-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-primary focus:outline-none resize-none font-mono text-sm"
                                placeholder="Cole o conteúdo aqui..."
                            />
                            <button 
                                onClick={handleGenerate}
                                disabled={isGenerating}
                                className="w-full py-4 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors flex justify-center items-center gap-2 shadow-lg"
                            >
                                {isGenerating ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div> : <BrainCircuitIcon className="w-6 h-6"/>}
                                {isGenerating ? "Criando Conexões Neurais..." : "Gerar Baralho Inteligente"}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="col-span-2 space-y-4">
                                    <h3 className="font-bold text-gray-700">Cards Gerados ({generatedCards.length})</h3>
                                    <div className="space-y-3">
                                        {generatedCards.map((card, idx) => (
                                            <div key={idx} className="bg-gray-50 p-4 rounded-xl border border-gray-200 group hover:border-primary/30 transition-colors">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="bg-primary/10 text-primary text-xs font-bold px-2 py-0.5 rounded uppercase tracking-wide">{card.tag || 'Geral'}</span>
                                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                        <button onClick={() => handleRefine(idx, 'question', card.question)} className="text-xs flex items-center gap-1 text-blue-600 hover:underline"><SparklesIcon className="w-3 h-3"/> Refinar Pergunta</button>
                                                    </div>
                                                </div>
                                                <p className="font-semibold text-gray-800 mb-2">{card.question}</p>
                                                <div className="pl-3 border-l-2 border-green-300">
                                                    <p className="text-gray-600 text-sm">{card.answer}</p>
                                                    {card.mnemonic && (
                                                        <p className="text-xs text-purple-600 mt-1 font-medium flex items-center gap-1">
                                                            <BrainCircuitIcon className="w-3 h-3"/> Dica: {card.mnemonic}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="bg-gray-100 p-5 rounded-xl h-fit sticky top-0">
                                    <h3 className="font-bold text-gray-800 mb-4">Salvar Baralho</h3>
                                    <div className="space-y-3">
                                        <select className="w-full p-2 rounded border" onChange={e => setSelectedCourseId(e.target.value)} value={selectedCourseId}>
                                            <option value="">Selecione o Curso</option>
                                            {courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                        </select>
                                        <select className="w-full p-2 rounded border" onChange={e => setSelectedModuleId(e.target.value)} value={selectedModuleId} disabled={!selectedCourseId}>
                                            <option value="">Selecione o Módulo</option>
                                            {modules.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
                                        </select>
                                        <select className="w-full p-2 rounded border" onChange={e => setSelectedDisciplineId(e.target.value)} value={selectedDisciplineId} disabled={!selectedModuleId}>
                                            <option value="">Selecione a Disciplina</option>
                                            {disciplines.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
                                        </select>
                                        <input 
                                            type="text" 
                                            placeholder="Nome do Baralho (ex: Anatomia Cardíaca)"
                                            className="w-full p-2 rounded border"
                                            value={subjectName}
                                            onChange={e => setSubjectName(e.target.value)}
                                        />
                                        <button 
                                            onClick={handleSave}
                                            disabled={isSaving}
                                            className="w-full py-3 bg-green-600 text-white font-bold rounded-lg hover:bg-green-700 transition-colors shadow-md flex justify-center items-center gap-2"
                                        >
                                            {isSaving ? "Salvando..." : "Salvar Baralho"} <SaveIcon className="w-4 h-4"/>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// --- Main Page ---
const TrueFlashcardsPage: React.FC = () => {
    const [decks, setDecks] = useState<FlashcardSet[]>([]);
    const [loading, setLoading] = useState(true);
    const [isGenModalOpen, setIsGenModalOpen] = useState(false);
    const [viewingDeck, setViewingDeck] = useState<FlashcardSet | null>(null);
    const [simulatingDeck, setSimulatingDeck] = useState<FlashcardSet | null>(null);

    const loadDecks = async () => {
        setLoading(true);
        const data = await flashcardService.getFlashcardSets();
        setDecks(data);
        setLoading(false);
    };

    useEffect(() => {
        loadDecks();
    }, []);

    const handleDelete = async (id: string) => {
        if (window.confirm("Excluir este baralho permanentemente?")) {
            await flashcardService.deleteFlashcardSet(id);
            if (viewingDeck?.id === id) setViewingDeck(null);
            loadDecks();
        }
    };
    
    const handleSimulate = (deck: FlashcardSet) => {
        setSimulatingDeck(deck);
        // We can keep the detail modal open behind or close it. Let's keep logic simple.
    };

    return (
        <div className="h-full w-full flex flex-col bg-gray-50 overflow-y-auto">
            <header className="p-8 border-b border-gray-200 bg-white flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                        <LayersIcon className="w-8 h-8 text-primary" />
                        Flashcards (Neuro-Repetição)
                    </h1>
                    <p className="text-gray-500 mt-1">Gerencie baralhos de memorização ativa focados em retenção de longo prazo.</p>
                </div>
                <button 
                    onClick={() => setIsGenModalOpen(true)}
                    className="px-6 py-3 bg-gradient-to-r from-primary to-teal-500 text-white font-bold rounded-xl hover:shadow-lg hover:scale-105 transition-all flex items-center gap-2"
                >
                    <SparklesIcon className="w-5 h-5" /> Novo Baralho com IA
                </button>
            </header>

            <main className="flex-grow p-8">
                {loading ? (
                    <div className="flex justify-center items-center h-64"><div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div></div>
                ) : decks.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                        {decks.map(deck => (
                            <div 
                                key={deck.id} 
                                onClick={() => setViewingDeck(deck)}
                                className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 cursor-pointer relative"
                            >
                                <div className="p-6">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/10 to-primary/30 flex items-center justify-center text-primary">
                                            <LayersIcon className="w-6 h-6" />
                                        </div>
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); handleDelete(deck.id); }} 
                                            className="p-2 rounded-lg hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors z-10"
                                        >
                                            <TrashIcon className="w-5 h-5"/>
                                        </button>
                                    </div>
                                    <h3 className="text-xl font-bold text-gray-800 mb-1">{deck.subject_name}</h3>
                                    <p className="text-sm text-gray-500 mb-4">Criado em {new Date(deck.created_at).toLocaleDateString()}</p>
                                    
                                    <div className="flex items-center gap-4 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                                        <div className="flex items-center gap-1 font-semibold">
                                            <BrainCircuitIcon className="w-4 h-4 text-purple-500"/>
                                            {deck.flashcards.length} Cards
                                        </div>
                                        <div className="w-px h-4 bg-gray-300"></div>
                                        <div className="flex items-center gap-1">
                                           IA Powered
                                        </div>
                                    </div>
                                </div>
                                <div className="h-2 bg-gradient-to-r from-primary to-teal-400 w-full"></div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-20">
                        <div className="inline-block p-6 bg-white rounded-full shadow-sm mb-4">
                            <LayersIcon className="w-12 h-12 text-gray-300" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-700 mb-2">Nenhum baralho encontrado</h2>
                        <p className="text-gray-500">Use a IA para transformar seus resumos em flashcards poderosos.</p>
                    </div>
                )}
            </main>

            {isGenModalOpen && (
                <FlashcardGeneratorModal onClose={() => setIsGenModalOpen(false)} onCreated={loadDecks} />
            )}

            {viewingDeck && (
                <FlashcardSetDetailModal 
                    deck={viewingDeck} 
                    onClose={() => setViewingDeck(null)} 
                    onStudy={() => handleSimulate(viewingDeck)}
                    onDelete={() => handleDelete(viewingDeck.id)}
                />
            )}

            {simulatingDeck && (
                <div className="fixed inset-0 z-[60]">
                    <TrueFlashcardStudyModal 
                        deck={simulatingDeck} 
                        onClose={() => setSimulatingDeck(null)} 
                    />
                </div>
            )}
        </div>
    );
};

export default TrueFlashcardsPage;
