const GITHUB_README = 'https://github.com/DomeCast/Simulator/blob/main/README.md'

export function escapeGuideHtml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function rewriteHref(href: string): string {
  if (href === 'README.md') return GITHUB_README
  return href
}

function inline(text: string): string {
  const escaped = escapeGuideHtml(text)
  return escaped
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_match, label: string, href: string) => {
      const url = rewriteHref(href)
      const safeUrl = escapeGuideHtml(url)
      const extra = url.startsWith('https://') || url.startsWith('http://')
        ? ' target="_blank" rel="noopener noreferrer"'
        : ''
      return `<a href="${safeUrl}"${extra}>${label}</a>`
    })
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
}

function isTableSeparator(line: string): boolean {
  return /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)
}

function splitRow(line: string): string[] {
  return line
    .trim()
    .replace(/^\|/, '')
    .replace(/\|$/, '')
    .split('|')
    .map((cell) => cell.trim())
}

function renderTable(rows: string[]): string {
  const [headerLine, , ...bodyLines] = rows
  const headers = splitRow(headerLine)
    .map((cell) => `<th>${inline(cell)}</th>`)
    .join('')
  const body = bodyLines
    .map((line) => {
      const cells = splitRow(line).map((cell) => `<td>${inline(cell)}</td>`)
      return `<tr>${cells.join('')}</tr>`
    })
    .join('')
  return `<table><thead><tr>${headers}</tr></thead><tbody>${body}</tbody></table>`
}

function listKind(line: string): 'ol' | 'ul' | null {
  if (/^\d+\.\s/.test(line)) return 'ol'
  if (/^-\s/.test(line)) return 'ul'
  return null
}

function listItemText(line: string): string {
  return line.replace(/^\d+\.\s/, '').replace(/^-\s/, '')
}

function renderList(lines: string[], start: number): { html: string; next: number } {
  const kind = listKind(lines[start])
  if (!kind) return { html: '', next: start }

  const items: string[] = []
  let index = start
  while (index < lines.length && listKind(lines[index]) === kind) {
    let item = `<p>${inline(listItemText(lines[index]))}</p>`
    index += 1
    const nested: string[] = []
    while (index < lines.length && /^\s{2,}-\s/.test(lines[index])) {
      nested.push(lines[index].trim())
      index += 1
    }
    if (nested.length > 0) {
      item += `<ul>${nested.map((line) => `<li>${inline(listItemText(line))}</li>`).join('')}</ul>`
    }
    items.push(`<li>${item}</li>`)
  }

  return { html: `<${kind}>${items.join('')}</${kind}>`, next: index }
}

/** Renders the first-time guide markdown subset used by USER_GUIDE.md. */
export function renderGuideMarkdown(markdown: string): string {
  const lines = markdown.replaceAll('\r\n', '\n').split('\n')
  const html: string[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    if (line.trim() === '') {
      index += 1
      continue
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line)
    if (heading) {
      const level = heading[1].length
      html.push(`<h${level}>${inline(heading[2])}</h${level}>`)
      index += 1
      continue
    }

    if (line.includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1])) {
      const rows = [line, lines[index + 1]]
      index += 2
      while (index < lines.length && lines[index].includes('|')) {
        rows.push(lines[index])
        index += 1
      }
      html.push(renderTable(rows))
      continue
    }

    if (listKind(line)) {
      const list = renderList(lines, index)
      html.push(list.html)
      index = list.next
      continue
    }

    const paragraph = [line]
    index += 1
    while (
      index < lines.length
      && lines[index].trim() !== ''
      && !/^(#{1,3})\s+/.test(lines[index])
      && !listKind(lines[index])
      && !(lines[index].includes('|') && index + 1 < lines.length && isTableSeparator(lines[index + 1]))
    ) {
      paragraph.push(lines[index])
      index += 1
    }
    html.push(`<p>${inline(paragraph.join(' '))}</p>`)
  }

  return html.join('')
}
