import React, { useState, useEffect, useMemo } from "react";
import { db } from "../services/firebase";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  deleteDoc,
  doc,
  updateDoc
} from "firebase/firestore";

function TesteEscamacaoPage() {
  const [form, setForm] = useState({
    data: "",
    fornecedor: "",
    pesoComEscama: "",
    pesoSemEscama: "",
    biometria: "",
  });
  const [dados, setDados] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [editId, setEditId] = useState(null); // ID que está sendo editado

  // Buscar dados do Firestore
  useEffect(() => {
    const q = query(collection(db, "teste_escamacao"), orderBy("data", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setDados(lista);
    });
    return () => unsubscribe();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // Salvar ou atualizar
  const handleSave = async () => {
    if (!form.data || !form.fornecedor || !form.pesoComEscama || !form.pesoSemEscama) {
      alert("Preencha Data, Fornecedor, Peso C/ Escama e Peso S/ Escama.");
      return;
    }
    setIsSaving(true);
    try {
      const pesoCom = parseFloat(String(form.pesoComEscama).replace(",", ".")) || 0;
      const pesoSem = parseFloat(String(form.pesoSemEscama).replace(",", ".")) || 0;
      const biom = parseFloat(String(form.biometria).replace(",", ".")) || 0;
      const aproveitamento = pesoCom > 0 ? (pesoSem / pesoCom) * 100 : 0;

      if (editId) {
        // atualização
        await updateDoc(doc(db, "teste_escamacao", editId), {
          data: form.data,
          fornecedor: form.fornecedor,
          pesoComEscama: pesoCom,
          pesoSemEscama: pesoSem,
          aproveitamento,
          biometria: biom,
        });
        setEditId(null);
      } else {
        // novo
        await addDoc(collection(db, "teste_escamacao"), {
          data: form.data,
          fornecedor: form.fornecedor,
          pesoComEscama: pesoCom,
          pesoSemEscama: pesoSem,
          aproveitamento,
          biometria: biom,
        });
      }

      setForm({
        data: "",
        fornecedor: "",
        pesoComEscama: "",
        pesoSemEscama: "",
        biometria: "",
      });
    } catch (err) {
      console.error("Erro ao salvar:", err);
      alert("Falha ao salvar. Verifique a conexão e tente novamente.");
    } finally {
      setIsSaving(false);
    }
  };

  // Excluir
  const handleDelete = async (id) => {
    if (window.confirm("Tem certeza que deseja excluir este lançamento?")) {
      await deleteDoc(doc(db, "teste_escamacao", id));
    }
  };

  // Editar
  const handleEdit = (item) => {
    setForm({
      data: item.data,
      fornecedor: item.fornecedor,
      pesoComEscama: item.pesoComEscama,
      pesoSemEscama: item.pesoSemEscama,
      biometria: item.biometria,
    });
    setEditId(item.id);
  };

  // Calcular média diária
  const medias = useMemo(() => {
    const agrupado = {};
    dados.forEach((item) => {
      const chave = `${item.data}-${item.fornecedor}`;
      if (!agrupado[chave]) {
        agrupado[chave] = {
          data: item.data,
          fornecedor: item.fornecedor,
          pesoComEscama: 0,
          pesoSemEscama: 0,
          aproveitamento: 0,
          biometria: 0,
          count: 0,
        };
      }
      agrupado[chave].pesoComEscama += Number(item.pesoComEscama || 0);
      agrupado[chave].pesoSemEscama += Number(item.pesoSemEscama || 0);
      agrupado[chave].aproveitamento += Number(item.aproveitamento || 0);
      agrupado[chave].biometria += Number(item.biometria || 0);
      agrupado[chave].count++;
    });

    return Object.values(agrupado).map((m) => ({
      ...m,
      pesoComEscama: m.count ? m.pesoComEscama / m.count : 0,
      pesoSemEscama: m.count ? m.pesoSemEscama / m.count : 0,
      aproveitamento: m.count ? m.aproveitamento / m.count : 0,
      biometria: m.count ? m.biometria / m.count : 0,
    }));
  }, [dados]);

  const aproveitamentoForm =
    form.pesoComEscama && form.pesoSemEscama
      ? (
          (parseFloat(String(form.pesoSemEscama).replace(",", ".")) /
            (parseFloat(String(form.pesoComEscama).replace(",", ".")) || 1)) *
          100
        ).toFixed(2)
      : "";

  const nf2 = (v) => (isFinite(v) ? Number(v).toFixed(2) : "0.00");
  const nf0 = (v) => (isFinite(v) ? Math.round(Number(v)).toString() : "0");

  return (
    <div className="bg-white p-6 rounded-lg shadow-md space-y-8">
      <h2 className="text-3xl font-bold text-gray-800 text-center">
        Entrada de Dados - Teste de Escamação
      </h2>

      {/* Form */}
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium">Data</label>
          <input
            type="date"
            name="data"
            value={form.data}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Fornecedor</label>
          <input
            type="text"
            name="fornecedor"
            value={form.fornecedor}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Peso C/ Escama (Kg)</label>
          <input
            type="text"
            name="pesoComEscama"
            value={form.pesoComEscama}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Peso S/ Escama (Kg)</label>
          <input
            type="text"
            name="pesoSemEscama"
            value={form.pesoSemEscama}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">% Aproveitado</label>
          <input
            type="text"
            value={aproveitamentoForm}
            disabled
            className="mt-1 block w-full p-2 border rounded-md bg-gray-100"
          />
        </div>
        <div>
          <label className="block text-sm font-medium">Biometria (g)</label>
          <input
            type="text"
            name="biometria"
            value={form.biometria}
            onChange={handleChange}
            className="mt-1 block w-full p-2 border rounded-md"
          />
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving}
        className="bg-green-600 text-white font-bold py-2 px-4 rounded-lg hover:bg-green-700 transition"
      >
        {editId ? "Atualizar" : "Salvar Lançamento"}
      </button>

      {/* Lista completa */}
      <h3 className="text-xl font-semibold mt-6">Lançamentos</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse mt-2">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Data</th>
              <th className="p-2 border">Fornecedor</th>
              <th className="p-2 border">C/ Escama</th>
              <th className="p-2 border">S/ Escama</th>
              <th className="p-2 border">% Aproveitado</th>
              <th className="p-2 border">Biometria</th>
              <th className="p-2 border">Ações</th>
            </tr>
          </thead>
          <tbody>
            {dados.map((item) => (
              <tr key={item.id}>
                <td className="p-2 border">{item.data}</td>
                <td className="p-2 border">{item.fornecedor}</td>
                <td className="p-2 border">{nf2(item.pesoComEscama)}</td>
                <td className="p-2 border">{nf2(item.pesoSemEscama)}</td>
                <td className="p-2 border">{nf2(item.aproveitamento)}%</td>
                <td className="p-2 border">{nf0(item.biometria)}</td>
                <td className="p-2 border space-x-2">
                  <button
                    onClick={() => handleEdit(item)}
                    className="bg-blue-500 text-white px-2 py-1 rounded"
                  >
                    Editar
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="bg-red-500 text-white px-2 py-1 rounded"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
            {dados.length === 0 && (
              <tr>
                <td colSpan="7" className="p-4 text-center text-gray-500">
                  Nenhum lançamento encontrado.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Média */}
      <h3 className="text-xl font-semibold mt-6">Média Diária (Data + Fornecedor)</h3>
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse mt-2">
          <thead className="bg-gray-200">
            <tr>
              <th className="p-2 border">Data</th>
              <th className="p-2 border">Fornecedor</th>
              <th className="p-2 border">C/ Escama</th>
              <th className="p-2 border">S/ Escama</th>
              <th className="p-2 border">% Aproveitado</th>
              <th className="p-2 border">Biometria</th>
            </tr>
          </thead>
          <tbody>
            {medias.map((m, idx) => (
              <tr key={idx}>
                <td className="p-2 border">{m.data}</td>
                <td className="p-2 border">{m.fornecedor}</td>
                <td className="p-2 border">{nf2(m.pesoComEscama)}</td>
                <td className="p-2 border">{nf2(m.pesoSemEscama)}</td>
                <td className="p-2 border">{nf2(m.aproveitamento)}%</td>
                <td className="p-2 border">{nf0(m.biometria)}</td>
              </tr>
            ))}
            {medias.length === 0 && (
              <tr>
                <td colSpan="6" className="p-4 text-center text-gray-500">
                  Nenhum cálculo disponível.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default TesteEscamacaoPage;
