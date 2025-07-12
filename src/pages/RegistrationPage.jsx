import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import { collection, addDoc, onSnapshot, query, doc, deleteDoc, updateDoc, getDocs, where } from 'firebase/firestore';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

// --- Componentes de UI (Modais e Notificação) ---

function Notification({ message, type, onClose }) {
  if (!message) return null;
  const baseClasses = "p-4 mb-4 rounded-md fixed top-5 right-5 z-50 shadow-lg";
  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };
  return (
    <div className={`${baseClasses} ${typeClasses[type] || typeClasses.info}`} role="alert">
      <p>{message}</p>
      <button onClick={onClose} className="absolute top-0 right-0 p-2 text-lg">&times;</button>
    </div>
  );
}

function ConfirmationModal({ isOpen, onClose, onConfirm, title, message }) {
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-sm w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800">{title}</h3>
        <p className="text-gray-600 mt-2 mb-6">{message}</p>
        <div className="flex justify-end gap-4">
          <button onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-400 transition">Cancelar</button>
          <button onClick={onConfirm} className="bg-red-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-red-700 transition">Confirmar</button>
        </div>
      </div>
    </div>
  );
}

function EditModal({ isOpen, onClose, onSave, item, collectionName }) {
  const [formData, setFormData] = useState(null);

  useEffect(() => {
    if (item) {
      setFormData({ ...item });
    }
  }, [item]);

  if (!isOpen || !formData) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  const renderFields = () => {
    switch (collectionName) {
      case 'fornecedores':
        return (
          <div>
            <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Fornecedor</label>
            <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
          </div>
        );
      case 'usuarios':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Usuário</label>
              <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="funcao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" name="funcao" id="funcao" value={formData.funcao} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="permissao" className="block text-sm font-medium text-gray-700">Nível de Permissão</label>
              <select name="permissao" id="permissao" value={formData.permissao} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
                <option>Administrador</option>
                <option>Gerente</option>
                <option>Operador</option>
                <option>Leitura</option>
              </select>
            </div>
          </div>
        );
      case 'equipe_producao':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Membro</label>
              <input type="text" name="nome" id="nome" value={formData.nome} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="funcao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" name="funcao" id="funcao" value={formData.funcao} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
          </div>
        );
      default:
        return <p>Tipo de cadastro não reconhecido.</p>;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-lg shadow-xl max-w-lg w-full mx-4">
        <h3 className="text-xl font-bold text-gray-800 mb-4">Editar Item</h3>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            {renderFields()}
          </div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-400 transition">Cancelar</button>
            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// --- Página Principal de Cadastros ---

function RegistrationPage() {
  // Estados para os formulários
  const [fornecedorNome, setFornecedorNome] = useState('');
  const [usuarioNome, setUsuarioNome] = useState('');
  const [usuarioFuncao, setUsuarioFuncao] = useState('');
  const [usuarioPermissao, setUsuarioPermissao] = useState('Leitura');
  const [equipeNome, setEquipeNome] = useState('');
  const [equipeFuncao, setEquipeFuncao] = useState('');

  // Estados para as listas de dados e carregamento
  const [fornecedoresList, setFornecedoresList] = useState([]);
  const [loadingFornecedores, setLoadingFornecedores] = useState(true);
  const [usuariosList, setUsuariosList] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [equipeList, setEquipeList] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(true);

  // Estados para os modais e itens selecionados
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);
  
  // Estado para notificações
  const [notification, setNotification] = useState({ message: '', type: '' });

  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3000);
  };

  // Efeitos para buscar dados em tempo real
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "fornecedores")), (snapshot) => {
      setFornecedoresList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingFornecedores(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "usuarios")), (snapshot) => {
      setUsuariosList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingUsuarios(false);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "equipe_producao")), (snapshot) => {
      setEquipeList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingEquipe(false);
    });
    return () => unsub();
  }, []);

  // --- Funções de CRUD (Create, Read, Update, Delete) ---

  const checkDuplicate = async (collectionName, field, value, excludeId = null) => {
    const q = query(collection(db, collectionName), where(field, "==", value));
    const querySnapshot = await getDocs(q);
    if (excludeId && !querySnapshot.empty) {
      return querySnapshot.docs.some(doc => doc.id !== excludeId);
    }
    return !querySnapshot.empty;
  };
  
  const handleSaveFornecedor = async (e) => {
    e.preventDefault();
    if (!fornecedorNome.trim()) return;
    if (await checkDuplicate("fornecedores", "nome", fornecedorNome.trim())) {
      return showNotification("Este fornecedor já existe!", "error");
    }
    try {
      await addDoc(collection(db, "fornecedores"), { nome: fornecedorNome.trim() });
      setFornecedorNome('');
      showNotification("Fornecedor salvo com sucesso!");
    } catch (err) { showNotification("Erro ao salvar.", "error"); }
  };

  const handleSaveUsuario = async (e) => {
    e.preventDefault();
    if (!usuarioNome.trim()) return;
    if (await checkDuplicate("usuarios", "nome", usuarioNome.trim())) {
      return showNotification("Este usuário já existe!", "error");
    }
    try {
      await addDoc(collection(db, "usuarios"), { nome: usuarioNome.trim(), funcao: usuarioFuncao.trim(), permissao: usuarioPermissao });
      setUsuarioNome(''); setUsuarioFuncao(''); setUsuarioPermissao('Leitura');
      showNotification("Usuário salvo com sucesso!");
    } catch (err) { showNotification("Erro ao salvar.", "error"); }
  };

  const handleSaveEquipe = async (e) => {
    e.preventDefault();
    if (!equipeNome.trim()) return;
    if (await checkDuplicate("equipe_producao", "nome", equipeNome.trim())) {
      return showNotification("Este membro da equipe já existe!", "error");
    }
    try {
      await addDoc(collection(db, "equipe_producao"), { nome: equipeNome.trim(), funcao: equipeFuncao.trim() });
      setEquipeNome(''); setEquipeFuncao('');
      showNotification("Membro da equipe salvo com sucesso!");
    } catch (err) { showNotification("Erro ao salvar.", "error"); }
  };

  const handleDeleteClick = (id, collectionName) => {
    setItemToDelete({ id, collectionName });
    setIsConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, itemToDelete.collectionName, itemToDelete.id));
      showNotification("Item excluído com sucesso!");
    } catch (err) { showNotification("Erro ao excluir.", "error"); }
    finally { setIsConfirmOpen(false); setItemToDelete(null); }
  };

  const handleEditClick = (item, collectionName) => {
    setItemToEdit({ ...item, collectionName });
    setIsEditModalOpen(true);
  };

  const handleUpdateItem = async (updatedItem) => {
    const { id, collectionName, ...dataToUpdate } = updatedItem;
    if (await checkDuplicate(collectionName, "nome", dataToUpdate.nome, id)) {
      return showNotification("Este nome já pertence a outro item!", "error");
    }
    try {
      const itemRef = doc(db, collectionName, id);
      await updateDoc(itemRef, dataToUpdate);
      showNotification("Item atualizado com sucesso!");
    } catch (err) {
      showNotification("Erro ao atualizar o item.", "error");
    } finally {
      setIsEditModalOpen(false);
      setItemToEdit(null);
    }
  };

  const handleExportBarcodes = () => {
    const barcodesContainer = document.getElementById('barcodes-for-export');
    if (!barcodesContainer) return;
    showNotification("Gerando PDF...", "info");
    html2canvas(barcodesContainer, { scale: 2 }).then(canvas => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, pdfWidth - 20, 0, undefined, 'FAST');
      pdf.save('codigos_de_barras_equipe.pdf');
    });
  };

  const renderList = (title, data, loading, columns, collectionName) => (
    <div className="mt-4">
      <div className="flex justify-between items-center">
        <h4 className="text-lg font-semibold text-gray-700">{title}</h4>
        {collectionName === 'equipe_producao' && data.length > 0 && (
          <button onClick={handleExportBarcodes} className="bg-green-600 text-white font-bold py-1 px-3 rounded-lg text-sm hover:bg-green-700 transition">Exportar Códigos</button>
        )}
      </div>
      <div className="overflow-x-auto bg-white rounded-lg shadow mt-2 max-h-64">
        <table className="w-full text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0">
            <tr>
              {columns.map(col => <th key={col.key} scope="col" className="px-6 py-3">{col.label}</th>)}
              <th scope="col" className="px-6 py-3 text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length + 1} className="px-6 py-4 text-center">Carregando...</td></tr>
            ) : data.length === 0 ? (
              <tr><td colSpan={columns.length + 1} className="px-6 py-4 text-center">Nenhum item cadastrado.</td></tr>
            ) : (
              data.map(item => (
                <tr key={item.id} className="bg-white border-b hover:bg-gray-50">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4">
                      {col.isBarcode ? <Barcode value={item.id} height={40} fontSize={12} /> : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <button onClick={() => handleEditClick(item, collectionName)} className="font-medium text-blue-600 hover:underline mr-4">Editar</button>
                    <button onClick={() => handleDeleteClick(item.id, collectionName)} className="font-medium text-red-600 hover:underline">Excluir</button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-white p-6 md:p-8 rounded-lg shadow-md space-y-12">
      <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ message: '', type: '' })} />
      <ConfirmationModal isOpen={isConfirmOpen} onClose={() => setIsConfirmOpen(false)} onConfirm={confirmDelete} title="Confirmar Exclusão" message="Você tem certeza que deseja excluir este item? Esta ação não pode ser desfeita." />
      <EditModal isOpen={isEditModalOpen} onClose={() => setIsEditModalOpen(false)} onSave={handleUpdateItem} item={itemToEdit} collectionName={itemToEdit?.collectionName} />

      <h2 className="text-3xl font-bold text-gray-800 text-center">Central de Cadastros</h2>
      
      <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cadastro de Fornecedor</h3>
        <form onSubmit={handleSaveFornecedor} className="space-y-4">
          <div>
            <label htmlFor="fornecedorNome" className="block text-sm font-medium text-gray-700">Nome do Fornecedor</label>
            <input type="text" id="fornecedorNome" value={fornecedorNome} onChange={e => setFornecedorNome(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Salvar Fornecedor</button>
        </form>
        {renderList('Fornecedores Cadastrados', fornecedoresList, loadingFornecedores, [{ key: 'nome', label: 'Nome' }], 'fornecedores')}
      </div>

      <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cadastro de Usuário do Sistema</h3>
        <form onSubmit={handleSaveUsuario} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="usuarioNome" className="block text-sm font-medium text-gray-700">Nome</label>
              <input type="text" id="usuarioNome" value={usuarioNome} onChange={e => setUsuarioNome(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="usuarioFuncao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" id="usuarioFuncao" value={usuarioFuncao} onChange={e => setUsuarioFuncao(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
          </div>
          <div>
            <label htmlFor="usuarioPermissao" className="block text-sm font-medium text-gray-700">Nível de Permissão</label>
            <select id="usuarioPermissao" value={usuarioPermissao} onChange={e => setUsuarioPermissao(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
              <option>Administrador</option>
              <option>Gerente</option>
              <option>Operador</option>
              <option>Leitura</option>
            </select>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Salvar Usuário</button>
        </form>
        {renderList('Usuários Cadastrados', usuariosList, loadingUsuarios, [{ key: 'nome', label: 'Nome' }, { key: 'funcao', label: 'Função' }, { key: 'permissao', label: 'Permissão' }], 'usuarios')}
      </div>

      <div className="p-6 bg-gray-50 rounded-lg shadow-inner">
        <h3 className="text-xl font-semibold text-gray-800 mb-4">Cadastro da Equipe de Produção</h3>
        <form onSubmit={handleSaveEquipe} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="equipeNome" className="block text-sm font-medium text-gray-700">Nome</label>
              <input type="text" id="equipeNome" value={equipeNome} onChange={e => setEquipeNome(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="equipeFuncao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" id="equipeFuncao" value={equipeFuncao} onChange={e => setEquipeFuncao(e.target.value)} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Salvar Membro</button>
        </form>
        {renderList('Equipe Cadastrada', equipeList, loadingEquipe, [{ key: 'nome', label: 'Nome' }, { key: 'funcao', label: 'Função' }, { key: 'id', label: 'Código de Barras', isBarcode: true }], 'equipe_producao')}
      </div>

      {/* Container oculto para exportação de PDF */}
      <div id="barcodes-for-export" className="absolute -left-full p-4 bg-white">
        <style>{`@media print { body { -webkit-print-color-adjust: exact; } }`}</style>
        <h1 style={{textAlign: 'center', margin: '20px'}}>Códigos de Barras - Equipe de Produção</h1>
        {equipeList.map(membro => (
          <div key={membro.id} style={{ textAlign: 'center', marginBottom: '25px', pageBreakInside: 'avoid' }}>
            <p style={{fontSize: '16px', fontWeight: 'bold'}}>{membro.nome}</p>
            <Barcode value={membro.id} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default RegistrationPage;