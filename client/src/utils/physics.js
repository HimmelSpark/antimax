export class BubblePhysics {
  constructor(x, y, size) {
    this.x = x;
    this.y = y;
    this.vx = 0;
    this.vy = 0;
    this.size = size;
    this.friction = 0.96;
    this.bounceFactor = 0.6;
    this.isDragging = false;
    this.lastMouseX = 0;
    this.lastMouseY = 0;
    this.lastTime = 0;
  }

  startDrag(mouseX, mouseY) {
    this.isDragging = true;
    this.vx = 0;
    this.vy = 0;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.lastTime = performance.now();
  }

  drag(mouseX, mouseY) {
    if (!this.isDragging) return;
    const now = performance.now();
    const dt = Math.max(now - this.lastTime, 1);
    this.vx = ((mouseX - this.lastMouseX) / dt) * 16;
    this.vy = ((mouseY - this.lastMouseY) / dt) * 16;
    this.x = mouseX - this.size / 2;
    this.y = mouseY - this.size / 2;
    this.lastMouseX = mouseX;
    this.lastMouseY = mouseY;
    this.lastTime = now;
  }

  release() {
    this.isDragging = false;
  }

  update(viewportWidth, viewportHeight) {
    if (this.isDragging) return;

    this.vx *= this.friction;
    this.vy *= this.friction;

    this.x += this.vx;
    this.y += this.vy;

    if (this.x < 0) {
      this.x = 0;
      this.vx = Math.abs(this.vx) * this.bounceFactor;
    }
    if (this.x + this.size > viewportWidth) {
      this.x = viewportWidth - this.size;
      this.vx = -Math.abs(this.vx) * this.bounceFactor;
    }
    if (this.y < 0) {
      this.y = 0;
      this.vy = Math.abs(this.vy) * this.bounceFactor;
    }
    if (this.y + this.size > viewportHeight) {
      this.y = viewportHeight - this.size;
      this.vy = -Math.abs(this.vy) * this.bounceFactor;
    }

    if (Math.abs(this.vx) < 0.1) this.vx = 0;
    if (Math.abs(this.vy) < 0.1) this.vy = 0;
  }

  isMoving() {
    return Math.abs(this.vx) > 0.1 || Math.abs(this.vy) > 0.1;
  }
}
