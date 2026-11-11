import { Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { IonContent, IonIcon } from '@ionic/angular';
import { DemoStore, languages } from '../demo/demo-store';
import { Locale, Message } from '../demo/locale';
import { Sheet } from '../demo/sheet';
import { PaymentMethods } from './payment-methods';
import { PilgrimProfiles } from '../demo/pilgrim-profiles';
import { AvatarColor } from '../demo/models';
import { PilgrimAvatar } from './pilgrim-avatar';

type Section = 'editProfile' | 'achievements' | 'trusted' | 'payments' | 'suggest' | 'about';

@Component({
  imports: [IonContent, IonIcon, Sheet, PaymentMethods, PilgrimAvatar],
  templateUrl: './profile-page.html',
  styleUrls: ['./profile-page.scss', './pilgrim-profile.scss'],
})
export class ProfilePage {
  protected readonly store = inject(DemoStore);
  protected readonly locale = inject(Locale);
  protected readonly profiles = inject(PilgrimProfiles);
  private readonly router = inject(Router);
  protected readonly languages = languages;
  protected readonly section = signal<Section | null>(null);
  protected readonly notice = signal<Message | null>(null);
  protected readonly draftName = signal('');
  protected readonly draftBio = signal('');
  protected readonly draftPhoto = signal('');
  protected readonly draftColor = signal<AvatarColor>('ocean');
  protected readonly loadingPhoto = signal(false);
  protected readonly colors: { value: AvatarColor; label: Message }[] = [
    { value: 'ocean', label: 'avatarOcean' },
    { value: 'forest', label: 'avatarForest' },
    { value: 'sunset', label: 'avatarSunset' },
    { value: 'violet', label: 'avatarViolet' },
  ];

  protected open(section: Section): void {
    this.notice.set(null);
    if (section === 'editProfile') {
      const profile = this.store.state().profile;
      this.draftName.set(profile.name);
      this.draftBio.set(profile.bio);
      this.draftPhoto.set(profile.photo);
      this.draftColor.set(profile.color);
    }
    this.section.set(section);
  }

  protected saveProfile(): void {
    const name = this.draftName().trim();
    if (!name || this.loadingPhoto()) return;
    this.store.patch({
      profile: {
        ...this.store.state().profile,
        name,
        bio: this.draftBio().trim(),
        photo: this.draftPhoto(),
        color: this.draftColor(),
      },
    });
    this.section.set(null);
  }

  protected feature(id: string, checked: boolean): void {
    const profile = this.store.state().profile;
    const featured = profile.featuredAchievements.filter((entry) => entry !== id);
    if (
      checked &&
      (featured.length >= 3 || !this.profiles.unlocked().some((entry) => entry.id === id))
    )
      return;
    this.store.patch({
      profile: { ...profile, featuredAchievements: checked ? [...featured, id] : featured },
    });
  }

  protected async photo(input: HTMLInputElement): Promise<void> {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    this.notice.set(null);
    this.loadingPhoto.set(true);
    try {
      if (
        !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
        file.size > 10 * 1024 * 1024
      )
        throw new Error('Unsupported photo');
      const bitmap = await createImageBitmap(file);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = canvas.height = 256;
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Canvas unavailable');
        const side = Math.min(bitmap.width, bitmap.height);
        context.fillStyle = '#fff';
        context.fillRect(0, 0, 256, 256);
        context.drawImage(
          bitmap,
          (bitmap.width - side) / 2,
          (bitmap.height - side) / 2,
          side,
          side,
          0,
          0,
          256,
          256,
        );
        this.draftPhoto.set(canvas.toDataURL('image/jpeg', 0.8));
      } finally {
        bitmap.close();
      }
    } catch {
      this.notice.set('profilePhotoError');
    } finally {
      this.loadingPhoto.set(false);
    }
  }

  protected history(): void {
    void this.router.navigateByUrl('/diario');
  }

  protected saveContact(value: string): void {
    this.store.patch({ trustedContact: value.trim() });
    this.notice.set('saved');
  }

  protected suggest(value: string): void {
    if (!value.trim()) return;
    this.store.patch({ suggestions: [...this.store.state().suggestions, value.trim()] });
    this.notice.set('suggestThanks');
  }
}
