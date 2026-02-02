import { Component, Input, OnInit, OnDestroy, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-timer',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './timer.component.html',
  styleUrl: './timer.component.scss'
})
export class TimerComponent implements OnInit, OnDestroy {
  @Input() duration = 90;
  @Input() startTime = 0;

  timeLeft = signal(90);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  ngOnInit(): void {
    this.startTimer();
  }

  ngOnDestroy(): void {
    this.stopTimer();
  }

  private startTimer(): void {
    this.updateTimeLeft();
    this.intervalId = setInterval(() => {
      this.updateTimeLeft();
    }, 1000);
  }

  private stopTimer(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private updateTimeLeft(): void {
    if (this.startTime === 0) {
      this.timeLeft.set(this.duration);
      return;
    }

    const elapsed = Math.floor((Date.now() - this.startTime) / 1000);
    const remaining = Math.max(0, this.duration - elapsed);
    this.timeLeft.set(remaining);
  }

  formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  }
}
