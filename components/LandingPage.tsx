
import React, { useCallback, useState } from 'react';
import { UploadCloudIcon, ImageIcon } from './IconComponents';

interface LandingPageProps {
    onPdfUpload: (file: File) => void;
    isLoading: boolean;
    error: string | null;
}

const LandingPage: React.FC<LandingPageProps> = ({ onPdfUpload, isLoading, error }) => {
    const [isDragging, setIsDragging] = useState(false);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            onPdfUpload(e.target.files[0]);
        }
    };

    const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            const file = e.dataTransfer.files[0];
            // Aceita PDF e Imagens
            if (file.type === 'application/pdf' || file.type.startsWith('image/')) {
                onPdfUpload(file);
            } else {
                alert("Por favor, envie um arquivo PDF ou Imagem (PNG, JPG) válido.");
            }
        }
    }, [onPdfUpload]);

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
    };

    const handleDragEnter = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    return (
        <div className="h-full w-full flex flex-col bg-white">
            <main className="flex-grow flex items-center justify-center p-4">
                <div className="w-full max-w-4xl text-center">
                    <h2 className="text-4xl md:text-6xl font-extrabold text-gray-900 mb-4">
                        Potencialize Seus Estudos para Medicina com <span className="text-primary">IA</span>
                    </h2>
                    <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
                        Envie seus guias de estudo (PDF) ou fotos de anotações/provas (Imagens). A IA irá ler, transcrever e criar questões interativas instantaneamente.
                    </p>

                    <div
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        className={`relative group w-full max-w-2xl mx-auto p-8 border-2 border-dashed rounded-xl transition-all duration-300 ${isDragging ? 'border-primary bg-primary/10' : 'border-gray-300 hover:border-primary/80 hover:bg-gray-50'}`}
                    >
                        <input
                            type="file"
                            id="file-upload"
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                            onChange={handleFileChange}
                            accept=".pdf, .png, .jpg, .jpeg"
                            disabled={isLoading}
                        />
                        <div className="flex flex-col items-center justify-center space-y-4">
                            {isLoading ? (
                                <>
                                    <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                                    <p className="text-gray-600 font-semibold">Processando seu material com IA...</p>
                                </>
                            ) : (
                                <>
                                    <div className="p-4 bg-primary/10 rounded-full group-hover:scale-110 transition-transform flex gap-2">
                                        <UploadCloudIcon className="w-10 h-10 text-primary" />
                                    </div>
                                    <div className="text-gray-600 font-semibold">
                                        <label htmlFor="file-upload" className="text-primary cursor-pointer hover:underline">Clique para enviar</label> ou arraste
                                        <p className="text-sm text-gray-400 mt-1 font-normal">PDFs, Fotos de Caderno, Prints de Provas</p>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                    {error && <p className="mt-4 text-red-500">{error}</p>}
                </div>
            </main>
        </div>
    );
};

export default LandingPage;
