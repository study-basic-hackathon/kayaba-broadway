import { Routes } from '@angular/router';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { FieldComponent } from './pages/field/field.component';
import { FieldsComponent } from './pages/fields/fields.component';
import { PaymentComponent } from './pages/payment/payment.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'register', component: RegisterComponent },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'field', component: FieldComponent },
      { path: 'fields', component: FieldsComponent },
      { path: 'payment', component: PaymentComponent },
    ],
  },
];
