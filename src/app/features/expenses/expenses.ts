import { Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog } from '@angular/material/dialog';
import { TranslocoModule } from '@jsverse/transloco';
import { SheetConfigService } from '@core/google-sheets/sheet-config.service';
import { Expense } from '@shared/models/expense.model';
import { ExpensesService } from './expenses.service';
import { ExpenseFormComponent } from './expense-form/expense-form';
import { ExpenseListComponent } from './expense-list/expense-list';
import { ConfirmDialogComponent } from '@shared/components/confirm-dialog/confirm-dialog';

@Component({
  selector: 'app-expenses',
  imports: [
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    TranslocoModule,
    ExpenseListComponent,
  ],
  templateUrl: './expenses.html',
  styleUrl: './expenses.scss',
})
export class ExpensesComponent {
  readonly sheetConfig = inject(SheetConfigService);
  readonly svc         = inject(ExpensesService);
  private readonly dialog = inject(MatDialog);

  openAddDialog(): void {
    this.dialog
      .open(ExpenseFormComponent, {
        data: { categories: this.svc.categories() },
        width: '460px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe(async (expense: Expense | undefined) => {
        if (!expense) return;
        try { await this.svc.add(expense); }
        catch (err) { this.showError(err); }
      });
  }

  openEditDialog(expense: Expense): void {
    this.dialog
      .open(ExpenseFormComponent, {
        data: { expense, categories: this.svc.categories() },
        width: '460px',
        maxWidth: '95vw',
      })
      .afterClosed()
      .subscribe(async (updated: Expense | undefined) => {
        if (!updated) return;
        try { await this.svc.update(updated); }
        catch (err) { this.showError(err); }
      });
  }

  confirmDelete(expense: Expense): void {
    this.dialog
      .open(ConfirmDialogComponent, {
        data: {
          title:        'expenses.delete_expense_title',
          message:      `Delete "${expense.description || formatCurrency(expense.amount)}"?`,
          confirmLabel: 'expenses.delete_button',
          confirmColor: 'warn',
        },
        width: '360px',
      })
      .afterClosed()
      .subscribe(async (confirmed: boolean | undefined) => {
        if (!confirmed) return;
        try { await this.svc.delete(expense.id); }
        catch (err) { this.showError(err); }
      });
  }

  private showError(err: unknown): void {
    // Errors with snackbar are handled inside ExpensesService;
    // rethrow unexpected ones so they surface in devtools.
    console.error(err);
  }
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
}
