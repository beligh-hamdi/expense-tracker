import { Component, inject, signal, computed } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule } from '@jsverse/transloco';
import { Category } from '@shared/models/category.model';
import { MAT_COLOR_TOKENS, resolveMatToken } from '@shared/utils/mat-colors.util';
import { slugify } from '@shared/utils/crypto.util';

export interface CategoryFormData {
  category?: Category;
}

// Curated subset of Material icons grouped by theme
const ICON_OPTIONS: { group: string; key: string; icons: string[] }[] = [
  {
    group: 'Food & Drink',
    key: 'icon_group_food_drink',
    icons: ['restaurant', 'local_cafe', 'local_bar', 'fastfood', 'lunch_dining', 'bakery_dining', 'local_grocery_store'],
  },
  {
    group: 'Transport',
    key: 'icon_group_transport',
    icons: ['directions_car', 'directions_bus', 'local_taxi', 'train', 'flight', 'directions_bike', 'local_gas_station'],
  },
  {
    group: 'Shopping',
    key: 'icon_group_shopping',
    icons: ['shopping_bag', 'shopping_cart', 'storefront', 'checkroom', 'chair', 'devices'],
  },
  {
    group: 'Health & Wellness',
    key: 'icon_group_health_wellness',
    icons: ['favorite', 'local_hospital', 'fitness_center', 'spa', 'medical_services', 'pharmacy_medication'],
  },
  {
    group: 'Entertainment',
    key: 'icon_group_entertainment',
    icons: ['movie', 'sports_esports', 'music_note', 'sports', 'theater_comedy', 'festival'],
  },
  {
    group: 'Home & Utilities',
    key: 'icon_group_home_utilities',
    icons: ['home', 'bolt', 'water_drop', 'wifi', 'phone_android', 'tv'],
  },
  {
    group: 'Finance & Work',
    key: 'icon_group_finance_work',
    icons: ['work', 'school', 'account_balance', 'savings', 'credit_card', 'business_center'],
  },
  {
    group: 'Other',
    key: 'icon_group_other',
    icons: ['label', 'star', 'pets', 'child_care', 'volunteer_activism', 'more_horiz'],
  },
];

@Component({
  selector: 'app-category-form',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  templateUrl: './category-form.html',
  styleUrl: './category-form.scss',
})
export class CategoryFormComponent {
  readonly data = inject<CategoryFormData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<CategoryFormComponent>);

  readonly isEdit = !!this.data.category;
  readonly iconOptions = ICON_OPTIONS;

  /** Tokens resolved to their current computed value at dialog-open time. */
  readonly colorOptions = MAT_COLOR_TOKENS.map(opt => ({
    ...opt,
    resolved: resolveMatToken(opt.token),
  }));

  readonly selectedColor = signal(
    this.data.category?.color ?? this.colorOptions[0].resolved
  );
  readonly selectedIcon = signal(this.data.category?.icon ?? 'label');

  readonly name = signal(this.data.category?.name ?? '');
  readonly budgetLimit = signal(this.data.category?.budgetLimit ?? 0);

  readonly isValid = computed(() => this.name().trim().length > 0 && this.name().length <= 40);

  onNameInput(event: Event): void {
    this.name.set((event.target as HTMLInputElement).value);
  }

  onBudgetInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.budgetLimit.set(val === '' ? 0 : +val);
  }

  selectColor(color: string): void { this.selectedColor.set(color); }
  selectIcon(icon: string): void   { this.selectedIcon.set(icon); }

  submit(): void {
    if (!this.isValid()) return;
    const category: Category = {
      id:          this.data.category?.id ?? slugify(this.name().trim()),
      name:        this.name().trim(),
      color:       this.selectedColor(),
      icon:        this.selectedIcon(),
      budgetLimit: this.budgetLimit(),
    };
    this.dialogRef.close(category);
  }
}
