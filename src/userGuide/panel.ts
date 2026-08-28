import userGuideMarkdown from '../../USER_GUIDE.md?raw'
import { renderGuideMarkdown } from './markdown'

const GUIDE_ARTICLE_HTML = renderGuideMarkdown(userGuideMarkdown)

const POPOUT_STYLES = `
  :root { color-scheme: dark; }
  html, body {
    margin: 0;
    min-height: 100%;
    background: #05080d;
    color: #dbe7f3;
    font-family: Manrope, sans-serif;
  }
  body { padding: 28px 32px 48px; }
  .eyebrow {
    margin: 0 0 6px;
    color: #718397;
    font: 500 10px/1.2 "DM Mono", monospace;
    letter-spacing: 0.17em;
    text-transform: uppercase;
  }
  h1 { margin: 0 0 18px; font-size: 28px; letter-spacing: -0.03em; }
  h2 { margin: 28px 0 10px; font-size: 18px; color: #e7f0f8; }
  h3 { margin: 18px 0 8px; font-size: 14px; color: #b6c6d5; }
  p, li { color: #b6c6d5; line-height: 1.55; }
  p { margin: 0 0 12px; }
  ul, ol { margin: 0 0 14px; padding-left: 1.3em; }
  li { margin: 0 0 6px; }
  li p { margin: 0; }
  li ul { margin: 8px 0 0; }
  code {
    padding: 0.1em 0.35em;
    border-radius: 4px;
    color: #70e6cd;
    background: #131e2a;
    font-family: "DM Mono", monospace;
    font-size: 0.92em;
  }
  a { color: #58e6c2; }
  table { width: 100%; border-collapse: collapse; margin: 0 0 16px; font-size: 14px; }
  th, td {
    padding: 8px 10px;
    border-bottom: 1px solid rgba(148, 177, 204, 0.14);
    text-align: left;
    vertical-align: top;
  }
  th { color: #8fa2b5; font: 600 10px/1.2 "DM Mono", monospace; letter-spacing: 0.08em; text-transform: uppercase; }
`

function popoutDocument(): string {
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>DomeCast Simulator — First-time guide</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet" />
    <style>${POPOUT_STYLES}</style>
  </head>
  <body>
    <p class="eyebrow">DomeCast Simulator</p>
    <article class="guide-article">${GUIDE_ARTICLE_HTML}</article>
  </body>
</html>`
}

export function mountUserGuide(dialog: HTMLDialogElement): void {
  const body = dialog.querySelector<HTMLElement>('#guide-body')!
  const closeButton = dialog.querySelector<HTMLButtonElement>('#guide-close')!
  const popoutButton = dialog.querySelector<HTMLButtonElement>('#guide-popout')!
  body.innerHTML = GUIDE_ARTICLE_HTML

  const close = () => {
    if (dialog.open) dialog.close()
  }

  closeButton.addEventListener('click', close)
  popoutButton.addEventListener('click', () => {
    const popup = window.open('', 'domecast-user-guide', 'width=760,height=900,menubar=no,toolbar=no')
    if (!popup) return
    popup.document.open()
    popup.document.write(popoutDocument())
    popup.document.close()
    close()
  })

  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close()
  })
}

export function openUserGuide(dialog: HTMLDialogElement): void {
  if (!dialog.open) dialog.showModal()
}
