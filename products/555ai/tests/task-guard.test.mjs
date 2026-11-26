import assert from 'node:assert/strict'
import { test } from 'node:test'
import { initialTaskState, foldTaskState } from '../task-guard-state.mjs'

const event = (type, data) => ({ type, data })
const assistant = (text, kind = 'stop', content = [{ type: 'text', text }]) => event('assistant/message', {
  turn: 1, message: { source: { kind: 'model' }, content },
  stream: [{ type: 'chunk', chunk: { type: 'finish', reason: { kind } } }],
})

test('ended turns retain unfinished tasks and new turns clear only the ended status', () => {
  let state = foldTaskState(initialTaskState(), event('turn/start', { turn: 1 }))
  state = foldTaskState(state, event('todo/write', { todos: [{ status: 'completed' }, { status: 'in_progress' }, { status: 'pending' }] }))
  state = foldTaskState(state, event('turn/end', { turn: 1 }))
  assert.deepEqual(state.view, { remaining: 2, ended: true })
  assert.deepEqual(foldTaskState(state, event('turn/start', { turn: 2 })).view, { remaining: 2, ended: false })
})

test('only a terminal text placeholder is eligible, questions and structured tools stay unchanged', () => {
  const state = foldTaskState(initialTaskState(), event('turn/start', { turn: 1 }))
  assert.equal(foldTaskState(state, assistant('[todo_write]')).placeholder, true)
  for (const e of [assistant('Which folder should I use?'), assistant('[todo_write]', 'max-tokens'),
    assistant('', 'stop', [{ type: 'tool-call', name: 'todo_write' }])]) {
    assert.equal(foldTaskState(state, e).placeholder, false)
  }
  assert.equal(foldTaskState(state, event('step/start', {})), state)
})

test('recovery count survives replay and checkpoint suffix replay', () => {
  const events = [event('turn/start', { turn: 1 }), event('todo/write', { todos: [{ status: 'pending' }] }),
    assistant('[todo_write]'), event('user/message', { source: { kind: '555ai-task-recovery', attempt: 1 } }),
    assistant('[todo_write]'), event('turn/end', { turn: 1 })]
  const checkpoint = events.slice(0, 4).reduce(foldTaskState, initialTaskState())
  assert.deepEqual(events.slice(4).reduce(foldTaskState, JSON.parse(JSON.stringify(checkpoint))), events.reduce(foldTaskState, initialTaskState()))
  assert.equal(checkpoint.recoveries, 1)
})
