import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Player } from '../../../core/models';

@Component({
  selector: 'app-player-list',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './player-list.component.html',
  styleUrl: './player-list.component.scss'
})
export class PlayerListComponent {
  @Input() players: Player[] = [];
  @Input() currentDrawerId = '';
  @Input() scores: Record<string, number> = {};

  get sortedPlayers(): Player[] {
    return [...this.players].sort((a, b) => {
      const scoreA = this.scores[a.id] || 0;
      const scoreB = this.scores[b.id] || 0;
      return scoreB - scoreA;
    });
  }

  getPlayerScore(playerId: string): number {
    return this.scores[playerId] || 0;
  }
}
