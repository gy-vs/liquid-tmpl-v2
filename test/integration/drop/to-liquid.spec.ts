import { Liquid, Drop } from '../../../src'

describe('drop/toLiquid', function () {
  let liquid: Liquid
  beforeEach(() => (liquid = new Liquid()))

  class Cart {
    toLiquid () { return ['apple', 'pear', 'fig'] }
  }
  class Sku {
    constructor (public raw: { code: string, qty: number }) {}
    toLiquid () { return { code: this.raw.code, qty: this.raw.qty } }
  }
  class Product extends Drop {
    constructor (private _name: string, private _status: string) { super() }
    get name () { return this._name }
    liquidMethodMissing (key: string) {
      if (key === 'status') return this._status
    }
  }
  const context = () => ({
    cart: new Cart(),
    skus: [
      new Sku({ code: 'SKU-a', qty: 0 }),
      new Sku({ code: 'SKU-b', qty: 5 })
    ],
    products: [
      new Product('p1', 'on'),
      new Product('p2', 'off')
    ]
  })
  const render = (tpl: string) => liquid.parseAndRender(tpl, context())

  describe('root value resolution', function () {
    it('should resolve toLiquid result on dot access', async () => {
      expect(await render('{{ cart.size }}/{{ cart.first }}')).toBe('3/apple')
    })
    it('should iterate over the toLiquid result in for', async () => {
      expect(await render('{% for x in cart %}{{ x }},{% endfor %}')).toBe('apple,pear,fig,')
    })
    it('should render for/else when toLiquid result is empty', async () => {
      class EmptyCart { toLiquid () { return [] } }
      const html = await liquid.parseAndRender('{% for x in cart %}x{% else %}empty{% endfor %}', { cart: new EmptyCart() })
      expect(html).toBe('empty')
    })
    it('should apply join on the toLiquid result', async () => {
      expect(await render('{{ cart | join: "-" }}')).toBe('apple-pear-fig')
    })
    it('should apply size on the toLiquid result', async () => {
      expect(await render('{{ cart | size }}')).toBe('3')
    })
    it('should support contains on the toLiquid result', async () => {
      expect(await render('{% if cart contains "pear" %}y{% else %}n{% endif %}')).toBe('y')
    })
    it('should support contains on toLiquid string', async () => {
      class Name { toLiquid () { return 'pear' } }
      const html = await liquid.parseAndRender('{% if name contains "ea" %}y{% else %}n{% endif %}', { name: new Name() })
      expect(html).toBe('y')
    })
    it('should output the toLiquid result directly', async () => {
      class Title { toLiquid () { return 'TITLE' } }
      expect(await liquid.parseAndRender('{{ title }}', { title: new Title() })).toBe('TITLE')
    })
    it('should resolve nested toLiquid chains', async () => {
      class Inner { toLiquid () { return { value: 'INNER' } } }
      class Outer { toLiquid () { return { inner: new Inner() } } }
      expect(await liquid.parseAndRender('{{ outer.inner.value }}', { outer: new Outer() })).toBe('INNER')
    })
    it('should work in sync rendering', () => {
      const html = liquid.parseAndRenderSync('{% for x in cart %}{{ x }};{% endfor %}{{ cart | size }}', context())
      expect(html).toBe('apple;pear;fig;3')
    })
  })

  describe('array filters reading element properties', function () {
    it('should resolve toLiquid properties in where', async () => {
      expect(await render(`{{ skus | where: 'qty', 5 | map: 'code' | join }}`)).toBe('SKU-b')
    })
    it('should resolve toLiquid properties in reject', async () => {
      expect(await render(`{{ skus | reject: 'qty', 0 | map: 'code' | join }}`)).toBe('SKU-b')
    })
    it('should resolve toLiquid properties in find', async () => {
      expect(await render(`{% assign s = skus | find: 'code', 'SKU-a' %}{{ s.code }}`)).toBe('SKU-a')
    })
    it('should resolve toLiquid properties in find_index', async () => {
      expect(await render(`{{ skus | find_index: 'qty', 5 }}`)).toBe('1')
    })
    it('should resolve toLiquid properties in has', async () => {
      expect(await render(`{{ skus | has: 'qty', 5 }}`)).toBe('true')
      expect(await render(`{{ skus | has: 'qty', 9 }}`)).toBe('false')
    })
    it('should resolve toLiquid properties in group_by', async () => {
      const html = await render(`{{ skus | group_by: 'qty' | json }}`)
      const groups = JSON.parse(html)
      expect(groups.map((g: any) => g.name)).toEqual([0, 5])
      expect(groups.map((g: any) => g.items.length)).toEqual([1, 1])
    })
    it('should resolve liquidMethodMissing in where', async () => {
      expect(await render(`{{ products | where: 'status', 'on' | map: 'name' | join }}`)).toBe('p1')
    })
    it('should resolve liquidMethodMissing in has', async () => {
      expect(await render(`{{ products | has: 'status', 'off' }}`)).toBe('true')
    })
    it('should resolve liquidMethodMissing in group_by', async () => {
      const groups = JSON.parse(await render(`{{ products | group_by: 'status' | json }}`))
      expect(groups.map((g: any) => [g.name, g.items.length])).toEqual([['on', 1], ['off', 1]])
    })
    it('should use liquid truthiness for where without expected value', async () => {
      // 'on' and 'off' are both truthy in liquid (only nil/false are falsy)
      expect(await render(`{{ products | where: 'status' | map: 'name' | join: ',' }}`)).toBe('p1,p2')
    })
    it('should support nested property paths', async () => {
      class Order {
        constructor (public raw: { sku: { code: string } }) {}
        toLiquid () { return { sku: { code: this.raw.sku.code } } }
      }
      const orders = [new Order({ sku: { code: 'X' } }), new Order({ sku: { code: 'Y' } })]
      const html = await liquid.parseAndRender(`{% assign o = orders | find: 'sku.code', 'Y' %}{{ o.sku.code }}`, { orders })
      expect(html).toBe('Y')
    })
    it('should work in sync rendering', () => {
      const html = liquid.parseAndRenderSync(`{{ skus | where: 'qty', 5 | map: 'code' | join }}`, context())
      expect(html).toBe('SKU-b')
    })
  })

  describe('non-regression', function () {
    it('should not change plain arrays', async () => {
      const nums = [1, 2, 3]
      expect(await liquid.parseAndRender('{% for n in nums %}{{ n }}{% endfor %}{{ nums | size }}{% if nums contains 2 %}y{% endif %}', { nums }))
        .toBe('1233y')
    })
    it('should not change plain objects', async () => {
      expect(await liquid.parseAndRender('{{ obj.a }}{% if obj %}y{% endif %}', { obj: { a: 'A' } })).toBe('Ay')
    })
    it('should not change class instances without toLiquid', async () => {
      class Plain { constructor (public a: string) {} method () { return 'METHOD' } }
      expect(await liquid.parseAndRender('{{ obj.a }}', { obj: new Plain('A') })).toBe('A')
      // prototype methods remain invisible with ownPropertyOnly enabled
      expect(await liquid.parseAndRender('{{ obj.method }}', { obj: new Plain('A') })).toBe('')
    })
    it('should keep ownPropertyOnly for where on element prototype properties', async () => {
      class Item { constructor (public id: number) {} active () { return true } }
      const items = [new Item(1)]
      const html = await liquid.parseAndRender(`{{ items | where: 'active', true | size }}`, { items })
      expect(html).toBe('0')
    })
    it('should still resolve Drop prototype methods', async () => {
      class NamedDrop extends Drop {
        name () { return 'NAME' }
      }
      expect(await liquid.parseAndRender(`{{ drops | map: 'name' | join }}`, { drops: [new NamedDrop()] })).toBe('NAME')
    })
  })
})
