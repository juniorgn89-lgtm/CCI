/**
 * Gerador de PDF de RESUMO (1+ páginas A4) a partir de um payload estruturado.
 * Determinístico e client-side — os números vêm prontos da tela (não reprocessa),
 * então o PDF bate com o que o usuário vê. Este módulo (com o `jsPDF`) só é baixado
 * quando alguém clica em "Compartilhar" (import dinâmico no ShareReportButton).
 */
import type { Tone, ReportPayload } from '@/lib/report/reportTypes'

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
 * Monta o PDF e devolve um Blob. `geradoEm` entra formatado (a lib não chama
 * `new Date()` — o chamador controla o formato pt-BR).
 */
export async function buildReportPdf(payload: ReportPayload, geradoEm: string): Promise<Blob> {
  const { jsPDF } = await import('jspdf')
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const W = doc.internal.pageSize.getWidth()
  const H = doc.internal.pageSize.getHeight()
  const M = 40
  const brand = payload.brand ?? 'Visor360'

  const color = (c: readonly number[]) => doc.setTextColor(c[0], c[1], c[2])
  const fill = (c: readonly number[]) => doc.setFillColor(c[0], c[1], c[2])
  const draw = (c: readonly number[]) => doc.setDrawColor(c[0], c[1], c[2])

  /* Header band */
  const headerH = 96
  fill(C.navy)
  doc.rect(0, 0, W, headerH, 'F')
  color(C.white)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(brand.toUpperCase(), M, 30)
  doc.setFontSize(20)
  doc.text(payload.title, M, 56)
  if (payload.subtitle) {
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    color(C.slate)
    doc.text(payload.subtitle, M, 74, { maxWidth: W - 2 * M })
  }
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  color(C.slate)
  doc.text(`Gerado em ${geradoEm}`, W - M, 30, { align: 'right' })

  let y = headerH + 24

  /* KPIs (linha de caixas) */
  if (payload.kpis.length) {
    const n = payload.kpis.length
    const gap = 10
    const boxW = (W - 2 * M - gap * (n - 1)) / n
    const boxH = 58
    payload.kpis.forEach((k, i) => {
      const x = M + i * (boxW + gap)
      draw(C.border)
      fill(C.light)
      doc.setLineWidth(0.5)
      doc.roundedRect(x, y, boxW, boxH, 5, 5, 'FD')
      color(C.gray)
      doc.setFont('helvetica', 'normal')
      doc.setFontSize(8)
      doc.text(k.label.toUpperCase(), x + 10, y + 18, { maxWidth: boxW - 20 })
      color(toneColor(k.tone))
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(15)
      doc.text(k.value, x + 10, y + 43, { maxWidth: boxW - 20 })
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
  const rule = (yy: number) => {
    draw(C.border)
    doc.setLineWidth(0.5)
    doc.line(M, yy, W - M, yy)
  }

  payload.sections.forEach((sec) => {
    ensure(46)
    color(C.navy)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(sec.title, M, y)
    y += 6
    rule(y)
    y += 15
    sec.rows.forEach((r) => {
      ensure(r.sub ? 26 : 20)
      doc.setFontSize(10)
      color(r.strong ? C.dark : C.body)
      doc.setFont('helvetica', r.strong ? 'bold' : 'normal')
      doc.text(r.label, M, y, { maxWidth: W - 2 * M - 150 })
      color(C.dark)
      doc.setFont('helvetica', 'bold')
      doc.text(r.value, W - M, y, { align: 'right' })
      if (r.sub) {
        color(C.gray)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(8)
        doc.text(r.sub, M, y + 11)
      }
      y += r.sub ? 25 : 19
    })
    if (sec.note) {
      ensure(16)
      color(C.gray)
      doc.setFont('helvetica', 'italic')
      doc.setFontSize(8)
      doc.text(sec.note, M, y, { maxWidth: W - 2 * M })
      y += 16
    }
    y += 12
  })

  /* Rodapé em todas as páginas */
  const pages = doc.getNumberOfPages()
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p)
    rule(H - footerH + 8)
    color(C.gray)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    if (payload.footnote) doc.text(payload.footnote, M, H - footerH + 22, { maxWidth: W - 2 * M - 60 })
    doc.text(`${p}/${pages}`, W - M, H - footerH + 22, { align: 'right' })
  }

  return doc.output('blob')
}
