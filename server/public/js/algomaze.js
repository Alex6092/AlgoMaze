function Gem(x, y)
{
    this.x = x;
    this.y = y;
    this.collected = false;
    this.image = Loader.getImage('gem');

    this.gridCollected = false;
}

Gem.prototype.getImage = function() {
    return this.image;
}

Gem.prototype.isCollected = function() {
    return this.collected;
}

Gem.prototype.collect = function() {
    this.collected = true;
}

Gem.prototype.reset = function() {
    this.collected = false;
    this.gridCollected = false;
}

function Switch(x, y, initialState)
{
    this.x = x;
    this.y = y;
    this.initialState = initialState;
    this.state = this.initialState;
    this.gridState = this.initialState;

    this.images = {}
    this.images[SwitchState.On] = Loader.getImage('switch_on');
    this.images[SwitchState.Off] = Loader.getImage('switch_off');
}

Switch.prototype.getImage = function() {
    return this.images[this.state];
}

Switch.prototype.reset = function() {
    this.state = this.initialState;
    this.gridState = this.initialState;
}

Switch.prototype.toggle = function() {
    if(this.state == SwitchState.On)
    {
        this.state = SwitchState.Off;
    }
    else
    {
        this.state = SwitchState.On;
    }
}

var map = {
    cols: 12,
    rows: 12,
    tsize: 64,
    layers: [[
        3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 1, 2, 1, 1, 1, 1, 3,
        3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 2, 2, 1, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 2, 1, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
        3, 1, 1, 1, 1, 2, 1, 1, 1, 1, 1, 3,
        3, 3, 3, 3, 3, 2, 3, 3, 3, 3, 3, 3
    ], [
        4, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 5, 0, 0, 0, 0, 0, 5, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4,
        4, 4, 4, 0, 5, 4, 4, 4, 4, 4, 4, 4,
        4, 4, 4, 0, 0, 3, 3, 3, 3, 3, 3, 3
    ]],

    switches: [ { x: 128, y: 192, state: false }, { x: 256, y: 192, state: true} ],
    gems: [ { x: 128, y: 64 }],
    teleport1: [],
    teleport2: [],
    teleport3: [],
    teleport4: [],
    randomTile: [],
    startPosition: { x: 128, y: 128 },
    startDirection: Direction.Down,
    getTile: function (layer, col, row) {
        return this.layers[layer][row * map.cols + col];
    },
    isSolidTileAtXY: function (x, y) {
        var col = Math.floor(x / this.tsize);
        var row = Math.floor(y / this.tsize);

        if(col < 0 || col >= this.cols || row < 0 || row >= this.rows)
            return true;

        // tiles 3 and 5 are solid -- the rest are walkable
        // loop through all layers and return TRUE if any tile is solid
        return this.layers.reduce(function (res, layer, index) {
            var tile = this.getTile(index, col, row);
            var isSolid = tile === 3 || tile === 5 || (tile === 0 && layer == 0);
            return res || isSolid;
        }.bind(this), false);
    },
    getCol: function (x) {
        return Math.floor(x / this.tsize);
    },
    getRow: function (y) {
        return Math.floor(y / this.tsize);
    },
    getX: function (col) {
        return col * this.tsize;
    },
    getY: function (row) {
        return row * this.tsize;
    }
};

function Hero(map) {
    this.startX = map.startPosition.x + map.tsize / 2;
    this.startY = map.startPosition.y + map.tsize / 2;
    this.startDirection = map.startDirection;
    this.map = map;
    this.x = this.startX;
    this.y = this.startY;
    this.xGrid = Math.floor(this.x / map.tsize);
    this.yGrid = Math.floor(this.y / map.tsize);
    this.width = map.tsize;
    this.height = map.tsize;

    this.images = {};
    this.images[Direction.Down] = Loader.getImage('hero_down');
    this.images[Direction.Up] = Loader.getImage('hero_up');
    this.images[Direction.Left] = Loader.getImage('hero_left');
    this.images[Direction.Right] = Loader.getImage('hero_right');

    this.direction = this.startDirection;
}

Hero.SPEED = 192; // pixels per second

Hero.prototype.getImage = function() {
    return this.images[this.direction];
}

Hero.prototype.move = function (delta, dirx, diry) {
    // move hero
    this.x += dirx * Hero.SPEED * delta;
    this.y += diry * Hero.SPEED * delta;

    // check if we walked into a non-walkable tile
    this._collide(dirx, diry);

    // clamp values
    var maxX = this.map.cols * this.map.tsize;
    var maxY = this.map.rows * this.map.tsize;
    this.x = Math.max(0, Math.min(this.x, maxX));
    this.y = Math.max(0, Math.min(this.y, maxY));
};

Hero.prototype.goDown = function(delta, onFinished)
{
    this.direction = Direction.Down;
    var curX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 0, 1);

    var newX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    if(newY > curY)
    {
        this.y = newY * map.tsize + map.tsize / 2;
        onFinished();
    }
}

Hero.prototype.goUp = function(delta, onFinished)
{
    this.direction = Direction.Up;
    var curX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 0, -1);

    var newX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    if (newY < curY)
    {
        this.y = newY * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.goLeft = function(delta, onFinished)
{
    this.direction = Direction.Left;
    var curX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, -1, 0);

    var newX = Math.ceil((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.ceil((this.y - map.tsize / 2) / map.tsize);

    if (newX < curX)
    {
        this.x = newX * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.goRight = function(delta, onFinished)
{
    this.direction = Direction.Right;
    var curX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var curY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    this.move(delta, 1, 0);

    var newX = Math.floor((this.x - map.tsize / 2) / map.tsize);
    var newY = Math.floor((this.y - map.tsize / 2) / map.tsize);

    if (newX > curX)
    {
        this.x = newX * map.tsize + map.tsize / 2;
        onFinished();
    }
};

Hero.prototype.resetPosition = function()
{
    this.x = this.startX;
    this.y = this.startY;
    this.xGrid = Math.floor(this.startX / this.map.tsize);
    this.yGrid = Math.floor(this.startY / this.map.tsize);
    this.gridDirection = this.startDirection;
    this.direction = this.startDirection;
}

Hero.prototype.turnLeft = function()
{
    if(this.direction == Direction.Down)
    {
        this.direction = Direction.Right;
    }
    else if(this.direction == Direction.Right)
    {
        this.direction = Direction.Up;
    }
    else if(this.direction == Direction.Up)
    {
        this.direction = Direction.Left;
    }
    else if(this.direction == Direction.Left)
    {
        this.direction = Direction.Down;
    }
}

Hero.prototype._collide = function (dirx, diry) {
    var row, col;
    // -1 in right and bottom is because image ranges from 0..63
    // and not up to 64
    var left = this.x - this.width / 2;
    var right = this.x + this.width / 2 - 1;
    var top = this.y - this.height / 2;
    var bottom = this.y + this.height / 2 - 1;

    // check for collisions on sprite sides
    var collision =
        this.map.isSolidTileAtXY(left, top) ||
        this.map.isSolidTileAtXY(right, top) ||
        this.map.isSolidTileAtXY(right, bottom) ||
        this.map.isSolidTileAtXY(left, bottom);
    if (!collision) { return; }

    if (diry > 0) {
        row = this.map.getRow(bottom);
        this.y = -this.height / 2 + this.map.getY(row);
    }
    else if (diry < 0) {
        row = this.map.getRow(top);
        this.y = this.height / 2 + this.map.getY(row + 1);
    }
    else if (dirx > 0) {
        col = this.map.getCol(right);
        this.x = -this.width / 2 + this.map.getX(col);
    }
    else if (dirx < 0) {
        col = this.map.getCol(left);
        this.x = this.width / 2 + this.map.getX(col + 1);
    }
};

Game.load = function () {
    return [
        Loader.loadImage('tiles', './assets/tiles.png'),

        Loader.loadImage('hero_down', './assets/down.png'),
        Loader.loadImage('hero_up', './assets/up.png'),
        Loader.loadImage('hero_left', './assets/left.png'),
        Loader.loadImage('hero_right', './assets/right.png'),

        Loader.loadImage('gem', './assets/gem.png'),

        Loader.loadImage('switch_off', './assets/switch_off.png'),
        Loader.loadImage('switch_on', './assets/switch_on.png'),

        Loader.loadImage('teleport_1', './assets/teleport-blue.png'),
        Loader.loadImage('teleport_2', './assets/teleport-red.png'),
        Loader.loadImage('teleport_3', './assets/teleport-green.png'),
        Loader.loadImage('teleport_4', './assets/teleport-purple.png'),

        Loader.loadImage('random', './assets/random.png')
    ];
};

Game.initializeGemsAndSwitches = function() {
    this.switches = [];
    for(var i = 0; i < map.switches.length; i++)
    {
        var _switch = map.switches[i];
        this.switches.push(new Switch(_switch.x, _switch.y, _switch.state ? SwitchState.On : SwitchState.Off));
    }

    this.gems = [];
    for(var i = 0; i < map.gems.length; i++)
    {
        var gem = map.gems[i];
        this.gems.push(new Gem(gem.x, gem.y));
    }

    for(var i = 0; i < map.randomTile.length; i++)
    {
        var tile = map.randomTile[i];
        var spawn = getRandomBinary() || getRandomBinary();
        if(spawn)
        {
            var type = getRandomBinary();
            if(type)
            {
                // Spawn gemme
                this.gems.push(new Gem(tile.x, tile.y));
            }
            else
            {
                // Spawn interrupteur
                var open = getRandomBinary();
                this.switches.push(new Switch(tile.x, tile.y, open ? SwitchState.On : SwitchState.Off));
            }
        }
    }
};

Game.init = function () {
    //Keyboard.listenForEvents(
    //    [Keyboard.LEFT, Keyboard.RIGHT, Keyboard.UP, Keyboard.DOWN]);
    this.tileAtlas = Loader.getImage('tiles');

    this.actionQueue = new Array();
    this.hero = new Hero(map);
    this.initializeGemsAndSwitches();
    this.displayRandomTile = true;
    // État du visualiseur pas-à-pas.
    this.paused = false;          // si vrai, l'update boucle sans consommer la file
    // this.speed est volontairement omis : c'est une préférence utilisateur qui doit
    // persister entre les niveaux (Game.init() est appelé à chaque changement de niveau).
    if (this.speed == null) this.speed = 1;
    this.stepOnce = false;        // sur clic "Pas suivant" : autorise un seul cran puis re-pause
    this.currentActionLine = null;// ligne source de l'action en cours d'exécution
};

// Émet un CustomEvent vers le DOM pour que l'UI puisse réagir (surlignage ligne, etc.).
function _emitGameEvent(type, detail) {
    try { document.dispatchEvent(new CustomEvent(type, { detail })); } catch (e) {}
}

// Helpers pour les actions à durée fixe (turnLeft, collectGem, toggleSwitch, CHECK) :
// _holdSince est attaché à l'objet action quand il entre en tête de file.
function _holdElapsed(head) {
    if (!head || head._holdSince == null) return 0;
    return performance.now() - head._holdSince;
}
function _holdDuration(baseMs, speed) {
    return baseMs / Math.max(0.25, speed || 1);
}

// Helper qui shift la file ET incrémente le compteur de pas + émet l'event de progression.
function _consumeAction() {
    Game.actionQueue.shift();
    Game.currentStep = (Game.currentStep || 0) + 1;
    _emitGameEvent('algomaze:step', { step: Game.currentStep, total: Game.totalSteps || 0 });
}

Game.update = function (delta) {
    // Pause : on bloque la consommation de la file, mais le rendu continue.
    if (this.paused && !this.stepOnce) return;

    // Ajuste la vitesse d'animation : delta × multiplicateur.
    var effectiveDelta = delta * (this.speed || 1);

    if(this.actionQueue.length > 0)
    {
        var head = this.actionQueue[0];
        // Pour rétro-compatibilité, les actions peuvent être soit des strings (legacy)
        // soit des objets { action, line }. On normalise.
        var actionName = typeof head === 'string' ? head : head.action;
        var actionLine = typeof head === 'string' ? null : head.line;

        // À chaque NOUVELLE action en tête de file, on signale la ligne source.
        if (actionLine !== this.currentActionLine) {
            this.currentActionLine = actionLine;
            _emitGameEvent('algomaze:current-line', { line: actionLine });
        }

        // Mode pas-à-pas : on consomme une action et on re-pause aussitôt.
        if (this.stepOnce) this.stepOnce = false, this.paused = true;

        // Délègue le traitement de l'action (legacy : on utilise actionName pour le switch).
        delta = effectiveDelta;
        // (le code legacy ci-dessous lit delta, on continue avec effectiveDelta).

        if(actionName == "DOWN")
        {
            this.hero.goDown(delta, function() {
                checkTeleporter(false);
                _consumeAction();
            });
        }
        else if(actionName == "UP")
        {
            this.hero.goUp(delta, function() {
                checkTeleporter(false);
                _consumeAction();
            });
        }
        else if(actionName == "LEFT")
        {
            this.hero.goLeft(delta, function() {
                checkTeleporter(false);
                _consumeAction();
            });
        }
        else if(actionName == "RIGHT")
        {
            this.hero.goRight(delta, function() {
                checkTeleporter(false);
                _consumeAction();
            });
        }
        else if(actionName == "AVANCER")
        {
            var direction = this.hero.direction;
            var newAction = direction.toUpperCase();
            // Préserve l'info de ligne source quand on remplace AVANCER par DOWN/UP/LEFT/RIGHT.
            this.actionQueue[0] = (typeof head === 'object')
                ? { action: newAction, line: head.line }
                : newAction;
        }
        else if(actionName == "TURN_LEFT")
        {
            // Effectue le tour à l'entrée, puis maintient l'affichage 200 ms (scaled par speed)
            // pour que l'élève voie l'orientation avant l'action suivante.
            if (typeof head === 'object' && head._holdSince == null) {
                this.hero.turnLeft();
                head._holdSince = performance.now();
            }
            if (_holdElapsed(head) >= _holdDuration(200, this.speed)) {
                _consumeAction();
            }
        }
        else if(actionName == "TOGGLE_SWITCH")
        {
            // À la première frame : on marque l'interrupteur comme "en transition" et on note
            // l'ancien état pour permettre le crossfade entre les deux images.
            if (typeof head === 'object' && head._holdSince == null) {
                head._holdSince = performance.now();
                var hx = this.hero.x - map.tsize / 2;
                var hy = this.hero.y - map.tsize / 2;
                for (var i = 0; i < this.switches.length; i++) {
                    var sw = this.switches[i];
                    if (sw.x == hx && sw.y == hy) {
                        sw.animatingToggle = { fromState: sw.state, progress: 0 };
                        head._switch = sw;
                        break;
                    }
                }
            }
            var sd = _holdDuration(250, this.speed);
            var se = _holdElapsed(head);
            if (head._switch && head._switch.animatingToggle) {
                head._switch.animatingToggle.progress = Math.min(1, se / sd);
            }
            if (se >= sd) {
                if (head._switch) {
                    head._switch.toggle();
                    head._switch.animatingToggle = null;
                }
                _consumeAction();
            }
        }
        else if(actionName == "COLLECT_GEM")
        {
            if (typeof head === 'object' && head._holdSince == null) {
                head._holdSince = performance.now();
                var hx2 = this.hero.x - map.tsize / 2;
                var hy2 = this.hero.y - map.tsize / 2;
                for (var j = 0; j < this.gems.length; j++) {
                    var gem = this.gems[j];
                    if (gem.x == hx2 && gem.y == hy2 && !gem.isCollected()) {
                        gem.animatingCollect = { progress: 0 };
                        head._gem = gem;
                        break;
                    }
                }
            }
            var gd = _holdDuration(280, this.speed);
            var ge = _holdElapsed(head);
            if (head._gem && head._gem.animatingCollect) {
                head._gem.animatingCollect.progress = Math.min(1, ge / gd);
            }
            if (ge >= gd) {
                if (head._gem) {
                    head._gem.collect();
                    head._gem.animatingCollect = null;
                }
                _consumeAction();
            }
        }
        else if(actionName == "CHECK")
        {
            // Action visuelle uniquement : affiche un "?" au-dessus du robot pendant un court instant
            // pour matérialiser l'évaluation d'une condition (isBlocked, canCollectGem, etc.).
            if (typeof head === 'object' && head._holdSince == null) {
                head._holdSince = performance.now();
            }
            Game._showThinking = true;
            if (_holdElapsed(head) >= _holdDuration(180, this.speed)) {
                Game._showThinking = false;
                _consumeAction();
            }
        }
    }

    // File vidée : on émet un event "fin d'exécution" et on retire le surlignage de ligne.
    if (this.actionQueue.length === 0 && this.currentActionLine !== null) {
        this.currentActionLine = null;
        _emitGameEvent('algomaze:current-line', { line: null });
        _emitGameEvent('algomaze:execution-end', {});
    }

    if(this.actionQueue.length == 0 && Game.displayRandomTile == false)
    {
        setTimeout(() => {
            if(this.actionQueue.length == 0 && Game.displayRandomTile == false)
            {
                Game.displayRandomTile = true;
                Game.reset();
            }
        }, 1000);
    }
};

Game._drawLayer = function (layer) {
    for (var c = 0; c < map.cols; c++) {
        for (var r = 0; r < map.rows; r++) {
            var tile = map.getTile(layer, c, r);
            var x = c  * map.tsize;
            var y = r  * map.tsize;
            if (tile !== 0) { // 0 => empty tile
                this.ctx.drawImage(
                    this.tileAtlas, // image
                    (tile - 1) * map.tsize, // source x
                    0, // source y
                    map.tsize, // source width
                    map.tsize, // source height
                    Math.round(x),  // target x
                    Math.round(y), // target y
                    map.tsize, // target width
                    map.tsize // target height
                );
            }
        }
    }
};

Game._drawGrid = function () {
    var width = map.cols * map.tsize;
    var height = map.rows * map.tsize;
    var x, y;
    for (var r = 0; r < map.rows; r++) {
        x = 0;
        y = r * map.tsize;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(width, y);
        this.ctx.stroke();
    }
    for (var c = 0; c < map.cols; c++) {
        x = c * map.tsize;
        y = 0;
        this.ctx.beginPath();
        this.ctx.moveTo(x, y);
        this.ctx.lineTo(x, height);
        this.ctx.stroke();
    }
};

Game._drawGemsAndSwitches = function()
{
    for(var i = 0; i < this.switches.length; i++)
    {
        var _switch = this.switches[i];
        if (_switch.animatingToggle) {
            // Crossfade entre l'image de l'état initial et celle de l'état suivant.
            var p = _switch.animatingToggle.progress || 0;
            var fromImg = _switch.images[_switch.animatingToggle.fromState];
            var toImg = _switch.images[_switch.animatingToggle.fromState === SwitchState.On ? SwitchState.Off : SwitchState.On];
            this.ctx.globalAlpha = 1 - p;
            this.ctx.drawImage(fromImg, _switch.x, _switch.y);
            this.ctx.globalAlpha = p;
            this.ctx.drawImage(toImg, _switch.x, _switch.y);
            this.ctx.globalAlpha = 1;
        } else {
            this.ctx.drawImage(_switch.getImage(), _switch.x, _switch.y);
        }
    }

    for(var i = 0; i < this.gems.length; i++)
    {
        var gem = this.gems[i];
        if (gem.animatingCollect) {
            // La gemme s'envole vers le haut et fait un fondu.
            var pg = gem.animatingCollect.progress || 0;
            this.ctx.globalAlpha = 1 - pg;
            this.ctx.drawImage(gem.getImage(), gem.x, gem.y - 30 * pg);
            this.ctx.globalAlpha = 1;
        } else if (!gem.isCollected()) {
            this.ctx.drawImage(gem.getImage(), gem.x, gem.y);
        }
    }

    map.teleport1.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_1"), teleport.x, teleport.y);
    });
    map.teleport2.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_2"), teleport.x, teleport.y);
    });
    map.teleport3.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_3"), teleport.x, teleport.y);
    });
    map.teleport4.forEach(teleport => {
        this.ctx.drawImage(Loader.getImage("teleport_4"), teleport.x, teleport.y);
    });

    if(this.displayRandomTile)
    {
        map.randomTile.forEach(tile => {
            this.ctx.drawImage(Loader.getImage("random"), tile.x, tile.y);
        });
    }
}

Game.render = function () {
    // draw map background layer
    this._drawLayer(0);

    // draw gems and switches 
    this._drawGemsAndSwitches();

    // draw main character
    this.ctx.drawImage(
        this.hero.getImage(),
        this.hero.x - this.hero.width / 2,
        this.hero.y - this.hero.height / 2);

    // Indicateur "?" : le robot est en train d'évaluer une condition (CHECK action).
    if (this._showThinking) {
        var tx = this.hero.x;
        var ty = this.hero.y - this.hero.height / 2 - 8;
        this.ctx.save();
        this.ctx.font = 'bold 28px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'bottom';
        this.ctx.lineWidth = 4;
        this.ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
        this.ctx.fillStyle = '#FBBF24';
        this.ctx.strokeText('?', tx, ty);
        this.ctx.fillText('?', tx, ty);
        this.ctx.restore();
    }

    // draw map top layer
    this._drawLayer(1);

    this._drawGrid();
};

// Récupère la ligne du code utilisateur d'où la fonction a été appelée.
// Marche en parcourant la stack trace de haut en bas et en gardant la PREMIÈRE
// frame qui pointe vers `<anonymous>:LINE` — le code utilisateur passé à eval().
function _getUserLineFromStack() {
    try {
        var stack = new Error().stack || '';
        var lines = stack.split('\n');
        for (var i = 0; i < lines.length; i++) {
            var m = lines[i].match(/<anonymous>:(\d+):\d+/);
            if (m) return parseInt(m[1], 10);
        }
    } catch (e) {}
    return null;
}

Game.queueAction = function(actionName) {
    // Chaque action garde la ligne source qui l'a déclenchée pour le surlignage.
    this.actionQueue.push({ action: actionName, line: _getUserLineFromStack() });
};

// ----- Contrôles du visualiseur pas-à-pas -----
Game.setPaused = function(paused) {
    this.paused = !!paused;
    this.stepOnce = false;
    _emitGameEvent('algomaze:pause-state', { paused: this.paused });
};
Game.togglePause = function() { this.setPaused(!this.paused); };
Game.step = function() {
    // Force la consommation d'UNE action puis re-pause.
    if (this.actionQueue.length === 0) return;
    this.stepOnce = true;
};
Game.setSpeed = function(multiplier) {
    this.speed = Math.max(0.1, Math.min(10, Number(multiplier) || 1));
    _emitGameEvent('algomaze:speed', { speed: this.speed });
};

Game.reset = function() {
    this.actionQueue = [];
    this.allActions = [];
    this.snapshots = [];
    this.currentStep = 0;
    this.totalSteps = 0;
    this.hero.resetPosition();
    // Reset propre du visualiseur.
    this.paused = false;
    this.stepOnce = false;
    if (this.currentActionLine !== null) {
        this.currentActionLine = null;
        _emitGameEvent('algomaze:current-line', { line: null });
    }
    _emitGameEvent('algomaze:pause-state', { paused: false });
    _emitGameEvent('algomaze:step', { step: 0, total: 0 });
    _emitGameEvent('algomaze:reset', {});
    /*
    for(var i = 0; i < this.switches.length; i++)
    {
        this.switches[i].reset();
    }

    for(var i = 0; i < this.gems.length; i++)
    {
        this.gems[i].reset();
    }
    */
    this.initializeGemsAndSwitches();
}

/*
function bas()
{
    Game.queueAction("DOWN");
}

function haut()
{
    Game.queueAction("UP");
}

function gauche()
{
    Game.queueAction("LEFT");
}

function droite()
{
    Game.queueAction("RIGHT");
}
*/

function isOnCellIn(x, y, cells)
{
    var result = false;
    for(var cell of cells)
    {
        if(cell.x == x && cell.y == y)
        {
            result = true;
            break;
        }
    }

    return result;
}

function getTeleportedToCell(xSrc, ySrc, cells)
{
    if(cells[0].x == xSrc && cells[0].y == ySrc)
    {
        return cells[1];
    }

    return cells[0];
}

function checkTeleporter(grid)
{
    var x = grid ? Game.hero.xGrid * map.tsize : Game.hero.x - map.tsize / 2;
    var y = grid ? Game.hero.yGrid * map.tsize : Game.hero.y - map.tsize / 2;

    var targetCell = null;
    if(isOnCellIn(x, y, map.teleport1))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport1);
    }
    if(isOnCellIn(x, y, map.teleport2))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport2);
    }
    if(isOnCellIn(x, y, map.teleport3))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport3);
    }
    if(isOnCellIn(x, y, map.teleport4))
    {
        targetCell = getTeleportedToCell(x, y, map.teleport4);
    }


    if(targetCell != null)
    {
        if(grid)
        {
            Game.hero.xGrid = targetCell.x / map.tsize;
            Game.hero.yGrid = targetCell.y / map.tsize;
        }
        else
        {
            Game.hero.x = targetCell.x + map.tsize / 2;
            Game.hero.y = targetCell.y + map.tsize / 2;
        }
    }
}

function moveForward()
{
    Game.queueAction("AVANCER");

    var actionName = Game.hero.gridDirection;
    actionName = actionName.toUpperCase();

    if(actionName == "DOWN")
    {
        Game.hero.yGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.yGrid -= 1;
        }
    }
    else if(actionName == "UP")
    {
        Game.hero.yGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.yGrid += 1;
        }
    }
    else if(actionName == "LEFT")
    {
        Game.hero.xGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.xGrid += 1;
        }
    }
    else if(actionName == "RIGHT")
    {
        Game.hero.xGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            Game.hero.xGrid -= 1;
        }
    }

    checkTeleporter(true);
}

function turnLeft()
{
    Game.queueAction("TURN_LEFT");

    var direction = Game.hero.gridDirection;
    if(direction == Direction.Down)
    {
        direction = Direction.Right;
    }
    else if(direction == Direction.Right)
    {
        direction = Direction.Up;
    }
    else if(direction == Direction.Up)
    {
        direction = Direction.Left;
    }
    else if(direction == Direction.Left)
    {
        direction = Direction.Down;
    }

    Game.hero.gridDirection = direction;
}

function toggleSwitch()
{
    Game.queueAction("TOGGLE_SWITCH");
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            _switch.gridState = !_switch.gridState;
            break;
        }
    }
}

function collectGem()
{
    Game.queueAction("COLLECT_GEM");

    for(var gem of Game.gems) {
        if(gem.x / map.tsize == Game.hero.xGrid && gem.y / map.tsize == Game.hero.yGrid)
        {
            gem.gridCollected = true;
            break;
        }
    }
}

function canCollectGem()
{
    Game.queueAction("CHECK");
    var result = false;
    for(var gem of Game.gems) {
        if(gem.x / map.tsize == Game.hero.xGrid && gem.y / map.tsize == Game.hero.yGrid && !gem.gridCollected)
        {
            result = true;
            break;
        }
    }
    return result;
}

function isOnSwitch()
{
    Game.queueAction("CHECK");
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = true;
            break;
        }
    }
    return result;
}

function canActivateSwitch()
{
    Game.queueAction("CHECK");
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = _switch.gridState == SwitchState.Off;
            break;
        }
    }
    return result;
}

function canDeactivateSwitch()
{
    Game.queueAction("CHECK");
    var result = false;
    for(var _switch of Game.switches) {
        if(_switch.x / map.tsize == Game.hero.xGrid && _switch.y / map.tsize == Game.hero.yGrid)
        {
            result = _switch.gridState == SwitchState.On;
            break;
        }
    }
    return result;
}

function isBlocked()
{
    Game.queueAction("CHECK");
    var result = false;

    var actionName = Game.hero.gridDirection;
    actionName = actionName.toUpperCase();

    if(actionName == "DOWN")
    {
        Game.hero.yGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            result = true;
        }
        Game.hero.yGrid -= 1;
    }
    else if(actionName == "UP")
    {
        Game.hero.yGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            result = true;
        }
        Game.hero.yGrid += 1;
    }
    else if(actionName == "LEFT")
    {
        Game.hero.xGrid -= 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            result = true;
        }
        Game.hero.xGrid += 1;
    }
    else if(actionName == "RIGHT")
    {
        Game.hero.xGrid += 1;

        if(map.isSolidTileAtXY(Game.hero.xGrid * map.tsize, Game.hero.yGrid * map.tsize))
        {
            result = true;
        }
        Game.hero.xGrid -= 1;
    }

    return result;
}

// Détermine l'offset (dx,dy) de la case située à gauche ou à droite du personnage
// selon sa direction courante. Permet d'implémenter isBlockedLeft/Right sans rotation,
// évitant les pirouettes visuelles parasites pendant l'exécution.
function _sideOffset(side)
{
    const dir = Game.hero.gridDirection;
    if (side === 'left') {
        if (dir == Direction.Down)  return { dx: 1,  dy: 0  };
        if (dir == Direction.Right) return { dx: 0,  dy: -1 };
        if (dir == Direction.Up)    return { dx: -1, dy: 0  };
        if (dir == Direction.Left)  return { dx: 0,  dy: 1  };
    } else { // 'right'
        if (dir == Direction.Down)  return { dx: -1, dy: 0  };
        if (dir == Direction.Left)  return { dx: 0,  dy: -1 };
        if (dir == Direction.Up)    return { dx: 1,  dy: 0  };
        if (dir == Direction.Right) return { dx: 0,  dy: 1  };
    }
    return { dx: 0, dy: 0 };
}

function isBlockedLeft()
{
    Game.queueAction("CHECK");
    const { dx, dy } = _sideOffset('left');
    return map.isSolidTileAtXY((Game.hero.xGrid + dx) * map.tsize, (Game.hero.yGrid + dy) * map.tsize);
}

function isBlockedRight()
{
    Game.queueAction("CHECK");
    const { dx, dy } = _sideOffset('right');
    return map.isSolidTileAtXY((Game.hero.xGrid + dx) * map.tsize, (Game.hero.yGrid + dy) * map.tsize);
}
// ------------------------------------------------

// Soft reset : remet l'état visuel des gems/switches existants à leur état initial
// SANS recréer les arrays — contrairement à initializeGemsAndSwitches() qui re-randomise
// les tuiles `randomTile`. Indispensable pour que le dry-run du visualiseur opère
// sur la MÊME disposition que celle utilisée par l'eval du code utilisateur.
function _softResetScene() {
    Game.hero.resetPosition();
    Game._showThinking = false;
    for (var i = 0; i < Game.gems.length; i++) {
        var g = Game.gems[i];
        g.collected = false;
        g.gridCollected = false;
        g.animatingCollect = null;
    }
    for (var i = 0; i < Game.switches.length; i++) {
        var s = Game.switches[i];
        s.state = s.initialState;
        s.gridState = s.initialState;
        s.animatingToggle = null;
    }
}

// ===== Visualiseur pas-à-pas : pré-calcul des snapshots pour navigation backward =====
// À chaque appel de solve(), on enregistre l'état visuel attendu APRÈS chaque action.
// L'élève peut ensuite scruber n'importe quel pas instantanément via le slider.
function _captureSnapshot() {
    return {
        heroX: Game.hero.x,
        heroY: Game.hero.y,
        heroXGrid: Game.hero.xGrid,
        heroYGrid: Game.hero.yGrid,
        heroDirection: Game.hero.direction,
        heroGridDirection: Game.hero.gridDirection,
        gems: Game.gems.map(g => ({ collected: g.collected, gridCollected: g.gridCollected })),
        switches: Game.switches.map(s => ({ state: s.state, gridState: s.gridState }))
    };
}

function _applySnapshot(snap) {
    Game.hero.x = snap.heroX;
    Game.hero.y = snap.heroY;
    Game.hero.xGrid = snap.heroXGrid;
    Game.hero.yGrid = snap.heroYGrid;
    Game.hero.direction = snap.heroDirection;
    Game.hero.gridDirection = snap.heroGridDirection;
    for (var i = 0; i < Game.gems.length && i < snap.gems.length; i++) {
        Game.gems[i].collected = snap.gems[i].collected;
        Game.gems[i].gridCollected = snap.gems[i].gridCollected;
        Game.gems[i].animatingCollect = null;
    }
    for (var j = 0; j < Game.switches.length && j < snap.switches.length; j++) {
        Game.switches[j].state = snap.switches[j].state;
        Game.switches[j].gridState = snap.switches[j].gridState;
        Game.switches[j].animatingToggle = null;
    }
    Game._showThinking = false;
}

// Applique une action SANS ANIMATION (utilisé par le dry-run et le scrub forward instant).
function _applyActionInstantly(actionName) {
    if (!actionName || actionName === 'CHECK') return;
    var hero = Game.hero;
    var resolved = actionName === 'AVANCER' ? String(hero.direction).toUpperCase() : actionName;

    if (resolved === 'DOWN' || resolved === 'UP' || resolved === 'LEFT' || resolved === 'RIGHT') {
        var dx = (resolved === 'LEFT') ? -1 : (resolved === 'RIGHT') ? 1 : 0;
        var dy = (resolved === 'UP') ? -1 : (resolved === 'DOWN') ? 1 : 0;
        var newX = hero.x + dx * map.tsize;
        var newY = hero.y + dy * map.tsize;
        var checkX = newX - map.tsize / 2;
        var checkY = newY - map.tsize / 2;
        if (!map.isSolidTileAtXY(checkX, checkY)) {
            hero.x = newX;
            hero.y = newY;
            hero.xGrid = Math.floor(checkX / map.tsize);
            hero.yGrid = Math.floor(checkY / map.tsize);
        }
        // Met à jour la direction du hero
        if (resolved === 'DOWN') hero.direction = Direction.Down;
        else if (resolved === 'UP') hero.direction = Direction.Up;
        else if (resolved === 'LEFT') hero.direction = Direction.Left;
        else if (resolved === 'RIGHT') hero.direction = Direction.Right;
        hero.gridDirection = hero.direction;
        // Téléporteurs
        checkTeleporter(false);
    } else if (resolved === 'TURN_LEFT') {
        if (hero.direction === Direction.Down) hero.direction = Direction.Right;
        else if (hero.direction === Direction.Right) hero.direction = Direction.Up;
        else if (hero.direction === Direction.Up) hero.direction = Direction.Left;
        else if (hero.direction === Direction.Left) hero.direction = Direction.Down;
        hero.gridDirection = hero.direction;
    } else if (resolved === 'COLLECT_GEM') {
        var hx = hero.x - map.tsize / 2;
        var hy = hero.y - map.tsize / 2;
        for (var g = 0; g < Game.gems.length; g++) {
            var gem = Game.gems[g];
            if (gem.x === hx && gem.y === hy && !gem.collected) {
                gem.collected = true;
                gem.gridCollected = true;
                break;
            }
        }
    } else if (resolved === 'TOGGLE_SWITCH') {
        var sx = hero.x - map.tsize / 2;
        var sy = hero.y - map.tsize / 2;
        for (var s = 0; s < Game.switches.length; s++) {
            var sw = Game.switches[s];
            if (sw.x === sx && sw.y === sy) {
                sw.toggle();
                sw.gridState = sw.state;
                break;
            }
        }
    }
}

// Scrub vers le pas K : applique le snapshot[K], reconstruit la file restante.
Game.scrubToStep = function(targetStep) {
    if (!this.snapshots || !this.allActions) return;
    var K = Math.max(0, Math.min(this.totalSteps, parseInt(targetStep) || 0));
    _applySnapshot(this.snapshots[K]);
    // Reconstruit la file avec des CLONES (sinon AVANCER muterait allActions).
    this.actionQueue = this.allActions.slice(K).map(a => ({ action: a.action, line: a.line }));
    this.currentStep = K;
    this.paused = true;
    this.stepOnce = false;
    _emitGameEvent('algomaze:step', { step: K, total: this.totalSteps });
    _emitGameEvent('algomaze:pause-state', { paused: true });
    _emitGameEvent('algomaze:current-line', { line: this.actionQueue[0] ? this.actionQueue[0].line : null });
};

function solve(code)
{
    Game.reset();
    Game.displayRandomTile = false;

    eval(code);  // remplit Game.actionQueue avec les actions de l'élève

    // Sauvegarde la séquence complète pour permettre le scrub.
    Game.allActions = Game.actionQueue.slice();
    Game.totalSteps = Game.allActions.length;
    Game.currentStep = 0;

    // Dry-run : remise à zéro SANS re-randomisation des tuiles `randomTile`.
    // On ne touche pas aux arrays Game.gems / Game.switches — l'élève a écrit son code
    // en fonction de cette disposition et c'est elle qu'on doit lui visualiser.
    _softResetScene();

    Game.snapshots = [_captureSnapshot()];
    for (var i = 0; i < Game.allActions.length; i++) {
        _applyActionInstantly(Game.allActions[i].action);
        Game.snapshots.push(_captureSnapshot());
    }

    // Restaure l'état initial (snapshot 0) pour que l'animation joue depuis le début.
    _applySnapshot(Game.snapshots[0]);

    _emitGameEvent('algomaze:execution-start', { total: Game.totalSteps });
    _emitGameEvent('algomaze:step', { step: 0, total: Game.totalSteps });
}

function getRandomBinary() {
    return Math.round(Math.random());
}

function initializeGame(data) {
    map.cols = data.cols;
    map.rows = data.rows;
    map.tsize = data.tsize;
    map.layers = data.layers;
    map.switches = data.switches;
    map.gems = data.gems;
    map.teleport1 = data.teleport1 == null ? [] : data.teleport1;
    map.teleport2 = data.teleport2 == null ? [] : data.teleport2;
    map.teleport3 = data.teleport3 == null ? [] : data.teleport3;
    map.teleport4 = data.teleport4 == null ? [] : data.teleport4;
    map.randomTile = data.randomTile == null ? [] : data.randomTile;
    map.startPosition = data.startPosition;
    map.startDirection = data.startDirection;

    // Afficher les consignes
    document.getElementById('instructions').innerHTML = data.instructions;

    Game.init();
}