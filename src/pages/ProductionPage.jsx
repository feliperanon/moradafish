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

// ATENÇÃO: Senha mestra atualizada
const MASTER_PASSWORD = '571232';

// NOVA FUNÇÃO: Formata números para o padrão brasileiro (ex: 5.000,00)
function formatarPeso(numero) {
  if (typeof numero !== 'number' || isNaN(numero)) {
    return '0,00';
  }
  return numero.toLocaleString('pt-BR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}


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

  // Carrega fornecedores
  useEffect(() => {
    async function carregar() {
      const snap = await getDocs(collection(db, 'fornecedores'));
      setFornecedores(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }
    carregar();
  }, []);

  // Observa produção ativa
  useEffect(() => {
    const q = query(collection(db, 'producoes'), where('status', '==', 'ativo'));
    const unsub = onSnapshot(q, async snap => {
      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const data = { id: docSnap.id, ...docSnap.data() };
        setProducaoAtiva(data);
        setNomePiscicultura(data.nomePiscicultura || '—');
        setPesoPiscicultura(data.pesoInicial || 0);
        setRefugoPreLinha(data.refugoPreLinha || 0);
        const inicio = data.criadoEm?.toDate();
        setStartDateTime(inicio);
        iniciarCronometro(inicio);
        escutarPesagens(docSnap.id);
      } else {
        setProducaoAtiva(null);
        setPesagens([]);
      }
    });
    return () => unsub();
  }, []);

  // Inicia cronômetro
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

  // Função genérica para verificar a senha mestra
  function verificarSenha() {
    const senha = window.prompt("Para editar, digite a senha mestra:");
    if (senha === MASTER_PASSWORD) {
      return true;
    } else if (senha !== null) {
      alert("Senha incorreta!");
    }
    return false;
  }
  
  // --- FUNÇÕES DE EDIÇÃO COM SENHA ---
  async function handleEditNomePiscicultura() {
    if (!producaoAtiva || !verificarSenha()) return;
    const novoNome = window.prompt("Digite o novo nome da Piscicultura:", nomePiscicultura);
    if (novoNome && novoNome.trim() !== '') {
        setNomePiscicultura(novoNome);
        await updateDoc(doc(db, 'producoes', producaoAtiva.id), { nomePiscicultura: novoNome });
    }
  }

  async function handleEditPesoPiscicultura() {
    if (!producaoAtiva || !verificarSenha()) return;
    const novoPesoStr = window.prompt("Digite o novo peso do lote (kg):", pesoPiscicultura);
    if (novoPesoStr) {
        const novoPeso = Number(novoPesoStr.replace(',', '.')); // Aceita vírgula
        if (!isNaN(novoPeso) && novoPeso >= 0) {
            setPesoPiscicultura(novoPeso);
            await updateDoc(doc(db, 'producoes', producaoAtiva.id), { pesoInicial: novoPeso });
        } else {
            alert("Valor de peso inválido.");
        }
    }
  }
  
  async function handleAddRefugoPreLinha() {
    if (!producaoAtiva || !verificarSenha()) return;
    const pesoStr = window.prompt("Digite o peso do NOVO refugo a ser adicionado (kg):");
    if (pesoStr) {
      const peso = Number(pesoStr.replace(',', '.')); // Aceita vírgula
      if (!isNaN(peso) && peso > 0) {
        const novoTotalRefugo = refugoPreLinha + peso;
        setRefugoPreLinha(novoTotalRefugo);
        await updateDoc(doc(db, 'producoes', producaoAtiva.id), { refugoPreLinha: novoTotalRefugo });
      } else {
        alert("Valor de refugo inválido.");
      }
    }
  }

  // --- LÓGICA DE PRODUÇÃO ---
  async function handleStartProduction() {
    if (!fornecedorSelecionado || !formPesoInicial) return;
    const peso = Number(formPesoInicial.replace(',', '.'));
    if (isNaN(peso) || peso <= 0) {
        alert('Peso inicial inválido.');
        return;
    }
    const fornDoc = await getDoc(doc(db, 'fornecedores', fornecedorSelecionado));
    const nome = fornDoc.exists() ? fornDoc.data().nome : '';
    await addDoc(collection(db, 'producoes'), {
      fornecedorId: fornecedorSelecionado,
      nomePiscicultura: nome,
      pesoInicial: peso,
      refugoPreLinha: 0,
      criadoEm: serverTimestamp(),
      status: 'ativo',
      iniciadoPor: 'Felipe',
    });
    setFornecedorSelecionado('');
    setFormPesoInicial('');
  }

  async function registrarPesagem(tipo) {
    if (!producaoAtiva || !colaborador || !pesoAtual) {
      alert('É necessário informar o colaborador e o peso.');
      return;
    }
    const peso = Number(pesoAtual.replace(',', '.'));
    if (isNaN(peso) || peso <= 0) {
        alert('Peso inválido.');
        return;
    }
    const prodRef = doc(db, 'producoes', producaoAtiva.id);
    await addDoc(collection(prodRef, 'pesagens'), {
      colaborador,
      tipo,
      peso: peso,
      criadoEm: serverTimestamp(),
    });
    setPesoAtual('');
    setColaborador('');
  }
  
  async function handleEditPesagem(pesagem) {
    if (!verificarSenha()) return;
    const novoColaborador = window.prompt("Editar nome do colaborador:", pesagem.colaborador);
    if (novoColaborador === null) return;
    const novoPesoStr = window.prompt("Editar peso (kg):", pesagem.peso);
    if (novoPesoStr === null) return;
    const novoPeso = Number(novoPesoStr.replace(',', '.'));
    if (isNaN(novoPeso) || novoPeso <= 0) {
      alert("Peso inválido.");
      return;
    }
    const pesagemRef = doc(db, 'producoes', producaoAtiva.id, 'pesagens', pesagem.id);
    await updateDoc(pesagemRef, { colaborador: novoColaborador, peso: novoPeso });
  }

  async function handleFecharProducao() {
    if (!producaoAtiva || !window.confirm('Tem certeza que deseja encerrar a produção?')) return;
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), { status: 'encerrado', encerradoEm: serverTimestamp() });
  }

  function escutarPesagens(id) {
    const q = query(collection(db, 'producoes', id, 'pesagens'));
    return onSnapshot(q, snap => {
      setPesagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  // *** NOVA FUNÇÃO PARA LER O PESO ***
  // Esta função chama o serviço da balança e atualiza o estado com o valor formatado.
  const handleLerPeso = async () => {
    const pesoLido = await lerPesoDaBalanca(); // Chama a nova lógica
    if (pesoLido !== null && typeof pesoLido === 'number') {
      // Formata o número para o padrão brasileiro (com vírgula) para exibir no campo de input.
      setPesoAtual(pesoLido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  // --- CÁLCULOS TOTAIS ATUALIZADOS ---
  const brutoPeixe = pesagens.filter(p => p.tipo === 'peixe').reduce((a, p) => a + p.peso, 0);
  const brutoFile = pesagens.filter(p => p.tipo === 'file').reduce((a, p) => a + p.peso, 0);
  const refugoDePeixe = pesagens.filter(p => p.tipo === 'refugoPeixe').reduce((a, p) => a + p.peso, 0);
  const refugoDeFile = pesagens.filter(p => p.tipo === 'refugoFile').reduce((a, p) => a + p.peso, 0);

  const totalLiquidoPeixe = brutoPeixe - refugoDePeixe;
  const totalLiquidoFile = brutoFile - refugoDeFile;

  const rendimentoEquipe = brutoPeixe > 0 ? (totalLiquidoFile / brutoPeixe) * 100 : 0;
  const pesoReal = pesoPiscicultura - refugoPreLinha;
  const faltando = pesoReal - brutoPeixe;

  const dadosPorColab = pesagens.reduce((acc, p) => {
    const nome = p.colaborador;
    if (!acc[nome]) acc[nome] = { eventos: [], brutoPeixe: 0, brutoFile: 0, refugoPeixe: 0, refugoFile: 0 };
    acc[nome].eventos.push(p);
    if (p.tipo === 'peixe') acc[nome].brutoPeixe += p.peso;
    if (p.tipo === 'file') acc[nome].brutoFile += p.peso;
    if (p.tipo === 'refugoPeixe') acc[nome].refugoPeixe += p.peso;
    if (p.tipo === 'refugoFile') acc[nome].refugoFile += p.peso;
    return acc;
  }, {});

  return (
    <div className="p-4 bg-gray-50 min-h-screen">
      {!producaoAtiva ? (
        <div>
          <h1 className="text-2xl font-bold mb-4">Iniciar Nova Produção</h1>
          <div className="flex flex-col gap-4 max-w-md">
            <div>
              <label htmlFor="selectPiscicultura" className="block mb-1 font-medium">Piscicultura</label>
              <select id="selectPiscicultura" value={fornecedorSelecionado} onChange={e => setFornecedorSelecionado(e.target.value)} className="border p-2 rounded w-full">
                <option value="" disabled>Selecione...</option>
                {fornecedores.map(f => (<option key={f.id} value={f.id}>{f.nome}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="pesoInicial" className="block mb-1 font-medium">Peso Piscicultura (kg)</label>
              <input id="pesoInicial" type="text" value={formPesoInicial} onChange={e => setFormPesoInicial(e.target.value)} className="border p-2 rounded w-full" placeholder="Ex: 5000,00" />
            </div>
            <button onClick={handleStartProduction} disabled={!fornecedorSelecionado || !formPesoInicial} className="bg-green-600 disabled:opacity-50 hover:bg-green-700 text-white font-bold px-6 py-2 rounded self-start">
              Iniciar Produção
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* --- CABEÇALHO ATUALIZADO --- */}
          <div className="bg-white p-4 rounded-lg shadow-md mb-6">
            <div className="flex justify-between items-start mb-4">
                <h1 className="text-2xl font-bold text-gray-800">Produção Ativa</h1>
                <div className="text-right">
                    <button onClick={handleFecharProducao} className="bg-red-600 hover:bg-red-700 text-white font-bold px-5 py-2 rounded">
                        Encerrar Produção
                    </button>
                    <p className="text-xs text-gray-500 mt-1">
                        Início: {startDateTime ? format(startDateTime, 'dd/MM/yyyy HH:mm') : '—'}
                    </p>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Piscicultura</label>
                        <p className="text-lg font-bold">{nomePiscicultura}</p>
                    </div>
                    <button onClick={handleEditNomePiscicultura} className="text-gray-400 hover:text-blue-600" title="Editar">✏️</button>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Peso do Lote</label>
                        <p className="text-lg font-bold">{formatarPeso(pesoPiscicultura)} kg</p>
                    </div>
                    <button onClick={handleEditPesoPiscicultura} className="text-gray-400 hover:text-blue-600" title="Editar">✏️</button>
                </div>
                <div className="flex items-center justify-between p-3 bg-gray-50 rounded">
                    <div>
                        <label className="text-sm font-medium text-gray-600">Refugo Pré-Linha</label>
                        <p className="text-lg font-bold">{formatarPeso(refugoPreLinha)} kg</p>
                    </div>
                    <button onClick={handleAddRefugoPreLinha} className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold hover:bg-orange-600" title="Adicionar Refugo Pré-Linha">+</button>
                </div>
                <div className="p-3 bg-green-100 rounded">
                    <label className="text-sm font-medium text-green-800">Peso Real para Produção</label>
                    <p className="text-lg font-bold text-green-800">{formatarPeso(pesoReal)} kg</p>
                </div>
            </div>
          </div>

          {/* PAINEL "EM TEMPO REAL" */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
             <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <p className="text-sm text-gray-500">TEMPO</p>
                <p className="text-3xl font-bold text-gray-800">{cronometroTexto}</p>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <p className="text-sm text-gray-500">RENDIMENTO</p>
                <p className="text-3xl font-bold text-green-600">{formatarPeso(rendimentoEquipe)}%</p>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <p className="text-sm text-gray-500">PROCESSADO</p>
                <p className="text-3xl font-bold text-blue-600">{formatarPeso(brutoPeixe)} kg</p>
             </div>
             <div className="bg-white p-4 rounded-lg shadow-md text-center">
                <p className="text-sm text-gray-500">A PROCESSAR</p>
                <p className="text-3xl font-bold text-orange-600">{formatarPeso(faltando)} kg</p>
             </div>
          </div>

          {/* --- REGISTRAR PESAGEM OTIMIZADO PARA TOUCH --- */}
          <div className="bg-white p-4 rounded-xl mb-6 shadow-md">
            <h2 className="text-xl font-semibold mb-3">Registrar Pesagem</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input
                  type="text"
                  placeholder="Nome do Colaborador"
                  value={colaborador}
                  onChange={e => setColaborador(e.target.value)}
                  autoFocus
                  className="border p-4 text-lg w-full rounded-md md:col-span-2"
              />
              <div className="flex gap-3">
                {/* *** BOTÃO DA BALANÇA ATUALIZADO *** */}
                <button onClick={handleLerPeso} className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-md text-lg">⚖️</button>
                <input type="text" placeholder="Peso (kg)" value={pesoAtual} onChange={e => setPesoAtual(e.target.value)} className="border p-4 text-lg w-full rounded-md" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => registrarPesagem('peixe')} className="bg-blue-600 hover:bg-blue-700 text-white p-4 text-lg font-bold rounded-md">Entrada Peixe</button>
                  <button onClick={() => registrarPesagem('file')} className="bg-green-600 hover:bg-green-700 text-white p-4 text-lg font-bold rounded-md">Saída Filé</button>
                  <button onClick={() => registrarPesagem('refugoPeixe')} className="bg-yellow-500 hover:bg-yellow-600 text-white p-4 text-lg font-bold rounded-md">Refugo Peixe</button>
                  <button onClick={() => registrarPesagem('refugoFile')} className="bg-red-600 hover:bg-red-700 text-white p-4 text-lg font-bold rounded-md">Refugo Filé</button>
              </div>
            </div>
          </div>
          
          {/* TABELA DE PRODUÇÃO */}
          <div className="bg-white p-4 rounded-xl shadow-md">
            <h2 className="text-xl font-bold mb-3">Detalhes do Lote</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-base border-collapse">
                <thead className="bg-gray-200">
                  <tr>
                    <th className="p-3 border font-medium text-left">Colaborador</th>
                    <th className="p-3 border font-medium text-left">Ação</th>
                    <th className="p-3 border font-medium text-center">Horário</th>
                    <th className="p-3 border font-medium text-right">Peso (kg)</th>
                    <th className="p-3 border font-medium text-center">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(dadosPorColab).map(([nome, d]) => {
                    const rendTotalColab = d.brutoPeixe > 0 ? ((d.brutoFile - d.refugoFile) / d.brutoPeixe) * 100 : 0;
                    return (
                      <React.Fragment key={nome}>
                        {d.eventos.sort((a,b) => a.criadoEm?.toMillis() - b.criadoEm?.toMillis()).map(ev => {
                          const hora = ev.criadoEm ? format(ev.criadoEm.toDate(), 'HH:mm:ss') : '—';
                          const labels = { peixe: '🐟 Entrada Peixe', file: '🔪 Saída Filé', refugoPeixe: '🚫 Refugo Peixe', refugoFile: '🗑️ Refugo Filé' };
                          const cores = { peixe: 'text-blue-600', file: 'text-green-600', refugoPeixe: 'text-yellow-600', refugoFile: 'text-red-600' };
                          return (
                            <tr key={ev.id} className="hover:bg-gray-50">
                              <td className="p-3 border">{ev.colaborador}</td>
                              <td className={`p-3 border font-medium ${cores[ev.tipo]}`}>{labels[ev.tipo]}</td>
                              <td className="p-3 border text-center">{hora}</td>
                              <td className="p-3 border text-right">{formatarPeso(ev.peso)}</td>
                              <td className="p-3 border text-center">
                                <button onClick={() => handleEditPesagem(ev)} className="underline text-sm text-blue-600">Editar</button>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-gray-100 font-semibold">
                          <td className="p-3 border-y-2" colSpan="2">Subtotal ({nome})</td>
                          <td className="p-3 border-y-2 text-right">Bruto: {formatarPeso(d.brutoPeixe)}</td>
                          <td className="p-3 border-y-2 text-right">Líquido: {formatarPeso(d.brutoFile - d.refugoFile)}</td>
                          <td className="p-3 border-y-2 text-right">Rend: {formatarPeso(rendTotalColab)}%</td>
                        </tr>
                      </React.Fragment>
                    );
                  })}
                </tbody>
                <tfoot className="bg-gray-800 text-white font-semibold">
                  <tr>
                    <td className="p-4" colSpan="2">TOTAL GERAL DO LOTE</td>
                    <td className="p-4 text-right">Peixe Líquido: {formatarPeso(totalLiquidoPeixe)}</td>
                    <td className="p-4 text-right">Filé Líquido: {formatarPeso(totalLiquidoFile)}</td>
                    <td className="p-4 text-right">Rend. Total: {formatarPeso(rendimentoEquipe)}%</td>
                  </tr>
                  <tr className="bg-gray-700 text-sm">
                    <td className="p-2" colSpan="2">REFUGO TOTAL</td>
                    <td className="p-2 text-right">Pré-Linha: {formatarPeso(refugoPreLinha)} kg</td>
                    <td className="p-2 text-right">De Peixe: {formatarPeso(refugoDePeixe)} kg</td>
                    <td className="p-2 text-right">De Filé: {formatarPeso(refugoDeFile)} kg</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
