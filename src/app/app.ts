import { Component, inject } from '@angular/core';
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
  listOutline,
  bagOutline,
  bookOutline,
  cafeOutline,
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
  protected readonly tabs = tabs;
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);

  constructor() {
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
      listOutline,
      bagOutline,
      bookOutline,
      cafeOutline,
      downloadOutline,
      informationCircleOutline,
      sparklesOutline,
      starOutline,
      waterOutline,
      wifi,
    });
  }
}
