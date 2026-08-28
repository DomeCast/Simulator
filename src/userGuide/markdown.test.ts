import { describe, expect, it } from 'vitest'
import { renderGuideMarkdown } from './markdown'

describe('guide markdown', () => {
  it('renders headings, emphasis, code, and GitHub-bound README links', () => {
    const html = renderGuideMarkdown(
      '# Title\n\nSee the [README](README.md) and use `0` for **floor** seating.\n',
    )

    expect(html).toContain('<h1>Title</h1>')
    expect(html).toContain('<code>0</code>')
    expect(html).toContain('<strong>floor</strong>')
    expect(html).toContain(
      'href="https://github.com/DomeCast/Simulator/blob/main/README.md"',
    )
    expect(html).toContain('target="_blank"')
  })

  it('renders the ray colour table', () => {
    const html = renderGuideMarkdown(
      '| Colour | Meaning |\n| --- | --- |\n| Teal | **Valid path** |\n',
    )

    expect(html).toContain('<th>Colour</th>')
    expect(html).toContain('<td>Teal</td>')
    expect(html).toContain('<strong>Valid path</strong>')
  })

  it('nests indented bullets under a numbered step', () => {
    const html = renderGuideMarkdown(
      '1. Choose image:\n   - Square (**1:1**)\n   - Wide (**2:1**)\n2. Leave preview on.\n',
    )

    expect(html).toContain('<ol>')
    expect(html).toContain('<ul>')
    expect(html).toContain('<strong>1:1</strong>')
    expect(html).toContain('Leave preview on.')
  })
})
