import { Component, OnInit, inject, signal, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

interface Field {
  id: string;
  name: string;
  description: string | null;
  background_url: string | null;
  width: number;
  height: number;
  created_at: number;
}

interface FieldsResponse {
  fields: Field[];
}

@Component({
  selector: 'app-fields',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fields.component.html',
  styleUrl: './fields.component.scss',
})
export class FieldsComponent implements OnInit {
  auth = inject(AuthService);
  http = inject(HttpClient);
  router = inject(Router);

  labels = ['Label', 'Label', 'Label'];
  activeLabel = 1;
  isMenuOpen = signal(false);
  fields = signal<Field[]>([]);
  activeNav = signal<'create' | 'fields' | 'account'>('fields');

  toggleMenu() {
    this.isMenuOpen.update((v) => !v);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent) {
    const target = event.target as HTMLElement;
    if (!target.closest('.account-menu-wrapper')) {
      this.isMenuOpen.set(false);
    }
  }

  ngOnInit() {
    this.http.get<FieldsResponse>('http://localhost:8787/fields').subscribe({
      next: (data) => {
        this.fields.set(data.fields);
      },
      error: (error) => console.log(error),
    });
  }

  onClick(id: string) {
    this.router.navigate(['/field'], { queryParams: { id } });
  }

  logout() {
    this.auth.logout();
    this.router.navigate(['/login'], { replaceUrl: true });
  }
}
