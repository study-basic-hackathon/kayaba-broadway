import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';

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

  fields: any[] = [];
  labels = ['Label', 'Label', 'Label'];
  activeLabel = 1;

  ngOnInit() {
    this.http.get('http://localhost:8787/fields').subscribe({
      next: (data) => console.log(data),
      error: (error) => console.log(error),
    });

    this.fields = Array(1).fill({ title: 'Title', updated: 'Updated 2 days ago' });
  }

  onClick() {
    this.router.navigate(['/field']);
  }
}
