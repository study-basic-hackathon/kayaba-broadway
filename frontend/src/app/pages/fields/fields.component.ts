import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './fields.component.html',
  styleUrl: './fields.component.scss',
})
export class FieldsComponent {
  constructor(private router: Router) {}

  // email = '';
  // password = '';
  // error = '';

  // async onSubmit() {
  //   const res = await fetch('http://localhost:8787/auth/login', {
  //     method: 'POST',
  //     headers: { 'Content-Type': 'application/json' },
  //     body: JSON.stringify({ email: this.email, password: this.password }),
  //     credentials: 'include',
  //   });

  //   if (!res.ok) {
  //     const { error } = await res.json();
  //     this.error = error;
  //     return;
  //   }

  //   const { accessToken } = await res.json();
  //   this.router.navigate(['/field']);
  // }
}
