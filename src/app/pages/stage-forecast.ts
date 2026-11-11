import { Component, inject, input } from '@angular/core';
import { IonIcon } from '@ionic/angular';
import { Locale } from '../demo/locale';
import { StageWeather } from './stage-weather';

@Component({
  selector: 'app-stage-forecast',
  imports: [IonIcon],
  templateUrl: './stage-forecast.html',
  styleUrl: './stage-forecast.scss',
})
export class StageForecast {
  protected readonly locale = inject(Locale);
  readonly place = input.required<string>();
  readonly weather = input.required<StageWeather>();
}
