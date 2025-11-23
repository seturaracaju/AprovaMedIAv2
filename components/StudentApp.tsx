
import React, { useState, useEffect } from 'react';
import { Session } from '@supabase/supabase-js';
import { Student } from '../types';
import { supabase } from '../services/supabaseClient';
import { useUser } from '../contexts/UserContext';

import StudentSidebar from './StudentSidebar';
import StudentDashboardPage from './student/StudentDashboardPage';
import StudentTestsPage from './student/StudentTestsPage';
import StudentProfilePage from './student/StudentProfilePage';
import StudentSummariesPage from './student/OfficialSummariesPage';
import StudentTrueFlashcardsPage from './student/TrueFlashcardsPage';
import StudentExplorePage from './student/StudentExplorePage';
import StudentLibraryPage from './student/StudentLibraryPage';
import StudentCommunityPage from './student/StudentCommunityPage'; 
import StudentMarketplacePage from './student/StudentMarketplacePage'; // Fase 4
import StudentStudyRoomsPage from './student/StudentStudyRoomsPage'; // Fase 4

interface StudentAppProps {
    session: Session;
    studentProfile: Student;
}

export type StudentView = 'dashboard' | 'explore' | 'library' | 'tests' | 'profile' | 'summaries' | 'trueFlashcards' | 'community' | 'marketplace' | 'rooms';

const StudentApp: React.FC<StudentAppProps> = ({ studentProfile, session }) => {
    const [currentView, setCurrentView] = useState<StudentView>('dashboard');
    const { setUserRole } = useUser();

    // Sincroniza o contexto do usuário para que a Sidebar e outros componentes saibam que é um aluno.
    useEffect(() => {
        if (studentProfile) {
            setUserRole({ 
                role: 'student', 
                studentId: studentProfile.id, 
                studentName: studentProfile.name 
            });
        }
    }, [studentProfile, setUserRole]);

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    const renderView = () => {
        if (!studentProfile) return null; 
        switch (currentView) {
            case 'explore':
                return <StudentExplorePage student={studentProfile} />;
            case 'library':
                return <StudentLibraryPage student={studentProfile} />;
            case 'marketplace':
                return <StudentMarketplacePage student={studentProfile} />;
            case 'rooms':
                return <StudentStudyRoomsPage student={studentProfile} />;
            case 'tests':
                return <StudentTestsPage student={studentProfile} />;
            case 'summaries':
                return <StudentSummariesPage student={studentProfile} />;
            case 'trueFlashcards':
                return <StudentTrueFlashcardsPage student={studentProfile} />;
            case 'community':
                return <StudentCommunityPage student={studentProfile} />;
            case 'profile':
                return <StudentProfilePage student={studentProfile} />;
            case 'dashboard':
            default:
                return <StudentDashboardPage student={studentProfile} />;
        }
    };
    
    if (!studentProfile) {
        return (
             <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                    <p className="mt-4 text-gray-600">Carregando seu portal...</p>
                </div>
            </div>
        );
    }
    
    return (
        <div className="flex h-full w-full bg-gray-100">
            <StudentSidebar
                studentName={studentProfile.name}
                currentView={currentView}
                setCurrentView={setCurrentView}
                onLogout={handleLogout}
            />
            <div className="flex-1 flex flex-col overflow-hidden">
                {renderView()}
            </div>
        </div>
    );
};

export default StudentApp;
