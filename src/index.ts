class Sprite {
  public image: CanvasImageSource;

  constructor(
    public url: string,
    public pos: [x: number, y: number],
    public size: [width: number, height: number],
    public ctx: CanvasRenderingContext2D,
    public resources: Resources
  ) {
    this.image = resources.getImage(url)!;
  }

  public render() {
    if (!this.ctx) {
      return;
    }

    var x = this.pos[0];
    var y = this.pos[1];

    this.ctx.drawImage(this.image, x, y, this.size[0], this.size[1]);
  }
}

type Enemy = {
  pos: {
    x: number;
    y: number;
  };
  sprite: Sprite;
};

class Resources {
  constructor(imagesToLoad: string[]) {
    this.loadImages(imagesToLoad);
  }
  private resourcesBuffer: { [x: string]: CanvasImageSource | null } = {};
  public readyCallbacks: Function[] = [];

  public loadImages(imagesToLoad: string[]) {
    imagesToLoad.map((url) => {
      if (this.resourcesBuffer[url]) {
        return this.resourcesBuffer[url];
      } else {
        var image = new Image();

        image.onload = () => {
          this.resourcesBuffer[url] = image;
        };
        this.resourcesBuffer[url] = null;
        image.src = url;
        // https://www.reddit.com/r/vuejs/comments/de6a53/image_onload_not_being_called/
        image.onerror = (e) => {
          console.log(e);
        };
      }
    });
  }

  public getImage(url: string) {
    return this.resourcesBuffer[url];
  }
}

class GameConstructor {
  public currentTargets: Enemy[] = [];
  public currentTargetsAdded: number = 0;
  public canvas = document.getElementById("canvas") as HTMLCanvasElement;
  public context = this.canvas.getContext("2d")!;
  public gamePause: boolean = true;
  public menuWrapper = document.getElementById("menu-wrapper")!;
  public menu = document.getElementById("menu")!;
  public resources: Resources = new Resources(["./images/ninja.png"]);
  public hardnessLevel: number = 0;
  public totalGameTime: number = 0;
  public timeLeft: number = 0;
  public addDynamically: boolean = true;
  public targetEnimiesCount: number = 0;
  public killedEnemies: number = 0;

  private addEntityInterval: /*TimerHandler*/ any | null = null;
  private timeCountInterval: /*Function*/ any | null = null;
  private endGameTimeout: any | null = null;

  private mousePos: { x: number; y: number } = { x: 0, y: 0 };

  constructor(public debugMode: boolean) {
    var form = this.menu.querySelector("form")!;
    form.addEventListener("submit", (e) => this.prepareGame(e, form));

    var gameOverScreen = this.menu.querySelector(".game-over") as HTMLElement;
    gameOverScreen.querySelector("button")?.addEventListener("click", () => this.playAgain());

    this.canvas.addEventListener("mousemove", (e) => this.getMousePos(e));
    this.canvas.addEventListener("click", () => this.checkIntersection());
  }

  private getMousePos(evt: MouseEvent) {
    var rect = this.canvas.getBoundingClientRect(),
      root = document.documentElement;

    // return relative mouse position
    var mouseX = evt.clientX - rect.left - root.scrollLeft;
    var mouseY = evt.clientY - rect.top - root.scrollTop;
    this.mousePos = {
      x: mouseX,
      y: mouseY,
    };
  }

  private renderDebugMousePos() {
    if (this.debugMode) {
      var ctx = this.context!;

      ctx.save();
      ctx.translate(0, 0);

      ctx.font = "bold 15px serif";
      ctx.fillStyle = "black";
      ctx.fillText(`Mouse PosX: ${this.mousePos.x}`, 0, 15);
      ctx.fillText(`Mouse PosY: ${this.mousePos.y}`, 0, 30);

      ctx.restore();
    }
  }
  private updateMenuVisibility(show: boolean) {
    if (show) {
      this.menuWrapper.style.display = "block";
    } else {
      this.menuWrapper.style.display = "none";
    }
  }
  private renderTimer() {
    // @ https://stackoverflow.com/questions/21294302/converting-milliseconds-to-minutes-and-seconds-with-javascript
    function millisToMinutesAndSeconds(millis: number) {
      var minutes = Math.floor(millis / 60000);
      var seconds = parseFloat(((millis % 60000) / 1000).toFixed(0));
      return minutes + ":" + (seconds < 10 ? "0" : "") + seconds;
    }

    var ctx = this.context!;

    ctx.save();
    ctx.translate(this.canvas.width / 2, 100);

    ctx.font = "bold 15px serif";
    ctx.fillStyle = "black";
    ctx.fillText(millisToMinutesAndSeconds(this.timeLeft), 0, 0);

    ctx.restore();
  }

  private renderEntityCount() {
    var ctx = this.context!;

    ctx.save();
    ctx.translate(this.canvas.width / 2, 100);

    ctx.font = "bold 15px serif";
    ctx.fillStyle = "red";
    ctx.fillText(`Осталось врагов: ${this.currentTargets.length}`, -50, 20);
    ctx.fillText(`Убито врагов: ${this.killedEnemies}`, -30, 40);

    ctx.restore();
  }
  private createEntity() {
    function randomIntFromInterval(min: number, max: number) {
      // min and max included
      return Math.floor(Math.random() * (max - min + 1) + min);
    }

    var newTarget: Enemy = {
      pos: {
        x: randomIntFromInterval(100, this.canvas.width - 100),
        y: randomIntFromInterval(100, this.canvas.height - 100),
      },
      sprite: new Sprite("./images/ninja.png", [0, 0], [70, 70], this.canvas.getContext("2d")!, this.resources),
    };
    this.currentTargetsAdded = this.currentTargetsAdded + 1;
    // this.currentTargetsAdded = ++this.currentTargetsAdded
    this.currentTargets.push(newTarget);
  }
  private checkIntersection() {
    this.currentTargets.map((target) => {
      if (
        this.mousePos.x >= target.pos.x &&
        this.mousePos.x <= target.pos.x + target.sprite.size[0] &&
        this.mousePos.y >= target.pos.y &&
        this.mousePos.y <= target.pos.y + target.sprite.size[1]
      ) {
        this.removeEntity(target);
      }
    });
  }
  private removeEntity(target: Enemy) {
    this.currentTargets = this.currentTargets.filter((enemy) => enemy !== target);
    this.killedEnemies = this.killedEnemies + 1;
    // пока что нет удаления врагов и способа их удаления
  }

  private handleAddingEntities(maximumEntities: number) {
    if (this.addDynamically) {
      if (this.currentTargets.length < maximumEntities) {
        this.createEntity();
      }
    } else {
      if (this.currentTargetsAdded < maximumEntities) {
        this.createEntity();
      }
    }
  }
  private renderEntities(entityArr: Enemy[]) {
    entityArr.map((element) => this.renderEntity(element));
  }
  private renderEntity(element: Enemy) {
    var ctx = this.context!;

    ctx.save();
    ctx.translate(element.pos.x, element.pos.y);
    element.sprite.render();
    if (this.debugMode) {
      // @ https://stackoverflow.com/questions/5158222/how-do-i-style-html5-canvas-text-to-be-bold-and-or-italic
      ctx.font = "20px serif";
      ctx.fillStyle = "red";
      ctx.fillText(`x: ${element.pos.x}, y: ${element.pos.y}`, 0, 20);
      ctx.fillStyle = "blue";
      ctx.fillText(`xs: ${element.sprite.size[0]}, ys: ${element.sprite.size[1]}`, 0, 40);
    }
    ctx.restore();
  }

  public updateCanvas() {
    if (!this.gamePause) {
      requestAnimationFrame(this.updateCanvas.bind(this));
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
      this.renderEntities(this.currentTargets);
      this.renderTimer();
      this.renderEntityCount();
      this.renderDebugMousePos();
      if (this.targetEnimiesCount === this.killedEnemies) {
        this.endGame(1);
      }
    } else {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
  }
  public prepareGame(e: SubmitEvent, form: HTMLFormElement) {
    e.preventDefault();
    var hardnessValue = Number((form[0] as HTMLInputElement).value);
    var dynamicallyAdding = (form[1] as HTMLInputElement).checked;
    console.log(hardnessValue, dynamicallyAdding);
    if (
      (!hardnessValue || typeof hardnessValue !== "number" || hardnessValue < 1 || hardnessValue > 3) &&
      !dynamicallyAdding
    ) {
      return;
    } else {
      this.addDynamically = dynamicallyAdding;
      this.hardnessLevel = hardnessValue;
      this.startGame();
    }
  }
  public startGame() {
    if (this.hardnessLevel > 3 || this.hardnessLevel < 1) {
      return this.endGame(3);
    }

    this.gamePause = false;
    this.updateMenuVisibility(false);

    switch (this.hardnessLevel) {
      case 1: {
        this.targetEnimiesCount = 200;
        this.addEntityInterval = setInterval(() => this.handleAddingEntities(this.targetEnimiesCount), 5 * 200);
        this.totalGameTime = this.timeLeft = 4 * 60000;
        break;
      }
      case 2: {
        this.targetEnimiesCount = 200;
        this.addEntityInterval = setInterval(() => this.handleAddingEntities(this.targetEnimiesCount), 5 * 100);
        this.totalGameTime = this.timeLeft = 2 * 60000;
        break;
      }
      case 3: {
        this.targetEnimiesCount = 100;
        this.addEntityInterval = setInterval(() => this.handleAddingEntities(this.targetEnimiesCount), 5 * 50);
        this.totalGameTime = this.timeLeft = 0.5 * 60000;
        break;
      }
    }
    this.timeCountInterval = setInterval(() => (this.timeLeft -= 1000), 1000);
    this.endGameTimeout = setTimeout(() => this.endGame(2), this.totalGameTime);

    this.updateCanvas();
  }
  public endGame(gameEndCase: number) {
    this.gamePause = true;
    this.context.clearRect(0, 0, canvas.width, canvas.height);

    this.updateMenuVisibility(true);
    var homeScreen = this.menu.querySelector(".home") as HTMLElement;
    homeScreen.style.display = "none";

    var gameOverScreen = this.menu.querySelector(".game-over") as HTMLElement;
    gameOverScreen.style.display = "block";
    var textZone = gameOverScreen.querySelector(".game-over-text") as HTMLElement;

    var h1 = document.createElement("h1");
    var span = document.createElement("span");
    switch (gameEndCase) {
      case 1: {
        // игрок убил всех врагов
        h1.innerHTML = "Вы убили всех врагов";
        span.innerHTML = `Убито врагов: ${this.killedEnemies}`;
        break;
      }
      case 2: {
        // игра закончилась по времени
        h1.innerHTML = "Время закончилось!";
        span.innerHTML = `Врагов осталось: ${this.currentTargets.length} <br/> Убито врагов: ${this.killedEnemies}`;
        break;
      }
      case 3:
      default: {
        // остальное, например, если игрок переборщил с уровнем сложности
        h1.innerHTML = "Ошибка";

        break;
      }
    }
    textZone.append(h1);
    textZone.append(span);
  }
  public playAgain() {
    var homeScreen = this.menu.querySelector(".home") as HTMLElement;
    homeScreen.style.display = "block";

    var gameOverScreen = this.menu.querySelector(".game-over") as HTMLElement;
    gameOverScreen.style.display = "none";
    var textZone = gameOverScreen.querySelector(".game-over-text") as HTMLElement;
    textZone.innerHTML = "";

    this.currentTargets = [];
    this.currentTargetsAdded = 0;
    this.gamePause = true;
    this.hardnessLevel = 0;
    this.totalGameTime = 0;
    this.timeLeft = 0;
    this.addDynamically = true;
    this.killedEnemies = 0;

    clearInterval(this.addEntityInterval);
    this.addEntityInterval = null;
    clearInterval(this.timeCountInterval);
    this.timeCountInterval = null;
    clearTimeout(this.endGameTimeout);
    this.endGameTimeout = null;
  }
}
var parentPage = document.getElementById("root");
var canvas = document.getElementById("canvas") as HTMLCanvasElement;

if (parentPage && canvas) {
  var game = new GameConstructor(true);
}
