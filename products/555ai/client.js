/** Independent product name and the dog mascot. */
window.__ModuleLoader__.load({
  id: '@555ai/brand',
  factory(require) {
    const React = require('react')
    function Name({ useDisplayName }) {
      const name = useDisplayName(value => value)
      return React.createElement('span', { 'data-product-name': '', title: name, style: { fontWeight: 500,
        display: 'block', minWidth: 0, maxWidth: '100%', overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' } }, name ?? '')
    }
    function Mark() { return React.createElement('img', { src: '/favicon.svg', alt: '', width: 28, height: 28 }) }
    function TaskStatus({ useProjection, t }) {
      const status = useProjection('ai555TaskCompletion')
      if (!status?.ended || status.remaining === 0) return null
      return React.createElement('div', { role: 'status', 'data-task-incomplete': '',
        style: { padding: 12, border: '1px solid currentColor', borderRadius: 12, fontSize: 12, lineHeight: 1.6 } },
      t('incomplete', { count: status.remaining }))
    }
    return {
      inject: ['slots', 'locale'],
      apply(ctx, config) {
        ctx.effect(() => ctx.locale.register('555ai-task', {
          zh: { incomplete: '本轮已结束，还有 {count} 项待办未完成。发送消息可继续处理。' },
          en: { incomplete: 'This run ended with {count} unfinished tasks. Send a message to continue.' },
          ja: { incomplete: '今回の実行は終了しました。未完了のタスクが {count} 件あります。メッセージで続行できます。' },
          es: { incomplete: 'La ejecución terminó con {count} tareas pendientes. Envía un mensaje para continuar.' },
          fr: { incomplete: 'Cette exécution est terminée ; {count} tâches restent à faire. Envoyez un message pour continuer.' },
          de: { incomplete: 'Dieser Lauf ist beendet. {count} Aufgaben sind noch offen. Sende eine Nachricht zum Fortsetzen.' },
          ru: { incomplete: 'Запуск завершён, осталось задач: {count}. Отправьте сообщение для продолжения.' },
          pt: { incomplete: 'Esta execução terminou com {count} tarefas pendentes. Envie uma mensagem para continuar.' },
        }), '555ai: task status dictionaries')
        ctx.slots.inject('conversation.input.dock', () => ctx.slots.register({
          name: 'conversation.input.dock', id: '555ai-task-status', order: 1, locale: '555ai-task',
        }, TaskStatus))
        ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({
          name: 'sidebar.brand.name',
          inject: () => ({ hooks: { displayName: config.displayName } }),
        }, Name))
        for (const name of ['sidebar.brand.mark', 'conversation.hero.brand.mark']) {
          ctx.slots.inject(name, () => ctx.slots.register({ name }, Mark))
        }
      },
    }
  },
})
