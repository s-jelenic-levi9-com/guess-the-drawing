import { Component, Input, Output, EventEmitter, ViewChild, ElementRef, AfterViewInit, OnDestroy, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Subject, takeUntil, fromEvent } from 'rxjs';
import { SocketService } from '../../../core/services/socket.service';
import { DrawingStroke, DrawingPoint, DrawingTool } from '../../../core/models';

@Component({
  selector: 'app-drawing-canvas',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './drawing-canvas.component.html',
  styleUrl: './drawing-canvas.component.scss'
})
export class DrawingCanvasComponent implements AfterViewInit, OnDestroy {
  @ViewChild('canvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  
  @Input() isDrawer = false;
  @Output() strokeEmitted = new EventEmitter<DrawingStroke>();
  @Output() canvasCleared = new EventEmitter<void>();

  private destroy$ = new Subject<void>();
  private ctx!: CanvasRenderingContext2D;
  private isDrawing = false;
  private currentStroke: DrawingPoint[] = [];
  strokeHistory: DrawingStroke[] = [];

  colors = ['#000000', '#FF0000', '#FF8000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#8000FF', '#FF00FF', '#FFFFFF'];
  brushSizes = [4, 8, 12, 20, 32];

  currentColor = signal('#000000');
  currentBrushSize = signal(8);
  currentTool = signal<'brush' | 'eraser'>('brush');

  constructor(private socketService: SocketService) {}

  ngAfterViewInit(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx = canvas.getContext('2d')!;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';

    this.setupCanvasEvents();
    this.setupSocketListeners();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupCanvasEvents(): void {
    const canvas = this.canvasRef.nativeElement;

    // Mouse events
    fromEvent<MouseEvent>(canvas, 'mousedown')
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => this.startDrawing(e));

    fromEvent<MouseEvent>(canvas, 'mousemove')
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => this.draw(e));

    fromEvent<MouseEvent>(canvas, 'mouseup')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.stopDrawing());

    fromEvent<MouseEvent>(canvas, 'mouseleave')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.stopDrawing());

    // Touch events
    fromEvent<TouchEvent>(canvas, 'touchstart')
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => this.startDrawingTouch(e));

    fromEvent<TouchEvent>(canvas, 'touchmove')
      .pipe(takeUntil(this.destroy$))
      .subscribe(e => this.drawTouch(e));

    fromEvent<TouchEvent>(canvas, 'touchend')
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.stopDrawing());
  }

  private setupSocketListeners(): void {
    this.socketService.onDrawingUpdate()
      .pipe(takeUntil(this.destroy$))
      .subscribe(stroke => this.drawStroke(stroke));

    this.socketService.onDrawingCleared()
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => this.doClearCanvas());
  }

  private startDrawing(e: MouseEvent): void {
    if (!this.isDrawer) return;
    
    this.isDrawing = true;
    const point = this.getCanvasPoint(e);
    this.currentStroke = [point];
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
  }

  private startDrawingTouch(e: TouchEvent): void {
    if (!this.isDrawer) return;
    e.preventDefault();
    
    const touch = e.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const point = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    
    this.isDrawing = true;
    this.currentStroke = [point];
    
    this.ctx.beginPath();
    this.ctx.moveTo(point.x, point.y);
  }

  private draw(e: MouseEvent): void {
    if (!this.isDrawing || !this.isDrawer) return;

    const point = this.getCanvasPoint(e);
    this.currentStroke.push(point);

    this.ctx.strokeStyle = this.currentTool() === 'eraser' ? '#FFFFFF' : this.currentColor();
    this.ctx.lineWidth = this.currentBrushSize();
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
  }

  private drawTouch(e: TouchEvent): void {
    if (!this.isDrawing || !this.isDrawer) return;
    e.preventDefault();

    const touch = e.touches[0];
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    const point = {
      x: touch.clientX - rect.left,
      y: touch.clientY - rect.top
    };
    
    this.currentStroke.push(point);

    this.ctx.strokeStyle = this.currentTool() === 'eraser' ? '#FFFFFF' : this.currentColor();
    this.ctx.lineWidth = this.currentBrushSize();
    this.ctx.lineTo(point.x, point.y);
    this.ctx.stroke();
  }

  private stopDrawing(): void {
    if (!this.isDrawing) return;
    this.isDrawing = false;

    if (this.currentStroke.length > 0 && this.isDrawer) {
      const stroke: DrawingStroke = {
        points: this.currentStroke,
        color: this.currentTool() === 'eraser' ? '#FFFFFF' : this.currentColor(),
        width: this.currentBrushSize(),
        timestamp: Date.now()
      };
      
      this.strokeHistory.push(stroke);
      this.strokeEmitted.emit(stroke);
    }

    this.currentStroke = [];
  }

  private getCanvasPoint(e: MouseEvent): DrawingPoint {
    const rect = this.canvasRef.nativeElement.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    };
  }

  private drawStroke(stroke: DrawingStroke): void {
    if (stroke.points.length === 0) return;

    this.ctx.beginPath();
    this.ctx.strokeStyle = stroke.color;
    this.ctx.lineWidth = stroke.width;
    this.ctx.moveTo(stroke.points[0].x, stroke.points[0].y);

    for (let i = 1; i < stroke.points.length; i++) {
      this.ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    this.ctx.stroke();
  }

  selectColor(color: string): void {
    this.currentColor.set(color);
    this.currentTool.set('brush');
  }

  selectBrushSize(size: number): void {
    this.currentBrushSize.set(size);
  }

  selectTool(tool: 'brush' | 'eraser'): void {
    this.currentTool.set(tool);
  }

  clearCanvas(): void {
    this.doClearCanvas();
    this.canvasCleared.emit();
  }

  private doClearCanvas(): void {
    const canvas = this.canvasRef.nativeElement;
    this.ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.ctx.fillStyle = '#FFFFFF';
    this.ctx.fillRect(0, 0, canvas.width, canvas.height);
    this.strokeHistory = [];
  }

  undo(): void {
    if (this.strokeHistory.length === 0) return;
    
    this.strokeHistory.pop();
    this.doClearCanvas();
    
    for (const stroke of this.strokeHistory) {
      this.drawStroke(stroke);
    }
  }
}
