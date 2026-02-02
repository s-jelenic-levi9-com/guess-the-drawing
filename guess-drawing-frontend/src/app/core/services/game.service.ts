import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Room, RoomSettings } from '../models';

@Injectable({
  providedIn: 'root'
})
export class GameService {
  private readonly apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  createRoom(settings?: Partial<RoomSettings>): Observable<{ room: Room }> {
    return this.http.post<{ room: Room }>(`${this.apiUrl}/games/create`, { settings });
  }

  getActiveRooms(): Observable<{ rooms: Room[] }> {
    return this.http.get<{ rooms: Room[] }>(`${this.apiUrl}/games/active`);
  }

  getRoomDetails(roomCode: string): Observable<{ room: Room }> {
    return this.http.get<{ room: Room }>(`${this.apiUrl}/games/${roomCode}`);
  }
}
