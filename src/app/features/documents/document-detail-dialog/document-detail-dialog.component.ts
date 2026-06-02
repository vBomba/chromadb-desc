import { Component, input, model } from '@angular/core';
import { VbButtonComponent, VbPopupComponent } from 'vbomba-ui';
import { DocumentRow } from '../document-row.model';

@Component({
  selector: 'app-document-detail-dialog',
  standalone: true,
  imports: [VbButtonComponent, VbPopupComponent],
  templateUrl: './document-detail-dialog.component.html',
  styleUrl: './document-detail-dialog.component.scss',
})
export class DocumentDetailDialogComponent {
  open = model(false);
  row = input<DocumentRow | null>(null);

  protected formatMetadata(meta: Record<string, unknown> | null): string {
    if (!meta || typeof meta !== 'object') return '—';
    return JSON.stringify(meta, null, 2);
  }

  protected embeddingSummary(doc: DocumentRow): string {
    const v = doc.embedding;
    if (!v || !v.length) return '—';
    const norm = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    const preview = v.slice(0, 10).map((x) => x.toFixed(4)).join(', ');
    const more = v.length > 10 ? ` … +${v.length - 10} more` : '';
    return `‖v‖ ≈ ${norm.toFixed(4)}\n[${preview}${more}]`;
  }

  protected close(): void {
    this.open.set(false);
  }
}
