// C:\code\moradafish\src\pages\RendFiletadorExcelPage.jsx
import React, { useEffect, useMemo, useState } from "react";
import { db } from "../services/firebase";
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  query,
  where,
  orderBy,
} from "firebase/firestore";
import * as XLSX from "xlsx";
import { format, startOfMonth, endOfMonth, parseISO } from "date-fns";

/* ====================== Helpers ====================== */
const toISO = (d) => format(d, "yyyy-MM-dd");

const normalizeNumber = (v) => {
  if (v === "" || v === null || v === undefined) return 0;
  const cleaned = String(v).replace("%", "").trim();
  const n = Number(cleaned.replace(",", "."));
  return isNaN(n) ? 0 : n;
};

const pctToRatio = (val) => {
  const n = normalizeNumber(val);
  return n > 1 ? n / 100 : n; // aceita 85 ou 0.85
};

const norm = (s) =>
  String(s ?? "")
    .replace(/["“”']/g, "")
    .replace(/\s+/g, " ")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim();

/* ---- aliases de cabeçalho ---- */
const ALIAS = {
  data: ["data", "dt", "dia", "data do lancamento", "lancamento", "competencia"],
  filetador: [
    "filetador",
    "filetadores",
    "colaborador",
    "funcionario",
    "operador",
    "nome",
    "nome do filetador",
    "matricula",
    "crachá",
    "cracha",
    "id",
  ],
  peixeSem: [
    "peixe recebido sem escama (kg)",
    "peixe recebido sem escama",
    "peixe sem escama (kg)",
    "peixe sem escama",
    "entrada sem escama (kg)",
    "peixe s/ escama (kg)",
  ],
  fileProd: [
    "file produzido (kg)",
    "filé produzido (kg)",
    "file produzido",
    "producao file (kg)",
    "saida file (kg)",
    "producao de file (kg)",
  ],
  correcao: ["correcao", "correção", "ajuste", "ajuste (kg)", "corte", "desconto"],
  aprov: [
    "% aprov. sem escamas",
    "percentual aprovado sem escamas",
    "aprov sem escamas",
    "% aprovado sem escamas",
    "% aprov sem escamas",
    "aprovacao sem escamas",
  ],
};

/* ----------------- Header helpers ----------------- */
function findHeaderRow(rows) {
  // procura até 120 linhas e aceita o melhor score, mesmo que 1
  let bestRow = 0,
    bestScore = -1;
  for (let r = 0; r < rows.length && r < 120; r++) {
    const cells = (rows[r] || []).map((c) => norm(c));
    let score = 0;
    const has = (aliases) => aliases.some((a) => cells.includes(a));
    if (has(ALIAS.data)) score++;
    if (has(ALIAS.filetador)) score++;
    if (has(ALIAS.peixeSem)) score++;
    if (has(ALIAS.fileProd)) score++;
    if (has(ALIAS.correcao)) score++;
    if (has(ALIAS.aprov)) score++;
    if (score > bestScore) {
      bestScore = score;
      bestRow = r;
    }
    if (score >= 3) break; // achou um cabeçalho bom
  }
  return bestRow;
}
function mergeHeaderRows(rows, startIdx) {
  const h1 = rows[startIdx] || [];
  const h2 = rows[startIdx + 1] || [];
  const h3 = rows[startIdx + 2] || [];
  const len = Math.max(h1.length, h2.length, h3.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    const a = String(h1[i] ?? ""),
      b = String(h2[i] ?? ""),
      c = String(h3[i] ?? "");
    const merged = [a, b, c]
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
    out.push(merged);
  }
  return out;
}
function buildColumnMap(headerCells) {
  const map = { data: -1, filetador: -1, peixeSem: -1, fileProd: -1, correcao: -1, aprov: -1 };
  const cells = headerCells.map((c) => norm(c));
  const setIdx = (key, aliases) => {
    for (let i = 0; i < cells.length; i++)
      if (aliases.includes(cells[i])) {
        map[key] = i;
        return;
      }
  };
  setIdx("data", ALIAS.data);
  setIdx("filetador", ALIAS.filetador);
  setIdx("peixeSem", ALIAS.peixeSem);
  setIdx("fileProd", ALIAS.fileProd);
  setIdx("correcao", ALIAS.correcao);
  setIdx("aprov", ALIAS.aprov);
  return map;
}

/* ------------ Date helpers ------------ */
function excelNumToISO(n) {
  const d = XLSX.SSF.parse_date_code(n);
  if (!d || !d.y) return "";
  const js = new Date(d.y, (d.m || 1) - 1, d.d || 1);
  return toISO(js);
}
function anyToISO(v) {
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === "number") return excelNumToISO(v); // tratar sempre serial Excel quando vier número
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    try {
      const s2 = s.replace(/-/g, "/");
      const parts = s2.split("/");
      if (parts.length === 3) {
        let [d, m, y] = parts.map((x) => x.trim());
        const yy = y.length === 2 ? Number(y) + 2000 : Number(y);
        const js = new Date(yy, Number(m) - 1, Number(d));
        if (!isNaN(js)) return toISO(js);
      }
      return toISO(parseISO(s));
    } catch {
      return "";
    }
  }
  return "";
}

/* ---------- Fuzzy helpers (para importar) ---------- */
function lev(a, b) {
  a = norm(a);
  b = norm(b);
  const m = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) m[i][0] = i;
  for (let j = 0; j <= b.length; j++) m[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      m[i][j] = Math.min(m[i - 1][j] + 1, m[i][j - 1] + 1, m[i - 1][j - 1] + cost);
    }
  }
  return m[a.length][b.length];
}
function buildColabIndex(colaboradores) {
  const byNome = {};
  const list = [];
  colaboradores.forEach((raw) => {
    const c = {
      id: raw.id,
      nome: raw.nome ?? raw.Nome ?? raw.name ?? "",
      apelido: raw.apelido ?? raw.Apelido ?? raw.nickname ?? "",
      matricula: String(raw.matricula ?? raw.Matricula ?? raw.codigo ?? raw.codigoBarras ?? "")
        .trim()
        .replace(/^0+/, ""),
      funcao: raw.funcao ?? raw.função ?? raw.Funcao ?? raw["Função"] ?? "",
    };
    list.push(c);
    if (c.nome) byNome[norm(c.nome)] = c;
  });
  return { byNome, list };
}
function resolveColaborador(raw, index) {
  // normaliza e remove prefixos/ruídos comuns ("Filetador Fulano", etc.)
  let s = norm(String(raw || ""));
  if (!s) return null;
  s = s
    .replace(
      /^(filetador(a)?|operador(a)? de filet(agem)?|filetagem|fil(e|é)to(r|ra)|fil(e|é))[:\- ]*/i,
      ""
    )
    .replace(/\((.*?)\)/g, " ") // remove parenteses (ex. matrícula)
    .replace(/\s{2,}/g, " ")
    .trim();

  // 1) match exato
  if (index.byNome[s]) return index.byNome[s];

  // 2) contém/é contido
  for (const c of index.list) {
    const n = norm(c.nome || "");
    if (!n) continue;
    if (s.includes(n) || n.includes(s)) return c;
  }

  // 3) aproximação por distância
  let best = null,
    bestD = 999;
  for (const c of index.list) {
    const n = norm(c.nome || "");
    if (!n) continue;
    const d = lev(s, n);
    if (d < bestD) {
      bestD = d;
      best = c;
    }
  }
  return bestD <= 6 ? best : null; // tolerância maior por conta de ruídos
}

/* ====================== Página ====================== */
export default function RendFiletadorExcelPage() {
  const [monthDate] = useState(() => new Date());
  const [selectedFile, setSelectedFile] = useState(null);

  const [colaboradores, setColaboradores] = useState([]); // origem: equipe_producao
  const [linhas, setLinhas] = useState([]);

  // média diária (teste_escamacao) por Data
  const [aprovPorData, setAprovPorData] = useState({}); // "2025-08-04" => 0.9739

  const [form, setForm] = useState({
    dataISO: toISO(new Date()),
    filetadorId: "",
    peixeSemEscamaKg: "",
    fileProduzidoKg: "",
    correcaoKg: "",
  });

  // ======= Estado do mapeamento manual =======
  const [mapModalOpen, setMapModalOpen] = useState(false);
  const [headerOptions, setHeaderOptions] = useState([]); // textos de cabeçalho
  const [rowsParsed, setRowsParsed] = useState([]); // linhas do excel
  const [headerRowIdx, setHeaderRowIdx] = useState(0);
  const [tempMap, setTempMap] = useState({
    data: -1,
    filetador: -1,
    peixeSem: -1,
    fileProd: -1,
    correcao: -1,
    aprov: -1,
  });

  /* ===== Carregar equipe (APENAS 'equipe_producao') ===== */
  useEffect(() => {
    const unsub = onSnapshot(query(collection(db, "equipe_producao")), (snap) => {
      const arr = snap.docs.map((d) => {
        const x = d.data();
        return {
          id: d.id,
          nome: String(x.nome ?? x.Nome ?? x.name ?? "").trim() || "(Sem nome)",
          funcao: String(x.funcao ?? x.função ?? x.Funcao ?? x["Função"] ?? "").trim(),
          matricula: String(x.matricula ?? x.Matricula ?? x.codigo ?? x.codigoBarras ?? "")
            .trim()
            .replace(/^0+/, ""),
        };
      });
      arr.sort((a, b) => a.nome.localeCompare(b.nome));
      setColaboradores(arr);
    });
    return () => unsub();
  }, []);

  /* ===== Select de filetador: filtro mais abrangente + fallback ===== */
  const listaParaSelect = useMemo(() => {
    const isFilet = (f) => {
      const s = norm(f);
      return (
        s.includes("filetador") ||
        s.includes("filetag") ||
        /operador(a)? de filet/.test(s) ||
        s.includes("fil e") || // "filé" sem acento após normalização
        s.includes("file")
      );
    };
    let base = colaboradores.filter((c) => isFilet(c.funcao));
    if (base.length === 0) base = colaboradores; // fallback: lista todos
    return base
      .map((c) => ({
        id: c.id,
        nome: c.matricula ? `${c.nome} (${c.matricula})` : c.nome,
      }))
      .sort((a, b) => a.nome.localeCompare(b.nome));
  }, [colaboradores]);

  /* ====== Lançamentos do mês ====== */
  useEffect(() => {
    const ini = startOfMonth(monthDate);
    const fim = endOfMonth(monthDate);
    const qRef = query(
      collection(db, "rend_filetador"),
      where("dataISO", ">=", toISO(ini)),
      where("dataISO", "<=", toISO(fim)),
      orderBy("dataISO", "asc")
    );
    const unsub = onSnapshot(qRef, (snap) => {
      setLinhas(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
    return () => unsub();
  }, [monthDate]);

  /* ====== teste_escamacao -> média diária ====== */
  useEffect(() => {
    const ini = startOfMonth(monthDate);
    const fim = endOfMonth(monthDate);
    const qRef = query(
      collection(db, "teste_escamacao"),
      where("dataISO", ">=", toISO(ini)),
      where("dataISO", "<=", toISO(fim))
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const soma = {},
        cont = {};
      snap.forEach((d) => {
        const x = d.data();
        const dataISO = x.dataISO;

        let ratio = pctToRatio(
          x.mediaDiariaPercent ??
            x.mediaDiariaPct ??
            x.mediaDiaria ??
            x.percentualAprovacao ??
            x.percentual ??
            x.percentualAproveitado ??
            x.aprovacaoSemEscamaPercent ??
            x.aprovacaoSemEscama ??
            0
        );

        if (!ratio || ratio <= 0) {
          const cEscama = normalizeNumber(
            x.cEscama ?? x.comEscama ?? x.comEscamaKg ?? x.peixeComEscamaKg ?? 0
          );
          const sEscama = normalizeNumber(
            x.sEscama ?? x.semEscama ?? x.semEscamaKg ?? x.peixeSemEscamaKg ?? 0
          );
          if (cEscama > 0 && sEscama > 0) ratio = sEscama / cEscama;
        }

        if (!dataISO) return;
        if (ratio > 0) {
          soma[dataISO] = (soma[dataISO] || 0) + ratio;
          cont[dataISO] = (cont[dataISO] || 0) + 1;
        }
      });
      const mapa = {};
      Object.keys(soma).forEach((d) => (mapa[d] = soma[d] / cont[d]));
      setAprovPorData(mapa);
    });
    return () => unsub();
  }, [monthDate]);

  const colabIndex = useMemo(() => buildColabIndex(colaboradores), [colaboradores]);

  const colabById = useMemo(() => {
    const m = {};
    colabIndex.list.forEach((c) => (m[c.id] = c));
    return m;
  }, [colabIndex]);

  const linhasCalculadas = useMemo(() => {
    const base = [...linhas].sort((a, b) => {
      if (a.dataISO !== b.dataISO) return a.dataISO.localeCompare(b.dataISO);
      return (a.filetadorNome || "").localeCompare(b.filetadorNome || "");
    });
    return base.map((ln) => {
      let aprov = aprovPorData[ln.dataISO] ?? 0;
      if (!aprov || aprov <= 0) aprov = pctToRatio(ln.aprovSemEscamaPct);

      const peixeSem = normalizeNumber(ln.peixeSemEscamaKg);
      const fileProd = normalizeNumber(ln.fileProduzidoKg);
      const corr = normalizeNumber(ln.correcaoKg);

      const peixeCom = aprov > 0 ? peixeSem / aprov : peixeSem;
      const fileAj = Math.max(0, fileProd - corr);
      const rend = peixeCom > 0 ? (fileAj / peixeCom) * 100 : 0;

      return {
        ...ln,
        _auto: {
          aprovRatio: aprov,
          aprovPct: (aprov || 0) * 100,
          peixeComEscamaKg: peixeCom,
          fileAjusteKg: fileAj,
          rendimentoPct: rend,
        },
      };
    });
  }, [linhas, aprovPorData]);

  const totais = useMemo(() => {
    let peixeCom = 0,
      fileAj = 0;
    linhasCalculadas.forEach((i) => {
      peixeCom += i._auto?.peixeComEscamaKg || 0;
      fileAj += i._auto?.fileAjusteKg || 0;
    });
    const rendMes = peixeCom > 0 ? (fileAj / peixeCom) * 100 : 0;
    return { peixeCom, fileAj, rendMes };
  }, [linhasCalculadas]);

  /* ---- form manual ---- */
  const onChange = (e) => {
    const { name, value } = e.target;
    setForm((s) => ({ ...s, [name]: value }));
  };

  const salvarManual = async (e) => {
    e.preventDefault();
    const { dataISO, filetadorId, peixeSemEscamaKg, fileProduzidoKg, correcaoKg } = form;
    if (!dataISO || !filetadorId) {
      alert("Data e Filetador são obrigatórios.");
      return;
    }
    const colab = colabById[filetadorId];
    const id = `${dataISO}_${filetadorId}`;
    await setDoc(doc(db, "rend_filetador", id), {
      dataISO,
      filetadorId,
      filetadorNome: colab?.nome || "",
      peixeSemEscamaKg: normalizeNumber(peixeSemEscamaKg),
      fileProduzidoKg: normalizeNumber(fileProduzidoKg),
      correcaoKg: normalizeNumber(correcaoKg),
    });
    setForm((s) => ({
      ...s,
      peixeSemEscamaKg: "",
      fileProduzidoKg: "",
      correcaoKg: "",
    }));
  };

  const editarLinha = async (id, campos) => {
    await updateDoc(doc(db, "rend_filetador", id), {
      dataISO: campos.dataISO,
      filetadorId: campos.filetadorId,
      filetadorNome: colabById[campos.filetadorId]?.nome || "",
      peixeSemEscamaKg: normalizeNumber(campos.peixeSemEscamaKg),
      fileProduzidoKg: normalizeNumber(campos.fileProduzidoKg),
      correcaoKg: normalizeNumber(campos.correcaoKg),
      aprovSemEscamaPct: normalizeNumber(campos.aprovSemEscamaPct || 0),
    });
  };

  const excluirLinha = async (id) => {
    if (!confirm("Excluir este lançamento?")) return;
    await deleteDoc(doc(db, "rend_filetador", id));
  };

  /* ============ Importador (auto + fallback manual) ============ */
  const importarExcel = async (file) => {
    if (!file) {
      alert("Selecione um arquivo primeiro.");
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf);

      const wanted =
        wb.SheetNames.find(
          (n) => norm(n).includes("rend") && norm(n).includes("filet")
        ) ?? wb.SheetNames[0];
      const ws = wb.Sheets[wanted];

      const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
      const hdrIdx = findHeaderRow(rows);
      const headerMerged = mergeHeaderRows(rows, hdrIdx);
      let autoMap = buildColumnMap(headerMerged);

      // Se não reconheceu Data ou Filetador, abre mapeamento manual
      if (autoMap.data === -1 || autoMap.filetador === -1) {
        setHeaderOptions(
          headerMerged.map((h, i) => h || `(coluna ${i + 1})`)
        );
        setRowsParsed(rows);
        setHeaderRowIdx(hdrIdx);
        setTempMap(autoMap);
        setMapModalOpen(true);
        return; // importa depois que confirmar o modal
      }

      await importarComMapa(rows, hdrIdx, autoMap);
    } catch (err) {
      console.error(err);
      alert(
        "Não foi possível ler o arquivo. Feche qualquer programa que o esteja usando e selecione novamente."
      );
    } finally {
      setSelectedFile(null); // evita reaproveitar referência após HMR
    }
  };

  async function importarComMapa(rows, hdrIdx, map) {
    const idx = buildColabIndex(colaboradores);
    const erros = [];
    const ops = [];

    for (let r = hdrIdx + 1; r < rows.length; r++) {
      const row = rows[r];
      if (!row || row.every((c) => String(c).trim() === "")) continue;

      const dataISO = anyToISO(row[map.data]);
      if (!dataISO) {
        erros.push(`Linha ${r + 1}: Data inválida "${row[map.data]}".`);
        continue;
      }

      const filetRaw = String(row[map.filetador] ?? "");
      const colab = resolveColaborador(filetRaw, idx);
      if (!colab) {
        erros.push(`Data ${dataISO}: Filetador "${filetRaw}" não encontrado no cadastro.`);
        continue;
      }

      const peixeSemRaw = map.peixeSem !== -1 ? row[map.peixeSem] : 0;
      const fileProdRaw = map.fileProd !== -1 ? row[map.fileProd] : 0;
      const correcaoRaw = map.correcao !== -1 ? row[map.correcao] : 0;
      const aprovRaw = map.aprov !== -1 ? row[map.aprov] : 0;

      const id = `${dataISO}_${colab.id}`;
      const payload = {
        dataISO,
        filetadorId: colab.id,
        filetadorNome: colab.nome,
        peixeSemEscamaKg: normalizeNumber(peixeSemRaw),
        fileProduzidoKg: normalizeNumber(fileProdRaw),
        correcaoKg: normalizeNumber(correcaoRaw),
        aprovSemEscamaPct: normalizeNumber(aprovRaw),
      };
      ops.push({ id, payload });
    }

    if (!ops.length) {
      alert(`Nenhum registro válido para importar.\nErros:\n- ${erros.join("\n- ")}`);
      return;
    }
    for (const op of ops) {
      await setDoc(doc(db, "rend_filetador", op.id), op.payload);
    }
    if (erros.length) {
      alert(
        `Importação finalizada com avisos:\n- ${erros.slice(0, 50).join("\n- ")}${
          erros.length > 50 ? "\n(+ mais…)" : ""
        }`
      );
    } else {
      alert("Importação concluída com sucesso!");
    }
  }

  /* -------- Modal de mapeamento de colunas -------- */
  const MappingModal = () => {
    const [localMap, setLocalMap] = useState(tempMap);
    const change = (key, val) => setLocalMap((m) => ({ ...m, [key]: Number(val) }));

    const confirm = async () => {
      if (localMap.data === -1 || localMap.filetador === -1) {
        alert("Selecione ao menos: Data e Filetador.");
        return;
      }
      setMapModalOpen(false);
      await importarComMapa(rowsParsed, headerRowIdx, localMap);
      // limpa estados temporários
      setHeaderOptions([]);
      setRowsParsed([]);
      setTempMap({ data: -1, filetador: -1, peixeSem: -1, fileProd: -1, correcao: -1, aprov: -1 });
    };

    const close = () => {
      setMapModalOpen(false);
      setHeaderOptions([]);
      setRowsParsed([]); // descarta
    };

    return (
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
        <div className="bg-white rounded-2xl p-5 w-full max-w-2xl">
          <h3 className="text-lg font-semibold mb-1">Mapear colunas do Excel</h3>
          <p className="text-sm text-gray-600 mb-4">
            Seu arquivo tem cabeçalhos diferentes. Escolha abaixo quais colunas correspondem a cada campo.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              ["data", "Data *"],
              ["filetador", "Filetador *"],
              ["peixeSem", "Peixe recebido sem escama (kg)"],
              ["fileProd", "Filé produzido (kg)"],
              ["correcao", "Correção (kg)"],
              ["aprov", "% aprov. Sem escamas"],
            ].map(([key, label]) => (
              <div key={key}>
                <label className="label">{label}</label>
                <select
                  className="input"
                  value={localMap[key] ?? -1}
                  onChange={(e) => change(key, e.target.value)}
                >
                  <option value={-1}>— Não usar —</option>
                  {headerOptions.map((h, i) => (
                    <option key={i} value={i}>
                      {h || `(coluna ${i + 1})`}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          <div className="flex gap-2 mt-4 justify-end">
            <button className="btn-ghost" onClick={close}>
              Cancelar
            </button>
            <button className="btn-primary" onClick={confirm}>
              Importar
            </button>
          </div>
        </div>
      </div>
    );
  };

  const LinhaTabela = ({ item }) => {
    const [edit, setEdit] = useState(false);
    const [loc, setLoc] = useState({
      dataISO: item.dataISO,
      filetadorId: item.filetadorId,
      peixeSemEscamaKg: item.peixeSemEscamaKg,
      fileProduzidoKg: item.fileProduzidoKg,
      correcaoKg: item.correcaoKg,
      aprovSemEscamaPct: item.aprovSemEscamaPct || "",
    });

    const salvar = async () => {
      await editarLinha(item.id, loc);
      setEdit(false);
    };

    return (
      <tr className="border-b">
        <td className="p-2">
          {edit ? (
            <input
              type="date"
              className="input"
              value={loc.dataISO}
              onChange={(e) => setLoc({ ...loc, dataISO: e.target.value })}
            />
          ) : (
            item.dataISO
          )}
        </td>

        <td className="p-2">
          {edit ? (
            <select
              className="input"
              value={loc.filetadorId}
              onChange={(e) => setLoc({ ...loc, filetadorId: e.target.value })}
            >
              <option value="">Selecione…</option>
              {listaParaSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
          ) : (
            item.filetadorNome
          )}
        </td>

        <td className="p-2">
          {edit ? (
            <input
              type="number"
              step="0.01"
              className="input"
              value={loc.peixeSemEscamaKg}
              onChange={(e) => setLoc({ ...loc, peixeSemEscamaKg: e.target.value })}
            />
          ) : (
            Number(item.peixeSemEscamaKg || 0).toFixed(2)
          )}
        </td>

        <td className="p-2">
          {edit ? (
            <input
              type="number"
              step="0.01"
              className="input"
              value={loc.fileProduzidoKg}
              onChange={(e) => setLoc({ ...loc, fileProduzidoKg: e.target.value })}
            />
          ) : (
            Number(item.fileProduzidoKg || 0).toFixed(2)
          )}
        </td>

        <td className="p-2">
          {edit ? (
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="% aprov. (opcional)"
              value={loc.aprovSemEscamaPct}
              onChange={(e) => setLoc({ ...loc, aprovSemEscamaPct: e.target.value })}
            />
          ) : (
            `${(item._auto?.aprovPct || 0).toFixed(2)}%`
          )}
        </td>

        <td className="p-2">
          {edit ? (
            <input
              type="number"
              step="0.01"
              className="input"
              value={loc.correcaoKg}
              onChange={(e) => setLoc({ ...loc, correcaoKg: e.target.value })}
            />
          ) : (
            Number(item.correcaoKg || 0).toFixed(2)
          )}
        </td>

        <td className="p-2">{Number(item._auto?.peixeComEscamaKg || 0).toFixed(2)}</td>
        <td className="p-2">{Number(item._auto?.fileAjusteKg || 0).toFixed(2)}</td>
        <td className="p-2">{Number(item._auto?.rendimentoPct || 0).toFixed(2)}%</td>

        <td className="p-2">
          {!edit ? (
            <div className="flex gap-2">
              <button className="btn-secondary" onClick={() => setEdit(true)}>
                Editar
              </button>
              <button className="btn-danger" onClick={() => excluirLinha(item.id)}>
                Excluir
              </button>
            </div>
          ) : (
            <div className="flex gap-2">
              <button className="btn-primary" onClick={salvar}>
                Salvar
              </button>
              <button className="btn-ghost" onClick={() => setEdit(false)}>
                Cancelar
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  return (
    <div className="p-4">
      {mapModalOpen && <MappingModal />}

      <h1 className="text-2xl font-bold flex items-center justify-between">
        Rend. filetador (excel)
        <span className="text-sm font-normal text-gray-500">
          Mês: {format(monthDate, "MM/yyyy")}
        </span>
      </h1>

      {/* Importar Excel */}
      <div className="mt-4">
        <label className="label">Importar Excel</label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
            className="input"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <button
            type="button"
            className="btn-primary"
            onClick={() => importarExcel(selectedFile)}
            disabled={!selectedFile}
          >
            Importar
          </button>
          <button
            type="button"
            className="btn-ghost"
            onClick={() => setSelectedFile(null)}
          >
            Limpar arquivo
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          O select de <b>Filetador</b> lê <b>equipe_producao</b> e aceita variações de função
          (Filetador, Operador de Filetagem, etc.). Se não houver ninguém marcado, lista todos.
        </p>
      </div>

      {/* Lançamento Manual */}
      <form onSubmit={salvarManual} className="mt-6 p-4 rounded-xl border bg-white">
        <h2 className="font-semibold mb-3">Lançamento manual</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="label">Data *</label>
            <input
              type="date"
              name="dataISO"
              value={form.dataISO}
              onChange={onChange}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Filetador *</label>
            <select
              name="filetadorId"
              className="input"
              value={form.filetadorId}
              onChange={onChange}
              required
            >
              <option value="">Selecione…</option>
              {listaParaSelect.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nome}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500">1 lançamento por filetador/dia.</p>
          </div>
          <div>
            <label className="label">Peixe recebido sem escama (kg)</label>
            <input
              type="number"
              step="0.01"
              name="peixeSemEscamaKg"
              value={form.peixeSemEscamaKg}
              onChange={onChange}
              className="input"
            />
          </div>
          <div>
            <label className="label">Filé produzido (kg)</label>
            <input
              type="number"
              step="0.01"
              name="fileProduzidoKg"
              value={form.fileProduzidoKg}
              onChange={onChange}
              className="input"
            />
          </div>
          <div>
            <label className="label">Correção (kg)</label>
            <input
              type="number"
              step="0.01"
              name="correcaoKg"
              value={form.correcaoKg}
              onChange={onChange}
              className="input"
            />
          </div>
        </div>

        <div className="mt-3">
          <button className="btn-primary">Salvar lançamento</button>
        </div>
      </form>

      {/* Totais do mês */}
      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="card">
          <div className="card-title">Peixe recebido com escama (Kg)</div>
          <div className="card-value">{totais.peixeCom.toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="card-title">Filé produzido (kg) - Ajuste</div>
          <div className="card-value">{totais.fileAj.toFixed(2)}</div>
        </div>
        <div className="card">
          <div className="card-title">Rendimento do mês</div>
          <div className="card-value">{totais.rendMes.toFixed(2)}%</div>
        </div>
      </div>

      {/* Tabela */}
      <div className="mt-6 overflow-x-auto">
        <table className="min-w-[1000px] w-full text-sm bg-white rounded-lg overflow-hidden">
          <thead className="bg-gray-100">
            <tr className="text-left">
              <th className="p-2">Data</th>
              <th className="p-2">Filetador</th>
              <th className="p-2">Peixe recebido sem escama (kg)</th>
              <th className="p-2">Filé produzido (kg)</th>
              <th className="p-2">% aprov. Sem escamas (auto)</th>
              <th className="p-2">Correção (kg)</th>
              <th className="p-2">Peixe recebido com escama (Kg)</th>
              <th className="p-2">Filé produzido (kg) - Ajuste</th>
              <th className="p-2">Rend. (%)</th>
              <th className="p-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {linhasCalculadas.length === 0 ? (
              <tr>
                <td className="p-4 text-gray-500" colSpan={10}>
                  Sem lançamentos para o mês atual.
                </td>
              </tr>
            ) : (
              linhasCalculadas.map((it) => <LinhaTabela key={it.id} item={it} />)
            )}
          </tbody>
        </table>
      </div>

      {/* CSS utilitário local */}
      <style>{`
        .label { display:block; font-size:12px; color:#374151; margin-bottom:4px; }
        .input { width:100%; border:1px solid #e5e7eb; border-radius:10px; padding:8px 10px; outline:none; background:#fff; }
        .btn-primary { background:#2563eb; color:#fff; padding:8px 12px; border-radius:10px; }
        .btn-secondary { background:#f59e0b; color:#111827; padding:6px 10px; border-radius:10px; }
        .btn-danger { background:#ef4444; color:#fff; padding:6px 10px; border-radius:10px; }
        .btn-ghost { background:#e5e7eb; color:#111827; padding:6px 10px; border-radius:10px; }
        .card { border:1px solid #e5e7eb; border-radius:16px; padding:14px; background:#fff; }
        .card-title { font-size:12px; color:#6b7280; }
        .card-value { font-size:20px; font-weight:700; }
      `}</style>
    </div>
  );
}
