export interface Category {
  id: string;           // UUID
  name: string;
  color: string;        // Hex color e.g. '#4caf50'
  budgetLimit: number;  // Monthly budget limit (0 = no limit)
  icon: string;         // Material icon name e.g. 'restaurant'
}

export const CATEGORY_COLUMNS = [
  'id',
  'name',
  'color',
  'budgetLimit',
  'icon',
] as const satisfies (keyof Category)[];

export function rowToCategory(row: string[]): Category {
  return {
    id:          row[0] ?? '',
    name:        row[1] ?? '',
    color:       row[2] ?? '#607d8b',
    budgetLimit: parseFloat(row[3]) || 0,
    icon:        row[4] ?? 'label',
  };
}

export function categoryToRow(c: Category): string[] {
  return [
    c.id,
    c.name,
    c.color,
    String(c.budgetLimit),
    c.icon,
  ];
}

/**
 * Default categories seeded on first run.
 * `colorToken` is a --mat-sys-* CSS custom property resolved at seed time
 * so the stored hex value always matches the active Material theme.
 */
export const DEFAULT_CATEGORIES: (Omit<Category, 'id' | 'color'> & { nameKey: string; colorToken: string })[] = [
  { nameKey: 'categories.default_food',          name: 'Food & Dining',  colorToken: '--mat-sys-error',              budgetLimit: 0, icon: 'restaurant'    },
  { nameKey: 'categories.default_transport',     name: 'Transport',      colorToken: '--mat-sys-primary',            budgetLimit: 0, icon: 'directions_car' },
  { nameKey: 'categories.default_shopping',      name: 'Shopping',       colorToken: '--mat-sys-tertiary',           budgetLimit: 0, icon: 'shopping_bag'   },
  { nameKey: 'categories.default_entertainment', name: 'Entertainment',  colorToken: '--mat-sys-secondary',          budgetLimit: 0, icon: 'movie'          },
  { nameKey: 'categories.default_health',        name: 'Health',         colorToken: '--mat-sys-tertiary-container', budgetLimit: 0, icon: 'favorite'       },
  { nameKey: 'categories.default_utilities',     name: 'Utilities',      colorToken: '--mat-sys-outline',            budgetLimit: 0, icon: 'bolt'           },
  { nameKey: 'categories.default_other',         name: 'Other',          colorToken: '--mat-sys-neutral-variant20',  budgetLimit: 0, icon: 'label'          },
];
