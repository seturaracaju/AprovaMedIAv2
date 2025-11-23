
import React, { useState, useCallback, useEffect } from 'react';
import { supabase } from '../services/supabaseClient';
import LandingPage from './LandingPage';
import ChatView from './ChatView';
import Sidebar from './Sidebar';
import AcademicManagementPage from './AcademicManagementPage';
import TestsPage from './TestsPage';
import CrmPage from './CrmPage';
import StudyBankPage from './StudyBankPage';
import DashboardPage from './DashboardPage';
import OfficialSummariesPage from './OfficialSummariesPage';
import TrueFlashcardsPage from './TrueFlashcardsPage';
import MarketplaceManagementPage from './MarketplaceManagementPage';
import GamificationManagementPage from './GamificationManagementPage';
import StudyRoomManagementPage from './StudyRoomManagementPage';
import { usePdfParser } from '../hooks/usePdfParser';
import FloatingChatButton from './FloatingChatButton';
import TutorChatModal from './TutorChatModal';
import * as geminiService from '../services/geminiService';
import { useUser } from '../contexts/UserContext';

export type View = 'dashboard' | 'landing' | 'chat' | 'academicManagement' | 'studyBank' | 'tests' | 'crm' | 'officialSummaries' | 'trueFlashcards' | 'marketplace' | 'gamification' | 'studyRooms';

const TeacherApp: React.FC = () => {
    const [pdfFile, setPdfFile] = useState<File | null>(null);
    const [pdfText, setPdfText] = useState<string | null>(null);
    const [fileName, setFileName] = useState<string>('');
    const { parsePdf, isLoading: isPdfLoading, error: pdfError } = usePdfParser();
    
    const [isImageLoading, setIsImageLoading] = useState(false);
    const [imageError, setImageError] = useState<string | null>(null);

    const [currentView, setCurrentView] = useState<View>('dashboard'); 
    const [isTutorModalOpen, setIsTutorModalOpen] = useState(false);
    
    // Context sync for Tutor AI and Sidebar
    const { setUserRole } = useUser();
    useEffect(() => {
        setUserRole({ role: 'teacher' });
    }, [setUserRole]);

    const handleFileUpload = useCallback(async (file: File) => {
        setImageError(null);
        
        if (file.type === 'application/pdf') {
            const result = await parsePdf(file);
            if (result && result.text) {
                setPdfText(result.text);
                setFileName(file.name);
                setPdfFile(file);
                setCurrentView('chat');
            }
        } else if (file.type.startsWith('image/')) {
            setIsImageLoading(true);
            try {
                const transcribedText = await geminiService.transcribeImage(file);
                if (transcribedText) {
                    setPdfText(transcribedText);
                    setFileName(file.name);
                    setPdfFile(file);
                    setCurrentView('chat');
                } else {
                    setImageError("Não foi possível extrair texto desta imagem.");
                }
            } catch (e) {
                console.error(e);
                setImageError("Erro ao processar imagem com IA.");
            } finally {
                setIsImageLoading(false);
            }
        }
    }, [parsePdf]);

    const handleStartNewSession = () => {
        setPdfFile(null);
        setPdfText(null);
        setFileName('');
        setCurrentView('landing');
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    useEffect(() => {
        if (currentView === 'chat' && (!pdfFile || !pdfText)) {
            setCurrentView('landing');
        }
    }, [currentView, pdfFile, pdfText]);

    const renderView = () => {
        switch (currentView) {
            case 'dashboard': return <DashboardPage />;
            case 'chat': return (pdfFile && pdfText) ? <ChatView pdfFile={pdfFile} pdfText={pdfText} fileName={fileName} onStartNewSession={handleStartNewSession} /> : null;
            case 'academicManagement': return <AcademicManagementPage />;
            case 'studyBank': return <StudyBankPage />;
            case 'marketplace': return <MarketplaceManagementPage />;
            case 'gamification': return <GamificationManagementPage />;
            case 'studyRooms': return <StudyRoomManagementPage />;
            case 'tests': return <TestsPage />;
            case 'crm': return <CrmPage />;
            case 'officialSummaries': return <OfficialSummariesPage />;
            case 'trueFlashcards': return <TrueFlashcardsPage />;
            case 'landing': default:
                return <LandingPage onPdfUpload={handleFileUpload} isLoading={isPdfLoading || isImageLoading} error={pdfError || imageError} />;
        }
    };

    return (
        <div className="flex h-full w-full bg-gray-100">
            <Sidebar currentView={currentView} setCurrentView={setCurrentView} onLogout={handleLogout} />
            <div className="flex-1 flex flex-col overflow-hidden">
                {renderView()}
            </div>
            <FloatingChatButton onClick={() => setIsTutorModalOpen(true)} />
            {isTutorModalOpen && <TutorChatModal onClose={() => setIsTutorModalOpen(false)} />}
        </div>
    );
};

export default TeacherApp;
