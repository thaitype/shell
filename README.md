# @thaitype/reorder


[![CI](https://github.com/thaitype/reorder/actions/workflows/main.yml/badge.svg)](https://github.com/thaitype/reorder/actions/workflows/main.yml) [![codecov](https://codecov.io/gh/thaitype/reorder/graph/badge.svg?token=B7MCHM57BH)](https://codecov.io/gh/thaitype/reorder) [![NPM Version](https://img.shields.io/npm/v/@thaitype/reorder) ](https://www.npmjs.com/package/@thaitype/reorder)[![npm downloads](https://img.shields.io/npm/dt/@thaitype/reorder)](https://www.npmjs.com/@thaitype/reorder) 


> Pure reorder function for consistent and testable item ordering based on the `order` field.

## ✨ Features

- ⚙️ **Pure function** – works without DB or side effects.
- 🧪 **100% unit-testable** – ideal for CI pipelines and logic isolation.
- 📐 **Order-aware** – operates strictly on the `order` field, not array position.
- 🔄 **Auto-renumbering** – handles tight gaps and invalid values intelligently.
- ✅ **Robust edge case handling** – including missing/duplicate/invalid orders.

## 📦 Installation

```bash
npm install @thaitype/reorder
# or
pnpm add @thaitype/reorder
````

## 🧠 Use Case

Designed for reordering structures like **chapters**, **lessons**, or **sublessons** where the data model includes an `{ id, order? }` field.

## 🔧 API

```ts
function reorderItems(
  items: OrderableItem[],
  moveId: string,
  targetIndex: number
): {
  changes: { id: string; order: number }[];
  orderedItems: OrderableItem[];
}
```

### Types

```ts
export interface OrderableItem {
  id: string;
  order?: number;
}
```

## 📊 Algorithm Overview

1. Sort `items` by `order` ascending.
2. Remove the `moveId` item.
3. Insert it at `targetIndex` in the sorted array.
4. Recompute its `order`:

   * Between neighbors → use midpoint
   * Before first → next - 1
   * After last → previous + 1
   * Only item → assign 1
5. If new order too close → renumber all with step gaps (e.g. 10, 20, 30…).
6. Return:

   * `changes[]` for DB update
   * `orderedItems[]` for UI reference

## 🧪 Example

```ts
const items = [
  { id: 'A', order: 700 },
  { id: 'B', order: 200 },
  { id: 'C', order: 300 },
  { id: 'D', order: 100 },
  { id: 'E', order: 400 }
];

const result = reorderItems(items, 'A', 1);
```

**Output:**

```ts
{
  changes: [{ id: 'A', order: 150 }],
  orderedItems: [
    { id: 'D', order: 100 },
    { id: 'A', order: 150 },
    { id: 'B', order: 200 },
    { id: 'C', order: 300 },
    { id: 'E', order: 400 }
  ]
}
```

## 🧼 Edge Case Support

* ✅ Unsorted input
* ✅ Missing or `undefined` orders
* ✅ Duplicate or zero orders
* ✅ Insert at start, middle, end
* ✅ Auto-renumber when necessary

## 🧪 Tests

Run test suite with coverage:

```bash
pnpm test
pnpm test:coverage
```

## 📁 Exports

* `reorderItems()` — main reorder function
* `sortItemsByOrder()` — utility function to sort items

## 🧑‍💻 Development

```bash
pnpm install
pnpm build
pnpm test
```

To release:

```bash
pnpm release
```

## 📄 License

MIT © [Thada Wangthammang](https://github.com/thadaw)

