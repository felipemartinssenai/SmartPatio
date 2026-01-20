
import React, { useState } from 'react';
import { Veiculo, VehicleStatus } from '../types';

interface VehicleDetailModalProps {
    vehicle: Veiculo | null;
    onClose: () => void;
}

const STATUS_MAP: Record<VehicleStatus, string> = {
    'aguardando_coleta': 'Aguardando Coleta',
    'em_transito': 'Em Trânsito / Rota',
    'no_patio': 'No Pátio',
    'finalizado': 'Finalizado'
};

const DetailRow: React.FC<{ 
    label: string; 
    value: string | number | undefined | null; 
    type?: 'address' | 'phone' | 'default' 
}> = ({ label, value, type = 'default' }) => {
    
    const handleAction = () => {
        if (!value) return;

        if (type === 'address') {
            const encodedAddress = encodeURIComponent(String(value));
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodedAddress}`, '_blank');
        }

        if (type === 'phone') {
            const cleanNumber = String(value).replace(/\D/g, '');
            const waNumber = cleanNumber.length <= 11 ? `55${cleanNumber}` : cleanNumber;
            window.open(`https://wa.me/${waNumber}`, '_blank');
        }
    };

    const isInteractive = type !== 'default' && value;

    return (
        <div 
            className={`bg-gray-900/50 p-4 rounded-2xl border transition-all ${
                isInteractive 
                ? 'hover:bg-blue-600/10 cursor-pointer border-blue-500/30 active:scale-[0.98]' 
                : 'border-gray-700/50'
            }`}
            onClick={isInteractive ? handleAction : undefined}
        >
            <div className="flex justify-between items-start mb-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">{label}</p>
                {isInteractive && (
                    <svg className={`w-4 h-4 ${type === 'address' ? 'text-blue-500' : 'text-green-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d={type === 'address' ? "M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" : "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"}></path>
                    </svg>
                )}
            </div>
            <p className={`text-sm font-bold leading-tight ${
                type === 'address' ? 'text-blue-400' : 
                type === 'phone' ? 'text-green-400' : 
                'text-white'
            }`}>
                {value || '---'}
            </p>
        </div>
    );
};

const VehicleDetailModal: React.FC<VehicleDetailModalProps> = ({ vehicle, onClose }) => {
    const [viewerIndex, setViewerIndex] = useState<number | null>(null);

    if (!vehicle) return null;

    const photos = vehicle.fotos_avaria_url || [];
    const documents = vehicle.documentos_url || [];

    const handleOpenMaps = () => {
        if (vehicle.lat && vehicle.lng) {
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${vehicle.lat},${vehicle.lng}`, '_blank');
        } else {
            const fullAddress = `${vehicle.proprietario_rua || ''}, ${vehicle.proprietario_numero || ''} - ${vehicle.proprietario_bairro || ''}, ${vehicle.proprietario_cep || ''}`;
            window.open(`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(fullAddress)}`, '_blank');
        }
    };

    const fullAddress = vehicle.proprietario_rua 
        ? `${vehicle.proprietario_rua}, ${vehicle.proprietario_numero || 'S/N'} - ${vehicle.proprietario_bairro || ''} (${vehicle.proprietario_cep || 'S/ CEP'})`
        : null;

    return (
        <div className="fixed inset-0 bg-black/95 backdrop-blur-sm flex items-center justify-center z-[5000] p-4" onClick={onClose}>
            <div className="bg-gray-800 rounded-[32px] w-full max-w-3xl max-h-[92vh] flex flex-col shadow-2xl border border-gray-700 overflow-hidden animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                <div className="p-6 border-b border-gray-700 bg-gray-900/80 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <span className="text-2xl font-mono font-black bg-white text-black px-3 py-1 rounded-xl shadow-lg">
                            {vehicle.placa}
                        </span>
                        <h2 className="text-lg font-black text-white uppercase">Detalhes da Coleta</h2>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors text-gray-400">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-gray-900/20">
                    {photos.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Fotos do Veículo</h3>
                            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
                                {photos.map((url, idx) => (
                                    <div key={idx} onClick={() => setViewerIndex(idx)} className="aspect-square rounded-xl overflow-hidden border-2 border-gray-700 hover:border-blue-500 cursor-pointer transition-all shadow-md">
                                        <img src={url} alt={`Avaria ${idx}`} className="w-full h-full object-cover" />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {documents.length > 0 && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] px-1">Documentos Anexados</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {documents.map((url, idx) => {
                                    const isPdf = url.toLowerCase().includes('.pdf');
                                    return (
                                        <a key={idx} href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-4 bg-gray-800 border border-gray-700 rounded-2xl hover:border-blue-500 hover:bg-gray-750 transition-all group">
                                            <div className="p-2 bg-blue-600/10 text-blue-400 rounded-lg group-hover:bg-blue-600 group-hover:text-white transition-all">
                                                {isPdf ? (
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"></path></svg>
                                                ) : (
                                                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg>
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-xs font-bold text-white uppercase truncate">Documento #{idx + 1}</p>
                                                <p className="text-[9px] text-gray-500 font-black uppercase">Clique para abrir/baixar</p>
                                            </div>
                                        </a>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] px-1 flex items-center gap-2">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0"></path></svg>
                            Informações do Veículo
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                            <DetailRow label="Modelo" value={vehicle.modelo} />
                            <DetailRow label="Cor" value={vehicle.cor} />
                            <DetailRow label="Ano" value={vehicle.ano} />
                            <DetailRow label="Status" value={STATUS_MAP[vehicle.status] || vehicle.status} />
                        </div>
                    </div>

                    <div className="space-y-4">
                        <h3 className="text-xs font-black text-blue-500 uppercase tracking-[0.2em] px-1">Proprietário e Localização</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            <DetailRow label="Proprietário" value={vehicle.proprietario_nome} />
                            <DetailRow label="Telefone" value={vehicle.proprietario_telefone} type="phone" />
                            <div className="md:col-span-2">
                                <DetailRow label="Endereço de Coleta" value={fullAddress} type="address" />
                            </div>
                        </div>
                    </div>

                    {vehicle.observacoes && (
                        <div className="space-y-4">
                            <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] px-1">Observações</h3>
                            <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[24px]">
                                <p className="text-amber-200 text-sm italic leading-relaxed">"{vehicle.observacoes}"</p>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-6 border-t border-gray-700 bg-gray-900/80 backdrop-blur-md flex gap-4">
                    <button onClick={onClose} className="flex-1 py-4 bg-gray-800 hover:bg-gray-700 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] border border-gray-700 active:scale-95">Voltar</button>
                    <button onClick={handleOpenMaps} className="flex-1 py-4 bg-blue-600 hover:bg-blue-500 rounded-2xl text-white font-black uppercase tracking-widest text-[10px] shadow-xl shadow-blue-900/40 flex items-center justify-center gap-2 active:scale-95">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"></path></svg>
                        GPS
                    </button>
                </div>
            </div>

            {viewerIndex !== null && (
                <div className="fixed inset-0 z-[6000] bg-black/95 flex items-center justify-center p-4" onClick={() => setViewerIndex(null)}>
                    <img src={photos[viewerIndex]} alt="Full" className="max-w-full max-h-full object-contain" />
                </div>
            )}
        </div>
    );
};

export default VehicleDetailModal;
