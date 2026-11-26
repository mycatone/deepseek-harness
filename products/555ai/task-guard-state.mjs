/** Bounded, replayable task status for the 555AI product guard. */
export function initialTaskState() {
  return { turn: 0, placeholder: false, recoveries: 0, view: { remaining: 0, ended: false } }
}

/** Fold committed Session events; replay never starts model or tool work. */
export function foldTaskState(state, event) {
  const data = event.data
  switch (event.type) {
    case 'turn/start':
      return { ...state, turn: data.turn, placeholder: false, recoveries: 0,
        view: state.view.ended ? { ...state.view, ended: false } : state.view }
    case 'todo/write': {
      const remaining = data.todos.filter(todo => todo.status !== 'completed').length
      return remaining === state.view.remaining ? state : { ...state, view: { ...state.view, remaining } }
    }
    case 'assistant/message': {
      if (data.turn !== state.turn) return state
      const content = data.message.content
      const text = content.filter(block => block.type === 'text').map(block => block.text).join('').trim()
      const finish = data.stream?.findLast(record => record.type === 'chunk' && record.chunk.type === 'finish')
      const placeholder = data.message.source.kind === 'model' && finish?.chunk.reason.kind === 'stop'
        && !content.some(block => block.type === 'tool-call') && /^\[[\w.-]+\]$/u.test(text)
      return placeholder === state.placeholder ? state : { ...state, placeholder }
    }
    case 'user/message':
      return data.source.kind === '555ai-task-recovery'
        ? { ...state, recoveries: data.source.attempt } : state
    case 'turn/end':
      return state.view.ended ? state : { ...state, view: { ...state.view, ended: true } }
    default:
      return state
  }
}
