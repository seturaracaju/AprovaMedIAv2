
import React, { useState, useRef, useEffect, useMemo } from 'react';
import Header from './Header';
import { ChatMessage, QuizQuestion } from '../types';
import { answerQuestion, extractQuestionsFromPdf } from '../services/geminiService';
import { saveQuestionSet } from '../services/questionBankService';
import * as testService from '../services/testService';
import { SendIcon, UserIcon, BotIcon } from './IconComponents';
import PdfViewer from './PdfViewer';
import QuestionBankView from './QuestionBankView';
import FlashcardModal from './FlashcardModal';
import SaveQuestionsModal from './SaveQuestionsModal';
import AnswerKeyProcessorTab from './AnswerKeyProcessorTab';
import SummaryGeneratorTab from './SummaryGeneratorTab';
import FlashcardGeneratorTab from './FlashcardGeneratorTab';

interface ChatViewProps {
    pdfFile: File;
    pdfText: string;
    fileName: string;
    onStartNewSession: () => void;
}

const LoadingIndicator: React.FC = () => (
    <div className="flex items-center space-x-2">
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0s' }}></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.2s' }}></div>
        <div className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0.4s' }}></div>
    </div>
);

const ADMIN_TEST_USER_ID = "00000000-0000-0000-0000-000000000000"; // Placeholder for admin/testing

const ChatView: React.FC<ChatViewProps> = ({ pdfFile, pdfText, fileName, onStartNewSession }) => {
    const [messages, setMessages] = useState<ChatMessage[]>([
        { role: 'system', content: `Olá! Analisei "${fileName}". Pergunte-me qualquer coisa ou use as ferramentas de IA.` }
    ]);
    const [userInput, setUserInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [questionBank, setQuestionBank] = useState<QuizQuestion[] | null>(null);
    const [isExtracting, setIsExtracting] = useState(false);
    const [activeTab, setActiveTab] = useState<'chat' | 'questions' | 'answers' | 'summary' | 'flashcards'>('chat');
    const [showFlashcards, setShowFlashcards] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);
    const [selectedQuestionIndices, setSelectedQuestionIndices] = useState<Set<number>>(new Set());
    
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const selectedQuestions = useMemo(() => {
        if (!questionBank) return [];
        return Array.from(selectedQuestionIndices).map(index => questionBank[index]);
    }, [questionBank, selectedQuestionIndices]);

    useEffect(() => {
        if (activeTab === 'chat') {
            chatContainerRef.current?.scrollTo(0, chatContainerRef.current.scrollHeight);
        }
    }, [messages, activeTab]);
    
    useEffect(() => {
        setSelectedQuestionIndices(new Set());
    }, [questionBank]);

    const handleSendMessage = async () => {
        if (!userInput.trim() || isLoading) return;

        const newMessages: ChatMessage[] = [...messages, { role: 'user', content: userInput }];
        setMessages(newMessages);
        setUserInput('');
        setIsLoading(true);

        const response = await answerQuestion(pdfText, userInput);

        setMessages([...newMessages, { role: 'model', content: response }]);
        setIsLoading(false);
    };
    
    const handleExtractQuestions = async () => {
        setIsExtracting(true);
        setQuestionBank(null);
        const extracted = await extractQuestionsFromPdf(pdfText);
        setQuestionBank(extracted);
        setIsExtracting(false);
        setActiveTab('questions');
    };
    
    const handleSelectionChange = (index: number) => {
        const newSelection = new Set(selectedQuestionIndices);
        if (newSelection.has(index)) {
            newSelection.delete(index);
        } else {
            newSelection.add(index);
        }
        setSelectedQuestionIndices(newSelection);
    };

    const handleSelectAll = (checked: boolean) => {
        if (checked && questionBank) {
            const allIndices = new Set(questionBank.map((_, i) => i));
            setSelectedQuestionIndices(allIndices);
        } else {
            setSelectedQuestionIndices(new Set());
        }
    };


    const handleSaveQuestions = async (details: { disciplineId: string; subjectName: string; createTest: boolean; testName: string; }) => {
        if (selectedQuestions.length > 0) {
            try {
                const savedSet = await saveQuestionSet(details.disciplineId, details.subjectName, selectedQuestions);
                
                if (savedSet) {
                    let alertMessage = `Sucesso! ${selectedQuestions.length} questões salvas em "${details.subjectName}".`;

                    if (details.createTest && details.testName) {
                        const newTest = await testService.createTest(details.testName, selectedQuestions, 'fixed', { disciplineId: details.disciplineId });
                        if (newTest) {
                            alertMessage += `\n\nTeste "${newTest.name}" também foi criado com sucesso!`;
                        } else {
                            alertMessage += "\n\nFalha ao criar o teste automaticamente.";
                        }
                    }
                    alert(alertMessage);
                } else {
                    throw new Error("O servidor não retornou confirmação.");
                }
            } catch (error: any) {
                 console.error("Erro ao salvar:", error);
                 alert(`Erro ao salvar questões: ${error.message || "Verifique sua conexão ou permissões."}`);
            }
        }
        setShowSaveModal(false);
    };
    
    const TabButton: React.FC<{ tabName: typeof activeTab; children: React.ReactNode }> = ({ tabName, children }) => (
         <button
            onClick={() => setActiveTab(tabName)}
            className={`flex-1 py-3 px-1 text-center border-b-2 font-medium text-sm ${activeTab === tabName ? 'border-primary text-primary' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'}`}
        >
            {children}
        </button>
    );


    return (
        <>
            <div className="h-full w-full flex flex-col bg-gray-100">
                <Header onStartNewSession={onStartNewSession} fileName={fileName} />
                <main className="flex-grow flex flex-col md:flex-row h-full overflow-hidden">
                    {/* PDF Viewer */}
                    <div className="hidden md:flex md:w-1/2 h-full">
                        <PdfViewer file={pdfFile} />
                    </div>

                    {/* Interaction Panel */}
                    <div className="w-full md:w-1/2 flex flex-col bg-white h-full">
                        <div className="border-b border-gray-200">
                            <nav className="flex -mb-px">
                                <TabButton tabName="chat">Chat</TabButton>
                                <TabButton tabName="questions">Questões de Estudo</TabButton>
                                <TabButton tabName="answers">Gabarito/Respostas</TabButton>
                                <TabButton tabName="summary">Criar Resumos</TabButton>
                                <TabButton tabName="flashcards">Criar Flashcards</TabButton>
                            </nav>
                        </div>

                        {activeTab === 'chat' && (
                            <>
                                <div ref={chatContainerRef} className="flex-grow p-6 space-y-6 overflow-y-auto">
                                    {messages.map((msg, index) => (
                                        <div key={index} className={`flex items-start gap-4 ${msg.role === 'user' ? 'justify-end' : ''}`}>
                                            {msg.role !== 'user' && (
                                                <div className="w-8 h-8 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center">
                                                    <BotIcon className="w-5 h-5 text-primary"/>
                                                </div>
                                            )}
                                            <div className={`max-w-md p-4 rounded-xl ${
                                                msg.role === 'user' ? 'bg-primary text-white rounded-br-none' : 
                                                msg.role === 'model' ? 'bg-gray-100 text-gray-800 rounded-bl-none' : 'bg-teal-100 border border-teal-200 text-teal-800 rounded-bl-none'
                                            }`}>
                                                <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                                            </div>
                                            {msg.role === 'user' && (
                                                <div className="w-8 h-8 flex-shrink-0 bg-gray-200 rounded-full flex items-center justify-center">
                                                    <UserIcon className="w-5 h-5 text-gray-600"/>
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                    {isLoading && (
                                        <div className="flex items-start gap-4">
                                            <div className="w-8 h-8 flex-shrink-0 bg-primary/10 rounded-full flex items-center justify-center">
                                                <BotIcon className="w-5 h-5 text-primary"/>
                                            </div>
                                            <div className="max-w-md p-4 rounded-xl bg-gray-100 text-gray-800 rounded-bl-none">
                                                <LoadingIndicator />
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="p-4 border-t border-gray-200 bg-white">
                                    <div className="relative">
                                        <input
                                            type="text"
                                            value={userInput}
                                            onChange={(e) => setUserInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                                            placeholder="Pergunte qualquer coisa sobre o PDF..."
                                            className="w-full p-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:outline-none bg-white text-gray-800 placeholder:text-gray-400"
                                            disabled={isLoading}
                                        />
                                        <button
                                            onClick={handleSendMessage}
                                            disabled={isLoading || !userInput.trim()}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-primary rounded-full text-white hover:bg-primary-dark transition-colors disabled:bg-gray-300"
                                        >
                                            <SendIcon className="w-5 h-5" />
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                        {activeTab === 'questions' && (
                            <QuestionBankView 
                                questions={questionBank}
                                isExtracting={isExtracting}
                                onExtract={handleExtractQuestions}
                                onStudy={() => setShowFlashcards(true)}
                                onSave={() => setShowSaveModal(true)}
                                selectedIndices={selectedQuestionIndices}
                                onSelectionChange={handleSelectionChange}
                                onSelectAll={handleSelectAll}
                            />
                        )}
                        {activeTab === 'answers' && <AnswerKeyProcessorTab questions={questionBank} onQuestionsUpdate={setQuestionBank} />}
                        {activeTab === 'summary' && <SummaryGeneratorTab pdfText={pdfText} />}
                        {activeTab === 'flashcards' && <FlashcardGeneratorTab pdfText={pdfText} />}
                    </div>
                </main>
            </div>
            {showFlashcards && selectedQuestions.length > 0 && (
                <FlashcardModal 
                    studentId={ADMIN_TEST_USER_ID}
                    questionSet={{
                        id: 'chat-session-set',
                        subjectName: `Questões de ${fileName}`,
                        questions: selectedQuestions
                    }}
                    onClose={() => setShowFlashcards(false)}
                />
            )}
            {showSaveModal && selectedQuestions.length > 0 && (
                <SaveQuestionsModal 
                    onClose={() => setShowSaveModal(false)}
                    onSave={handleSaveQuestions}
                />
            )}
        </>
    );
};

export default ChatView;
