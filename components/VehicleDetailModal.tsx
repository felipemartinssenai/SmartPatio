
import React, { useState } from 'react';
import { Veiculo } from '../types';

interface VehicleDetailModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
}

const DetailRow: React.FC<{ label: string; value: string | number | undefined | null }> = ({ label, value }) => (
    <div className="bg-gray-900/50 p-4 rounded-2xl border border-gray-700/50">
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">{label}</p>
        <p className="text-sm font-bold text-white leading-tight">{value || '---'}</p>
    </div>
);

const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({ vehicle, onClose }) => {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    if (!vehicle) return null;

    const photos = vehicle.fotos_avaria_url || [];

    const handleOpenMaps = () => {
        if (vehicle.lat && vehicle.lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${vehicle.lat},${vehicle.lng}`, '_blank');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div 
                className="bg-gray-800 rounded-[32px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200"
                onClick={e => e.stopPropagation()}
            >
                {/* Header */}
                <div className="p-6 border-b border-gray-700 bg-gray-900/80 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-mono font-black bg-white text-black px-3 py-1 rounded-xl shadow-lg transform -rotate-1">
                            {vehicle.placa}
                        </span>
                        <div>
                            <h2 className="text-lg font-black text-white uppercase tracking-tighter">Detalhes da Coleta</h2>
                            <p className="text-[10px] text-blue-400 font-black uppercase tracking-widest">Protocolo: {vehicle.id.slice(0, 8)}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-900/20">
                    
                    {/* Fotos */}
                    {photos.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Fotos do Estado do Veículo</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                {photos.map((url, idx) => (
                                    <div 
                                        key={idx} 
                                        onClick={() => setViewerIndex(idx)}
                                        className="aspect-square rounded-xl overflow-hidden border-2 border-gray-700 hover:border-blue-500 cursor-pointer transition-all shadow-md active:scale-95"
                                    >
                                        <img src={url} alt={`Avaria ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Dados do Veículo */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 17a2 2 0 11-4 0 2 2 0 014 0zM19 17a2 2 0 11-4 0 2 2 0 014 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg>
                            Informações do Veículo
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <DetailRow label="Modelo" value={vehicle.modelo} />
                            <DetailRow label="Cor" value={vehicle.cor} />
                            <DetailRow label="Ano" value={vehicle.ano} />
                            <DetailRow label="Chassi" value={vehicle.chassi} />
                            <DetailRow label="Renavam" value={vehicle.renavam} />
                            <DetailRow label="Status Atual" value={vehicle.status} />
                        </div>
                    </div>

                    {/* Dados do Proprietário / Local */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Proprietário e Localização
                        </h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <DetailRow label="Nome do Proprietário" value={vehicle.proprietario_nome} />
                            <DetailRow label="Telefone de Contato" value={vehicle.proprietario_telefone} />
                            <div className="md:col-span-2">
                                <DetailRow 
                                    label="Endereço de Coleta" 
                                    value={`${vehicle.proprietario_rua || ''}, ${vehicle.proprietario_numero || ''} - ${vehicle.proprietario_bairro || ''} (${vehicle.proprietario_cep || 'S/ CEP'})`} 
                                />
                            </div>
                        </div>
                    </div>

                    {/* Observações */}
                    {vehicle.observacoes && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Observações Adicionais</h3>
                            <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[24px]">
                                <p className="text-amber-200 text-sm italic leading-relaxed">"{vehicle.observacoes}"</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-700 bg-gray-900/80 backdrop-blur-md flex gap-4">
                    <button 
                        onClick={onClose}
                        className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all border border-gray-700 active:scale-95"
                    >
                        Voltar para Lista
                    </button>
                    {(vehicle.lat && vehicle.lng) && (
                        <button 
                            onClick={handleOpenMaps}
                            className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] transition-all shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-95"
                        >
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"></path></svg>
                            Abrir no GPS
                        </button>
                    )}
                </div>
            </div>

            {/* Visualizador de Imagem Full */}
            {viewerIndex !== null && (
                <div className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4 animate-in fade-in duration-300" onClick={() => setViewerIndex(null)}>
                    <img src={photos[viewerIndex]} alt="Full" className="max-w-full max-h-full object-contain rounded-lg" />
                    <button className="absolute top-6 right-6 p-4 text-white hover:bg-white/10 rounded-full transition-colors">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>
            )}
        </div>
    );
};

export default VehicleDetailModal;
