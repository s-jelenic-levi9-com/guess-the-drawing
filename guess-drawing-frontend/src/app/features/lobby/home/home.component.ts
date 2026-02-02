import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../core/services/auth.service';
import { GameService } from '../../../core/services/game.service';
import { Room } from '../../../core/models';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './home.component.html',
  styleUrl: './home.component.scss'
})
export class HomeComponent implements OnInit {
  rooms = signal<Room[]>([]);
  isLoading = signal(true);
  isCreating = signal(false);

  constructor(
    public authService: AuthService,
    private gameService: GameService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.refreshRooms();
  }

  refreshRooms(): void {
    this.isLoading.set(true);
    this.gameService.getActiveRooms().subscribe({
      next: (response) => {
        this.rooms.set(response.rooms);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  createRoom(): void {
    this.isCreating.set(true);
    this.gameService.createRoom().subscribe({
      next: (response) => {
        this.router.navigate(['/room', response.room.code]);
      },
      error: () => {
        this.isCreating.set(false);
      }
    });
  }

  joinRoom(roomCode: string): void {
    if (roomCode && roomCode.trim()) {
      this.router.navigate(['/room', roomCode.toUpperCase()]);
    }
  }

  quickJoin(): void {
    const waitingRooms = this.rooms().filter(
      r => r.status === 'waiting' && r.players.length < r.maxPlayers
    );
    
    if (waitingRooms.length > 0) {
      const randomRoom = waitingRooms[Math.floor(Math.random() * waitingRooms.length)];
      this.joinRoom(randomRoom.code);
    } else {
      this.createRoom();
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
