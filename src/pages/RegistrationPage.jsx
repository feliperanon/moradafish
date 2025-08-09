import React, { useState, useEffect } from 'react';
import { db } from '../services/firebase';
import {
  collection, addDoc, onSnapshot, query, doc,
  deleteDoc, updateDoc, getDocs, where
} from 'firebase/firestore';
import Barcode from 'react-barcode';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';

// --- Componentes de UI (Modais e Notificação) ---

function Notification({ message, type, onClose }) {
  if (!message) return null;
  const baseClasses = "p-4 mb-4 rounded-md fixed top-5 right-5 z-50 shadow-lg border-l-4";
  const typeClasses = {
    success: 'bg-green-100 border-green-500 text-green-700',
    error: 'bg-red-100 border-red-500 text-red-700',
    info: 'bg-blue-100 border-blue-500 text-blue-700',
  };
  return (
    <div className={`${baseClasses} ${typeClasses[type] || typeClasses.info}`} role="alert">
      <p className="pr-8">{message}</p>
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
    if (item) setFormData({ ...item });
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
            <input type="text" name="nome" id="nome" value={formData.nome || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
          </div>
        );
      case 'usuarios':
        return (
          <div className="space-y-4">
            <div>
              <label htmlFor="nome" className="block text-sm font-medium text-gray-700">Nome do Usuário</label>
              <input type="text" name="nome" id="nome" value={formData.nome || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="funcao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" name="funcao" id="funcao" value={formData.funcao || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="permissao" className="block text-sm font-medium text-gray-700">Nível de Permissão</label>
              <select name="permissao" id="permissao" value={formData.permissao || 'Leitura'} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm">
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
              <input type="text" name="nome" id="nome" value={formData.nome || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
            </div>
            <div>
              <label htmlFor="funcao" className="block text-sm font-medium text-gray-700">Função</label>
              <input type="text" name="funcao" id="funcao" value={formData.funcao || ''} onChange={handleChange} className="mt-1 block w-full p-2 border border-gray-300 rounded-md shadow-sm" required />
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
          <div className="mb-6">{renderFields()}</div>
          <div className="flex justify-end gap-4">
            <button type="button" onClick={onClose} className="bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg hover:bg-gray-400 transition">Cancelar</button>
            <button type="submit" className="bg-blue-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-blue-700 transition">Salvar Alterações</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/** ------------ MODAL DE IMPORTAÇÃO (Equipe) ------------ */
function ImportEquipeModal({ isOpen, onClose, onImport }) {
  const [rows, setRows] = useState([]);
  const [updateIfExists, setUpdateIfExists] = useState(true);
  const [fileName, setFileName] = useState('');

  if (!isOpen) return null;

  const normalizeHeader = (h) => (h || '').toString().trim().toLowerCase();

  const parseFile = async (file) => {
    try {
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json(ws, { defval: '' });

      // mapeia colunas flexíveis: nome / função / (opcional: matrícula)
      const mapped = json.map((r) => {
        const keys = Object.keys(r);
        const map = {};
        keys.forEach(k => { map[normalizeHeader(k)] = r[k]; });

        const nome = map['nome'] || map['colaborador'] || map['funcionário'] || map['funcionario'] || '';
        const funcao = map['função'] || map['funcao'] || map['cargo'] || '';
        const matricula = map['matrícula'] || map['matricula'] || '';

        return {
          nome: String(nome).trim(),
          funcao: String(funcao).trim(),
          matricula: String(matricula).trim(),
        };
      });

      setRows(mapped.filter(r => r.nome || r.funcao || r.matricula));
    } catch (e) {
      console.error(e);
      alert('Falha ao ler arquivo. Verifique se é CSV/XLSX válido.');
    }
  };

  const handleFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFileName(f.name);
    parseFile(f);
  };

  const handleConfirm = () => {
    onImport(rows, { updateIfExists });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50">
      <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-3xl mx-4">
        <h3 className="text-2xl font-bold text-gray-800">Importar Equipe de Produção</h3>
        <p className="text-gray-600 mt-1 mb-4">Formatos aceitos: CSV, XLSX, XLS. Colunas esperadas: <b>Nome</b>, <b>Função</b> (opcional: <b>Matrícula</b>).</p>

        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label className="flex-1 cursor-pointer">
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFile} className="hidden" />
            <div className="w-full p-3 border rounded-lg bg-gray-50 hover:bg-gray-100 transition text-center">
              {fileName || 'Selecionar arquivo…'}
            </div>
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" className="h-4 w-4" checked={updateIfExists} onChange={(e) => setUpdateIfExists(e.target.checked)} />
            <span className="text-sm text-gray-700">Atualizar se já existir (pelo nome)</span>
          </label>
        </div>

        <div className="bg-gray-50 rounded-lg border p-3 max-h-64 overflow-auto">
          <p className="text-sm text-gray-600 mb-2">Pré-visualização (até 20 linhas):</p>
          <table className="w-full text-sm">
            <thead className="bg-white sticky top-0">
              <tr>
                <th className="p-2 border">Nome</th>
                <th className="p-2 border">Função</th>
                <th className="p-2 border">Matrícula</th>
              </tr>
            </thead>
            <tbody>
              {rows.slice(0, 20).map((r, i) => (
                <tr key={i} className="bg-white odd:bg-gray-100">
                  <td className="p-2 border">{r.nome}</td>
                  <td className="p-2 border">{r.funcao}</td>
                  <td className="p-2 border">{r.matricula}</td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={3} className="p-2 text-center text-gray-500">Nenhum dado carregado.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex justify-end gap-3 mt-5">
          <button onClick={onClose} className="bg-gray-200 hover:bg-gray-300 text-gray-800 font-semibold px-4 py-2 rounded-lg">Cancelar</button>
          <button onClick={handleConfirm} disabled={rows.length === 0} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-bold px-4 py-2 rounded-lg">Importar</button>
        </div>
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

  // Estados para as listas
  const [fornecedoresList, setFornecedoresList] = useState([]);
  const [loadingFornecedores, setLoadingFornecedores] = useState(true);
  const [usuariosList, setUsuariosList] = useState([]);
  const [loadingUsuarios, setLoadingUsuarios] = useState(true);
  const [equipeList, setEquipeList] = useState([]);
  const [loadingEquipe, setLoadingEquipe] = useState(true);

  // Modais e itens selecionados
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [itemToDelete, setItemToDelete] = useState(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Importação
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Notificações
  const [notification, setNotification] = useState({ message: '', type: '' });
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification({ message: '', type: '' }), 3500);
  };

  // Realtime listeners
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'fornecedores')), (snapshot) => {
      setFornecedoresList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingFornecedores(false);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'usuarios')), (snapshot) => {
      setUsuariosList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingUsuarios(false);
    });
    return () => unsub();
  }, []);
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, 'equipe_producao')), (snapshot) => {
      setEquipeList(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoadingEquipe(false);
    });
    return () => unsub();
  }, []);

  // Funções gerais
  const checkDuplicate = async (collectionName, field, value, excludeId = null) => {
    const qDup = query(collection(db, collectionName), where(field, '==', value));
    const qs = await getDocs(qDup);
    if (excludeId && !qs.empty) {
      return qs.docs.some(d => d.id !== excludeId);
    }
    return !qs.empty;
  };

  const handleSaveFornecedor = async (e) => {
    e.preventDefault();
    const nome = fornecedorNome.trim();
    if (!nome) return;
    if (await checkDuplicate('fornecedores', 'nome', nome)) {
      return showNotification('Este fornecedor já existe!', 'error');
    }
    try {
      await addDoc(collection(db, 'fornecedores'), { nome });
      setFornecedorNome('');
      showNotification('Fornecedor salvo com sucesso!');
    } catch {
      showNotification('Erro ao salvar.', 'error');
    }
  };

  const handleSaveUsuario = async (e) => {
    e.preventDefault();
    const nome = usuarioNome.trim();
    const funcao = usuarioFuncao.trim();
    if (!nome || !funcao) return;
    if (await checkDuplicate('usuarios', 'nome', nome)) {
      return showNotification('Este usuário já existe!', 'error');
    }
    try {
      await addDoc(collection(db, 'usuarios'), { nome, funcao, permissao: usuarioPermissao });
      setUsuarioNome(''); setUsuarioFuncao(''); setUsuarioPermissao('Leitura');
      showNotification('Usuário salvo com sucesso!');
    } catch {
      showNotification('Erro ao salvar.', 'error');
    }
  };

  const handleSaveEquipe = async (e) => {
    e.preventDefault();
    const nome = equipeNome.trim();
    const funcao = equipeFuncao.trim();
    if (!nome || !funcao) return;
    if (await checkDuplicate('equipe_producao', 'nome', nome)) {
      return showNotification('Este membro da equipe já existe!', 'error');
    }
    try {
      await addDoc(collection(db, 'equipe_producao'), { nome, funcao });
      setEquipeNome(''); setEquipeFuncao('');
      showNotification('Membro da equipe salvo com sucesso!');
    } catch {
      showNotification('Erro ao salvar.', 'error');
    }
  };

  const handleDeleteClick = (id, collectionName) => {
    setItemToDelete({ id, collectionName });
    setIsConfirmOpen(true);
  };
  const confirmDelete = async () => {
    if (!itemToDelete) return;
    try {
      await deleteDoc(doc(db, itemToDelete.collectionName, itemToDelete.id));
      showNotification('Item excluído com sucesso!');
    } catch {
      showNotification('Erro ao excluir.', 'error');
    } finally {
      setIsConfirmOpen(false);
      setItemToDelete(null);
    }
  };

  const handleEditClick = (item, collectionName) => {
    setItemToEdit({ ...item, collectionName });
    setIsEditModalOpen(true);
  };
  const handleUpdateItem = async (updatedItem) => {
    const { id, collectionName, ...dataToUpdate } = updatedItem;
    if (dataToUpdate?.nome && await checkDuplicate(collectionName, 'nome', dataToUpdate.nome, id)) {
      return showNotification('Este nome já pertence a outro item!', 'error');
    }
    try {
      await updateDoc(doc(db, collectionName, id), dataToUpdate);
      showNotification('Item atualizado com sucesso!');
    } catch {
      showNotification('Erro ao atualizar o item.', 'error');
    } finally {
      setIsEditModalOpen(false);
      setItemToEdit(null);
    }
  };

  const handleExportBarcodes = () => {
    const barcodesContainer = document.getElementById('barcodes-for-export');
    if (!barcodesContainer) return;
    showNotification('Gerando PDF...', 'info');
    html2canvas(barcodesContainer, { scale: 2 }).then(canvas => {
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const imgWidth = pdfWidth - 20;
      const ratio = imgWidth / canvas.width;
      const imgHeight = canvas.height * ratio;
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 10, 10, imgWidth, imgHeight, undefined, 'FAST');
      pdf.save('codigos_de_barras_equipe.pdf');
    });
  };

  /** -------- Importação em massa: Equipe de Produção -------- */
  const handleImportEquipe = async (rows, options) => {
    if (!rows || rows.length === 0) {
      setIsImportOpen(false);
      return;
    }
    const { updateIfExists } = options || {};
    let inserted = 0, updated = 0, skipped = 0, invalid = 0;

    showNotification('Processando importação...', 'info');

    for (const r of rows) {
      const nome = (r?.nome || '').trim();
      const funcao = (r?.funcao || '').trim();
      const matricula = (r?.matricula || '').trim();

      if (!nome) { invalid++; continue; }

      try {
        // Procura por nome igual
        const qFind = query(collection(db, 'equipe_producao'), where('nome', '==', nome));
        const snap = await getDocs(qFind);

        if (snap.empty) {
          // Novo cadastro
          await addDoc(collection(db, 'equipe_producao'), {
            nome,
            ...(funcao ? { funcao } : {}),
            ...(matricula ? { matricula } : {}),
          });
          inserted++;
        } else {
          // Já existe
          if (updateIfExists) {
            const ref = snap.docs[0].ref;
            const dataToUpd = {};
            if (funcao) dataToUpd.funcao = funcao;
            if (matricula) dataToUpd.matricula = matricula;
            if (Object.keys(dataToUpd).length > 0) {
              await updateDoc(ref, dataToUpd);
              updated++;
            } else {
              skipped++;
            }
          } else {
            skipped++;
          }
        }
      } catch (e) {
        console.error('Falha ao processar linha:', e);
        invalid++;
      }
    }

    setIsImportOpen(false);
    showNotification(
      `Importação concluída: ${inserted} inseridos, ${updated} atualizados, ${skipped} ignorados, ${invalid} inválidos.`,
      'success'
    );
  };

  const renderList = (title, data, loading, columns, collectionName) => (
    <div className="mt-4">
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <h4 className="text-lg font-semibold text-gray-700">{title}</h4>
        <div className="flex gap-2">
          {collectionName === 'equipe_producao' && (
            <>
              {data.length > 0 && (
                <button
                  onClick={handleExportBarcodes}
                  className="bg-green-600 text-white font-bold py-1 px-3 rounded-lg text-sm hover:bg-green-700 transition"
                >
                  Exportar Códigos
                </button>
              )}
              <button
                onClick={() => setIsImportOpen(true)}
                className="bg-blue-600 text-white font-bold py-1 px-3 rounded-lg text-sm hover:bg-blue-700 transition"
              >
                Importar Planilha
              </button>
            </>
          )}
        </div>
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
                      {col.isBarcode ? <Barcode value={item.id} height={40} fontSize={12} /> : (item[col.key] ?? '')}
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
      <ImportEquipeModal isOpen={isImportOpen} onClose={() => setIsImportOpen(false)} onImport={handleImportEquipe} />

      <h2 className="text-3xl font-bold text-gray-800 text-center">Central de Cadastros</h2>

      {/* Fornecedor */}
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

      {/* Usuários */}
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

      {/* Equipe */}
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

        {renderList(
          'Equipe Cadastrada',
          equipeList,
          loadingEquipe,
          [
            { key: 'nome', label: 'Nome' },
            { key: 'funcao', label: 'Função' },
            { key: 'id', label: 'Código de Barras', isBarcode: true }
          ],
          'equipe_producao'
        )}
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
