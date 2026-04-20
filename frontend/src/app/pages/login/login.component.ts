import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.scss',
})
export class LoginComponent {
  private router = inject(Router);
  private auth = inject(AuthService);

  email = '';
  password = '';
  isLoading = signal(false);

  async onSubmit() {
    this.isLoading.set(true);
    try {
      await this.auth.login(this.email, this.password);
      this.router.navigate(['/fields']);
    } catch (error) {
      toast.error('ログインに失敗しました');
    } finally {
      this.isLoading.set(false);
    }
  }
}
