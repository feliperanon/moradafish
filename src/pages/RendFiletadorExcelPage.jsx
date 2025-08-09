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
  let bestRow = -1;
  let bestScore = -1;
  for (let r = 0; r < rows.length && r < 80; r++) {
    const cells = rows[r].map((c) => norm(c));
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
    if (score >= 2) break;
  }
  return bestRow >= 0 ? bestRow : 0;
}

function mergeHeaderRows(rows, startIdx) {
  const h1 = rows[startIdx] || [];
  const h2 = rows[startIdx + 1] || [];
  const h3 = rows[startIdx + 2] || [];
  const len = Math.max(h1.length, h2.length, h3.length);
  const out = [];
  for (let i = 0; i < len; i++) {
    const a = String(h1[i] ?? "");
    const b = String(h2[i] ?? "");
    const c = String(h3[i] ?? "");
    const merged = [a, b, c].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
    out.push(merged);
  }
  return out;
}

function buildColumnMap(headerCells) {
  const map = { data: -1, filetador: -1, peixeSem: -1, fileProd: -1, correcao: -1, aprov: -1 };
  const cells = headerCells.map((c) => norm(c));
  const setIdx = (key, aliases) => {
    for (let i = 0; i < cells.length; i++) {
      if (aliases.includes(cells[i])) {
        map[key] = i;
        return;
      }
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
function isDateLike(val) {
  if (val instanceof Date && !isNaN(val)) return true;
  if (typeof val === "string") {
    const s = val.trim();
    if (!s) return false;
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return true;
    if (/^\d{2}[\/\-]\d{2}[\/\-]\d{2,4}$/.test(s)) return true;
    return false;
  }
  if (typeof val === "number") return val >= 30000 && val <= 60000; // Excel serial
  return false;
}
function excelNumToISO(n) {
  const d = XLSX.SSF.parse_date_code(n);
  if (!d || !d.y) return "";
  const js = new Date(d.y, (d.m || 1) - 1, d.d || 1);
  return toISO(js);
}
function anyToISO(v) {
  if (v instanceof Date && !isNaN(v)) return toISO(v);
  if (typeof v === "number") return isDateLike(v) ? excelNumToISO(v) : "";
  if (typeof v === "string") {
    const s = v.trim();
    if (!s) return "";
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    try {
      const s2 = s.replace(/-/g, "/");
      const parts = s2.split("/");
      if (parts.length === 3) {
        let [d, m, y] = parts.map((x) => x.trim());
        if (d.length <= 2 && m.length <= 2) {
          const yy = y.length === 2 ? Number(y) + 2000 : Number(y);
          const js = new Date(yy, Number(m) - 1, Number(d));
          if (!isNaN(js)) return toISO(js);
        }
      }
      return toISO(parseISO(s));
    } catch {
      return "";
    }
  }
  return "";
}

/* ------------ “Adivinha” colunas Data/Filetador ------------ */
function inferColumns(rows, headerRowIdx, colaboradores) {
  const start = headerRowIdx + 1;
  const maxRows = Math.min(rows.length, start + 300);
  const cols = Math.max(...rows.slice(start, maxRows).map((r) => r.length), 0);

  const collabNorm = colaboradores.map((c) => norm(c.nome)).filter(Boolean);
  let dateScores = Array(cols).fill(0);
  let nameScores = Array(cols).fill(0);

  for (let r = start; r < maxRows; r++) {
    const row = rows[r] || [];
    for (let c = 0; c < cols; c++) {
      const v = row[c];
      if (isDateLike(v)) dateScores[c] += 1;
      const s = norm(v);
      if (s) {
        if (collabNorm.includes(s) || collabNorm.some((nm) => s.includes(nm) || nm.includes(s)))
          nameScores[c] += 3;
        else if (/[a-z]/i.test(String(v))) nameScores[c] += 1;
      }
    }
  }
  const data = Math.max(...dateScores) > 0 ? dateScores.indexOf(Math.max(...dateScores)) : -1;
  const filetador =
    Math.max(...nameScores) > 0 ? nameScores.indexOf(Math.max(...nameScores)) : -1;
  return { data, filetador };
}

/* ---------- Fuzzy match de colaboradores ---------- */
function lev(a, b) {
  a = norm(a); b = norm(b);
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
  const byApelido = {};
  const byMatricula = {};
  const list = [];

  colaboradores.forEach((c) => {
    const item = {
      id: c.id,
      nome: c.nome || "",
      apelido: c.apelido || c.nickname || "",
      matricula: String(c.matricula || c.codigo || "").trim(),
    };
    list.push(item);
    if (item.nome) byNome[norm(item.nome)] = item;
    if (item.apelido) byApelido[norm(item.apelido)] = item;
    if (item.matricula) byMatricula[norm(item.matricula)] = item;
  });

  return { byNome, byApelido, byMatricula, list };
}

function resolveColaborador(raw, index) {
  const s = norm(String(raw || ""));
  if (!s) return null;

  if (index.byNome[s]) return index.byNome[s];
  if (index.byApelido[s]) return index.byApelido[s];
  if (index.byMatricula[s]) return index.byMatricula[s];

  for (const k of Object.keys(index.byNome)) {
    if (s.includes(k) || k.includes(s)) return index.byNome[k];
  }
  for (const k of Object.keys(index.byApelido)) {
    if (s.includes(k) || k.includes(s)) return index.byApelido[k];
  }

  let best = null;
  let bestD = 3;
  index.list.forEach((c) => {
    const d1 = lev(s, c.nome || "");
    const d2 = c.apelido ? lev(s, c.apelido) : 99;
    if (d1 < bestD) { bestD = d1; best = c; }
    if (d2 < bestD) { bestD = d2; best = c; }
  });
  return bestD <= 2 ? best : null;
}

/* ====================== Página ====================== */
export default function RendFiletadorExcelPage() {
  const [monthDate] = useState(() => new Date());
  const [selectedFile, setSelectedFile] = useState(null);

  const [colaboradores, setColaboradores] = useState([]);
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

  // colaboradores (Cadastro da Equipe de Produção)
  useEffect(() => {
    const unsubCol = onSnapshot(
      query(collection(db, "colaboradores"), orderBy("nome", "asc")),
      (snap) =>
        setColaboradores(
          snap.docs.map((d) => ({ id: d.id, ...d.data(), nome: (d.data()?.nome || "").toString() }))
        )
    );
    return () => unsubCol();
  }, []);

  // filetadores visíveis (tolerante) e fallback
  const filetadoresVisiveis = useMemo(
    () =>
      colaboradores.filter(
        (c) => norm(c.funcao || "").includes("filetador") || c.filetador === true
      ),
    [colaboradores]
  );
  const listaParaSelect = filetadoresVisiveis.length ? filetadoresVisiveis : colaboradores;

  // lançamentos do mês
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

  // teste_escamacao -> média diária por Data
  useEffect(() => {
    const ini = startOfMonth(monthDate);
    const fim = endOfMonth(monthDate);
    const qRef = query(
      collection(db, "teste_escamacao"),
      where("dataISO", ">=", toISO(ini)),
      where("dataISO", "<=", toISO(fim))
    );
    const unsub = onSnapshot(qRef, (snap) => {
      const soma = {};
      const cont = {};
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
          const cEscama =
            normalizeNumber(x.cEscama ?? x.comEscama ?? x.comEscamaKg ?? x.peixeComEscamaKg ?? 0);
          const sEscama =
            normalizeNumber(x.sEscama ?? x.semEscama ?? x.semEscamaKg ?? x.peixeSemEscamaKg ?? 0);
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

  const colabById = useMemo(() => {
    const m = {};
    colaboradores.forEach((c) => (m[c.id] = c));
    return m;
  }, [colaboradores]);

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
    let peixeCom = 0;
    let fileAj = 0;
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
    setForm((s) => ({ ...s, peixeSemEscamaKg: "", fileProduzidoKg: "", correcaoKg: "" }));
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

  /* -------------- Importador (tolerante) -------------- */
  const importarExcel = async (file) => {
    if (!file) {
      alert("Selecione um arquivo primeiro.");
      return;
    }

    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf);

    const wanted =
      wb.SheetNames.find((n) => norm(n).includes("rend") && norm(n).includes("filet")) ??
      wb.SheetNames[0];
    const ws = wb.Sheets[wanted];

    const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "" });
    const headerRowIdx = findHeaderRow(rows);
    const headerMerged = mergeHeaderRows(rows, headerRowIdx);
    let map = buildColumnMap(headerMerged);

    // **usar TODOS colaboradores para inferência**
    if (map.data === -1 || map.filetador === -1) {
      const inferred = inferColumns(rows, headerRowIdx, colaboradores);
      if (map.data === -1) map.data = inferred.data;
      if (map.filetador === -1) map.filetador = inferred.filetador;
    }

    if (map.data === -1 || map.filetador === -1) {
      alert("Cabeçalho não reconhecido. Garanta colunas equivalentes a: Data e Filetador.");
      return;
    }

    // **AQUI**: índice baseado em TODOS os colaboradores (não só filetadores)
    const idx = buildColabIndex(colaboradores);

    const erros = [];
    const ops = [];

    for (let r = headerRowIdx + 1; r < rows.length; r++) {
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
  };
  /* --------------------------------------------------- */

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

        {/* % vindo do teste (auto). Se editar, salva o % do Excel/manual */}
        <td className="p-2">
          {edit ? (
            <input
              type="number"
              step="0.01"
              className="input"
              placeholder="% aprov. Sem escamas (opcional)"
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
      <h1 className="text-2xl font-bold flex items-center justify-between">
        Rend. filetador (excel)
        <span className="text-sm font-normal text-gray-500">Mês: {format(monthDate, "MM/yyyy")}</span>
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
          <button
            type="button"
            className="btn-primary"
            onClick={() => importarExcel(selectedFile)}
            disabled={!selectedFile}
          >
            Importar
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">
          Use a aba <b>Rend. filetador</b>. Os nomes são casados com o <b>Cadastro da Equipe</b> por
          <i> nome / apelido / matrícula</i> (com tolerância a pequenos erros).
        </p>
      </div>

      {/* Lançamento Manual */}
      <form onSubmit={salvarManual} className="mt-6 p-4 rounded-xl border bg-white">
        <h2 className="font-semibold mb-3">Lançamento manual</h2>
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <label className="label">Data *</label>
            <input type="date" name="dataISO" value={form.dataISO} onChange={onChange} className="input" required />
          </div>
          <div>
            <label className="label">Filetador *</label>
            <select name="filetadorId" className="input" value={form.filetadorId} onChange={onChange} required>
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
            <input type="number" step="0.01" name="peixeSemEscamaKg" value={form.peixeSemEscamaKg} onChange={onChange} className="input" />
          </div>
          <div>
            <label className="label">Filé produzido (kg)</label>
            <input type="number" step="0.01" name="fileProduzidoKg" value={form.fileProduzidoKg} onChange={onChange} className="input" />
          </div>
          <div>
            <label className="label">Correção (kg)</label>
            <input type="number" step="0.01" name="correcaoKg" value={form.correcaoKg} onChange={onChange} className="input" />
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
