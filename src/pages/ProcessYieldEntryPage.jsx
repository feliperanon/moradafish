// C:\code\moradafish\src\pages\ProcessYieldEntryPage.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore';
import { db } from '../services/firebase';

// Helpers
const monthNamesPt = [
  'Janeiro','Fevereiro','Março','Abril','Maio','Junho',
  'Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'
];

function startOfMonth(year, monthIndex) {
  return new Date(year, monthIndex, 1, 0, 0, 0, 0);
}
function endOfMonth(year, monthIndex) {
  return new Date(year, monthIndex + 1, 0, 23, 59, 59, 999);
}
function asDateInputValue(dateObj) {
  // yyyy-mm-dd para <input type="date">
  const yyyy = dateObj.getFullYear();
  const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
  const dd = String(dateObj.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}
function safeNumber(v) {
  if (v === null || v === undefined) return 0;
  const n = parseFloat(String(v).replace(',', '.'));
  return isNaN(n) ? 0 : n;
}
function formatKg(n) {
  const val = Number(n || 0);
  return val.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function toTimestampFromDateInput(dateStr) {
  // dateStr = 'yyyy-mm-dd'
  return new Date(`${dateStr}T00:00:00`);
}

export default function ProcessYieldEntryPage() {
  // Filtro mês/ano (default: mês atual)
  const now = new Date();
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth());

  // Fornecedores (coleção 'fornecedores' com campo 'nome')
  const [suppliers, setSuppliers] = useState([]);
  const [loadingSuppliers, setLoadingSuppliers] = useState(true);

  // Lançamentos
  const [entries, setEntries] = useState([]);
  const [loadingEntries, setLoadingEntries] = useState(true);

  // Form novo lançamento
  const [form, setForm] = useState({
    data: asDateInputValue(now),
    fornecedor: '',
    lote: '',
    pesoPiscicultura: '',
    refugoSemEscama: '',
    fileDescarte: '',
    pesoFinalFile: '',
  });

  // UI
  const [saving, setSaving] = useState(false);
  const [notif, setNotif] = useState(null);

  // Modal edição
  const [editingItem, setEditingItem] = useState(null);
  const [editingSaving, setEditingSaving] = useState(false);

  // Confirmação excluir
  const [deletingId, setDeletingId] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Carrega fornecedores
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'fornecedores'), (snap) => {
      const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      // Assume campo 'nome'
      list.sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR'));
      setSuppliers(list);
      setLoadingSuppliers(false);
    }, () => setLoadingSuppliers(false));
    return () => unsub();
  }, []);

  // Carrega lançamentos por mês/ano (data = Timestamp)
  useEffect(() => {
    setLoadingEntries(true);
    const start = startOfMonth(selectedYear, selectedMonth);
    const end = endOfMonth(selectedYear, selectedMonth);

    const qRef = query(
      collection(db, 'entrada_rendimento_processo'),
      where('data', '>=', start),
      where('data', '<=', end),
      orderBy('data', 'desc')
    );

    const unsub = onSnapshot(qRef, (snap) => {
      const list = snap.docs.map((d) => {
        const data = d.data();
        // normaliza números
        const n = (k) => safeNumber(data[k]);
        return {
          id: d.id,
          ...data,
          pesoPiscicultura: n('pesoPiscicultura'),
          refugoSemEscama: n('refugoSemEscama'),
          fileDescarte: n('fileDescarte'),
          pesoFinalFile: n('pesoFinalFile'),
        };
      });
      setEntries(list);
      setLoadingEntries(false);
    }, () => setLoadingEntries(false));

    return () => unsub();
  }, [selectedYear, selectedMonth]);

  const yearsForFilter = useMemo(() => {
    // gera um range básico (2 anos pra trás e 1 pra frente, se quiser ajustar)
    const y = now.getFullYear();
    return [y - 2, y - 1, y, y + 1];
  }, []);

  function notify(type, message) {
    setNotif({ type, message });
    setTimeout(() => setNotif(null), 3500);
  }

  // Salvar novo lançamento
  async function handleSave() {
    if (!form.data || !form.fornecedor || !form.lote) {
      notify('error', 'Preencha Data, Fornecedor e Lote.');
      return;
    }
    if (!suppliers.find((s) => s.nome === form.fornecedor)) {
      notify('error', 'Selecione um fornecedor da base de cadastros.');
      return;
    }

    setSaving(true);
    try {
      await addDoc(collection(db, 'entrada_rendimento_processo'), {
        data: toTimestampFromDateInput(form.data),
        fornecedor: form.fornecedor,
        lote: form.lote,
        pesoPiscicultura: safeNumber(form.pesoPiscicultura),
        refugoSemEscama: safeNumber(form.refugoSemEscama),
        fileDescarte: safeNumber(form.fileDescarte),
        pesoFinalFile: safeNumber(form.pesoFinalFile),
        createdAt: new Date(),
      });
      notify('success', 'Lançamento salvo com sucesso!');
      // Limpa campos mantem data igual
      setForm((prev) => ({
        ...prev,
        fornecedor: '',
        lote: '',
        pesoPiscicultura: '',
        refugoSemEscama: '',
        fileDescarte: '',
        pesoFinalFile: '',
      }));
    } catch (e) {
      console.error(e);
      notify('error', 'Erro ao salvar. Tente novamente.');
    } finally {
      setSaving(false);
    }
  }

  // Abrir modal edição
  function openEdit(item) {
    setEditingItem({
      ...item,
      // converte Timestamp -> input date
      dataInput: asDateInputValue(item.data.toDate ? item.data.toDate() : new Date(item.data)),
      pesoPiscicultura: String(item.pesoPiscicultura).replace('.', ','),
      refugoSemEscama: String(item.refugoSemEscama).replace('.', ','),
      fileDescarte: String(item.fileDescarte).replace('.', ','),
      pesoFinalFile: String(item.pesoFinalFile).replace('.', ','),
    });
  }

  // Salvar edição
  async function saveEdit() {
    if (!editingItem) return;
    const id = editingItem.id;
    setEditingSaving(true);
    try {
      const ref = doc(db, 'entrada_rendimento_processo', id);
      await updateDoc(ref, {
        data: toTimestampFromDateInput(editingItem.dataInput),
        fornecedor: editingItem.fornecedor,
        lote: editingItem.lote,
        pesoPiscicultura: safeNumber(editingItem.pesoPiscicultura),
        refugoSemEscama: safeNumber(editingItem.refugoSemEscama),
        fileDescarte: safeNumber(editingItem.fileDescarte),
        pesoFinalFile: safeNumber(editingItem.pesoFinalFile),
      });
      notify('success', 'Lançamento atualizado!');
      setEditingItem(null);
    } catch (e) {
      console.error(e);
      notify('error', 'Erro ao atualizar.');
    } finally {
      setEditingSaving(false);
    }
  }

  // Excluir
  async function confirmDelete() {
    if (!deletingId) return;
    setDeleting(true);
    try {
      await deleteDoc(doc(db, 'entrada_rendimento_processo', deletingId));
      notify('success', 'Lançamento excluído.');
      setDeletingId(null);
    } catch (e) {
      console.error(e);
      notify('error', 'Erro ao excluir.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-6">
      <h2 className="text-3xl font-bold text-gray-800 text-center">
        Entrada de Dados - Rendimento de Processo
      </h2>

      {/* Notificação */}
      {notif && (
        <div
          className={`p-4 rounded-md border-l-4 ${
            notif.type === 'success'
              ? 'bg-green-100 border-green-500 text-green-700'
              : 'bg-red-100 border-red-500 text-red-700'
          }`}
        >
          {notif.message}
        </div>
      )}

      {/* Filtros Mês/Ano */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-gray-50 p-4 rounded-lg border">
        <div>
          <label className="block text-sm font-medium text-gray-700">Ano</label>
          <select
            className="mt-1 w-full p-2 border rounded-md"
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value, 10))}
          >
            {yearsForFilter.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Mês</label>
          <select
            className="mt-1 w-full p-2 border rounded-md"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(parseInt(e.target.value, 10))}
          >
            {monthNamesPt.map((m, idx) => (
              <option key={m} value={idx}>{m}</option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <div className="text-gray-600">
            <strong>Exibindo:</strong> {monthNamesPt[selectedMonth]}/{selectedYear}
          </div>
        </div>
      </div>

      {/* Formulário de novo lançamento */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700">Data</label>
          <input
            type="date"
            value={form.data}
            onChange={(e) => setForm((p) => ({ ...p, data: e.target.value }))}
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Fornecedor</label>
          <select
            value={form.fornecedor}
            onChange={(e) => setForm((p) => ({ ...p, fornecedor: e.target.value }))}
            className="mt-1 w-full p-2 border rounded-md bg-white"
            disabled={loadingSuppliers}
          >
            <option value="">{loadingSuppliers ? 'Carregando...' : 'Selecione'}</option>
            {suppliers.map((s) => (
              <option key={s.id} value={s.nome}>{s.nome}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Lote</label>
          <input
            type="text"
            value={form.lote}
            onChange={(e) => setForm((p) => ({ ...p, lote: e.target.value }))}
            placeholder="Ex: Lote 123"
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Peso Bruto (Piscicultura) - Kg</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.pesoPiscicultura}
            onChange={(e) => setForm((p) => ({ ...p, pesoPiscicultura: e.target.value }))}
            placeholder="Ex: 500,00"
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Refugo s/ Escama - Kg</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.refugoSemEscama}
            onChange={(e) => setForm((p) => ({ ...p, refugoSemEscama: e.target.value }))}
            placeholder="Ex: 8,50"
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Filé de Descarte - Kg</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.fileDescarte}
            onChange={(e) => setForm((p) => ({ ...p, fileDescarte: e.target.value }))}
            placeholder="Ex: 4,30"
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
        <div className="md:col-span-3">
          <label className="block text-sm font-medium text-gray-700">Peso Final Filé - Kg</label>
          <input
            type="text"
            inputMode="decimal"
            value={form.pesoFinalFile}
            onChange={(e) => setForm((p) => ({ ...p, pesoFinalFile: e.target.value }))}
            placeholder="Ex: 320,00"
            className="mt-1 w-full p-2 border rounded-md"
          />
        </div>
      </div>

      <div className="text-center">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-green-600 text-white font-bold py-3 px-8 rounded-lg hover:bg-green-700 transition disabled:bg-gray-400"
        >
          {saving ? 'Salvando...' : 'Salvar Lançamento'}
        </button>
      </div>

      {/* Tabela de lançamentos do mês */}
      <div className="space-y-3">
        <h3 className="text-xl font-semibold text-gray-800">
          Lançamentos de {monthNamesPt[selectedMonth]} / {selectedYear}
        </h3>

        <div className="overflow-x-auto bg-white border rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-100 sticky top-0">
              <tr>
                <th className="p-2 text-left">Data</th>
                <th className="p-2 text-left">Fornecedor</th>
                <th className="p-2 text-left">Lote</th>
                <th className="p-2 text-right">Piscic. (Kg)</th>
                <th className="p-2 text-right">Ref. s/ Esc. (Kg)</th>
                <th className="p-2 text-right">Filé Descarte (Kg)</th>
                <th className="p-2 text-right">Filé Final (Kg)</th>
                <th className="p-2 text-center">Ações</th>
              </tr>
            </thead>
            <tbody>
              {loadingEntries ? (
                <tr><td className="p-3 text-center text-gray-500" colSpan={8}>Carregando...</td></tr>
              ) : entries.length === 0 ? (
                <tr><td className="p-3 text-center text-gray-500" colSpan={8}>Sem lançamentos neste período.</td></tr>
              ) : (
                entries.map((item) => {
                  const d = item.data?.toDate ? item.data.toDate() : new Date(item.data);
                  const dataFmt = d.toLocaleDateString('pt-BR');
                  return (
                    <tr key={item.id} className="border-t hover:bg-gray-50">
                      <td className="p-2">{dataFmt}</td>
                      <td className="p-2">{item.fornecedor}</td>
                      <td className="p-2">{item.lote}</td>
                      <td className="p-2 text-right">{formatKg(item.pesoPiscicultura)}</td>
                      <td className="p-2 text-right">{formatKg(item.refugoSemEscama)}</td>
                      <td className="p-2 text-right">{formatKg(item.fileDescarte)}</td>
                      <td className="p-2 text-right">{formatKg(item.pesoFinalFile)}</td>
                      <td className="p-2 text-center">
                        <div className="flex gap-2 justify-center">
                          <button
                            onClick={() => openEdit(item)}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white px-3 py-1 rounded"
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => setDeletingId(item.id)}
                            className="text-xs bg-red-600 hover:bg-red-700 text-white px-3 py-1 rounded"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Edição */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 space-y-4">
            <h4 className="text-xl font-bold text-gray-800">Editar Lançamento</h4>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium">Data</label>
                <input
                  type="date"
                  value={editingItem.dataInput}
                  onChange={(e) => setEditingItem((p) => ({ ...p, dataInput: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Fornecedor</label>
                <select
                  value={editingItem.fornecedor}
                  onChange={(e) => setEditingItem((p) => ({ ...p, fornecedor: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md bg-white"
                >
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.nome}>{s.nome}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium">Lote</label>
                <input
                  type="text"
                  value={editingItem.lote}
                  onChange={(e) => setEditingItem((p) => ({ ...p, lote: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>

              <div>
                <label className="block text-sm font-medium">Piscicultura (Kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.pesoPiscicultura}
                  onChange={(e) => setEditingItem((p) => ({ ...p, pesoPiscicultura: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Ref. s/ Esc. (Kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.refugoSemEscama}
                  onChange={(e) => setEditingItem((p) => ({ ...p, refugoSemEscama: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>
              <div>
                <label className="block text-sm font-medium">Filé Descarte (Kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.fileDescarte}
                  onChange={(e) => setEditingItem((p) => ({ ...p, fileDescarte: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>
              <div className="md:col-span-3">
                <label className="block text-sm font-medium">Filé Final (Kg)</label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={editingItem.pesoFinalFile}
                  onChange={(e) => setEditingItem((p) => ({ ...p, pesoFinalFile: e.target.value }))}
                  className="mt-1 w-full p-2 border rounded-md"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setEditingItem(null)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={saveEdit}
                disabled={editingSaving}
                className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 text-white disabled:bg-blue-300"
              >
                {editingSaving ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Excluir */}
      {deletingId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6 space-y-4">
            <h4 className="text-lg font-bold text-gray-800">Confirmar Exclusão</h4>
            <p className="text-gray-700">Tem certeza que deseja excluir este lançamento? Esta ação não pode ser desfeita.</p>
            <div className="flex justify-end gap-2 pt-2">
              <button
                onClick={() => setDeletingId(null)}
                className="px-4 py-2 rounded bg-gray-200 hover:bg-gray-300"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-4 py-2 rounded bg-red-600 hover:bg-red-700 text-white disabled:bg-red-300"
              >
                {deleting ? 'Excluindo...' : 'Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
