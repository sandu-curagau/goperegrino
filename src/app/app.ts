import {
  afterNextRender,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs } from '@ionic/angular';
import { PRIMARY_OUTLET, Router } from '@angular/router';
import { addIcons } from 'ionicons';
import {
  batteryFull,
  bedOutline,
  cellular,
  closeOutline,
  footstepsOutline,
  mapOutline,
  optionsOutline,
  personCircleOutline,
  ribbonOutline,
  lockClosedOutline,
  shieldCheckmarkOutline,
  callOutline,
  cloudOfflineOutline,
  locateOutline,
  notificationsOutline,
  partlySunnyOutline,
  rainyOutline,
  sunnyOutline,
  pauseOutline,
  playOutline,
  refreshOutline,
  checkmarkOutline,
  bagOutline,
  bookOutline,
  cardOutline,
  cafeOutline,
  cameraOutline,
  chatbubblesOutline,
  locationOutline,
  chevronForwardOutline,
  chevronBackOutline,
  arrowUpOutline,
  downloadOutline,
  informationCircleOutline,
  sparklesOutline,
  starOutline,
  waterOutline,
  wifi,
} from 'ionicons/icons';
import { tabs, walkOnlyTabs } from './app.routes';
import { DemoStore } from './demo/demo-store';
import { Locale } from './demo/locale';
import { Onboarding } from './demo/onboarding';
import { DemoControls } from './demo/demo-controls';
import { PremiumPass } from './demo/premium-pass';
import { Appearance } from './demo/appearance';

@Component({
  imports: [
    IonApp,
    IonIcon,
    IonLabel,
    IonTabBar,
    IonTabButton,
    IonTabs,
    Onboarding,
    DemoControls,
    PremiumPass,
  ],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  private readonly demoPanel = viewChild<ElementRef<HTMLDialogElement>>('demoPanel');
  private readonly router = inject(Router);
  protected readonly tabs = tabs;
  protected readonly walkOnlyTabs = walkOnlyTabs;
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly activeTab = signal('mapa');
  protected readonly creditOpen = signal(false);

  constructor() {
    inject(Appearance);
    effect(() => {
      if (this.store.walkClosed()) this.demoPanel()?.nativeElement.close();
    });
    effect(() => {
      if (!this.store.walkClosed() || this.router.currentNavigation()) return;
      const path =
        this.router.lastSuccessfulNavigation()?.finalUrl?.root.children[PRIMARY_OUTLET]?.segments[0]
          ?.path;
      // Older saved walks can only be classified as complete once the route data loads.
      if (path && walkOnlyTabs.has(path)) {
        void this.router.navigateByUrl('/caminho', { replaceUrl: true });
      }
    });
    const destroy = inject(DestroyRef);
    afterNextRender(() => {
      try {
        const key = 'goperegrino-map-attribution';
        if (sessionStorage.getItem(key)) return;
        sessionStorage.setItem(key, 'seen');
      } catch {
        // Show the launch attribution when session storage is unavailable.
      }
      this.creditOpen.set(true);
      const timer = setTimeout(() => this.creditOpen.set(false), 5000);
      destroy.onDestroy(() => clearTimeout(timer));
    });
    addIcons({
      batteryFull,
      bedOutline,
      cellular,
      closeOutline,
      footstepsOutline,
      mapOutline,
      optionsOutline,
      personCircleOutline,
      ribbonOutline,
      lockClosedOutline,
      shieldCheckmarkOutline,
      callOutline,
      cloudOfflineOutline,
      locateOutline,
      notificationsOutline,
      partlySunnyOutline,
      rainyOutline,
      sunnyOutline,
      pauseOutline,
      playOutline,
      refreshOutline,
      checkmarkOutline,
      bagOutline,
      bookOutline,
      cardOutline,
      cafeOutline,
      cameraOutline,
      chatbubblesOutline,
      locationOutline,
      chevronForwardOutline,
      chevronBackOutline,
      arrowUpOutline,
      downloadOutline,
      informationCircleOutline,
      sparklesOutline,
      starOutline,
      waterOutline,
      wifi,
    });
  }
}
