
import React, { useState, useRef, useEffect } from 'react';
import { View } from './TeacherApp';
import { PlusCircleIcon, GraduationCapIcon, UsersIcon, ClipboardListIcon, LayersIcon, BookOpenIcon, HomeIcon, FileTextIcon, UserCheckIcon, MoreVerticalIcon, ShoppingBagIcon, TrophyIcon, MessageCircleIcon } from './IconComponents';
import { useUser } from '../contexts/UserContext';
import { UserRole } from '../types';

interface SidebarProps {
    currentView: View;
    setCurrentView: (view: View) => void;
    onLogout: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, setCurrentView, onLogout }) => {
    const { userRole, setUserRole, allStudents } = useUser();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);
    
    const navItems = [
        { view: 'dashboard', label: 'Dashboard', icon: HomeIcon },
        { view: 'landing', label: 'Nova Sessão de Estudo', icon: PlusCircleIcon },
        { view: 'academicManagement', label: 'Gestão Acadêmica', icon: GraduationCapIcon },
        { view: 'studyBank', label: 'Banco de Estudos', icon: BookOpenIcon },
        { view: 'marketplace', label: 'Gestão da Loja', icon: ShoppingBagIcon }, // Novo Fase 4
        { view: 'gamification', label: 'Ranking Global', icon: TrophyIcon }, // Novo Fase 3
        { view: 'studyRooms', label: 'Salas de Estudo', icon: MessageCircleIcon }, // Novo Fase 4
        { view: 'tests', label: 'Testes na Íntegra', icon: ClipboardListIcon },
        { view: 'crm', label: 'CRM de Alunos', icon: UsersIcon },
        { view: 'officialSummaries', label: 'Resumos Oficiais', icon: FileTextIcon },
        { view: 'trueFlashcards', label: 'Flashcards', icon: LayersIcon },
    ];
    
    const logoUrl = "https://pub-872633efa2d545638be12ea86363c2ca.r2.dev/WhatsApp%20Image%202025-11-09%20at%2013.47.15%20(1).png";

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const handleRoleChange = (role: UserRole) => {
        setUserRole(role);
    };

    const currentRoleLabel = userRole.role === 'teacher' ? 'Professor (Admin)' : userRole.studentName;
    const initials = userRole.role === 'teacher' ? 'P' : userRole.studentName.charAt(0);

    return (
        <aside className="w-64 bg-gray-900 text-white flex flex-col flex-shrink-0 h-full border-r border-gray-800">
            {/* Header: Logo Only */}
            <div className="py-4 px-6 flex items-center justify-center border-b border-gray-800">
                 <img src={logoUrl} alt="AprovaMed IA" className="w-full h-auto max-w-[160px] opacity-90 hover:opacity-100 transition-opacity" />
            </div>

            {/* Navigation */}
            <nav className="flex-grow p-3 overflow-y-auto custom-scrollbar space-y-1">
                {navItems.map(item => {
                    const Icon = item.icon;
                    const isActive = currentView === item.view || (item.view === 'landing' && currentView === 'chat');
                    
                    return (
                        <button
                            key={item.view}
                            onClick={() => setCurrentView(item.view as View)}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left font-medium text-sm transition-all duration-200 group ${
                                isActive 
                                ? 'bg-primary text-white shadow-md shadow-primary/20' 
                                : 'text-gray-400 hover:bg-gray-800 hover:text-gray-100'
                            }`}
                        >
                            <Icon className={`w-5 h-5 transition-colors ${isActive ? 'text-white' : 'text-gray-500 group-hover:text-gray-300'}`} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            {/* Footer: User Profile Menu (Pop-up) */}
            <div className="p-3 border-t border-gray-800 mt-auto relative" ref={menuRef}>
                
                {/* Popover Menu */}
                {isMenuOpen && (
                    <div className="absolute bottom-full left-3 right-3 mb-2 bg-white rounded-xl shadow-2xl border border-gray-200 overflow-hidden z-50 animation-fade-in-up">
                        <div className="p-3 border-b border-gray-100 bg-gray-50">
                            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Visualizando como</p>
                            <p className="text-sm font-semibold text-gray-800 truncate">{currentRoleLabel}</p>
                        </div>
                        
                        <div className="max-h-48 overflow-y-auto p-1 custom-scrollbar">
                            <button
                                onClick={() => handleRoleChange({ role: 'teacher' })}
                                className={`w-full text-left px-3 py-2 text-sm rounded-lg flex items-center gap-2 ${userRole.role === 'teacher' ? 'bg-primary/10 text-primary font-medium' : 'text-gray-600 hover:bg-gray-100'}`}
                            >
                                <UserCheckIcon className="w-4 h-4"/> Professor (Admin)
                            </button>
                            
                            {allStudents.length > 0 && (
                                <div className="mt-2 mb-1 px-2">
                                    <p className="text-[10px] font-bold text-gray-400 uppercase">Alunos</p>
                                </div>
                            )}
                            
                            {allStudents.map(student => (
                                <button
                                    key={student.id}
                                    onClick={() => handleRoleChange({ role: 'student', studentId: student.id, studentName: student.name })}
                                    className={`w-full text-left px-3 py-2 text-sm rounded-lg truncate transition-colors ${
                                        userRole.role === 'student' && userRole.studentId === student.id 
                                        ? 'bg-primary/10 text-primary font-medium' 
                                        : 'text-gray-600 hover:bg-gray-100'
                                    }`}
                                >
                                    {student.name}
                                </button>
                            ))}
                        </div>

                        <div className="p-2 border-t border-gray-100 bg-gray-50">
                            <button
                                onClick={onLogout}
                                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            >
                                Sair da Plataforma
                            </button>
                        </div>
                    </div>
                )}

                {/* User Trigger Button */}
                <button 
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    className={`w-full flex items-center gap-3 p-2 rounded-xl transition-all duration-200 group ${isMenuOpen ? 'bg-gray-800' : 'hover:bg-gray-800'}`}
                >
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-primary to-primary-dark flex items-center justify-center text-white font-bold shadow-lg ring-2 ring-gray-800 group-hover:ring-gray-700 transition-all">
                        {initials}
                    </div>
                    <div className="flex-1 text-left min-w-0">
                        <p className="text-sm font-medium text-white truncate">{currentRoleLabel}</p>
                        <p className="text-xs text-gray-400 truncate">Clique para opções</p>
                    </div>
                    <MoreVerticalIcon className="w-5 h-5 text-gray-500 group-hover:text-white transition-colors" />
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
