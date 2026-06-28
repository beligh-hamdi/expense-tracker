import {
  Component, inject, signal, computed,
} from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslocoModule, TranslocoService } from '@jsverse/transloco';
import { Expense } from '@shared/models/expense.model';
import { Category } from '@shared/models/category.model';
import { OcrService } from '@core/ocr/ocr.service';
import { LanguageService } from '@core/i18n/language.service';
import { crypto } from '@shared/utils/crypto.util';

export interface ExpenseFormData {
  expense?: Expense;       // undefined = new expense
  categories: Category[];
}

@Component({
  selector: 'app-expense-form',
  imports: [
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatChipsModule,
    MatTooltipModule,
    TranslocoModule,
  ],
  templateUrl: './expense-form.html',
  styleUrl: './expense-form.scss',
})
export class ExpenseFormComponent {
  readonly data = inject<ExpenseFormData>(MAT_DIALOG_DATA);
  readonly dialogRef = inject(MatDialogRef<ExpenseFormComponent>);
  private readonly ocr = inject(OcrService);
  private readonly transloco = inject(TranslocoService);
  private readonly lang = inject(LanguageService);

  catName = (name: string) => this.lang.translateCategoryName(name);

  readonly isEdit = !!this.data.expense;
  readonly ocrLoading = signal(false);
  readonly ocrError = signal<string | null>(null);
  readonly receiptPreview = signal<string | null>(null);
  readonly ocrRawText = signal<string | null>(null);
  readonly zoomedIn = signal(false);

  readonly date = signal<Date>(new Date());
  readonly amount = signal<number | null>(null);
  readonly categoryId = signal('');
  readonly description = signal('');

  readonly isValid = computed(() =>
    !!this.date() && (this.amount() ?? 0) > 0 && !!this.categoryId()
  );

  constructor() {
    if (this.data.expense) {
      const e = this.data.expense;
      this.date.set(e.date ? new Date(e.date) : new Date());
      this.amount.set(e.amount);
      this.categoryId.set(e.categoryId);
      this.description.set(e.description);
    }
    // Pre-select first category for new expense
    if (!this.isEdit && this.data.categories.length) {
      this.categoryId.set(this.data.categories[0].id);
    }
  }

  onDateChange(value: Date | null): void {
    if (value) this.date.set(value);
  }

  onAmountInput(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.amount.set(val === '' ? null : +val);
  }

  onDescriptionInput(event: Event): void {
    this.description.set((event.target as HTMLInputElement).value);
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    // Show preview immediately
    const reader = new FileReader();
    reader.onload = () => this.receiptPreview.set(reader.result as string);
    reader.readAsDataURL(file);

    this.ocrLoading.set(true);
    this.ocrError.set(null);
    try {
      const result = await this.ocr.extractFromReceipt(file);
      if (result.amount != null) this.amount.set(result.amount);
      if (result.date)           this.date.set(new Date(result.date));
      if (result.merchant)       this.description.set(result.merchant);
      this.ocrRawText.set(result.rawText.trim().slice(0, 300));
    } catch (err) {
      this.ocrError.set(err instanceof Error ? err.message : this.transloco.translate('expense_form.ocr_failed'));
    } finally {
      this.ocrLoading.set(false);
    }
  }

  submit(): void {
    if (!this.isValid()) return;
    const expense: Expense = {
      id:          this.data.expense?.id ?? crypto.uuid(),
      date:        this.toIsoDate(this.date()),
      amount:      this.amount()!,
      categoryId:  this.categoryId(),
      description: this.description(),
      receiptUrl:  this.data.expense?.receiptUrl,
      createdAt:   this.data.expense?.createdAt ?? new Date().toISOString(),
    };
    this.dialogRef.close(expense);
  }

  private toIsoDate(d: Date): string {
    return d.toISOString().split('T')[0];
  }
}
