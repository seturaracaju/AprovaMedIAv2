import React, { useState, useEffect, useRef } from 'react';
import { supabase } from './services/supabaseClient';
import { Session } from '@supabase/supabase-js';
import AuthPage from './components/AuthPage';
import StudentApp from './components/StudentApp';
import TeacherApp from './components/TeacherApp';
import * as academicService from './services/academicService';
import { Student } from './types';
import { UserProvider } from './contexts/UserContext';

// pdf.js worker configuration
import('https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs');

const App: React.FC = () => {
    const [session, setSession] = useState<Session | null>(null);
    const [studentProfile, setStudentProfile] = useState<Student | null>(null);
    // Add a specific state for the user's role to make logic clearer.
    const [userRole, setUserRole] = useState<'teacher' | 'student' | null>(null);
    const [loading, setLoading] = useState(true);
    
    // Use a ref to track the last user ID. This persists across renders without triggering them.
    const lastUserId = useRef<string | undefined>(undefined);

    useEffect(() => {
        const checkUserRole = async (session: Session | null) => {
            // Update the ref with the current user ID (or undefined if logged out)
            lastUserId.current = session?.user?.id;

            if (session?.user) {
                try {
                    // Parallel fetch to check both tables independently
                    // This ensures strict separation: you are either in the 'teachers' table or 'students' table.
                    const [student, teacher] = await Promise.all([
                        academicService.getStudentProfile(session.user.id),
                        academicService.getTeacherProfile(session.user.id)
                    ]);

                    if (teacher) {
                        // User is confirmed as a Teacher/Admin in the database
                        console.log("User confirmed as Teacher/Admin");
                        setUserRole('teacher');
                        setStudentProfile(null);
                    } else if (student) {
                        // User is confirmed as a Student in the database
                        console.log("User confirmed as Student");
                        setStudentProfile(student);
                        setUserRole('student');
                    } else {
                        // User is authenticated but has no role profile in either table
                        console.warn("Access denied: User has no profile in 'students' or 'teachers'.");
                        await supabase.auth.signOut();
                        alert("Erro de Acesso: Seu usuário não possui um perfil de Aluno ou Professor associado. Entre em contato com o suporte.");
                        setStudentProfile(null);
                        setUserRole(null);
                    }
                } catch (error) {
                    console.error("Error checking user role:", error);
                    setStudentProfile(null);
                    setUserRole(null);
                }
            } else {
                // No session, so no user role.
                setStudentProfile(null);
                setUserRole(null);
            }
            setSession(session);
            setLoading(false);
        };

        // Check for initial session
        supabase.auth.getSession().then(({ data: { session } }) => {
            checkUserRole(session);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((event, newSession) => {
            // FIX: Prevent auto-reload on tab switch/focus
            // 1. Ignore token refreshes (happens in background)
            if (event === 'TOKEN_REFRESHED') return;

            // 2. If the user ID hasn't changed, DO NOT trigger the loading screen.
            // This prevents the app from unmounting/resetting state when switching tabs/windows.
            if (newSession?.user?.id === lastUserId.current) {
                // We can update the session object silently without triggering a full 'loading' state
                setSession(newSession);
                return;
            }

            // 3. Only trigger a full reload (with spinner) if it's a real login/logout event
            setLoading(true);
            checkUserRole(newSession);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
            </div>
        );
    }
    
    if (!session) {
        return <AuthPage />;
    }

    // Render the correct app based on the determined role.
    return (
        <UserProvider>
            <div className="h-screen w-screen">
                {userRole === 'student' && studentProfile ? (
                    <StudentApp session={session} studentProfile={studentProfile} />
                ) : userRole === 'teacher' ? (
                    <TeacherApp />
                ) : (
                    // This fallback handles cases where role is null/undetermined but session exists (rare due to logic above)
                     <div className="h-screen w-screen flex items-center justify-center bg-gray-100">
                        <div className="text-center">
                            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto"></div>
                            <p className="mt-4 text-gray-600">Verificando permissões...</p>
                        </div>
                    </div>
                )}
            </div>
        </UserProvider>
    );
};

export default App;