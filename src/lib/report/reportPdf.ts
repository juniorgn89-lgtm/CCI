/**
 * Gerador de PDF de RESUMO (1+ páginas A4) a partir de um payload estruturado.
 * Determinístico e client-side — os números vêm prontos da tela (não reprocessa),
 * então o PDF bate com o que o usuário vê. Este módulo (com o `jsPDF`) só é baixado
 * quando alguém clica em "Compartilhar" (import dinâmico no ShareReportButton).
 *
 * Todo texto é MEDIDO antes de ser desenhado: rótulo, valor e linha secundária
 * quebram em quantas linhas precisarem e o cursor avança pela altura real.
 * Nada se sobrepõe, nada é cortado na margem.
 */
import type { Tone, ReportPayload, ReportRow } from '@/lib/report/reportTypes'

/* ─── Paleta (design system) ─── */
const C = {
  navy: [30, 58, 95] as const,
  pos: [22, 163, 74] as const,
  neg: [220, 38, 38] as const,
  gray: [107, 114, 128] as const,
  border: [229, 231, 235] as const,
  dark: [17, 24, 39] as const,
  body: [55, 65, 81] as const,
  light: [249, 250, 251] as const,
  white: [255, 255, 255] as const,
  slate: [203, 213, 225] as const,
}
const toneColor = (t?: Tone) => (t === 'pos' ? C.pos : t === 'neg' ? C.neg : C.dark)

/**
 * As fontes padrão do PDF (Helvetica) só têm o alfabeto latino básico: sinal de
 * menos tipográfico, setas e letras gregas saem como lixo. Troca pelo equivalente
 * ASCII antes de desenhar.
 */
const limpar = (s: string) =>
  (s ?? '')
    .replace(/−/g, '-')
    .replace(/→/g, '->')
    .replace(/Δ/g, 'Var. ')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/≈/g, '~')
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/•/g, '-')
    .replace(/\s+/g, ' ')
    .trim()

/** "R$ 94.889.805 (antes R$ 79.121.100)" → valor principal + linha "antes …". */
const partirKpi = (value: string): { principal: string; antes: string | null } => {
  const m = value.match(/^(.*?)\s*\((antes .+)\)\s*$/)
  return m ? { principal: m[1], antes: m[2] } : { principal: value, antes: null }
}

/**
 * Monta o PDF e devolve um Blob. `geradoEm` entra formatado (a lib não chama
 * `new Date()` — o chamador controla o formato pt-BR).
 */
export async function buildReportPdf(payload: ReportPayload, geradoEm: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  const CW = W - 2 * M
  const brand = payload.brand ?? 'Visor360'

  const color = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2])
  const draw = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2])
  const font = (style: 'normal' | 'bold' | 'italic', size: number) => { doc.setFont('helvetica', style); doc.setFontSize(size) }
  const linhas = (texto: string, largura: number): string[] => doc.splitTextToSize(limpar(texto), Math.max(40, largura)) as string[]
  /** Reduz a fonte até o texto caber numa linha (sem passar do mínimo). */
  const caber = (texto: string, largura: number, max: number, min: number, style: 'normal' | 'bold') => {
    let size = max
    for (; size > min; size -= 1) { font(style, size); if (doc.getTextWidth(limpar(texto)) <= largura) break }
    font(style, size)
    return size
  }

  /* Header band — título quebra em até 2 linhas e a faixa cresce junto. */
  font('bold', 20)
  let tituloSize = 20
  let tituloLinhas = linhas(payload.title, CW - 130)
  if (tituloLinhas.length > 1) { tituloSize = caber(payload.title, CW - 130, 20, 15, 'bold'); tituloLinhas = linhas(payload.title, CW - 130) }
  tituloLinhas = tituloLinhas.slice(0, 2)
  font('normal', 10)
  const subLinhas = payload.subtitle ? linhas(payload.subtitle, CW).slice(0, 2) : []
  const tituloH = tituloLinhas.length * (tituloSize + 4)
  const headerH = 44 + tituloH + (subLinhas.length ? subLinhas.length * 13 + 4 : 0) + 14
  fill(C.navy)
  doc.rect(0, 0, W, headerH, 'F')
  color(C.white)
  font('bold', 9)
  doc.text(brand.toUpperCase(), M, 30)
  font('bold', tituloSize)
  let yy = 52 + tituloSize * 0.2
  tituloLinhas.forEach((l) => { doc.text(l, M, yy); yy += tituloSize + 4 })
  if (subLinhas.length) {
    font('normal', 10)
    color(C.slate)
    yy += 4
    subLinhas.forEach((l) => { doc.text(l, M, yy); yy += 13 })
  }
  font('normal', 9)
  color(C.slate)
  doc.text(`Gerado em ${geradoEm}`, W - M, 30, { align: 'right' })

  let y = headerH + 24

  /* KPIs (linha de caixas; o valor encolhe até caber e o "antes" vai pra linha de baixo) */
  if (payload.kpis.length) {
    const n = payload.kpis.length
    const gap = 10
    const boxW = (CW - gap * (n - 1)) / n
    const inner = boxW - 20
    const temAntes = payload.kpis.some((k) => partirKpi(k.value).antes)
    const boxH = temAntes ? 68 : 58
    payload.kpis.forEach((k, i) => {
      const x = M + i * (boxW + gap)
      const { principal, antes } = partirKpi(k.value)
      draw(C.border)
      fill(C.light)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, y, boxW, boxH, 5, 5, 'FD')
      color(C.gray)
      font('normal', 8)
      doc.text(linhas(k.label.toUpperCase(), inner)[0] ?? '', x + 10, y + 17)
      color(toneColor(k.tone))
      caber(principal, inner, 15, 9, 'bold')
      doc.text(limpar(principal), x + 10, y + 40)
      if (antes) {
        color(C.gray)
        caber(antes, inner, 8, 6, 'normal')
        doc.text(limpar(antes), x + 10, y + 56)
      }
    })
    y += boxH + 22
  }

  /* Seções */
  const footerH = 42
  const ensure = (need: number) => {
    if (y + need > H - footerH) {
      doc.addPage()
      y = M + 8
    }
  }
  const rule = (yy2: number) => {
    draw(C.border)
    doc.setLineWidth(0.5)
    doc.line(M, yy2, W - M, yy2)
  }

  const LH = 12.5 // altura de linha do corpo (10pt)
  const LHS = 10 // altura de linha do sub (8pt)

  /** Mede e desenha uma linha de seção; devolve a altura usada. */
  const desenharLinha = (r: ReportRow) => {
    const valor = limpar(r.value)
    font('bold', 10)
    const valW = valor ? doc.getTextWidth(valor) : 0
    // Valor curto fica à direita na primeira linha; valor longo (mais de 45% da
    // largura) desce pra uma linha própria, pra nunca invadir o rótulo.
    const valorEmLinha = valor && valW <= CW * 0.45
    const labelW = valorEmLinha ? CW - valW - 14 : CW
    font(r.strong ? 'bold' : 'normal', 10)
    const ls = linhas(r.label, labelW)
    font('normal', 8)
    const ss = r.sub ? linhas(r.sub, CW) : []
    const alturaLabel = ls.length * LH
    const alturaValor = valor && !valorEmLinha ? LH : 0
    const alturaSub = ss.length ? ss.length * LHS + 2 : 0
    const total = alturaLabel + alturaValor + alturaSub + 6
    ensure(Math.min(total, 120)) // bloco gigante quebra no meio em vez de deixar a página vazia

    let cy = y
    color(r.strong ? C.dark : C.body)
    font(r.strong ? 'bold' : 'normal', 10)
    ls.forEach((l, i) => {
      if (i > 0 && cy + LH > H - footerH) { doc.addPage(); cy = M + 8 }
      doc.text(l, M, cy)
      if (i === 0 && valorEmLinha) { color(C.dark); font('bold', 10); doc.text(valor, W - M, cy, { align: 'right' }); color(r.strong ? C.dark : C.body); font(r.strong ? 'bold' : 'normal', 10) }
      cy += LH
    })
    if (valor && !valorEmLinha) {
      if (cy + LH > H - footerH) { doc.addPage(); cy = M + 8 }
      color(C.dark); font('bold', 10)
      doc.text(valor, M, cy)
      cy += LH
    }
    if (ss.length) {
      color(C.gray); font('normal', 8)
      ss.forEach((l) => {
        if (cy + LHS > H - footerH) { doc.addPage(); cy = M + 8 }
        doc.text(l, M, cy)
        cy += LHS
      })
      cy += 2
    }
    y = cy + 6
  }

  payload.sections.forEach((sec) => {
    ensure(100) // título + primeira linha juntos: nada de título órfão no pé da página
    color(C.navy)
    font('bold', 11)
    doc.text(limpar(sec.title), M, y)
    y += 6
    rule(y)
    y += 16
    sec.rows.forEach(desenharLinha)
    if (sec.note) {
      font('italic', 8)
      const ns = linhas(sec.note, CW)
      ensure(ns.length * LHS + 4)
      color(C.gray)
      ns.forEach((l) => { doc.text(l, M, y); y += LHS })
      y += 4
    }
    y += 10
  })

  /* Rodapé em todas as páginas */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    rule(H - footerH + 8)
    color(C.gray)
    font('normal', 8)
    if (payload.footnote) {
      const fs = linhas(payload.footnote, CW - 60).slice(0, 2)
      fs.forEach((l, i) => doc.text(l, M, H - footerH + 22 + i * LHS))
    }
    doc.text(`${p}/${pages}`, W - M, H - footerH + 22, { align: 'right' })
  }

  return doc.output('blob')
}
