// C:\code\moradafish\src\pages\ProductionPage.jsx

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../services/firebase';
import {
  collection,
  addDoc,
  doc,
  getDocs,
  onSnapshot,
  updateDoc,
  query,
  where,
  getDoc,
  serverTimestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { lerPesoDaBalanca } from '../services/balancaService';

export default function ProductionPage() {
  const navigate = useNavigate();

  // Formulário inicial
  const [fornecedores, setFornecedores] = useState([]);
  const [fornecedorSelecionado, setFornecedorSelecionado] = useState('');
  const [formPesoInicial, setFormPesoInicial] = useState('');

  // Produção ativa
  const [producaoAtiva, setProducaoAtiva] = useState(null);
  const [nomePiscicultura, setNomePiscicultura] = useState('');
  const [pesoPiscicultura, setPesoPiscicultura] = useState(0);
  const [refugoPreLinha, setRefugoPreLinha] = useState(0);
  const [startDateTime, setStartDateTime] = useState(null);
  const [pesagens, setPesagens] = useState([]);

  // Estado de pesagem
  const [colaborador, setColaborador] = useState('');
  const [pesoAtual, setPesoAtual] = useState('');

  // Cronômetro
  const [cronometroTexto, setCronometroTexto] = useState('00:00:00');

  // Carrega fornecedores para o dropdown
  useEffect(() => {
    async function carregar() {
      const snap = await getDocs(collection(db, 'fornecedores'));
      setFornecedores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    carregar();
  }, []);

  // Observa produção ativa no Firestore
  useEffect(() => {
    const q = query(collection(db, 'producoes'), where('status', '==', 'ativo'));
    const unsub = onSnapshot(q, async snap => {
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = { id: docSnap.id, ...docSnap.data() };
        setProducaoAtiva(data);

        // Inicializa estados da produção
        setNomePiscicultura(data.nomePiscicultura || '—');
        setPesoPiscicultura(data.pesoInicial || 0);
        setRefugoPreLinha(data.refugoPreLinha || 0);

        // Data/hora de início e cronômetro
        const inicio = data.criadoEm?.toDate();
        setStartDateTime(inicio);
        iniciarCronometro(inicio);

        // Escuta as pesagens em subcoleção
        escutarPesagens(docSnap.id);
      }
    });
    return () => unsub();
  }, []);

  // Inicia cronômetro a partir do timestamp de início
  function iniciarCronometro(inicio) {
    if (!inicio) return;
    const id = setInterval(() => {
      const diff = Math.floor((Date.now() - inicio.getTime()) / 1000);
      const h = String(Math.floor(diff / 3600)).padStart(2, '0');
      const m = String(Math.floor((diff % 3600) / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setCronometroTexto(`${h}:${m}:${s}`);
    }, 1000);
    return () => clearInterval(id);
  }

  // Iniciar nova produção
  async function handleStartProduction() {
    if (!fornecedorSelecionado || Number(formPesoInicial) <= 0) {
      alert('Preencha fornecedor e peso inicial corretamente.');
      return;
    }
    // Busca nome da piscicultura
    const fornDoc = await getDoc(doc(db, 'fornecedores', fornecedorSelecionado));
    const nome = fornDoc.exists() ? fornDoc.data().nome : '';

    // Cria documento de produção
    await addDoc(collection(db, 'producoes'), {
      fornecedorId: fornecedorSelecionado,
      nomePiscicultura: nome,
      pesoInicial: Number(formPesoInicial),
      refugoPreLinha: 0,
      criadoEm: serverTimestamp(),
      status: 'ativo',
      iniciadoPor: 'Felipe',
    });

    // Limpa formulário e navega para produção ativa
    setFornecedorSelecionado('');
    setFormPesoInicial('');
    navigate('/production');
  }

  // Adicionar refugo pré-linha
  async function handleAddRefugoPreLinha() {
    if (!producaoAtiva) return;
    const peso = await lerPesoDaBalanca();
    const novo = refugoPreLinha + peso;
    setRefugoPreLinha(novo);
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), { refugoPreLinha: novo });
  }

  // Registrar pesagem na linha (Entrada, Saída, Refugo)
  async function registrarPesagem(tipo) {
    if (!producaoAtiva) return;
    if (!colaborador) {
      alert('Escaneie o colaborador primeiro.');
      return;
    }
    if (!pesoAtual) {
      alert('Informe o peso.');
      return;
    }
    // Trava de 2 minutos por colaborador
    const ultimas = pesagens
      .filter(p => p.colaborador === colaborador)
      .map(p => p.criadoEm?.toDate())
      .filter(d => d)
      .sort((a, b) => b - a);
    if (ultimas.length > 0 && (Date.now() - ultimas[0].getTime()) < 2 * 60 * 1000) {
      alert('Aguarde 2 minutos antes de nova pesagem para este colaborador.');
      return;
    }

    // Adiciona evento na subcoleção
    const prodRef = doc(db, 'producoes', producaoAtiva.id);
    await addDoc(collection(prodRef, 'pesagens'), {
      colaborador,
      tipo,
      peso: Number(pesoAtual),
      criadoEm: serverTimestamp(),
    });
    setPesoAtual('');
  }

  // Edição inline de campos de produção
  async function handleBlurNome() {
    if (!producaoAtiva) return;
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), { nomePiscicultura });
  }

  async function handleBlurPeso() {
    if (!producaoAtiva) return;
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), { pesoInicial: pesoPiscicultura });
  }

  // Encerrar produção
  async function handleFecharProducao() {
    if (!producaoAtiva || !window.confirm('Encerrar produção?')) return;
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), {
      status: 'encerrado',
      encerradoEm: serverTimestamp(),
    });
    setProducaoAtiva(null);
    setPesagens([]);
  }

  // Escuta subcoleção de pesagens
  function escutarPesagens(id) {
    return onSnapshot(collection(db, 'producoes', id, 'pesagens'), snap => {
      setPesagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  // Totais para relatórios
  const brutoPeixe = pesagens.filter(p => p.tipo === 'peixe').reduce((a, p) => a + p.peso, 0);
  const brutoFile = pesagens.filter(p => p.tipo === 'file').reduce((a, p) => a + p.peso, 0);
  const refugoLinha = pesagens.filter(p => p.tipo === 'refugoLinha').reduce((a, p) => a + p.peso, 0);
  const rendimentoEquipe = brutoPeixe > 0 ? (brutoFile / brutoPeixe) * 100 : 0;
  const pesoReal = pesoPiscicultura - refugoPreLinha;
  const faltando = pesoReal - brutoPeixe;

  // Agrupa por colaborador para tabela
  const dadosPorColab = {};
  pesagens.forEach(p => {
    const nome = p.colaborador;
    if (!dadosPorColab[nome]) dadosPorColab[nome] = { eventos: [], brutoPeixe: 0, brutoFile: 0, refugoLinha: 0 };
    const d = dadosPorColab[nome];
    d.eventos.push(p);
    if (p.tipo === 'peixe') d.brutoPeixe += p.peso;
    if (p.tipo === 'file') d.brutoFile += p.peso;
    if (p.tipo === 'refugoLinha') d.refugoLinha += p.peso;
  });

  return (
    <div className="p-4">
      {!producaoAtiva ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">Iniciar Nova Produção</h1>
          <div className="flex flex-col gap-4">
            <div>
              <label htmlFor="selectPiscicultura" className="block mb-1">Piscicultura</label>
              <select
                id="selectPiscicultura"
                value={fornecedorSelecionado}
                onChange={e => setFornecedorSelecionado(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="" disabled hidden>Selecione...</option>
                {fornecedores.map(f => (
                  <option key={f.id} value={f.id}>{f.nome}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="pesoInicial" className="block mb-1">Peso Piscicultura (kg)</label>
              <input
                id="pesoInicial"
                type="number"
                min="0"
                step="any"
                value={formPesoInicial}
                onChange={e => setFormPesoInicial(e.target.value)}
                className="border p-2 rounded w-full"
              />
            </div>
            <button
              onClick={handleStartProduction}
              disabled={!fornecedorSelecionado || Number(formPesoInicial) <= 0}
              className="bg-green-600 disabled:opacity-50 hover:bg-green-700 text-white px-6 py-2 rounded self-start"
            >
              Iniciar
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Cabeçalho da produção ativa */}
          <div className="flex flex-col md:flex-row justify-between items-start mb-6 gap-6">
            <div className="space-y-4">
              <h1 className="text-3xl font-bold">Produção Ativa</h1>

              <div>
                <label className="block mb-1">Piscicultura</label>
                <input
                  type="text"
                  value={nomePiscicultura}
                  onChange={e => setNomePiscicultura(e.target.value)}
                  onBlur={handleBlurNome}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div>
                <label className="block mb-1">Início</label>
                <input
                  type="text"
                  readOnly
                  value={startDateTime ? format(startDateTime, 'dd/MM/yyyy HH:mm:ss') : '—'}
                  className="border p-2 rounded bg-gray-100 w-full"
                />
              </div>

              <div>
                <label className="block mb-1">Peso Piscicultura (kg)</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  value={pesoPiscicultura}
                  onChange={e => setPesoPiscicultura(Number(e.target.value))}
                  onBlur={handleBlurPeso}
                  className="border p-2 rounded w-full"
                />
              </div>

              <div className="flex items-center space-x-4">
                <div>
                  <label className="block mb-1">Refugo Pré-Linha (kg)</label>
                  <span className="font-semibold">{refugoPreLinha.toFixed(2)}</span>
                </div>
                <button
                  onClick={handleAddRefugoPreLinha}
                  className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded"
                >
                  + Adicionar Refugo
                </button>
              </div>

              <div>
                <label className="block mb-1">Peso Real (kg)</label>
                <span className="font-semibold">{pesoReal.toFixed(2)}</span>
              </div>
            </div>

            <button
              onClick={handleFecharProducao}
              className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded self-start"
            >
              Encerrar Produção
            </button>
          </div>

          {/* Em tempo real */}
          <div className="bg-gray-100 p-6 rounded-xl mb-8 shadow-md">
            <h2 className="text-2xl font-semibold mb-4 flex items-center">
              <span className="text-3xl mr-2">📊</span>
              Em tempo real
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow">
                <span className="text-4xl">⏱️</span>
                <div>
                  <p className="text-sm text-gray-500">Cronômetro</p>
                  <p className="text-xl font-bold">{cronometroTexto}</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow">
                <span className="text-4xl">📈</span>
                <div>
                  <p className="text-sm text-gray-500">Rendimento</p>
                  <p className="text-xl font-bold">{rendimentoEquipe.toFixed(2)}%</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow">
                <span className="text-4xl">🐟</span>
                <div>
                  <p className="text-sm text-gray-500">Pesados</p>
                  <p className="text-xl font-bold">{brutoPeixe.toFixed(2)} kg</p>
                </div>
              </div>

              <div className="flex items-center space-x-3 bg-white p-4 rounded-lg shadow">
                <span className="text-4xl">📉</span>
                <div>
                  <p className="text-sm text-gray-500">Faltando</p>
                  <p className="text-xl font-bold">{faltando.toFixed(2)} kg</p>
                </div>
              </div>
            </div>
          </div>

          {/* Registrar pesagem */}
          <div className="bg-gray-50 p-6 rounded-xl mb-8">
            <h2 className="text-xl font-semibold mb-4">Registrar Pesagem</h2>
            <input
              type="text"
              placeholder="Escaneie colaborador"
              value={colaborador}
              onChange={e => setColaborador(e.target.value)}
              autoFocus
              className="border p-3 w-full rounded mb-4"
            />
            <div className="flex gap-3 mb-4">
              <button
                onClick={async () => setPesoAtual(await lerPesoDaBalanca())}
                className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-2 rounded"
              >
                Ler Balança
              </button>
              <input
                type="number"
                placeholder="Peso (kg)"
                value={pesoAtual}
                onChange={e => setPesoAtual(e.target.value)}
                className="border p-3 flex-1 rounded"
              />
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => registrarPesagem('peixe')}
                className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded"
              >
                Entrada Peixe
              </button>
              <button
                onClick={() => registrarPesagem('file')}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded"
              >
                Saída Filé
              </button>
              <button
                onClick={() => registrarPesagem('refugoLinha')}
                className="bg-orange-600 hover:bg-orange-700 text-white px-6 py-2 rounded"
              >
                Refugo na Linha
              </button>
            </div>
          </div>

          {/* Tabela de produção */}
          <h2 className="text-2xl font-bold mb-4">Produção do Lote Atual</h2>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-base border-collapse">
              <thead className="bg-gray-200">
                <tr>
                  <th className="p-3 border font-medium">Colaborador</th>
                  <th className="p-3 border font-medium">Ação</th>
                  <th className="p-3 border font-medium text-center">Horário</th>
                  <th className="p-3 border font-medium text-right">Peso (kg)</th>
                  <th className="p-3 border font-medium text-right">Rendimento (%)</th>
                  <th className="p-3 border font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(dadosPorColab).map(([nome, d]) => {
                  const netP = d.brutoPeixe;
                  const netF = d.brutoFile;
                  const rendTotal = netP > 0 ? (netF / netP) * 100 : 0;
                  return (
                    <React.Fragment key={nome}>
                      {d.eventos.map(ev => {
                        const evDate = ev.criadoEm?.toDate();
                        const hora = evDate ? format(evDate, 'HH:mm:ss') : '—';
                        const labels = {
                          peixe: '🐟 Entrada Peixe',
                          file: '🔪 Saída Filé',
                          refugoLinha: '🚫 Refugo'
                        };
                        const cores = {
                          peixe: 'text-blue-600',
                          file: 'text-green-600',
                          refugoLinha: 'text-orange-600'
                        };
                        let rendParcial = '-';
                        if (ev.tipo === 'file') {
                          const ent = d.eventos.find(e => e.tipo === 'peixe');
                          if (ent) rendParcial = ((ev.peso / ent.peso) * 100).toFixed(2) + '%';
                        }
                        return (
                          <tr key={ev.id} className="hover:bg-gray-50">
                            <td className="p-3 border">{nome}</td>
                            <td className={`p-3 border font-medium ${cores[ev.tipo]}`}>{labels[ev.tipo]}</td>
                            <td className="p-3 border text-center">{hora}</td>
                            <td className="p-3 border text-right">{ev.peso.toFixed(2)}</td>
                            <td className="p-3 border text-right font-bold">{rendParcial}</td>
                            <td className="p-3 border text-center">
                              <button onClick={() => handleEdit(ev)} className="underline text-sm">Editar</button>
                            </td>
                          </tr>
                        );
                      })}
                      <tr className="bg-gray-100 font-semibold">
                        <td className="p-3 border-y-2" colSpan="2">Subtotal ({nome})</td>
                        <td className="p-3 border-y-2 text-right">Peixe: {d.brutoPeixe.toFixed(2)}</td>
                        <td className="p-3 border-y-2 text-right">Filé: {d.brutoFile.toFixed(2)}</td>
                        <td className="p-3 border-y-2 text-right">Rend: {rendTotal.toFixed(2)}%</td>
                        <td className="p-3 border-y-2"></td>
                      </tr>
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot className="bg-gray-800 text-white font-semibold">
                <tr>
                  <td className="p-4" colSpan="2">TOTAL GERAL DO LOTE</td>
                  <td className="p-4 text-right">Peixe: {brutoPeixe.toFixed(2)}</td>
                  <td className="p-4 text-right">Filé: {brutoFile.toFixed(2)}</td>
                  <td className="p-4 text-right">Rend: {rendimentoEquipe.toFixed(2)}%</td>
                  <td className="p-4"></td>
                </tr>
                <tr className="bg-gray-700 text-sm">
                  <td className="p-2" colSpan="2">REFUGO PRÉ-LINHA</td>
                  <td className="p-2 text-right" colSpan="2">{refugoPreLinha.toFixed(2)} kg</td>
                  <td className="p-2 text-right">Refugo Linha: {refugoLinha.toFixed(2)}</td>
                  <td className="p-2"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}
    </div>
  );
}