import { Drop, Liquid } from '../../../src'

class Cart {
  toLiquid () {
    return ['apple', 'pear', 'fig']
  }
}

class Sku {
  constructor (
    private readonly raw: unknown,
    public readonly code: string,
    public readonly qty: number
  ) {}

  toLiquid () {
    return { code: this.code, qty: this.qty }
  }

  prototypeValue () {
    return 'hidden'
  }
}

class ProductDrop extends Drop {
  constructor (private readonly statusValue: string) {
    super()
  }

  get name () {
    return this.statusValue === 'on' ? 'first product' : 'second product'
  }

  liquidMethodMissing (key: string) {
    return key === 'status' ? this.statusValue : undefined
  }
}

describe('toLiquid', () => {
  let liquid: Liquid
  beforeEach(() => { liquid = new Liquid() })

  function render (template: string) {
    const cart = new Cart()
    const skus = [
      new Sku({ hidden: true }, 'SKU-a', 0),
      new Sku({ hidden: true }, 'SKU-b', 5)
    ]
    const products = [new ProductDrop('on'), new ProductDrop('off')]
    return liquid.parseAndRender(template, { cart, skus, products })
  }

  it('converts a root value for output, iteration, filters, and contains', async () => {
    expect(await render('{{ cart }}')).toBe('applepearfig')
    expect(await render('{% for item in cart %}{{ item }};{% endfor %}')).toBe('apple;pear;fig;')
    expect(await render('{{ cart | join: "-" }}')).toBe('apple-pear-fig')
    expect(await render('{{ cart | size }}')).toBe('3')
    expect(await render('{% if cart contains "pear" %}yes{% else %}no{% endif %}')).toBe('yes')
  })

  it('keeps property access working on converted root values', async () => {
    expect(await render('{{ cart.size }} {{ cart.first }}')).toBe('3 apple')
  })

  it('uses toLiquid when array filters read item properties', async () => {
    expect(await render('{{ skus | map: "code" | join: "-" }}')).toBe('SKU-a-SKU-b')
    expect(await render('{{ skus | where: "qty", 5 | map: "code" | join }}')).toBe('SKU-b')
    expect(await render('{{ skus | reject: "qty", 0 | map: "code" | join }}')).toBe('SKU-b')
    expect(await render('{{ skus | find: "code", "SKU-a" | json }}')).toBe('{"code":"SKU-a","qty":0}')
    expect(await render('{{ skus | find_index: "qty", 5 }}')).toBe('1')
  })

  it('keeps ownPropertyOnly enabled inside array filters', async () => {
    expect(await render('{{ skus | map: "raw" | json }}')).toBe('[null,null]')
    expect(await render('{{ skus | map: "prototypeValue" | json }}')).toBe('[null,null]')
  })

  it('groups converted array items by liquid properties', async () => {
    const template = '{% assign groups = skus | group_by: "qty" | sort: "name" %}' +
      '{% for group in groups %}{{ group.name }}:{{ group.items | map: "code" | join }};{% endfor %}'
    expect(await render(template)).toBe('0:SKU-a;5:SKU-b;')
  })

  it('uses liquidMethodMissing when array filters read Drop properties', async () => {
    expect(await render('{{ products | map: "status" | join: "-" }}')).toBe('on-off')
    expect(await render('{{ products | where: "status", "on" | size }}')).toBe('1')
    expect(await render('{{ products | has: "status", "off" }}')).toBe('true')
    expect(await render('{{ products | find: "status", "on" | map: "name" | first }}')).toBe('first product')
    expect(await render('{{ products | find_index: "status", "off" }}')).toBe('1')
  })

  it('does not expose prototype members when ownPropertyOnly is enabled', async () => {
    class DomainObject {
      own = 'own'
      toLiquid () {
        return { visible: 'visible' }
      }
      hidden () {
        return 'hidden'
      }
    }
    const template = '{{ object.visible }}|{{ object.hidden }}|{{ object.own }}'
    expect(await liquid.parseAndRender(template, { object: new DomainObject() })).toBe('visible||')
  })
})
