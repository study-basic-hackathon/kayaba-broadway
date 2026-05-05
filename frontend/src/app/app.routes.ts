import { Routes } from '@angular/router';
import { RegisterComponent } from './pages/register/register.component';
import { LoginComponent } from './pages/login/login.component';
import { FieldComponent } from './pages/field/field.component';
import { FieldsComponent } from './pages/fields/fields.component';
import { GameComponent } from './pages/game/game.component';
import { authGuard } from './guards/auth.guard';
import { PurchaseSuccessComponent } from './pages/purchase-success/purchase-success.component';

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
      { path: 'game/:fieldId', component: GameComponent },
      {
        path: 'payment/success',
        component: PurchaseSuccessComponent,
      },
    ],
  },
];
