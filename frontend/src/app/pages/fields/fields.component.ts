import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-fields',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './fields.component.html',
  styleUrl: './fields.component.scss',
})
export class FieldsComponent implements OnInit {
  auth = inject(AuthService);

  fields: any[] = [];
  labels = ['Label', 'Label', 'Label', 'Label', 'Label'];
  activeLabel = 1;

  ngOnInit() {
    const accessToken = localStorage.getItem('accessToken');

    fetch('http://localhost:8787/fields', {
      headers: { Authorization: `Bearer ${accessToken}` },
    })
      .then((res) => res.json())
      .catch((error) => console.log(error))
      .then((data) => {
        console.log(data);
      });

    this.fields = Array(23).fill({ title: 'Title', updated: 'Updated 2 days ago' });
  }
}
