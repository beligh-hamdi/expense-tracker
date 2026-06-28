import { Component, inject } from '@angular/core';
import { CurrencyPipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Category } from '@shared/models/category.model';
import { CategoriesService } from './categories.service';
import { CategoryFormComponent } from './category-form/category-form';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-categories',
  imports: [
    CurrencyPipe,
    TranslocoModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
  ],
  templateUrl: './categories.html',
  styleUrl: './categories.scss',
})
export class CategoriesComponent {
  readonly svc            = inject(CategoriesService);
  private readonly dialog    = inject(MatDialog);
  private readonly transloco = inject(TranslocoService);

  constructor() { this.svc.load(); }

  openAddDialog(): void {
    this.dialog
      .open(CategoryFormComponent, { data: {}, width: '480px', maxWidth: '95vw', maxHeight: '90vh' })
      .afterClosed()
      .subscribe(async (cat: Category | undefined) => {
        if (!cat) return;
        try { await this.svc.add(cat); }
        catch (err) { this.showError(err); }
      });
  }

  openEditDialog(category: Category): void {
    this.dialog
      .open(CategoryFormComponent, { data: { category }, width: '480px', maxWidth: '95vw', maxHeight: '90vh' })
      .afterClosed()
      .subscribe(async (updated: Category | undefined) => {
        if (!updated) return;
        try { await this.svc.update(updated); }
        catch (err) { this.showError(err); }
      });
  }

  confirmDelete(category: Category): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title:        this.transloco.translate('categories.delete_category_title'),
          message:      `Delete "${this.svc.catName(category.name)}"? ${this.transloco.translate('categories.expenses_lose_category')}`,
          confirmLabel: this.transloco.translate('categories.delete_button'),
          confirmColor: 'warn',
        },
        width: '380px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;
        try { await this.svc.delete(category.id); }
        catch (err) { this.showError(err); }
      });
  }

  private showError(err: unknown): void { console.error(err); }
}
