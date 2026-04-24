import { Routes } from '@angular/router';
import { LoginComponent } from './pages/login/login.component';
import { FieldComponent } from './pages/field/field.component';
import { FieldsComponent } from './pages/fields/fields.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'field', component: FieldComponent },
  { path: 'fields', component: FieldsComponent },
];
