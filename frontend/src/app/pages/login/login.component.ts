import { Component } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';

  async onSubmit() {
    const res = await fetch('http://localhost:8787/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: this.email, password: this.password }),
      credentials: 'include',
    });

    if (!res.ok) {
      const { error } = await res.json();
      this.error = error;
      return;
    }

    const { accessToken } = await res.json();
    console.log(accessToken);
  }
}
