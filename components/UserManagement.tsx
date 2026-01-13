
import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Profile, Page, UserRole } from '../types';

const ALL_PAGES: { id: Page; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Dashboard Mapa', icon: '📍' },
    { id: 'patio', label: 'Gestão de Pátio', icon: '🏠' },
    { id: 'solicitacao_coleta', label: 'Solicitar Coleta', icon: '➕' },
    { id: 'collections', label: 'Minhas Coletas (Motorista)', icon: '🚛' },
    { id: 'financials', label: 'Financeiro', icon: '💰' },
    { id: 'fechamentos', label: 'Fechamentos', icon: '📊' },
    { id: 'user_management', label: 'Gestão de Usuários', icon: '👥' },
];

const UserManagement: React.FC = () => {
    const [users, setUsers] = useState<Profile[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const [showAddUser, setShowAddUser] = useState(false);
    
    // Form para novo usuário
    const [newUserEmail, setNewUserEmail] = useState('');
    const [newUserPassword, setNewUserPassword] = useState('');
    const [newUserName, setNewUserName] = useState('');
    const [newUserRole, setNewUserRole] = useState<UserRole>('motorista');
    const [newUserPerms, setNewUserPerms] = useState<Page[]>(['collections']);
    const [addError, setAddError] = useState<string | null>(null);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        setLoading(true);
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .order('full_name');
        
        if (!error && data) {
            setUsers(data as Profile[]);
        }
        setLoading(false);
    };

    const handleTogglePermission = (page: Page) => {
        if (!selectedUser) return;
        
        const currentPerms = selectedUser.permissions || [];
        const newPerms = currentPerms.includes(page)
            ? currentPerms.filter(p => p !== page)
            : [...currentPerms, page];
        
        setSelectedUser({ ...selectedUser, permissions: newPerms });
    };

    const handleSavePermissions = async () => {
        if (!selectedUser) return;
        setIsSaving(true);
        
        const { error } = await supabase
            .from('profiles')
            .update({ 
                permissions: selectedUser.permissions,
                cargo: selectedUser.cargo
            })
            .eq('id', selectedUser.id);
        
        if (!error) {
            await fetchUsers();
            setSelectedUser(null);
        }
        setIsSaving(false);
    };

    const handleCreateUser = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setAddError(null);

        try {
            // Criação do usuário no Auth do Supabase
            const { error: signUpError } = await (supabase.auth as any).signUp({
                email: newUserEmail,
                password: newUserPassword,
                options: {
                    data: {
                        full_name: newUserName,
                        cargo: newUserRole,
                        permissions: newUserPerms
                    }
                }
            });

            if (signUpError) throw signUpError;

            // ROTINA DE CONFIRMAÇÃO COMENTADA CONFORME SOLICITADO
            // alert('Usuário cadastrado com sucesso! Verifique o e-mail se a confirmação estiver ativa no Supabase.');
            
            console.log('Usuário criado com sucesso no Auth.');
            setShowAddUser(false);
            setNewUserEmail('');
            setNewUserPassword('');
            setNewUserName('');
            
            // Recarrega a lista (o perfil deve ser criado via Trigger SQL imediatamente)
            setTimeout(() => fetchUsers(), 1500);

        } catch (err: any) {
            setAddError(err.message || 'Erro ao criar usuário');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="p-4 sm:p-8 bg-gray-900 h-full overflow-y-auto">
            <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-1">Gestão de Usuários</h1>
                    <p className="text-gray-400 text-sm">Controle de acessos e permissões do sistema</p>
                </div>
                <button
                    onClick={() => setShowAddUser(true)}
                    className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-lg transition-all"
                >
                    Novo Usuário
                </button>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Lista de Usuários */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-gray-700 bg-gray-700/30">
                        <h2 className="font-bold text-white">Usuários Cadastrados</h2>
                    </div>
                    <div className="divide-y divide-gray-700">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500">Carregando usuários...</div>
                        ) : users.length === 0 ? (
                            <div className="p-8 text-center text-gray-500">Nenhum usuário encontrado.</div>
                        ) : users.map(user => (
                            <div 
                                key={user.id}
                                onClick={() => setSelectedUser(user)}
                                className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${selectedUser?.id === user.id ? 'bg-blue-600/20' : 'hover:bg-gray-750'}`}
                            >
                                <div className="flex items-center">
                                    <div className="w-10 h-10 bg-blue-600 rounded-full flex items-center justify-center font-bold text-white mr-3 shadow-md">
                                        {user.full_name?.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="font-bold text-white text-sm">{user.full_name}</p>
                                        <p className="text-[10px] text-gray-400 uppercase font-black tracking-widest">{user.cargo}</p>
                                    </div>
                                </div>
                                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7"></path></svg>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor de Permissões */}
                <div className="bg-gray-800 rounded-2xl border border-gray-700 overflow-hidden shadow-xl">
                    <div className="p-4 border-b border-gray-700 bg-gray-700/30 flex justify-between items-center">
                        <h2 className="font-bold text-white">
                            {selectedUser ? `Configurações: ${selectedUser.full_name}` : 'Selecione um usuário'}
                        </h2>
                        {selectedUser && (
                            <button 
                                onClick={handleSavePermissions}
                                disabled={isSaving}
                                className="px-4 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg disabled:opacity-50 transition-all shadow-md"
                            >
                                {isSaving ? 'Salvando...' : 'Salvar Alterações'}
                            </button>
                        )}
                    </div>
                    
                    {selectedUser ? (
                        <div className="p-6 space-y-6">
                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Cargo do Sistema</label>
                                <select 
                                    value={selectedUser.cargo}
                                    onChange={(e) => setSelectedUser({...selectedUser, cargo: e.target.value as UserRole})}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="admin">Administrador</option>
                                    <option value="operador">Operador de Pátio</option>
                                    <option value="motorista">Motorista / Guincho</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-xs font-black text-gray-500 uppercase tracking-widest mb-3">Páginas Autorizadas</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {ALL_PAGES.map(page => (
                                        <button
                                            key={page.id}
                                            onClick={() => handleTogglePermission(page.id)}
                                            className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                                                (selectedUser.permissions || []).includes(page.id)
                                                    ? 'bg-blue-600/10 border-blue-500/50 text-blue-400'
                                                    : 'bg-gray-900 border-gray-700 text-gray-500 hover:border-gray-600'
                                            }`}
                                        >
                                            <div className="flex items-center">
                                                <span className="mr-3 text-lg">{page.icon}</span>
                                                <span className="text-sm font-bold">{page.label}</span>
                                            </div>
                                            <div className={`w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all ${(selectedUser.permissions || []).includes(page.id) ? 'bg-blue-500 border-blue-500' : 'border-gray-700'}`}>
                                                {(selectedUser.permissions || []).includes(page.id) && (
                                                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>
                                                )}
                                            </div>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="p-12 text-center text-gray-600 flex flex-col items-center">
                            <div className="w-20 h-20 bg-gray-700/30 rounded-full flex items-center justify-center mb-4 opacity-50">
                                <svg className="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z"></path></svg>
                            </div>
                            <p className="text-sm font-medium">Selecione um colaborador para gerenciar acessos.</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal para Adicionar Usuário */}
            {showAddUser && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[5000] p-4 backdrop-blur-sm">
                    <div className="bg-gray-800 rounded-3xl p-8 w-full max-w-md border border-gray-700 shadow-2xl">
                        <div className="flex justify-between items-center mb-6">
                            <h2 className="text-2xl font-bold text-white">Novo Colaborador</h2>
                            <button onClick={() => setShowAddUser(false)} className="text-gray-500 hover:text-white transition-colors">
                                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                            </button>
                        </div>
                        
                        <form onSubmit={handleCreateUser} className="space-y-4">
                            {addError && <div className="p-4 bg-red-500/10 border border-red-500/30 text-red-400 text-xs rounded-xl font-bold">{addError}</div>}
                            
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Nome Completo</label>
                                <input 
                                    required
                                    placeholder="Ex: João da Silva"
                                    value={newUserName}
                                    onChange={e => setNewUserName(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">E-mail de Acesso</label>
                                <input 
                                    required
                                    type="email"
                                    placeholder="joao@empresa.com"
                                    value={newUserEmail}
                                    onChange={e => setNewUserEmail(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Senha Provisória</label>
                                <input 
                                    required
                                    type="password"
                                    placeholder="Mínimo 6 caracteres"
                                    value={newUserPassword}
                                    onChange={e => setNewUserPassword(e.target.value)}
                                    className="w-full bg-gray-900 border border-gray-700 rounded-xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                                />
                            </div>

                            <button 
                                type="submit" 
                                disabled={isSaving} 
                                className="w-full py-4 bg-blue-600 hover:bg-blue-500 rounded-xl text-white font-black uppercase tracking-widest transition-all shadow-xl shadow-blue-900/40 mt-4 flex items-center justify-center gap-3 disabled:opacity-50"
                            >
                                {isSaving ? (
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                ) : 'Criar Colaborador'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserManagement;
