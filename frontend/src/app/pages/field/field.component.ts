import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-field',
  imports: [CommonModule],
  standalone: true,
  templateUrl: './field.component.html',
  styleUrl: './field.component.scss',
})
export class FieldComponent implements OnInit {
  ngOnInit() {}

  onClick() {
    alert('クリック！');
  }
}
