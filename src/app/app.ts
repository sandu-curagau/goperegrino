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
import { tabs } from './app.routes';
import { DemoStore } from './demo/demo-store';
import { Locale } from './demo/locale';
import { Onboarding } from './demo/onboarding';
import { DemoControls } from './demo/demo-controls';
import { PremiumPass } from './demo/premium-pass';

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
  protected readonly tabs = tabs;
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly activeTab = signal('mapa');
  protected readonly creditOpen = signal(false);

  constructor() {
    effect(() => {
      if (this.store.completionOpen()) this.demoPanel()?.nativeElement.close();
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
