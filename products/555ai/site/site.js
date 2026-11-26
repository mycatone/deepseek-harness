const tabs = [...document.querySelectorAll('[role="tab"]')]
function activate(tab) {
  for (const item of tabs) {
    const selected = item === tab
    item.setAttribute('aria-selected', String(selected))
    item.tabIndex = selected ? 0 : -1
    document.getElementById(item.getAttribute('aria-controls')).hidden = !selected
  }
}
for (const tab of tabs) {
  tab.addEventListener('click', () => activate(tab))
  tab.addEventListener('keydown', event => {
    const index = tabs.indexOf(tab)
    const offset = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key]
    let target
    if (offset !== undefined) target = tabs[(index + offset + tabs.length) % tabs.length]
    if (event.key === 'Home') target = tabs[0]
    if (event.key === 'End') target = tabs.at(-1)
    if (!target) return
    event.preventDefault()
    activate(target)
    target.focus()
  })
}
document.getElementById('copy-checksum').addEventListener('click', async () => {
  const status = document.getElementById('copy-status')
  try {
    await navigator.clipboard.writeText(document.getElementById('checksum').textContent)
    status.textContent = '校验值已复制'
  } catch (error) {
    // Clipboard may be unavailable on HTTP previews or managed devices; the text remains selectable.
    status.textContent = '无法访问剪贴板，请选中上方校验值复制，或下载校验文件'
  }
})
