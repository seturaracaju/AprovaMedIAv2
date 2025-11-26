
import React, { useState } from 'react';
import { Student } from '../types';
import { CheckCircleIcon, ShieldAlertIcon, CreditCardIcon } from './IconComponents';
import { supabase } from '../services/supabaseClient';

interface SubscriptionPageProps {
    student: Student;
    onSuccess: () => void;
}

const SubscriptionPage: React.FC<SubscriptionPageProps> = ({ student, onSuccess }) => {
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            // Chama a função segura no servidor (Edge Function)
            const { data, error } = await supabase.functions.invoke('create-checkout', {
                body: { 
                    userId: student.user_id, 
                    email: student.email, 
                    name: student.name 
                }
            });

            if (error) {
                console.error('Erro na Edge Function:', error);
                throw new Error(error.message || 'Falha na comunicação com o servidor.');
            }

            if (data?.paymentUrl) {
                // Redireciona o usuário para o checkout seguro do Asaas
                window.location.href = data.paymentUrl;
            } else {
                throw new Error('Link de pagamento não foi gerado.');
            }
            
        } catch (error: any) {
            alert(`Erro ao iniciar pagamento: ${error.message || "Tente novamente."}`);
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-4xl w-full bg-white rounded-2xl shadow-2xl overflow-hidden flex flex-col md:flex-row">
                
                {/* Lado Esquerdo: Benefícios */}
                <div className="bg-gray-900 text-white p-8 md:w-1/2 flex flex-col justify-between relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-primary/20 to-transparent z-0"></div>
                    <div className="relative z-10">
                        <h1 className="text-3xl font-bold mb-2">AprovaMed IA</h1>
                        <p className="text-gray-400 mb-8">Potencialize sua aprovação com Inteligência Artificial.</p>
                        
                        <ul className="space-y-3 text-sm">
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Mais de 50 mil questões</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Provas na Íntegra de grandes instituições</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Chat com PDF (Tire dúvidas na hora)</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Flashcards com Neuro-Repetição</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Tutor IA 24 horas</span>
                            </li>
                            <li className="flex items-center gap-3">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span>Download de Resumos</span>
                            </li>
                            <li className="flex items-center gap-3 pt-2 border-t border-gray-700">
                                <CheckCircleIcon className="w-5 h-5 text-primary flex-shrink-0" />
                                <span className="font-medium text-primary-light">Estamos em constante evolução para a sua aprovação</span>
                            </li>
                        </ul>
                    </div>
                    <div className="relative z-10 mt-8">
                        <p className="text-sm text-gray-400 italic">"A melhor decisão da minha preparação."</p>
                        <p className="text-sm font-bold text-white mt-1">- Dr. Rafael, Residente USP</p>
                    </div>
                </div>

                {/* Lado Direito: Checkout */}
                <div className="p-8 md:w-1/2 flex flex-col justify-center">
                    <div className="text-center mb-8">
                        <div className="inline-block p-3 bg-yellow-100 text-yellow-700 rounded-full mb-4">
                            <ShieldAlertIcon className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-gray-800">Assinatura Necessária</h2>
                        <p className="text-gray-500 mt-2">
                            Olá, <span className="font-bold">{student.name}</span>. Para acessar a plataforma, escolha seu plano abaixo.
                        </p>
                    </div>

                    <div className="border-2 border-primary rounded-xl p-6 relative bg-primary/5">
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide">
                            Oferta Especial
                        </div>
                        <div className="text-center mb-4">
                            <p className="text-gray-600 font-medium">Plano Mensal</p>
                            <div className="flex items-center justify-center gap-1 mt-2">
                                <span className="text-sm text-gray-500 align-top mt-1">R$</span>
                                <span className="text-4xl font-bold text-gray-900">29,90</span>
                                <span className="text-gray-500 self-end mb-1">/mês</span>
                            </div>
                        </div>
                        <button 
                            onClick={handleSubscribe}
                            disabled={loading}
                            className="w-full py-3 bg-primary text-white font-bold rounded-lg hover:bg-primary-dark transition-all shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                            ) : (
                                <>
                                    <CreditCardIcon className="w-5 h-5" /> Assinar Agora
                                </>
                            )}
                        </button>
                        <p className="text-xs text-center text-gray-400 mt-3 flex items-center justify-center gap-1">
                            <ShieldAlertIcon className="w-3 h-3"/> Pagamento seguro via Asaas (PIX ou Cartão)
                        </p>
                    </div>

                    <button 
                        onClick={handleLogout}
                        className="mt-6 text-sm text-gray-500 hover:text-gray-700 underline text-center"
                    >
                        Entrar com outra conta
                    </button>
                </div>
            </div>
        </div>
    );
};

export default SubscriptionPage;
