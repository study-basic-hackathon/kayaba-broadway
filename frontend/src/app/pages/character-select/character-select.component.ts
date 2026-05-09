import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router } from '@angular/router';
import { CHARACTERS } from '../../data/characters';

@Component({
  selector: 'app-character-select',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './character-select.component.html',
  styleUrl: './character-select.component.scss',
})
export class CharacterSelectComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  fieldId = this.route.snapshot.paramMap.get('fieldId') ?? '';
  characters = CHARACTERS;
  selectCharacter(characterId: string) {
    localStorage.setItem('selectedCharacter', characterId);
    this.router.navigate(['/game', this.fieldId]);
  }
}
