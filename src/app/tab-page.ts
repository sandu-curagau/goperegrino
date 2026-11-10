import { Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { IonContent } from '@ionic/angular';

@Component({
  imports: [IonContent],
  template: `
    <ion-content>
      <main class="page">
        <div class="page-accent" aria-hidden="true"></div>
        <h1>{{ title }}</h1>
      </main>
    </ion-content>
  `,
  styles: `
    .page {
      padding: calc(32px + var(--ion-safe-area-top, 0px)) 24px 24px;
    }

    .page-accent {
      width: 26px;
      height: 4px;
      border-radius: 4px;
      background: var(--ion-color-secondary);
    }

    h1 {
      margin: 12px 0 0;
      color: var(--ion-color-primary);
      font-size: 36px;
      font-weight: 760;
      letter-spacing: -0.055em;
      line-height: 1.12;
    }
  `,
})
export class TabPage {
  protected readonly title = inject(ActivatedRoute).snapshot.data['title'];
}
