
import React, { useState, useRef, useEffect } from 'react';
import { Course, Module, Discipline, QuestionSet, Class, Student, QuizQuestion } from '../types';
import { LayersIcon, ClipboardListIcon, MoreVerticalIcon, EditIcon, TrashIcon, BarChartIcon, MoveIcon } from './IconComponents';

type Item = Course | Module | Discipline | QuestionSet | Class | Student;

interface ContentCardProps {
    item: Item;
    type: 'course' | 'module' | 'discipline' | 'question_set' | 'class' | 'student';
    onSelect: () => void;
    onEdit?: (item: Item) => void;
    onDelete?: (id: string) => void;
    onMove?: (item: Item) => void;
    onCreateTest?: (name: string, questions: QuizQuestion[]) => void;
    onDetails?: (item: Item) => void;
}

const ContentCard: React.FC<ContentCardProps> = ({ item, type, onSelect, onEdit, onDelete, onMove, onCreateTest, onDetails }) => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    // This flag determines if the card should show management options (edit, delete, move)
    // or study-related options.
    const isManagementCard = !!(onEdit || onDelete || onMove);

    const defaultImageUrl = "https://images.unsplash.com/photo-1584968130310-6d736933932b?q=80&w=2970&auto=format&fit=crop&ixlib=rb-4.0.3&ixid=M3wxMjA3fDB8MHxwaG90by1wYWdlfHx8fGVufDB8fHx8fA%3D%3D";
    
    const imageUrl = 'image_url' in item && item.image_url ? item.image_url : null;
    const name = 'subjectName' in item ? item.subjectName : item.name;

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const getSubtitle = () => {
        switch (type) {
            case 'course':
                const course = item as Course;
                const moduleCount = course.modules?.length || 0;
                return `${moduleCount} ${moduleCount === 1 ? 'módulo' : 'módulos'}`;
            case 'module':
                const module = item as Module;
                const disciplineCount = module.disciplines?.length || 0;
                return `${disciplineCount} ${disciplineCount === 1 ? 'disciplina' : 'disciplinas'}`;
            case 'discipline':
                const discipline = item as Discipline;
                const setCount = discipline.question_sets?.length || 0;
                return `${setCount} ${setCount === 1 ? 'assunto' : 'assuntos'}`;
            case 'question_set':
                return `${(item as QuestionSet).questions.length} questões`;
            case 'class':
                const classItem = item as Class;
                const studentCount = classItem.students?.length || 0;
                return `${studentCount} ${studentCount === 1 ? 'aluno' : 'alunos'}`;
            case 'student':
                return 'Aluno';
            default:
                return '';
        }
    };

    const handleAction = (e: React.MouseEvent, action?: (item: Item) => void) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        if (action) {
            action(item);
        }
    };

    const handleDelete = (e: React.MouseEvent) => {
        e.stopPropagation();
        setIsMenuOpen(false);
        onDelete?.(item.id);
    };

    const handleCreateTest = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (onCreateTest && 'questions' in item) {
            // Use a default name instead of prompting to ensure reliability
            const defaultName = `${name} - Teste Rápido`;
            if (window.confirm(`Deseja criar um teste com o nome "${defaultName}" contendo estas questões?`)) {
                onCreateTest(defaultName, (item as QuestionSet).questions);
            }
        }
    };
    
    const cardClass = type === 'course' ? "w-64 h-40" : "w-56 h-32";
    const showDetailsButton = onDetails && ['course', 'module', 'discipline', 'class', 'student'].includes(type);

    return (
        <div 
            className={`flex-shrink-0 ${cardClass} bg-gray-700 rounded-lg overflow-hidden relative shadow-lg cursor-pointer group transform transition-transform duration-300 hover:scale-105 hover:shadow-2xl`}
            onClick={onSelect}
        >
            <img 
                src={imageUrl || defaultImageUrl} 
                alt={name}
                className="w-full h-full object-cover absolute inset-0 transition-transform duration-300 group-hover:scale-110" 
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-transparent"></div>
            <div className="absolute bottom-0 left-0 p-3 w-full">
                <h3 className="font-bold text-white truncate">{name}</h3>
                <p className="text-xs text-gray-300">{getSubtitle()}</p>
            </div>

            {showDetailsButton && (
                <button onClick={(e) => handleAction(e, onDetails)} className="absolute top-2 left-2 p-1.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-sm text-white opacity-0 group-hover:opacity-100 transition-opacity" title="Ver Detalhes e Análise">
                    <BarChartIcon className="w-4 h-4" />
                </button>
            )}

            {isManagementCard && (
                <div ref={menuRef} className="absolute top-2 right-2">
                    <button onClick={(e) => { e.stopPropagation(); setIsMenuOpen(!isMenuOpen); }} className="p-1.5 bg-black/40 hover:bg-black/60 rounded-full backdrop-blur-sm text-white">
                        <MoreVerticalIcon className="w-4 h-4" />
                    </button>
                    {isMenuOpen && (
                        <div className="absolute right-0 mt-2 w-32 bg-white rounded-md shadow-lg border z-20">
                            {onEdit && <button onClick={(e) => handleAction(e, onEdit)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><EditIcon className="w-4 h-4" /> Editar</button>}
                            {onMove && type === 'question_set' && <button onClick={(e) => handleAction(e, onMove)} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 flex items-center gap-2"><MoveIcon className="w-4 h-4" /> Mover</button>}
                            {onDelete && <button onClick={handleDelete} className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 flex items-center gap-2"><TrashIcon className="w-4 h-4" /> Excluir</button>}
                        </div>
                    )}
                </div>
            )}
            
            {!isManagementCard && type === 'question_set' && (
                <div className="absolute top-2 right-2 flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button onClick={(e) => { e.stopPropagation(); onSelect(); }} className="p-2 bg-green-500/80 hover:bg-green-500 rounded-full backdrop-blur-sm" title="Estudar com Flashcards">
                        <LayersIcon className="w-4 h-4 text-white" />
                    </button>
                    {onCreateTest && (
                        <button onClick={handleCreateTest} className="p-2 bg-primary/80 hover:bg-primary rounded-full backdrop-blur-sm" title="Criar Teste com este Assunto">
                            <ClipboardListIcon className="w-4 h-4 text-white" />
                        </button>
                    )}
                </div>
            )}
        </div>
    );
};

export default ContentCard;
