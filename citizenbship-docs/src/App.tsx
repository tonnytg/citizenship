import React, { useMemo, useRef, useState } from "react";

// --- Types
type UploadedDoc = {
  id: string;
  file: File;
  inferredType: DocType | "unknown";
};

type Applicant = {
  fullName: string;
  email: string;
  phone?: string;
  country: string;
  city: string;
};

type LineageInfo = {
  italianAncestorName: string;
  italianAncestorBirthYear?: string;
  italianAncestorBirthPlace?: string;
  relationshipToYou:
    | "bisavô/avó"
    | "trisavô/avó"
    | "tataravô/avó"
    | "outro"
    | "avô/avó";
  anyFemaleBefore1948: boolean;
  anyNaturalizationInLine: boolean;
  naturalizedBeforeChildBirth: boolean;
};

type DocType =
  | "certidao_nascimento"
  | "certidao_casamento"
  | "certidao_obito"
  | "certidao_naturalizacao"
  | "certidao_negativa_naturalizacao"
  | "passaporte"
  | "rg_cnh"
  | "comprovante_endereco"
  | "apostila_haya"
  | "traducao_juramentada";

// --- Helpers
const isImage = (name: string) => /\.(png|jpe?g|webp|gif)$/i.test(name);
const isPDF = (name: string) => /\.(pdf)$/i.test(name);
const uid = () => Math.random().toString(36).slice(2);

const guessDocType = (name: string): UploadedDoc["inferredType"] => {
  const n = name.toLowerCase();
  if (n.includes("nascimento")) return "certidao_nascimento";
  if (n.includes("casamento")) return "certidao_casamento";
  if (n.includes("óbito") || n.includes("obito")) return "certidao_obito";
  if (n.includes("naturaliza")) return "certidao_naturalizacao";
  if (n.includes("negativa") && n.includes("naturaliza"))
    return "certidao_negativa_naturalizacao";
  if (n.includes("passaporte")) return "passaporte";
  if (n.includes("rg") || n.includes("cnh") || n.includes("identidade"))
    return "rg_cnh";
  if (n.includes("endereco") || n.includes("endereço"))
    return "comprovante_endereco";
  if (n.includes("apostila") || n.includes("haia") || n.includes("haya"))
    return "apostila_haya";
  if (n.includes("tradu")) return "traducao_juramentada";
  return "unknown";
};

// Simple, client‑side quality scoring heuristic (0–100)
function scoreQuality(
  lineage: LineageInfo,
  docs: UploadedDoc[],
  applicant: Applicant
) {
  let score = 0;

  // Base info completeness
  if (applicant.fullName) score += 5;
  if (applicant.email) score += 5;
  if (applicant.country) score += 3;
  if (applicant.city) score += 3;

  // Lineage essentials
  if (lineage.italianAncestorName) score += 10;
  if (lineage.italianAncestorBirthYear) score += 6;
  if (lineage.relationshipToYou) score += 6;

  // Document presence boosts
  const types = new Set(docs.map((d) => d.inferredType));
  if (types.has("certidao_nascimento")) score += 10;
  if (types.has("certidao_casamento")) score += 8;
  if (types.has("certidao_obito")) score += 6;
  if (
    types.has("certidao_negativa_naturalizacao") ||
    types.has("certidao_naturalizacao")
  )
    score += 12;
  if (types.has("apostila_haya")) score += 8;
  if (types.has("traducao_juramentada")) score += 6;

  // Risk adjustments
  if (lineage.anyNaturalizationInLine) score -= 8;
  if (lineage.naturalizedBeforeChildBirth) score -= 25; // critical blocker
  if (lineage.anyFemaleBefore1948) score -= 8; // not impossible, but judicial route flag

  // File format sanity
  const pdfOrImg = docs.every(
    (d) => isPDF(d.file.name) || isImage(d.file.name)
  );
  score += pdfOrImg ? 6 : 0;

  // Clamp
  score = Math.max(0, Math.min(100, score));

  // Label
  const label =
    score >= 80
      ? "Excelente — Alta probabilidade de viabilidade"
      : score >= 60
      ? "Boa — Viável com possíveis ajustes"
      : score >= 40
      ? "Regular — Documentos/linhagem incompletos"
      : "Baixa — Falhas críticas a resolver";

  // Key flags
  const flags: string[] = [];
  if (!types.has("certidao_nascimento"))
    flags.push("Falta certidão de nascimento (linhagem)");
  if (!types.has("certidao_casamento"))
    flags.push("Falta certidão de casamento em alguma geração");
  if (
    !types.has("certidao_negativa_naturalizacao") &&
    !types.has("certidao_naturalizacao")
  )
    flags.push("Falta prova de (não) naturalização do Avo Italiano");
  if (lineage.naturalizedBeforeChildBirth)
    flags.push("Naturalização antes do nascimento do descendente — impeditivo");
  if (lineage.anyFemaleBefore1948)
    flags.push("Linha materna pré‑1948 — via judicial");

  return { score, label, flags };
}

// --- UI
export default function App() {
  const [applicant, setApplicant] = useState<Applicant>({
    fullName: "",
    email: "",
    phone: "",
    country: "Brasil",
    city: "",
  });

  const [lineage, setLineage] = useState<LineageInfo>({
    italianAncestorName: "",
    italianAncestorBirthYear: "",
    italianAncestorBirthPlace: "",
    relationshipToYou: "bisavô/avó",
    anyFemaleBefore1948: false,
    anyNaturalizationInLine: false,
    naturalizedBeforeChildBirth: false,
  });

  const [docs, setDocs] = useState<UploadedDoc[]>([]);
  const [accepted, setAccepted] = useState(false);
  const fileInput = useRef<HTMLInputElement | null>(null);

  const { score, label, flags } = useMemo(
    () => scoreQuality(lineage, docs, applicant),
    [lineage, docs, applicant]
  );

  const onFilePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const list = Array.from(files).map((f) => ({
      id: uid(),
      file: f,
      inferredType: guessDocType(f.name),
    }));
    setDocs((prev) => [...prev, ...list]);
    if (fileInput.current) fileInput.current.value = "";
  };

  const removeDoc = (id: string) =>
    setDocs((prev) => prev.filter((d) => d.id !== id));

  // Export a local JSON summary for sending later by email/whatsapp/back‑office
  const downloadSummary = () => {
    const payload = {
      applicant,
      lineage,
      docs: docs.map((d) => ({
        name: d.file.name,
        size: d.file.size,
        inferredType: d.inferredType,
      })),
      score,
      label,
      flags,
      createdAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `italian-citizenship-check-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const progressColor = useMemo(() => {
    if (score >= 80) return "bg-green-500";
    if (score >= 60) return "bg-emerald-500";
    if (score >= 40) return "bg-amber-500";
    return "bg-red-500";
  }, [score]);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 dark:bg-gray-950 dark:text-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-30 backdrop-blur supports-[backdrop-filter]:bg-white/60 dark:supports-[backdrop-filter]:bg-gray-900/60 border-b border-gray-200/70 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-2xl bg-gradient-to-tr from-sky-500 to-blue-600" />
            <span className="font-semibold tracking-tight">
              Cittadinanza Check
            </span>
          </div>
          <nav className="hidden sm:flex gap-6 text-sm opacity-80">
            <a href="#como-funciona" className="hover:opacity-100">
              Como funciona
            </a>
            <a href="#requisitos" className="hover:opacity-100">
              Requisitos
            </a>
            <a href="#avaliacao" className="hover:opacity-100">
              Avaliação
            </a>
          </nav>
          <a
            href="#form"
            className="inline-flex items-center rounded-xl border border-gray-300/70 dark:border-gray-700 px-3 py-1.5 text-sm hover:bg-gray-100 dark:hover:bg-gray-800"
          >
            Começar
          </a>
        </div>
      </header>

      {/* Hero */}
      <section className="relative isolate overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 py-16 md:py-24 grid md:grid-cols-2 gap-10 items-center">
          <div>
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight tracking-tight">
              Avalie sua{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-sky-500 to-blue-600">
                Cidadania Italiana
              </span>
            </h1>
            <p className="mt-4 text-base md:text-lg opacity-90">
              Envie seus documentos básicos e receba uma pré‑análise automática
              da qualidade do seu dossiê. Sem subir para o servidor — os
              arquivos ficam no seu navegador.
            </p>
            <div className="mt-6 flex gap-3">
              <a
                href="#form"
                className="inline-flex items-center rounded-2xl bg-blue-600 px-5 py-3 text-white font-medium shadow hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                Iniciar avaliação
              </a>
              <a
                href="#requisitos"
                className="inline-flex items-center rounded-2xl border border-gray-300 dark:border-gray-700 px-5 py-3 font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Ver requisitos
              </a>
            </div>
            <p className="mt-3 text-xs opacity-70">
              * Ferramenta educativa. A aprovação final depende da análise
              oficial.
            </p>
          </div>
          <div className="relative">
            <div className="rounded-3xl border border-gray-200 dark:border-gray-800 bg-white/70 dark:bg-gray-900/70 p-4 shadow-sm">
              <div className="rounded-2xl p-4 border border-gray-200 dark:border-gray-800">
                <p className="text-sm opacity-80">Qualidade atual</p>
                <div className="mt-2 h-3 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                  <div
                    className={`h-3 rounded-full ${progressColor}`}
                    style={{ width: `${score}%` }}
                  />
                </div>
                <div className="mt-2 text-sm font-medium">
                  {label} ({score}/100)
                </div>
                {flags.length > 0 && (
                  <ul className="mt-3 text-xs list-disc list-inside space-y-1 opacity-80">
                    {flags.slice(0, 4).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                    {flags.length > 4 && (
                      <li>…e mais {flags.length - 4} pontos</li>
                    )}
                  </ul>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="como-funciona" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Como funciona
        </h2>
        <div className="mt-6 grid md:grid-cols-3 gap-4">
          {[
            {
              title: "Preencha seus dados",
              desc: "Conte quem é o antepassado italiano e como ele se conecta a você.",
            },
            {
              title: "Anexe documentos",
              desc: "PDF/JPG/PNG: certidões, negativa/positiva de naturalização, apostilas e traduções.",
            },
            {
              title: "Receba uma pré‑análise",
              desc: "Geramos uma pontuação e alertas — você pode baixar um resumo JSON.",
            },
          ].map((step, i) => (
            <div
              key={i}
              className="rounded-2xl border border-gray-200 dark:border-gray-800 p-4"
            >
              <div className="text-3xl font-black opacity-40">{i + 1}</div>
              <div className="mt-2 font-semibold">{step.title}</div>
              <div className="text-sm opacity-80">{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Requirements */}
      <section id="requisitos" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Checklist essencial
        </h2>
        <div className="mt-6 grid md:grid-cols-2 gap-6">
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="font-semibold">Documentos por geração</h3>
            <ul className="mt-3 text-sm list-disc list-inside space-y-2 opacity-90">
              <li>
                Certidões de <b>nascimento</b>, <b>casamento</b> e (se
                aplicável) <b>óbito</b>
              </li>
              <li>
                Certidão <b>negativa/positiva</b> de naturalização do ascendente
                italiano
              </li>
              <li>
                <b>Apostila de Haia</b> e <b>tradução juramentada</b> quando
                exigido
              </li>
              <li>Documentos de identificação e comprovante de endereço</li>
            </ul>
          </div>
          <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
            <h3 className="font-semibold">Atenções comuns</h3>
            <ul className="mt-3 text-sm list-disc list-inside space-y-2 opacity-90">
              <li>Nomes e datas divergentes entre certidões</li>
              <li>
                Linha <b>materna antes de 1948</b> → geralmente via judicial
              </li>
              <li>
                Naturalização do italiano <b>antes</b> do nascimento do
                descendente direto
              </li>
              <li>Legibilidade: prefira PDFs e imagens nítidas</li>
            </ul>
          </div>
        </div>
      </section>

      {/* Form + Evaluator */}
      <section id="form" className="mx-auto max-w-7xl px-4 py-12">
        <h2 className="text-xl md:text-2xl font-bold tracking-tight">
          Envie seus dados e documentos
        </h2>

        <div className="mt-6 grid lg:grid-cols-3 gap-6">
          {/* Left: applicant + lineage */}
          <div className="lg:col-span-2 space-y-6">
            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold">Seus dados</h3>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm opacity-80">Nome completo</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={applicant.fullName}
                    onChange={(e) =>
                      setApplicant({ ...applicant, fullName: e.target.value })
                    }
                    placeholder="Seu nome"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">E‑mail</label>
                  <input
                    type="email"
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={applicant.email}
                    onChange={(e) =>
                      setApplicant({ ...applicant, email: e.target.value })
                    }
                    placeholder="voce@email.com"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">
                    Telefone (opcional)
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={applicant.phone || ""}
                    onChange={(e) =>
                      setApplicant({ ...applicant, phone: e.target.value })
                    }
                    placeholder="(00) 00000‑0000"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">Cidade</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={applicant.city}
                    onChange={(e) =>
                      setApplicant({ ...applicant, city: e.target.value })
                    }
                    placeholder="São Paulo"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">País</label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={applicant.country}
                    onChange={(e) =>
                      setApplicant({ ...applicant, country: e.target.value })
                    }
                    placeholder="Brasil"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold">Linhagem</h3>
              <div className="mt-4 grid sm:grid-cols-2 gap-4">
                <div className="sm:col-span-2">
                  <label className="text-sm opacity-80">
                    Nome do ascendente italiano
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={lineage.italianAncestorName}
                    onChange={(e) =>
                      setLineage({
                        ...lineage,
                        italianAncestorName: e.target.value,
                      })
                    }
                    placeholder="Giuseppe Rossi"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">
                    Ano de nascimento (aprox.)
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={lineage.italianAncestorBirthYear}
                    onChange={(e) =>
                      setLineage({
                        ...lineage,
                        italianAncestorBirthYear: e.target.value,
                      })
                    }
                    placeholder="1895"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">
                    Local de nascimento
                  </label>
                  <input
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={lineage.italianAncestorBirthPlace}
                    onChange={(e) =>
                      setLineage({
                        ...lineage,
                        italianAncestorBirthPlace: e.target.value,
                      })
                    }
                    placeholder="Campania, IT"
                  />
                </div>
                <div>
                  <label className="text-sm opacity-80">
                    Parentesco com você
                  </label>
                  <select
                    className="mt-1 w-full rounded-xl border border-gray-300/70 dark:border-gray-700 bg-white/80 dark:bg-gray-900 px-3 py-2 outline-none focus:ring-2 focus:ring-blue-400"
                    value={lineage.relationshipToYou}
                    onChange={(e) =>
                      setLineage({
                        ...lineage,
                        relationshipToYou: e.target
                          .value as LineageInfo["relationshipToYou"],
                      })
                    }
                  >
                    <option value="avô/avó">Avô/Avó</option>
                    <option value="bisavô/avó">Bisavô/Bisavó</option>
                    <option value="trisavô/avó">Trisavô/Trisavó</option>
                    <option value="tataravô/avó">Tataravô/Tataravó</option>
                    <option value="outro">Outro</option>
                  </select>
                </div>
                <div className="sm:col-span-2 grid sm:grid-cols-2 gap-3 mt-2">
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-gray-300 dark:border-gray-700"
                      checked={lineage.anyFemaleBefore1948}
                      onChange={(e) =>
                        setLineage({
                          ...lineage,
                          anyFemaleBefore1948: e.target.checked,
                        })
                      }
                    />
                    Linha materna com mulher que deu à luz{" "}
                    <b>antes de 01/01/1948</b>
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-gray-300 dark:border-gray-700"
                      checked={lineage.anyNaturalizationInLine}
                      onChange={(e) =>
                        setLineage({
                          ...lineage,
                          anyNaturalizationInLine: e.target.checked,
                        })
                      }
                    />
                    Há naturalização em alguma geração
                  </label>
                  <label className="flex items-start gap-3 text-sm">
                    <input
                      type="checkbox"
                      className="mt-1 size-4 rounded border-gray-300 dark:border-gray-700"
                      checked={lineage.naturalizedBeforeChildBirth}
                      onChange={(e) =>
                        setLineage({
                          ...lineage,
                          naturalizedBeforeChildBirth: e.target.checked,
                        })
                      }
                    />
                    Naturalização ocorreu <b>antes</b> do nascimento do
                    descendente direto
                  </label>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold">
                Documentos (não saem do seu navegador)
              </h3>
              <div className="mt-3">
                <input
                  ref={fileInput}
                  type="file"
                  multiple
                  accept=".pdf,.png,.jpg,.jpeg,.webp,.gif"
                  onChange={onFilePick}
                  className="block w-full text-sm file:mr-3 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-white hover:file:bg-blue-700"
                />
                <p className="mt-2 text-xs opacity-70">
                  PDF, JPG, PNG — nome do arquivo ajuda a classificar (ex.:
                  "nascimento_pedro.pdf").
                </p>
              </div>

              {docs.length > 0 && (
                <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="rounded-xl border border-gray-200 dark:border-gray-800 p-3"
                    >
                      <div
                        className="text-xs opacity-70 truncate"
                        title={d.file.name}
                      >
                        {d.file.name}
                      </div>
                      <div className="mt-1 text-xs">
                        Tipo: <b>{d.inferredType}</b>
                      </div>
                      <div className="mt-2 flex items-center justify-between">
                        <span className="text-[10px] opacity-60">
                          {(d.file.size / 1024).toFixed(1)} KB
                        </span>
                        <button
                          onClick={() => removeDoc(d.id)}
                          className="text-xs underline underline-offset-2 opacity-80 hover:opacity-100"
                        >
                          remover
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Right: evaluator card */}
          <aside id="avaliacao" className="lg:col-span-1">
            <div className="sticky top-24 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold">Pré‑análise</h3>
              <div className="mt-3 h-2 w-full rounded-full bg-gray-200 dark:bg-gray-800">
                <div
                  className={`h-2 rounded-full ${progressColor}`}
                  style={{ width: `${score}%` }}
                />
              </div>
              <div className="mt-2 text-sm font-medium">{label}</div>
              <ul className="mt-3 text-xs list-disc list-inside space-y-1 opacity-90">
                {flags.length === 0 ? (
                  <li>Nenhum alerta crítico até o momento.</li>
                ) : (
                  flags.map((f, i) => <li key={i}>{f}</li>)
                )}
              </ul>

              <div className="mt-4 flex items-start gap-2">
                <input
                  type="checkbox"
                  className="mt-1 size-4 rounded border-gray-300 dark:border-gray-700"
                  checked={accepted}
                  onChange={(e) => setAccepted(e.target.checked)}
                />
                <p className="text-xs opacity-80">
                  Concordo que esta é uma ferramenta educativa e que a análise
                  não substitui consultoria jurídica/profissional.
                </p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  onClick={downloadSummary}
                  className="rounded-xl bg-blue-600 px-4 py-2 text-sm text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  Baixar resumo JSON
                </button>
                <button
                  onClick={() => {
                    if (!accepted) {
                      alert("Marque a concordância para prosseguir.");
                      return;
                    }
                    // In a real app, here we'd submit to a backend
                    alert(
                      "Resumo gerado localmente. Envie o JSON para análise completa por um especialista."
                    );
                  }}
                  className="rounded-xl border border-gray-300 dark:border-gray-700 px-4 py-2 text-sm font-medium hover:bg-gray-100 dark:hover:bg-gray-800"
                >
                  Solicitar contato
                </button>
              </div>
              <p className="mt-2 text-[11px] opacity-70">
                Dica: use nomes de arquivo claros para ajudar na classificação
                automática.
              </p>
            </div>
          </aside>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800">
        <div className="mx-auto max-w-7xl px-4 py-8 text-xs opacity-70 flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Cittadinanza Check. Uso educativo.</p>
          <p>
            Feito com React + TypeScript + Tailwind. Nenhum arquivo é enviado
            sem sua ação.
          </p>
        </div>
      </footer>
    </div>
  );
}
