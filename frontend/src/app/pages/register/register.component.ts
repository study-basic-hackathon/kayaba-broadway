import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../services/auth.service';
import { toast } from 'ngx-sonner';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [FormsModule, CommonModule, RouterLink],
  templateUrl: './register.component.html',
  styleUrl: './register.component.scss',
})
export class RegisterComponent {
  private router = inject(Router);
  private auth = inject(AuthService);

  displayName = '';
  email = '';
  password = '';
  confirmPassword = '';
  isLoading = signal(false);

  async onSubmit() {
    this.isLoading.set(true);
    try {
      await this.auth.register(this.displayName, this.email, this.password, this.confirmPassword);
      this.router.navigate(['/fields'], { replaceUrl: true });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      this.isLoading.set(false);
    }
  }
}
