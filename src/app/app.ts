import { Component } from '@angular/core';
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
  wifi,
} from 'ionicons/icons';
import { tabs } from './app.routes';

@Component({
  imports: [IonApp, IonIcon, IonLabel, IonTabBar, IonTabButton, IonTabs],
  selector: 'app-root',
  styleUrl: './app.scss',
  templateUrl: './app.html',
})
export class App {
  protected readonly tabs = tabs;

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
      wifi,
    });
  }
}
