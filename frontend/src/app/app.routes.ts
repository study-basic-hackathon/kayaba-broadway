import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { FieldComponent } from './pages/field/field.component';
import { FieldsComponent } from './pages/fields/fields.component';
import { authGuard } from './guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  {
    path: '',
    canActivate: [authGuard],
    children: [
      { path: 'field', component: FieldComponent },
      { path: 'fields', component: FieldsComponent },
    ],
  },
];
