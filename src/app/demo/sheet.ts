import {
  afterNextRender,
  Component,
  ElementRef,
  inject,
  input,
  output,
  viewChild,
} from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { NavigationStart, Router } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Locale } from './locale';

@Component({
  selector: 'app-sheet',
  imports: [IonIcon],
  template: `
    <dialog #sheet class="sheet" [attr.aria-label]="title()" (close)="closed.emit()">
      <div class="sheet-heading">
        <h2>{{ title() }}</h2>
        <form method="dialog">
          <button type="submit" class="icon-button" [attr.aria-label]="locale.t('close')">
            <ion-icon name="close-outline" aria-hidden="true"></ion-icon>
          </button>
        </form>
      </div>
      <div class="sheet-content"><ng-content /></div>
    </dialog>
  `,
  styles: `
    .sheet {
      position: fixed;
      inset: auto auto max(12px, env(safe-area-inset-bottom)) 50%;
      width: min(366px, calc(100% - 20px));
      max-height: min(650px, calc(100dvh - 34px));
      margin: 0;
      padding: 0;
      overflow: auto;
      border: 1px solid var(--line);
      border-radius: 24px;
      background: var(--paper);
      color: var(--ink);
      box-shadow: 0 20px 58px #00192d65;
      transform: translateX(-50%);
    }
    .sheet::backdrop {
      background: #001a317b;
    }
    @media (prefers-reduced-motion: no-preference) {
      .sheet[open] {
        animation: sheet-in 160ms ease-out;
      }
      @keyframes sheet-in {
        from {
          opacity: 0;
          transform: translate(-50%, 12px);
        }
      }
    }
    .sheet-heading {
      position: sticky;
      top: 0;
      z-index: 1;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      padding: 12px 15px;
      background: var(--paper);
      border-bottom: 1px solid var(--line);
    }
    .sheet-heading h2 {
      margin: 0;
      font-size: 17px;
    }
    .sheet-content {
      padding: 16px;
    }
    @media (width > 900px) {
      .sheet {
        bottom: max(25px, calc((100dvh - 815px) / 2));
      }
    }
  `,
})
export class Sheet {
  readonly title = input.required<string>();
  readonly closed = output<void>();
  protected readonly locale = inject(Locale);
  private readonly sheet = viewChild.required<ElementRef<HTMLDialogElement>>('sheet');

  scrollToTop(): void {
    this.sheet().nativeElement.scrollTop = 0;
  }

  constructor() {
    afterNextRender(() => this.sheet().nativeElement.showModal());
    inject(Router)
      .events.pipe(takeUntilDestroyed())
      .subscribe((event) => {
        if (event instanceof NavigationStart) this.sheet()?.nativeElement.close();
      });
  }
}
