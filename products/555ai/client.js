/** Independent product name and the original 555 monogram. */
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
    return {
      inject: ['slots'],
      apply(ctx, config) {
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
