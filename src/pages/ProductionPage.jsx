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
  getDocs as getDocsOnce,
  serverTimestamp
} from 'firebase/firestore';
import { format } from 'date-fns';
import { lerPesoDaBalanca } from '../services/balancaService';

// ATENÇÃO: Senha mestra atualizada
const MASTER_PASSWORD = '571232';

// Formata números pt-BR (ex: 5.000,00)
function formatarPeso(numero) {
  if (typeof numero !== 'number' || isNaN(numero)) return '0,00';
  return numero.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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

  // Eventos de pesagem (continua igual)
  const [pesagens, setPesagens] = useState([]);

  // Estado de pesagem
  const [caixaId, setCaixaId] = useState('');
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
    const qAtiva = query(collection(db, 'producoes'), where('status', '==', 'ativo'));
    const unsub = onSnapshot(qAtiva, async snap => {
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

  // Senha mestra
  function verificarSenha() {
    const senha = window.prompt('Para editar, digite a senha mestra:');
    if (senha === MASTER_PASSWORD) return true;
    if (senha !== null) alert('Senha incorreta!');
    return false;
  }

  // --- FUNÇÕES DE EDIÇÃO COM SENHA ---
  async function handleEditNomePiscicultura() {
    if (!producaoAtiva || !verificarSenha()) return;
    const novoNome = window.prompt('Digite o novo nome da Piscicultura:', nomePiscicultura);
    if (novoNome && novoNome.trim() !== '') {
      setNomePiscicultura(novoNome);
      await updateDoc(doc(db, 'producoes', producaoAtiva.id), { nomePiscicultura: novoNome });
    }
  }

  async function handleEditPesoPiscicultura() {
    if (!producaoAtiva || !verificarSenha()) return;
    const novoPesoStr = window.prompt('Digite o novo peso do lote (kg):', pesoPiscicultura);
    if (novoPesoStr) {
      const novoPeso = Number(novoPesoStr.replace(',', '.'));
      if (!isNaN(novoPeso) && novoPeso >= 0) {
        setPesoPiscicultura(novoPeso);
        await updateDoc(doc(db, 'producoes', producaoAtiva.id), { pesoInicial: novoPeso });
      } else {
        alert('Valor de peso inválido.');
      }
    }
  }

  async function handleAddRefugoPreLinha() {
    if (!producaoAtiva || !verificarSenha()) return;
    const pesoStr = window.prompt('Digite o peso do NOVO refugo a ser adicionado (kg):');
    if (pesoStr) {
      const peso = Number(pesoStr.replace(',', '.'));
      if (!isNaN(peso) && peso > 0) {
        const novoTotalRefugo = refugoPreLinha + peso;
        setRefugoPreLinha(novoTotalRefugo);
        await updateDoc(doc(db, 'producoes', producaoAtiva.id), { refugoPreLinha: novoTotalRefugo });
      } else {
        alert('Valor de refugo inválido.');
      }
    }
  }

  // --- INICIAR PRODUÇÃO ---
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
      iniciadoPor: 'Felipe'
    });
    setFornecedorSelecionado('');
    setFormPesoInicial('');
  }

  // --- HELPERS DE CAIXA ---
  // retorna docRef da caixa se existir
  async function getCaixaDocById(caixaIdStr) {
    const qCaixa = query(
      collection(db, 'producoes', producaoAtiva.id, 'caixas'),
      where('caixaId', '==', caixaIdStr)
    );
    const snap = await getDocsOnce(qCaixa);
    return snap.empty ? null : { id: snap.docs[0].id, ...snap.docs[0].data() };
  }

  async function assertCaixaDisponivel(caixaIdStr) {
    const existente = await getCaixaDocById(caixaIdStr);
    if (existente && existente.status === 'pendente') {
      throw new Error(`A caixa ${caixaIdStr} já está pendente. Finalize (saída de filé) antes de lançar nova entrada.`);
    }
    // Se existir concluída, pode reutilizar — criaremos um novo registro de caixa
  }

  // *** NOVA FUNÇÃO PARA LER O PESO ***
  const handleLerPeso = async () => {
    const pesoLido = await lerPesoDaBalanca();
    if (pesoLido !== null && typeof pesoLido === 'number') {
      setPesoAtual(pesoLido.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
    }
  };

  // --- REGISTROS ---
  // Entrada de PEIXE -> sem dono; cria/atualiza "caixa" pendente e registra pesagem 'peixe'
  async function registrarEntradaPeixe() {
    if (!producaoAtiva) return alert('Nenhuma produção ativa.');
    if (!caixaId || !pesoAtual) return alert('Informe o ID da caixa e o peso.');
    const peso = Number(pesoAtual.replace(',', '.'));
    if (isNaN(peso) || peso <= 0) return alert('Peso inválido.');

    try {
      await assertCaixaDisponivel(caixaId.trim());

      // cria registro da caixa (pendente)
      const caixaRef = await addDoc(collection(db, 'producoes', producaoAtiva.id, 'caixas'), {
        caixaId: caixaId.trim(),
        pesoEntrada: peso,
        status: 'pendente',             // <- chave para bloquear duplicidade
        atribuidaA: null,
        criadoEm: serverTimestamp()
      });

      // registra evento de pesagem atrelado à caixa
      const prodRef = doc(db, 'producoes', producaoAtiva.id);
      await addDoc(collection(prodRef, 'pesagens'), {
        colaborador: '',                // sem dono
        tipo: 'peixe',
        caixaId: caixaId.trim(),
        peso,
        criadoEm: serverTimestamp()
      });

      setPesoAtual('');
      // mantém caixaId para facilitar retorno ou limpe se preferir:
      // setCaixaId('');
    } catch (e) {
      alert(e.message);
    }
  }

  // Saída de FILÉ -> exige caixa pendente + colaborador; fecha a caixa
  async function registrarSaidaFile() {
    if (!producaoAtiva) return alert('Nenhuma produção ativa.');
    if (!caixaId || !colaborador || !pesoAtual) return alert('Informe a caixa, o colaborador e o peso.');
    const pesoFile = Number(pesoAtual.replace(',', '.'));
    if (isNaN(pesoFile) || pesoFile <= 0) return alert('Peso inválido.');

    const caixa = await getCaixaDocById(caixaId.trim());
    if (!caixa) return alert(`Caixa ${caixaId} não encontrada. Registre a ENTRADA primeiro.`);
    if (caixa.status !== 'pendente') return alert(`Caixa ${caixaId} não está pendente.`);

    const pesoPeixe = Number(caixa.pesoEntrada) || 0;
    const rendimento = pesoPeixe > 0 ? (pesoFile / pesoPeixe) * 100 : 0;

    // 1) registra pesagem de file vinculando ao colaborador e à caixa
    const prodRef = doc(db, 'producoes', producaoAtiva.id);
    await addDoc(collection(prodRef, 'pesagens'), {
      colaborador,
      tipo: 'file',
      caixaId: caixaId.trim(),
      peso: pesoFile,
      criadoEm: serverTimestamp()
    });

    // 2) fecha a caixa
    await updateDoc(doc(db, 'producoes', producaoAtiva.id, 'caixas', caixa.id), {
      status: 'concluida',
      atribuidaA: colaborador,
      pesoFile,
      rendimento
    });

    setPesoAtual('');
    setColaborador('');
    // opcional: limpar caixa
    // setCaixaId('');
  }

  // Refugos continuam como antes (opcionais à caixa)
  async function registrarRefugo(tipoRefugo) {
    if (!producaoAtiva || !pesoAtual) return alert('Informe o peso.');
    const peso = Number(pesoAtual.replace(',', '.'));
    if (isNaN(peso) || peso <= 0) return alert('Peso inválido.');
    const prodRef = doc(db, 'producoes', producaoAtiva.id);
    await addDoc(collection(prodRef, 'pesagens'), {
      colaborador: colaborador || '', // pode estar vazio
      tipo: tipoRefugo,               // 'refugoPeixe' | 'refugoFile'
      caixaId: caixaId ? caixaId.trim() : null,
      peso,
      criadoEm: serverTimestamp()
    });
    setPesoAtual('');
    // setColaborador(''); // opcional
  }

  async function handleEditPesagem(p) {
    if (!verificarSenha()) return;
    const novoColab = window.prompt('Editar nome do colaborador:', p.colaborador || '');
    if (novoColab === null) return;
    const novoPesoStr = window.prompt('Editar peso (kg):', p.peso);
    if (novoPesoStr === null) return;
    const novoPeso = Number(novoPesoStr.replace(',', '.'));
    if (isNaN(novoPeso) || novoPeso <= 0) return alert('Peso inválido.');

    const pesagemRef = doc(db, 'producoes', producaoAtiva.id, 'pesagens', p.id);
    await updateDoc(pesagemRef, { colaborador: novoColab, peso: novoPeso });
  }

  async function handleFecharProducao() {
    if (!producaoAtiva || !window.confirm('Tem certeza que deseja encerrar a produção?')) return;
    await updateDoc(doc(db, 'producoes', producaoAtiva.id), { status: 'encerrado', encerradoEm: serverTimestamp() });
  }

  function escutarPesagens(id) {
    const qPes = query(collection(db, 'producoes', id, 'pesagens'));
    return onSnapshot(qPes, snap => {
      setPesagens(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
  }

  // --- CÁLCULOS TOTAIS ---
  const brutoPeixe = pesagens.filter(p => p.tipo === 'peixe').reduce((a, p) => a + p.peso, 0);
  const brutoFile = pesagens.filter(p => p.tipo === 'file').reduce((a, p) => a + p.peso, 0);
  const refugoDePeixe = pesagens.filter(p => p.tipo === 'refugoPeixe').reduce((a, p) => a + p.peso, 0);
  const refugoDeFile = pesagens.filter(p => p.tipo === 'refugoFile').reduce((a, p) => a + p.peso, 0);

  const totalLiquidoPeixe = brutoPeixe - refugoDePeixe;
  const totalLiquidoFile = brutoFile - refugoDeFile;

  const rendimentoEquipe = brutoPeixe > 0 ? (totalLiquidoFile / brutoPeixe) * 100 : 0;
  const pesoReal = pesoPiscicultura - refugoPreLinha;
  const faltando = pesoReal - brutoPeixe;

  // Agrupamento: se não tiver colaborador, mostra como PENDENTE
  const dadosPorColab = pesagens.reduce((acc, p) => {
    const nome = p.colaborador && p.colaborador.trim() !== '' ? p.colaborador : 'PENDENTE';
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
              <select
                id="selectPiscicultura"
                value={fornecedorSelecionado}
                onChange={e => setFornecedorSelecionado(e.target.value)}
                className="border p-2 rounded w-full"
              >
                <option value="" disabled>Selecione...</option>
                {fornecedores.map(f => (<option key={f.id} value={f.id}>{f.nome}</option>))}
              </select>
            </div>
            <div>
              <label htmlFor="pesoInicial" className="block mb-1 font-medium">Peso Piscicultura (kg)</label>
              <input
                id="pesoInicial"
                type="text"
                value={formPesoInicial}
                onChange={e => setFormPesoInicial(e.target.value)}
                className="border p-2 rounded w-full"
                placeholder="Ex: 5000,00"
              />
            </div>
            <button
              onClick={handleStartProduction}
              disabled={!fornecedorSelecionado || !formPesoInicial}
              className="bg-green-600 disabled:opacity-50 hover:bg-green-700 text-white font-bold px-6 py-2 rounded self-start"
            >
              Iniciar Produção
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* --- CABEÇALHO --- */}
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
                <button
                  onClick={handleAddRefugoPreLinha}
                  className="bg-orange-500 text-white rounded-full w-8 h-8 flex items-center justify-center text-xl font-bold hover:bg-orange-600"
                  title="Adicionar Refugo Pré-Linha"
                >
                  +
                </button>
              </div>
              <div className="p-3 bg-green-100 rounded">
                <label className="text-sm font-medium text-green-800">Peso Real para Produção</label>
                <p className="text-lg font-bold text-green-800">{formatarPeso(pesoReal)} kg</p>
              </div>
            </div>
          </div>

          {/* PAINEL EM TEMPO REAL */}
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

          {/* REGISTRAR PESAGEM (com CAIXA) */}
          <div className="bg-white p-4 rounded-xl mb-6 shadow-md">
            <h2 className="text-xl font-semibold mb-3">Registrar Pesagem</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="flex gap-3 md:col-span-2">
                <input
                  type="text"
                  placeholder="Caixa (ex: 001)"
                  value={caixaId}
                  onChange={e => setCaixaId(e.target.value)}
                  className="border p-4 text-lg w-48 rounded-md"
                />
                <button
                  onClick={handleLerPeso}
                  className="bg-purple-600 hover:bg-purple-700 text-white p-4 rounded-md text-lg"
                  title="Ler da balança"
                >
                  ⚖️
                </button>
                <input
                  type="text"
                  placeholder="Peso (kg)"
                  value={pesoAtual}
                  onChange={e => setPesoAtual(e.target.value)}
                  className="border p-4 text-lg w-full rounded-md"
                />
              </div>

              <input
                type="text"
                placeholder="Nome do Colaborador (só para Saída de Filé)"
                value={colaborador}
                onChange={e => setColaborador(e.target.value)}
                className="border p-4 text-lg w-full rounded-md md:col-span-2"
              />

              <div className="grid grid-cols-2 gap-3 md:col-span-2">
                <button
                  onClick={registrarEntradaPeixe}
                  className="bg-blue-600 hover:bg-blue-700 text-white p-4 text-lg font-bold rounded-md"
                  title="Lança a ENTRADA da caixa sem dono"
                >
                  Entrada Peixe (Caixa)
                </button>
                <button
                  onClick={registrarSaidaFile}
                  className="bg-green-600 hover:bg-green-700 text-white p-4 text-lg font-bold rounded-md"
                  title="Baixa a caixa e atribui ao colaborador"
                >
                  Saída Filé (Fechar Caixa)
                </button>
                <button
                  onClick={() => registrarRefugo('refugoPeixe')}
                  className="bg-yellow-500 hover:bg-yellow-600 text-white p-4 text-lg font-bold rounded-md"
                >
                  Refugo Peixe
                </button>
                <button
                  onClick={() => registrarRefugo('refugoFile')}
                  className="bg-red-600 hover:bg-red-700 text-white p-4 text-lg font-bold rounded-md"
                >
                  Refugo Filé
                </button>
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
                        {d.eventos
                          .sort((a, b) => (a.criadoEm?.toMillis?.() || 0) - (b.criadoEm?.toMillis?.() || 0))
                          .map(ev => {
                            const hora = ev.criadoEm ? format(ev.criadoEm.toDate(), 'HH:mm:ss') : '—';
                            const labels = {
                              peixe: `🐟 Entrada Peixe ${ev.caixaId ? `(Caixa ${ev.caixaId})` : ''}`,
                              file: `🔪 Saída Filé ${ev.caixaId ? `(Caixa ${ev.caixaId})` : ''}`,
                              refugoPeixe: '🚫 Refugo Peixe',
                              refugoFile: '🗑️ Refugo Filé'
                            };
                            const cores = { peixe: 'text-blue-600', file: 'text-green-600', refugoPeixe: 'text-yellow-600', refugoFile: 'text-red-600' };
                            return (
                              <tr key={ev.id} className="hover:bg-gray-50">
                                <td className="p-3 border">{ev.colaborador && ev.colaborador.trim() !== '' ? ev.colaborador : 'PENDENTE'}</td>
                                <td className={`p-3 border font-medium ${cores[ev.tipo]}`}>{labels[ev.tipo]}</td>
                                <td className="p-3 border text-center">{hora}</td>
                                <td className="p-3 border text-right">{formatarPeso(ev.peso)}</td>
                                <td className="p-3 border text-center">
                                  <button onClick={() => handleEditPesagem(ev)} className="underline text-sm text-blue-600">
                                    Editar
                                  </button>
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
